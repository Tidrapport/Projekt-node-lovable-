// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const https = require("https");
const PDFDocument = require("pdfkit");
const db = require("./database");

const app = express();

const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (FRONTEND_ORIGINS.length === 0) return true;
  if (FRONTEND_ORIGINS.includes("*")) return true;
  if (FRONTEND_ORIGINS.includes(origin)) return true;
  if (origin.startsWith("http://localhost") || origin.startsWith("https://localhost")) return true;
  if (origin.startsWith("http://127.0.0.1") || origin.startsWith("https://127.0.0.1")) return true;
  if (origin.endsWith(".ngrok-free.dev")) return true;
  return false;
}

// --- middleware ---
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ servera alla .html, .js, .css osv från samma mapp som server.js
app.use(express.static(__dirname));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Serve uppladdade filer (bilder m.m.)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Servera byggd frontend (SPA) om den finns
const FRONTEND_DIST = path.join(__dirname, "../tidrailwork-main/dist");
const HAS_FRONTEND_DIST = fs.existsSync(FRONTEND_DIST);
if (HAS_FRONTEND_DIST) {
  app.use(express.static(FRONTEND_DIST));
}
// SPA fallback tidigt för refresh på klientroutes (även när API-route finns)
if (HAS_FRONTEND_DIST) {
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    const accept = req.headers.accept || "";
    const secFetchDest = req.headers["sec-fetch-dest"] || "";
    if (!accept.includes("text/html") && secFetchDest !== "document") return next();
    if (req.path.startsWith("/uploads")) return next();
    if (req.path.startsWith("/fortnox")) return next();
    if (path.extname(req.path)) return next();
    return res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("Missing JWT_SECRET in .env");

const FORTNOX_AUTH_URL = process.env.FORTNOX_AUTH_URL || "https://apps.fortnox.se/oauth-v1/auth";
const FORTNOX_TOKEN_URL = process.env.FORTNOX_TOKEN_URL || "https://apps.fortnox.se/oauth-v1/token";
const FORTNOX_API_BASE = process.env.FORTNOX_API_BASE || "https://api.fortnox.se/3";
const FORTNOX_REDIRECT_URI = process.env.FORTNOX_REDIRECT_URI;
const FORTNOX_SCOPE = process.env.FORTNOX_SCOPE || "";
const FORTNOX_SUCCESS_REDIRECT = process.env.FORTNOX_SUCCESS_REDIRECT;
const FORTNOX_PAYROLL_PATH = process.env.FORTNOX_PAYROLL_PATH || "/archive";
const FORTNOX_REQUIRED_SCOPES = ["customer", "offer", "archive"];
const FORTNOX_CUSTOMER_SCOPE_ALIASES = ["customer", "customers"];

console.log("Fortnox config:", {
  authUrl: FORTNOX_AUTH_URL,
  redirectUri: FORTNOX_REDIRECT_URI,
  scope: FORTNOX_SCOPE,
});

const SUPERADMIN_COMPANY_NAMES = [
  process.env.SUPERADMIN_COMPANY_NAME || "Opero Systems AB",
  process.env.SUPERADMIN_COMPANY_ALT_NAME || "Opero-System AB",
].filter((name, index, arr) => name && arr.indexOf(name) === index);

function resolveSuperAdminCompanyId(callback) {
  if (!SUPERADMIN_COMPANY_NAMES.length) return callback(null, null);
  const where = SUPERADMIN_COMPANY_NAMES.map(() => "LOWER(name) = LOWER(?)").join(" OR ");
  const sql = `SELECT id, name FROM companies WHERE ${where} ORDER BY id LIMIT 1`;
  db.get(sql, SUPERADMIN_COMPANY_NAMES, (err, row) => {
    if (err) return callback(err);
    callback(null, row ? row.id : null);
  });
}

const KNOWLEDGE_ROOT = path.join(__dirname, "tdok");
const KNOWLEDGE_EXTS = new Set([".txt", ".md", ".markdown"]);
const ADMIN_DOC_EXTS = new Set([...KNOWLEDGE_EXTS, ".pdf"]);
const MAX_CHUNK_CHARS = 1200;
const MAX_CONTEXT_CHUNKS = 4;
const knowledgeCacheByDir = new Map();

function generateCompanyCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      user_id: decoded.user_id || decoded.id || null,
      role: decoded.role || null,
      company_id: decoded.company_id || null,
      impersonated: !!decoded.impersonated
    };
    // Normera så både id och user_id finns (vissa endpoints använder id sedan tidigare)
    req.user.id = req.user.user_id;
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (req.user.role || "").toLowerCase();
  if (role === "admin" || role === "super_admin") return next();
  return res.status(403).json({ error: "Admin required" });
}

function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (req.user.role || "").toLowerCase();
  if (role === "super_admin") return next();
  return res.status(403).json({ error: "Super admin required" });
}

function getFortnoxCredentials() {
  return {
    clientId: process.env.FORTNOX_CLIENT_ID || "",
    clientSecret: process.env.FORTNOX_CLIENT_SECRET || "",
  };
}

function getAllowedFortnoxScopes() {
  const scopes = String(FORTNOX_SCOPE || "")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  FORTNOX_REQUIRED_SCOPES.forEach((required) => {
    if (!scopes.includes(required)) scopes.push(required);
  });
  return scopes;
}

function buildFortnoxAuthUrl({ clientId, redirectUri, state, scope }) {
  const url = new URL(FORTNOX_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  if (scope) url.searchParams.set("scope", scope);
  return url.toString();
}

async function requestFortnoxToken({ grantType, code, refreshToken, redirectUri }) {
  const { clientId, clientSecret } = getFortnoxCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("Missing Fortnox client credentials");
  }
  const body = new URLSearchParams();
  body.set("grant_type", grantType);
  if (grantType === "authorization_code") {
    body.set("code", code);
    body.set("redirect_uri", redirectUri);
  } else if (grantType === "refresh_token") {
    body.set("refresh_token", refreshToken);
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const response = await fetch(FORTNOX_TOKEN_URL, { method: "POST", headers, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error_description || data.error || "Fortnox token error";
    throw new Error(message);
  }
  return data;
}

function saveFortnoxTokens(companyId, tokenData, existingRefreshToken = null) {
  const accessToken = tokenData.access_token || null;
  const refreshToken = tokenData.refresh_token || existingRefreshToken || null;
  const tokenType = tokenData.token_type || null;
  const scope = tokenData.scope || null;
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
    : null;
  if (!accessToken) {
    return Promise.reject(new Error("Missing access_token from Fortnox"));
  }
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO fortnox_connections
        (company_id, access_token, refresh_token, token_type, scope, expires_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(company_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_type = excluded.token_type,
        scope = excluded.scope,
        expires_at = excluded.expires_at,
        updated_at = datetime('now')`,
      [companyId, accessToken, refreshToken, tokenType, scope, expiresAt],
      (err) => {
        if (err) return reject(err);
        resolve({ accessToken, refreshToken, tokenType, scope, expiresAt });
      }
    );
  });
}

async function getFortnoxAccessToken(companyId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM fortnox_connections WHERE company_id = ?",
      [companyId],
      async (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);

        const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : null;
        const shouldRefresh = expiresAtMs ? Date.now() > expiresAtMs - 2 * 60 * 1000 : false;
        if (!shouldRefresh) return resolve(row.access_token);
        if (!row.refresh_token) return resolve(row.access_token);

        try {
          const tokenData = await requestFortnoxToken({
            grantType: "refresh_token",
            refreshToken: row.refresh_token,
          });
          const saved = await saveFortnoxTokens(companyId, tokenData, row.refresh_token);
          logAudit({
            req: null,
            companyId,
            actorUserId: null,
            action: "FORTNOX_TOKEN_REFRESH",
            entityType: "fortnox",
            entityId: companyId,
            metadata: { scope: saved.scope },
            success: true,
          });
          return resolve(saved.accessToken);
        } catch (refreshErr) {
          console.error("Kunde inte uppdatera Fortnox-token:", refreshErr);
          return resolve(row.access_token);
        }
      }
    );
  });
}

function getFortnoxConnection(companyId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM fortnox_connections WHERE company_id = ?",
      [companyId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

async function fetchFortnoxArticles(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
  const parseMetaNumber = (value) => {
    const numeric = Number(String(value || "").replace(/[^0-9]/g, ""));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  };
  let page = 1;
  let totalPages = 1;
  const collected = [];

  while (page <= totalPages) {
    const url = new URL(`${FORTNOX_API_BASE}/articles`);
    url.searchParams.set("page", String(page));
    const response = await fetch(url.toString(), { headers });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!response.ok) {
      const message =
        data?.ErrorInformation?.Message ||
        data?.ErrorInformation?.message ||
        data?.error ||
        text ||
        "Fortnox error";
      throw new Error(message);
    }
    const batch = Array.isArray(data?.Articles) ? data.Articles : [];
    collected.push(...batch);
    const meta = data?.MetaInformation || {};
    const parsedTotal = parseMetaNumber(meta["@TotalPages"] ?? meta.TotalPages ?? meta.totalPages);
    if (parsedTotal) totalPages = parsedTotal;
    if (!parsedTotal && batch.length === 0) break;
    page += 1;
  }

  return collected
    .map((article) => ({
      article_number: String(article?.ArticleNumber ?? "").trim(),
      description: String(article?.Description ?? "").trim(),
      unit: String(article?.Unit ?? "").trim(),
    }))
    .filter((article) => article.article_number || article.description);
}

async function fetchFortnoxCustomers(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
  const parseMetaNumber = (value) => {
    const numeric = Number(String(value || "").replace(/[^0-9]/g, ""));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  };
  let page = 1;
  let totalPages = 1;
  const collected = [];

  while (page <= totalPages) {
    const url = new URL(`${FORTNOX_API_BASE}/customers`);
    url.searchParams.set("page", String(page));
    const response = await fetch(url.toString(), { headers });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!response.ok) {
      const message =
        data?.ErrorInformation?.Message ||
        data?.ErrorInformation?.message ||
        data?.error ||
        text ||
        "Fortnox error";
      throw new Error(message);
    }
    const batch = Array.isArray(data?.Customers) ? data.Customers : [];
    collected.push(...batch);
    const meta = data?.MetaInformation || {};
    const parsedTotal = parseMetaNumber(meta["@TotalPages"] ?? meta.TotalPages ?? meta.totalPages);
    if (parsedTotal) totalPages = parsedTotal;
    if (!parsedTotal && batch.length === 0) break;
    page += 1;
  }

  const toText = (value) => {
    const textValue = String(value ?? "").trim();
    return textValue ? textValue : null;
  };

  return collected
    .map((customer) => ({
      customer_number: toText(customer?.CustomerNumber),
      name: toText(customer?.Name),
      customer_type: toText(customer?.CustomerType) || "company",
      orgnr: toText(customer?.OrganisationNumber),
      vat_number: toText(customer?.VATNumber),
      invoice_address1: toText(customer?.Address1),
      invoice_address2: toText(customer?.Address2),
      postal_code: toText(customer?.ZipCode),
      city: toText(customer?.City),
      country: toText(customer?.Country),
      contact_name: toText(customer?.ContactPerson),
      contact_email: toText(customer?.Email),
      invoice_email: toText(customer?.EmailInvoice || customer?.EmailInvoiceAddress),
      contact_phone: toText(customer?.Phone1),
      phone_secondary: toText(customer?.Phone2),
      their_reference: toText(customer?.YourReference),
      payment_terms: toText(customer?.TermsOfPayment),
    }))
    .filter((customer) => customer.customer_number || customer.name);
}

function hasFortnoxConnection(companyId) {
  return new Promise((resolve) => {
    db.get(
      "SELECT access_token FROM fortnox_connections WHERE company_id = ?",
      [companyId],
      (err, row) => {
        if (err) return resolve(false);
        resolve(!!row?.access_token);
      }
    );
  });
}

function buildFortnoxRedirectUrl(success) {
  const base = FORTNOX_SUCCESS_REDIRECT || (process.env.FRONTEND_ORIGIN ? `${process.env.FRONTEND_ORIGIN}/admin/invoice-settings` : "");
  if (!base) return null;
  try {
    const url = new URL(base);
    url.searchParams.set("fortnox", success ? "connected" : "error");
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeFortnoxScopeList(scopeValue) {
  return String(scopeValue || "")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function hasFortnoxCustomerScope(scopeValue) {
  const scopes = normalizeFortnoxScopeList(scopeValue);
  return FORTNOX_CUSTOMER_SCOPE_ALIASES.some((alias) => scopes.includes(alias));
}

/**
 * Company scope:
 * - super_admin kan välja company via query (?company_id=) eller via impersonation-token
 * - andra: ALWAYS req.user.company_id
 */
function getScopedCompanyId(req) {
  if (!req.user) return null;
  const role = (req.user.role || "").toLowerCase();
  if (role === "super_admin") {
    if (req.query.company_id) return req.query.company_id;
    if (req.user.company_id) return req.user.company_id;
    req.company_scope_all = true;
    return null;
  }
  return req.user.company_id || null;
}

function isAdminRole(req) {
  const role = (req.user?.role || "").toLowerCase();
  return role === "admin" || role === "super_admin";
}

function getAuthUserId(req) {
  return req.user?.user_id ?? req.user?.id ?? null;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const [first] = String(forwarded).split(",");
    return first.trim();
  }
  return req.socket?.remoteAddress || null;
}

function logAudit({ req, companyId, actorUserId, action, entityType, entityId, metadata, success }) {
  if (!action) return;
  const safeMetadata =
    metadata == null ? null : typeof metadata === "string" ? metadata : JSON.stringify(metadata);
  const ip = req ? getClientIp(req) : null;
  const userAgent = req ? req.headers["user-agent"] || null : null;
  db.run(
    `INSERT INTO audit_logs
      (company_id, actor_user_id, action, entity_type, entity_id, metadata, success, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      companyId ?? null,
      actorUserId ?? null,
      action,
      entityType || null,
      entityId != null ? String(entityId) : null,
      safeMetadata,
      success ? 1 : 0,
      ip,
      userAgent
    ],
    (err) => {
      if (err) {
        console.error("DB-fel vid logAudit:", err);
      }
    }
  );
}

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      method: "POST",
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, text: data });
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const EXPO_PUSH_ENDPOINT = process.env.EXPO_PUSH_ENDPOINT || "https://exp.host/--/api/v2/push/send";

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function sendExpoPush(tokens, { title, body, data }) {
  if (!tokens.length) return { sent: 0 };
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: data || null
  }));

  const chunks = chunkArray(messages, 100);
  let sent = 0;

  for (const chunk of chunks) {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk)
    });
    const text = await response.text();
    if (!response.ok) {
      console.error("Expo push error:", response.status, text);
    } else {
      sent += chunk.length;
    }
  }

  return { sent };
}

function fetchPushTokensForUsers(userIds, companyId, allowAll = false) {
  return new Promise((resolve, reject) => {
    if (!userIds.length) return resolve([]);
    const placeholders = userIds.map(() => "?").join(",");
    const where = [];
    const params = [];
    if (companyId) {
      where.push("u.company_id = ?");
      params.push(companyId);
    } else if (!allowAll) {
      return resolve([]);
    }
    where.push(`u.id IN (${placeholders})`);
    params.push(...userIds);

    const sql = `
      SELECT pt.token
      FROM push_tokens pt
      JOIN users u ON u.id = pt.user_id
      WHERE ${where.join(" AND ")}
    `;
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve((rows || []).map((r) => r.token));
    });
  });
}

async function requestOpenAi(payload, apiKey) {
  const url = "https://api.openai.com/v1/chat/completions";
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
  const body = JSON.stringify(payload);

  if (typeof fetch === "function") {
    const response = await fetch(url, { method: "POST", headers, body });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  }

  const fallback = await postJson(url, headers, body);
  let data = {};
  try {
    data = JSON.parse(fallback.text || "{}");
  } catch {
    data = {};
  }
  return { ok: fallback.status >= 200 && fallback.status < 300, status: fallback.status, data };
}

function chunkText(text) {
  const blocks = String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const chunks = [];
  let buffer = "";
  blocks.forEach((block) => {
    if (!buffer) {
      buffer = block;
      return;
    }
    if (buffer.length + block.length + 2 <= MAX_CHUNK_CHARS) {
      buffer = `${buffer}\n\n${block}`;
      return;
    }
    chunks.push(buffer);
    buffer = block;
  });
  if (buffer) chunks.push(buffer);
  return chunks;
}

function getKnowledgeDir(companyId) {
  if (!companyId) return KNOWLEDGE_ROOT;
  return path.join(KNOWLEDGE_ROOT, String(companyId));
}

function ensureDirExists(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    console.warn("Kunde inte skapa katalog:", dirPath, err);
  }
}

function sanitizeDocName(name, allowPdf = false) {
  const base = path.basename(String(name || ""));
  const ext = path.extname(base).toLowerCase();
  const allowed = allowPdf ? ADMIN_DOC_EXTS : KNOWLEDGE_EXTS;
  if (!base || !allowed.has(ext)) return null;
  return base;
}

function sanitizeUploadName(name) {
  const base = path.basename(String(name || ""));
  if (!base) return null;
  return base.replace(/[^A-Za-z0-9._-]/g, "_");
}

function loadKnowledgeChunks(knowledgeDir) {
  let entries = [];
  try {
    entries = fs.readdirSync(knowledgeDir, { withFileTypes: true });
  } catch (err) {
    return { chunks: [], sources: [] };
  }

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => KNOWLEDGE_EXTS.has(path.extname(name).toLowerCase()));

  const signatureParts = [];
  files.forEach((name) => {
    try {
      const fullPath = path.join(knowledgeDir, name);
      const stat = fs.statSync(fullPath);
      signatureParts.push(`${name}:${stat.mtimeMs}:${stat.size}`);
    } catch {
      signatureParts.push(`${name}:missing`);
    }
  });
  const signature = signatureParts.join("|");
  const cached = knowledgeCacheByDir.get(knowledgeDir);
  if (signature && cached && cached.signature === signature && cached.chunks.length) {
    return { chunks: cached.chunks, sources: files };
  }

  const chunks = [];
  files.forEach((name) => {
    const fullPath = path.join(knowledgeDir, name);
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      const parts = chunkText(content);
      parts.forEach((part) => {
        chunks.push({
          source: name,
          text: part,
          searchText: part.toLowerCase()
        });
      });
    } catch (err) {
      console.warn(`Kunde inte läsa kunskapsfil ${name}:`, err);
    }
  });

  knowledgeCacheByDir.set(knowledgeDir, { signature, chunks });
  return { chunks, sources: files };
}

function selectRelevantChunks(query, chunks) {
  const terms = String(query || "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
  const uniqueTerms = Array.from(new Set(terms)).filter((term) => term.length > 2);

  const scored = chunks
    .map((chunk) => {
      let score = 0;
      uniqueTerms.forEach((term) => {
        if (chunk.searchText.includes(term)) score += 1;
      });
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_CONTEXT_CHUNKS).map((item) => item.chunk);
}

const DEFAULT_SHIFT_CONFIGS = [
  {
    shift_type: "day",
    multiplier: 1.0,
    start_hour: 7,
    end_hour: 18,
    description: "Dagtid måndag-fredag"
  },
  {
    shift_type: "evening",
    multiplier: 1.25,
    start_hour: 18,
    end_hour: 21,
    description: "Kvällstid måndag-torsdag"
  },
  {
    shift_type: "night",
    multiplier: 1.5,
    start_hour: 21,
    end_hour: 7,
    description: "Nattid måndag-torsdag"
  },
  {
    shift_type: "weekend",
    multiplier: 1.75,
    start_hour: 18,
    end_hour: 6,
    description: "Helg fredag 18:00 - måndag 06:00"
  },
  {
    shift_type: "overtime_day",
    multiplier: 1.5,
    start_hour: 0,
    end_hour: 24,
    description: "Övertid vardag"
  },
  {
    shift_type: "overtime_weekend",
    multiplier: 2.0,
    start_hour: 0,
    end_hour: 24,
    description: "Övertid helg"
  }
];

const DEFAULT_TRAVEL_RATE = 170;

function ensureShiftConfigs(companyId, callback) {
  db.all(
    "SELECT shift_type FROM shift_types_config WHERE company_id = ?",
    [companyId],
    (err, rows) => {
      if (err) return callback(err);
      const existing = new Set((rows || []).map((r) => r.shift_type));
      const missing = DEFAULT_SHIFT_CONFIGS.filter((cfg) => !existing.has(cfg.shift_type));
      if (missing.length === 0) return callback(null);

      const stmt = db.prepare(
        `INSERT INTO shift_types_config (company_id, shift_type, multiplier, start_hour, end_hour, description)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      missing.forEach((cfg) => {
        stmt.run([
          companyId,
          cfg.shift_type,
          cfg.multiplier,
          cfg.start_hour,
          cfg.end_hour,
          cfg.description
        ]);
      });
      stmt.finalize(callback);
    }
  );
}

function ensureCompensationSettings(companyId, callback) {
  db.run(
    "INSERT OR IGNORE INTO compensation_settings (company_id, travel_rate) VALUES (?, ?)",
    [companyId, DEFAULT_TRAVEL_RATE],
    callback
  );
}

// Test-route
app.get("/", (req, res) => {
  res.send("Opero backend är igång!");
});

// (extra, om du vill vara säker)
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Offentligt endpoint för att lista företag vid inloggning
app.get("/public/companies", (req, res) => {
  db.all(
    "SELECT id, name, code, code AS company_code, logo_url FROM companies ORDER BY name",
    [],
    (err, rows) => {
      if (err) {
        console.error("DB-fel vid GET /public/companies:", err);
        return res.status(500).json({ error: "Kunde inte hämta företag" });
      }
      res.json(rows || []);
    }
  );
});

// Hämta företag (tenant-säker och användbar i UI)
app.get("/companies", requireAuth, (req, res) => {
  const role = (req.user.role || "").toLowerCase();
  if (role === "super_admin") {
    db.all(
      `SELECT id, name, code, billing_email, address_line1, address_line2, postal_code, city, country, phone,
              bankgiro, bic_number, iban_number, logo_url, org_number, vat_number, f_skatt, invoice_payment_terms, invoice_our_reference,
              invoice_late_interest, created_at
       FROM companies ORDER BY name`,
      [],
      (err, rows) => {
        if (err) {
          console.error("DB-fel vid /companies:", err);
          return res.status(500).json({ error: "DB error" });
        }
        res.json(rows || []);
      }
    );
  } else {
    db.all(
      `SELECT id, name, code, billing_email, address_line1, address_line2, postal_code, city, country, phone,
              bankgiro, bic_number, iban_number, logo_url, org_number, vat_number, f_skatt, invoice_payment_terms, invoice_our_reference,
              invoice_late_interest, created_at
       FROM companies WHERE id = ?`,
      [req.user.company_id],
      (err, rows) => {
        if (err) {
          console.error("DB-fel vid /companies:", err);
          return res.status(500).json({ error: "DB error" });
        }
        res.json(rows || []);
      }
    );
  }
});

// Hämta ett företag (company-scoped)
app.get("/companies/:id", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  const id = req.params.id;

  if (!allowAll && String(id) !== String(companyId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  db.get(
    `SELECT id, name, code, billing_email, address_line1, address_line2, postal_code, city, country, phone,
            bankgiro, bic_number, iban_number, logo_url, org_number, vat_number, f_skatt, invoice_payment_terms,
            invoice_our_reference, invoice_late_interest, created_at
     FROM companies
     WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error("DB-fel vid GET /companies/:id:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    }
  );
});

// Skapa företag (superadmin) + valfri admin-användare
app.post("/companies", requireAuth, requireSuperAdmin, (req, res) => {
  const {
    name,
    billing_email = null,
    code,
    address_line1,
    address_line2,
    postal_code,
    city,
    country,
    phone,
    org_number,
    vat_number,
    admin_first_name,
    admin_last_name,
    admin_email,
    admin_password,
  } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const companyCode = code || generateCompanyCode();
  const clean = (value) => (value ? String(value).trim() : null);

  db.run(
    `INSERT INTO companies (
      name,
      code,
      billing_email,
      address_line1,
      address_line2,
      postal_code,
      city,
      country,
      phone,
      org_number,
      vat_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(name).trim(),
      companyCode.trim(),
      clean(billing_email),
      clean(address_line1),
      clean(address_line2),
      clean(postal_code),
      clean(city),
      clean(country),
      clean(phone),
      clean(org_number),
      clean(vat_number),
    ],
    function (err) {
      if (err) {
        console.error("DB-fel vid POST /companies:", err);
        return res.status(500).json({ error: "Kunde inte skapa företag" });
      }

      const companyId = this.lastID;
      const result = { id: companyId, name: name.trim(), code: companyCode.trim(), billing_email: billing_email || null };

      // Skapa admin-user om data finns
      if (admin_first_name && admin_last_name && admin_email && admin_password) {
        const hash = bcrypt.hashSync(admin_password, 10);
        db.run(
          `INSERT INTO users (username, email, password, role, company_id, first_name, last_name)
           VALUES (?, ?, ?, 'admin', ?, ?, ?)`,
          [
            String(admin_email).toLowerCase(),
            String(admin_email).toLowerCase(),
            hash,
            companyId,
            String(admin_first_name).trim(),
            String(admin_last_name).trim()
          ],
          function (userErr) {
            if (userErr) {
              console.error("Kunde inte skapa admin för företag:", userErr);
              // returnera företag ändå
              return res.status(201).json(result);
            }
            return res.status(201).json({ ...result, admin_user_id: this.lastID });
          }
        );
      } else {
        return res.status(201).json(result);
      }
    }
  );
});

// Uppdatera företag (superadmin valfritt, admin endast sitt företag)
app.put("/companies/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const {
    name,
    billing_email,
    code,
    address_line1,
    address_line2,
    postal_code,
    city,
    country,
    phone,
    bankgiro,
    bic_number,
    iban_number,
    logo_url,
    org_number,
    vat_number,
    f_skatt,
    invoice_payment_terms,
    invoice_our_reference,
    invoice_late_interest,
  } = req.body || {};
  const role = (req.user.role || "").toLowerCase();
  const isSuper = role === "super_admin";
  const scopedCompanyId = getScopedCompanyId(req);

  if (!isSuper) {
    if (!scopedCompanyId || String(scopedCompanyId) !== String(id)) {
      return res.status(403).json({ error: "Admin kan bara uppdatera sitt eget företag" });
    }
  }

  const fields = [];
  const params = [];

  if (name !== undefined) {
    fields.push("name = ?");
    params.push(String(name).trim());
  }
  if (billing_email !== undefined) {
    fields.push("billing_email = ?");
    params.push(billing_email ? String(billing_email).trim() : null);
  }
  if (code !== undefined) {
    if (!isSuper) {
      return res.status(403).json({ error: "Endast superadmin kan ändra företagskod" });
    }
    fields.push("code = ?");
    params.push(String(code).trim());
  }
  if (address_line1 !== undefined) {
    fields.push("address_line1 = ?");
    params.push(address_line1 ? String(address_line1).trim() : null);
  }
  if (address_line2 !== undefined) {
    fields.push("address_line2 = ?");
    params.push(address_line2 ? String(address_line2).trim() : null);
  }
  if (postal_code !== undefined) {
    fields.push("postal_code = ?");
    params.push(postal_code ? String(postal_code).trim() : null);
  }
  if (city !== undefined) {
    fields.push("city = ?");
    params.push(city ? String(city).trim() : null);
  }
  if (country !== undefined) {
    fields.push("country = ?");
    params.push(country ? String(country).trim() : null);
  }
  if (phone !== undefined) {
    fields.push("phone = ?");
    params.push(phone ? String(phone).trim() : null);
  }
  if (bankgiro !== undefined) {
    fields.push("bankgiro = ?");
    params.push(bankgiro ? String(bankgiro).trim() : null);
  }
  if (bic_number !== undefined) {
    fields.push("bic_number = ?");
    params.push(bic_number ? String(bic_number).trim() : null);
  }
  if (iban_number !== undefined) {
    fields.push("iban_number = ?");
    params.push(iban_number ? String(iban_number).trim() : null);
  }
  if (logo_url !== undefined) {
    fields.push("logo_url = ?");
    params.push(logo_url ? String(logo_url).trim() : null);
  }
  if (org_number !== undefined) {
    fields.push("org_number = ?");
    params.push(org_number ? String(org_number).trim() : null);
  }
  if (vat_number !== undefined) {
    fields.push("vat_number = ?");
    params.push(vat_number ? String(vat_number).trim() : null);
  }
  if (f_skatt !== undefined) {
    const flag =
      f_skatt === true || f_skatt === 1 || f_skatt === "1" || f_skatt === "true";
    fields.push("f_skatt = ?");
    params.push(flag ? 1 : 0);
  }
  if (invoice_payment_terms !== undefined) {
    fields.push("invoice_payment_terms = ?");
    params.push(invoice_payment_terms ? String(invoice_payment_terms).trim() : null);
  }
  if (invoice_our_reference !== undefined) {
    fields.push("invoice_our_reference = ?");
    params.push(invoice_our_reference ? String(invoice_our_reference).trim() : null);
  }
  if (invoice_late_interest !== undefined) {
    fields.push("invoice_late_interest = ?");
    params.push(invoice_late_interest ? String(invoice_late_interest).trim() : null);
  }

  if (!fields.length) return res.status(400).json({ error: "Nothing to update" });
  params.push(id);

  db.run(`UPDATE companies SET ${fields.join(", ")} WHERE id = ?`, params, function (err) {
    if (err) {
      console.error("DB-fel vid PUT /companies/:id:", err);
      return res.status(500).json({ error: "Kunde inte uppdatera företag" });
    }
    if (this.changes === 0) return res.status(404).json({ error: "Företag hittades inte" });
    res.json({ success: true });
  });
});

// Ta bort företag (superadmin)
app.delete("/companies/:id", requireAuth, requireSuperAdmin, (req, res) => {
  const { id } = req.params;
  // Ta bort users först (enkelt), därefter company
  db.run(`DELETE FROM users WHERE company_id = ?`, [id], function (userErr) {
    if (userErr) {
      console.error("DB-fel vid DELETE users for company:", userErr);
      return res.status(500).json({ error: "Kunde inte ta bort användare" });
    }
    db.run(`DELETE FROM companies WHERE id = ?`, [id], function (err) {
      if (err) {
        console.error("DB-fel vid DELETE /companies/:id:", err);
        return res.status(500).json({ error: "Kunde inte ta bort företag" });
      }
      if (this.changes === 0) return res.status(404).json({ error: "Företag hittades inte" });
      res.json({ success: true });
    });
  });
});

// POST /companies/:id/logo (upload company logo, base64)
app.post("/companies/:id/logo", requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const scopedCompanyId = getScopedCompanyId(req);
  const role = (req.user?.role || "").toLowerCase();
  const isSuper = role === "super_admin";
  if (!isSuper && String(scopedCompanyId || "") !== String(id)) {
    return res.status(403).json({ error: "Admin kan bara uppdatera sitt eget företag" });
  }

  const { filename, content_base64 } = req.body || {};
  if (!filename || !content_base64) {
    return res.status(400).json({ error: "filename och content_base64 krävs" });
  }

  const uploadsDir = path.join(__dirname, "uploads", "company-logos");
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {
    console.error("Kunde inte skapa upload-mapp:", e);
  }

  const safeName = `${id}-${Date.now()}-${String(filename).replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const filePath = path.join(uploadsDir, safeName);

  try {
    const data = content_base64.split(",").pop();
    fs.writeFileSync(filePath, data, { encoding: "base64" });
  } catch (e) {
    console.error("Kunde inte skriva logga:", e);
    return res.status(500).json({ error: "Kunde inte spara logga" });
  }

  const storagePath = `/uploads/company-logos/${safeName}`;
  db.run(
    `UPDATE companies SET logo_url = ? WHERE id = ?`,
    [storagePath, id],
    function (err) {
      if (err) {
        console.error("DB-fel vid UPDATE company logo:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.json({ logo_url: storagePath });
    }
  );
});

// ======================
// CUSTOMERS (tenant-scoped)
// ======================
// GET /customers
app.get("/customers", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  db.all(
    "SELECT * FROM customers WHERE company_id = ? ORDER BY name",
    [companyId],
    (err, rows) => {
      if (err) {
        console.error("DB-fel vid GET /customers:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.json(rows || []);
    }
  );
});

// POST /customers (admin)
app.post("/customers", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const {
    name,
    customer_number,
    customer_type,
    orgnr,
    vat_number,
    invoice_address1,
    invoice_address2,
    postal_code,
    city,
    country,
    contact_name,
    contact_email,
    invoice_email,
    contact_phone,
    phone_secondary,
    their_reference,
    notes,
    payment_terms,
    reverse_vat
  } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const reverseVatValue =
    reverse_vat === true || reverse_vat === 1 || reverse_vat === "1" || reverse_vat === "true" ? 1 : 0;

  db.run(
    `INSERT INTO customers (
      company_id,
      customer_number,
      customer_type,
      name,
      orgnr,
      vat_number,
      invoice_address1,
      invoice_address2,
      postal_code,
      city,
      country,
      contact_name,
      contact_email,
      invoice_email,
      contact_phone,
      phone_secondary,
      their_reference,
      notes,
      payment_terms,
      reverse_vat
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      companyId,
      customer_number || null,
      customer_type || null,
      name,
      orgnr || null,
      vat_number || null,
      invoice_address1 || null,
      invoice_address2 || null,
      postal_code || null,
      city || null,
      country || null,
      contact_name || null,
      contact_email || null,
      invoice_email || null,
      contact_phone || null,
      phone_secondary || null,
      their_reference || null,
      notes || null,
      payment_terms || null,
      reverseVatValue
    ],
    function (err) {
      if (err) {
        console.error("DB-fel vid POST /customers:", err);
        return res.status(500).json({ error: "DB error" });
      }
      db.get("SELECT * FROM customers WHERE id = ?", [this.lastID], (e2, row) => {
        if (e2) {
          console.error("DB-fel vid SELECT ny kund:", e2);
          return res.status(500).json({ error: "DB error" });
        }
        res.json(row);
      });
    }
  );
});

// PUT /customers/:id (admin)
app.put("/customers/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  const {
    name,
    customer_number,
    customer_type,
    orgnr,
    vat_number,
    invoice_address1,
    invoice_address2,
    postal_code,
    city,
    country,
    contact_name,
    contact_email,
    invoice_email,
    contact_phone,
    phone_secondary,
    their_reference,
    notes,
    payment_terms,
    reverse_vat
  } = req.body || {};
  const reverseVatValue =
    reverse_vat === true || reverse_vat === 1 || reverse_vat === "1" || reverse_vat === "true" ? 1 : 0;

  db.get("SELECT id FROM customers WHERE id = ? AND company_id = ?", [id, companyId], (err, exists) => {
    if (err) {
      console.error("DB-fel vid SELECT customer for PUT:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!exists) return res.status(404).json({ error: "Not found" });

    db.run(
      `UPDATE customers
       SET name = COALESCE(?, name),
           customer_number = COALESCE(?, customer_number),
           customer_type = COALESCE(?, customer_type),
           orgnr = COALESCE(?, orgnr),
           vat_number = COALESCE(?, vat_number),
           invoice_address1 = COALESCE(?, invoice_address1),
           invoice_address2 = COALESCE(?, invoice_address2),
           postal_code = COALESCE(?, postal_code),
           city = COALESCE(?, city),
           country = COALESCE(?, country),
           contact_name = COALESCE(?, contact_name),
           contact_email = COALESCE(?, contact_email),
           invoice_email = COALESCE(?, invoice_email),
           contact_phone = COALESCE(?, contact_phone),
           phone_secondary = COALESCE(?, phone_secondary),
           their_reference = COALESCE(?, their_reference),
           notes = COALESCE(?, notes),
           payment_terms = COALESCE(?, payment_terms),
           reverse_vat = COALESCE(?, reverse_vat)
       WHERE id = ? AND company_id = ?`,
      [
        name ?? null,
        customer_number ?? null,
        customer_type ?? null,
        orgnr ?? null,
        vat_number ?? null,
        invoice_address1 ?? null,
        invoice_address2 ?? null,
        postal_code ?? null,
        city ?? null,
        country ?? null,
        contact_name ?? null,
        contact_email ?? null,
        invoice_email ?? null,
        contact_phone ?? null,
        phone_secondary ?? null,
        their_reference ?? null,
        notes ?? null,
        payment_terms ?? null,
        reverseVatValue,
        id,
        companyId
      ],
      function (e2) {
        if (e2) {
          console.error("DB-fel vid UPDATE customer:", e2);
          return res.status(500).json({ error: "DB error" });
        }
        db.get("SELECT * FROM customers WHERE id = ?", [id], (e3, row) => {
          if (e3) {
            console.error("DB-fel vid SELECT uppdaterad kund:", e3);
            return res.status(500).json({ error: "DB error" });
          }
          res.json(row);
        });
      }
    );
  });
});

// DELETE /customers/:id (admin)
app.delete("/customers/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  db.run("DELETE FROM customers WHERE id = ? AND company_id = ?", [id, companyId], function (err) {
    if (err) {
      console.error("DB-fel vid DELETE customer:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (this.changes === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });
});

// ======================
// PROJECTS (tenant-scoped)
// ======================
// GET /projects
app.get("/projects", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const customerId = req.query.customer_id;
  const where = [];
  const params = [];

  if (!allowAll) {
    where.push("p.company_id = ?");
    params.push(companyId);
  }
  if (customerId) {
    where.push("p.customer_id = ?");
    params.push(customerId);
  }

  const sql = `
    SELECT p.*, c.name AS customer_name
    FROM projects p
    LEFT JOIN customers c ON c.id = p.customer_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY p.name
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /projects:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows || []);
  });
});

// POST /projects (admin)
app.post("/projects", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const { customer_id, name, code, is_active, start_date, end_date, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });

  db.run(
    `INSERT INTO projects (company_id, customer_id, name, code, is_active, start_date, end_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      companyId,
      customer_id || null,
      name,
      code || null,
      typeof is_active === "number" ? is_active : (is_active === false ? 0 : 1),
      start_date || null,
      end_date || null,
      notes || null
    ],
    function (err) {
      if (err) {
        console.error("DB-fel vid POST /projects:", err);
        return res.status(500).json({ error: "DB error" });
      }
      db.get("SELECT * FROM projects WHERE id = ?", [this.lastID], (e2, row) => {
        if (e2) {
          console.error("DB-fel vid SELECT ny project:", e2);
          return res.status(500).json({ error: "DB error" });
        }
        res.json(row);
      });
    }
  );
});

// PUT /projects/:id (admin)
app.put("/projects/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  const { customer_id, name, code, is_active, start_date, end_date, notes } = req.body || {};

  db.get("SELECT id FROM projects WHERE id = ? AND company_id = ?", [id, companyId], (err, exists) => {
    if (err) {
      console.error("DB-fel vid SELECT project for PUT:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!exists) return res.status(404).json({ error: "Not found" });

    db.run(
      `UPDATE projects
       SET customer_id = COALESCE(?, customer_id),
           name = COALESCE(?, name),
           code = COALESCE(?, code),
           is_active = COALESCE(?, is_active),
           start_date = COALESCE(?, start_date),
           end_date = COALESCE(?, end_date),
           notes = COALESCE(?, notes)
       WHERE id = ? AND company_id = ?`,
      [
        customer_id ?? null,
        name ?? null,
        code ?? null,
        (typeof is_active === "number") ? is_active : (is_active === false ? 0 : null),
        start_date ?? null,
        end_date ?? null,
        notes ?? null,
        id,
        companyId
      ],
      function (e2) {
        if (e2) {
          console.error("DB-fel vid UPDATE project:", e2);
          return res.status(500).json({ error: "DB error" });
        }
        db.get("SELECT * FROM projects WHERE id = ?", [id], (e3, row) => {
          if (e3) {
            console.error("DB-fel vid SELECT uppdaterad project:", e3);
            return res.status(500).json({ error: "DB error" });
          }
          res.json(row);
        });
      }
    );
  });
});

// DELETE /projects/:id (admin)
app.delete("/projects/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  db.get("SELECT id, is_active FROM projects WHERE id = ? AND company_id = ?", [id, companyId], (err, project) => {
    if (err) {
      console.error("DB-fel vid SELECT project (delete):", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!project) return res.status(404).json({ error: "Not found" });

    const isInactive = Number(project.is_active) === 0;

    if (!isInactive) {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run("UPDATE projects SET is_active = 0 WHERE id = ? AND company_id = ?", [id, companyId], function (uErr) {
          if (uErr) {
            console.error("DB-fel vid UPDATE project (soft delete):", uErr);
            db.run("ROLLBACK");
            return res.status(500).json({ error: "DB error" });
          }
          db.run("UPDATE subprojects SET is_active = 0 WHERE project_id = ? AND company_id = ?", [id, companyId], (spErr) => {
            if (spErr) {
              console.error("DB-fel vid UPDATE subprojects (soft delete):", spErr);
              db.run("ROLLBACK");
              return res.status(500).json({ error: "DB error" });
            }
            db.run("COMMIT");
            res.status(204).end();
          });
        });
      });
      return;
    }

    db.get(
      `SELECT
        (SELECT COUNT(1) FROM time_reports WHERE project_id = ?) AS time_count,
        (SELECT COUNT(1) FROM work_orders WHERE project_id = ? AND company_id = ?) AS work_order_count`,
      [id, id, companyId],
      (countErr, counts) => {
        if (countErr) {
          console.error("DB-fel vid SELECT project dependencies:", countErr);
          return res.status(500).json({ error: "DB error" });
        }
        if ((counts?.time_count || 0) > 0 || (counts?.work_order_count || 0) > 0) {
          return res.status(409).json({
            error: "Projektet har kopplade tidrapporter eller arbetsorder och kan inte raderas helt."
          });
        }

        db.serialize(() => {
          db.run("BEGIN TRANSACTION");
          db.run(
            "DELETE FROM project_price_list_settings WHERE project_id = ? AND company_id = ?",
            [id, companyId]
          );
          db.run(
            "DELETE FROM project_job_role_rates WHERE project_id = ? AND company_id = ?",
            [id, companyId]
          );
          db.run(
            "DELETE FROM project_material_type_rates WHERE project_id = ? AND company_id = ?",
            [id, companyId]
          );
          db.run("DELETE FROM subprojects WHERE project_id = ? AND company_id = ?", [id, companyId]);
          db.run("DELETE FROM projects WHERE id = ? AND company_id = ?", [id, companyId], function (dErr) {
            if (dErr) {
              console.error("DB-fel vid DELETE project (hard):", dErr);
              db.run("ROLLBACK");
              return res.status(500).json({ error: "DB error" });
            }
            db.run("COMMIT");
            res.status(204).end();
          });
        });
      }
    );
  });
});

// ======================
// SUBPROJECTS (tenant-scoped)
// ======================
// GET /subprojects (optional ?project_id=)
app.get("/subprojects", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const projectId = req.query.project_id;

  if (projectId) {
    db.all(
      allowAll
        ? "SELECT * FROM subprojects WHERE project_id = ? ORDER BY name"
        : "SELECT * FROM subprojects WHERE company_id = ? AND project_id = ? ORDER BY name",
      allowAll ? [projectId] : [companyId, projectId],
      (err, rows) => {
        if (err) {
          console.error("DB-fel vid GET /subprojects (by project):", err);
          return res.status(500).json({ error: "DB error" });
        }
        res.json(rows || []);
      }
    );
  } else {
    db.all(
      allowAll ? "SELECT * FROM subprojects ORDER BY name" : "SELECT * FROM subprojects WHERE company_id = ? ORDER BY name",
      allowAll ? [] : [companyId],
      (err, rows) => {
        if (err) {
          console.error("DB-fel vid GET /subprojects:", err);
          return res.status(500).json({ error: "DB error" });
        }
        res.json(rows || []);
      }
    );
  }
});

// POST /subprojects (admin)
app.post("/subprojects", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const { project_id, name, code, is_active } = req.body || {};
  if (!project_id) return res.status(400).json({ error: "project_id required" });
  if (!name) return res.status(400).json({ error: "name required" });

  // ensure project belongs to company
  db.get("SELECT id FROM projects WHERE id = ? AND company_id = ?", [project_id, companyId], (err, proj) => {
    if (err) {
      console.error("DB-fel vid SELECT project for subproject POST:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!proj) return res.status(400).json({ error: "Invalid project_id" });

    db.run(
      `INSERT INTO subprojects (company_id, project_id, name, code, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        companyId,
        project_id,
        name,
        code || null,
        typeof is_active === "number" ? is_active : (is_active === false ? 0 : 1)
      ],
      function (e2) {
        if (e2) {
          console.error("DB-fel vid POST /subprojects:", e2);
          return res.status(500).json({ error: "DB error" });
        }
        db.get("SELECT * FROM subprojects WHERE id = ?", [this.lastID], (e3, row) => {
          if (e3) {
            console.error("DB-fel vid SELECT ny subproject:", e3);
            return res.status(500).json({ error: "DB error" });
          }
          res.json(row);
        });
      }
    );
  });
});

// PUT /subprojects/:id (admin)
app.put("/subprojects/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  const { name, code, is_active } = req.body || {};

  db.get("SELECT id FROM subprojects WHERE id = ? AND company_id = ?", [id, companyId], (err, exists) => {
    if (err) {
      console.error("DB-fel vid SELECT subproject for PUT:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!exists) return res.status(404).json({ error: "Not found" });

    db.run(
      `UPDATE subprojects
       SET name = COALESCE(?, name),
           code = COALESCE(?, code),
           is_active = COALESCE(?, is_active)
       WHERE id = ? AND company_id = ?`,
      [
        name ?? null,
        code ?? null,
        (typeof is_active === "number") ? is_active : (is_active === false ? 0 : null),
        id,
        companyId
      ],
      function (e2) {
        if (e2) {
          console.error("DB-fel vid UPDATE subproject:", e2);
          return res.status(500).json({ error: "DB error" });
        }
        db.get("SELECT * FROM subprojects WHERE id = ?", [id], (e3, row) => {
          if (e3) {
            console.error("DB-fel vid SELECT uppdaterad subproject:", e3);
            return res.status(500).json({ error: "DB error" });
          }
          res.json(row);
        });
      }
    );
  });
});

// DELETE /subprojects/:id (admin)
app.delete("/subprojects/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  db.run("DELETE FROM subprojects WHERE id = ? AND company_id = ?", [id, companyId], function (err) {
    if (err) {
      console.error("DB-fel vid DELETE subproject:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (this.changes === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });
});

// ======================
//   WORK ORDERS
// ======================
app.get("/work-orders", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  let targetCompanyId = companyId;
  if (!targetCompanyId && allowAll && req.query.company_id) {
    targetCompanyId = req.query.company_id;
  }

  const where = [];
  const params = [];
  if (targetCompanyId) {
    where.push("wo.company_id = ?");
    params.push(targetCompanyId);
  }

  const sql = `
    SELECT
      wo.*,
      p.name AS project_name,
      (SELECT first_name || ' ' || last_name FROM users WHERE id = wo.started_by) AS started_by_name,
      (SELECT first_name || ' ' || last_name FROM users WHERE id = wo.closed_by) AS closed_by_name,
      (SELECT first_name || ' ' || last_name FROM users WHERE id = wo.attested_by) AS attested_by_name,
      (SELECT COUNT(1) FROM work_order_comments c WHERE c.work_order_id = wo.id) AS comments_count,
      GROUP_CONCAT(u.id) AS assignee_ids,
      GROUP_CONCAT(u.first_name || ' ' || u.last_name) AS assignee_names,
      GROUP_CONCAT(u.email) AS assignee_emails
    FROM work_orders wo
    LEFT JOIN projects p ON p.id = wo.project_id AND p.company_id = wo.company_id
    LEFT JOIN work_order_assignees woa ON woa.work_order_id = wo.id
    LEFT JOIN users u ON u.id = woa.user_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    GROUP BY wo.id
    ORDER BY wo.created_at DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /work-orders:", err);
      return res.status(500).json({ error: "DB error" });
    }
    const result = (rows || []).map((row) => {
      const ids = row.assignee_ids ? String(row.assignee_ids).split(",") : [];
      const names = row.assignee_names ? String(row.assignee_names).split(",") : [];
      const emails = row.assignee_emails ? String(row.assignee_emails).split(",") : [];
      const assignees = ids.map((id, index) => ({
        id: Number(id),
        full_name: names[index] || "",
        email: emails[index] || "",
      }));
      return { ...row, assignees };
    });
    res.json(result);
  });
});

// User view: assigned work orders
app.get("/work-orders/assigned", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const sql = `
    SELECT
      wo.*,
      p.name AS project_name,
      (SELECT first_name || ' ' || last_name FROM users WHERE id = wo.started_by) AS started_by_name,
      (SELECT first_name || ' ' || last_name FROM users WHERE id = wo.closed_by) AS closed_by_name,
      (SELECT first_name || ' ' || last_name FROM users WHERE id = wo.attested_by) AS attested_by_name,
      (SELECT COUNT(1) FROM work_order_comments c WHERE c.work_order_id = wo.id) AS comments_count,
      GROUP_CONCAT(u.id) AS assignee_ids,
      GROUP_CONCAT(u.first_name || ' ' || u.last_name) AS assignee_names,
      GROUP_CONCAT(u.email) AS assignee_emails
    FROM work_orders wo
    JOIN work_order_assignees woa ON woa.work_order_id = wo.id
    LEFT JOIN projects p ON p.id = wo.project_id AND p.company_id = wo.company_id
    LEFT JOIN work_order_assignees woa2 ON woa2.work_order_id = wo.id
    LEFT JOIN users u ON u.id = woa2.user_id
    WHERE wo.company_id = ? AND woa.user_id = ?
    GROUP BY wo.id
    ORDER BY wo.created_at DESC
  `;

  db.all(sql, [companyId, userId], (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /work-orders/assigned:", err);
      return res.status(500).json({ error: "DB error" });
    }
    const result = (rows || []).map((row) => {
      const ids = row.assignee_ids ? String(row.assignee_ids).split(",") : [];
      const names = row.assignee_names ? String(row.assignee_names).split(",") : [];
      const emails = row.assignee_emails ? String(row.assignee_emails).split(",") : [];
      const assignees = ids.map((id, index) => ({
        id: Number(id),
        full_name: names[index] || "",
        email: emails[index] || "",
      }));
      return { ...row, assignees };
    });
    res.json(result);
  });
});

app.post("/work-orders", requireAuth, requireAdmin, (req, res) => {
  const scopedCompanyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  let companyId = scopedCompanyId;

  if (!companyId && allowAll && req.body?.company_id) {
    companyId = req.body.company_id;
  }
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const {
    title,
    description = null,
    instructions = null,
    project_id = null,
    priority = "medium",
    deadline = null,
    address = null,
    contact_name = null,
    contact_phone = null,
    status = "not_started",
    assignees = [],
  } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "title required" });
  }

  const cleanPriority = ["low", "medium", "high"].includes(String(priority).toLowerCase())
    ? String(priority).toLowerCase()
    : "medium";
  const cleanStatus = ["not_started", "in_progress", "paused", "closed", "attested", "active"].includes(
    String(status).toLowerCase()
  )
    ? String(status).toLowerCase() === "active"
      ? "not_started"
      : String(status).toLowerCase()
    : "not_started";

  const parsedAssignees = Array.isArray(assignees)
    ? assignees.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : [];
  const uniqueAssignees = Array.from(new Set(parsedAssignees));

  const orderYear = (() => {
    if (deadline) {
      const parsed = new Date(deadline);
      if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
    }
    return new Date().getFullYear();
  })();

  const continueInsert = () => {
    db.get(
      `SELECT MAX(order_number) AS max_number FROM work_orders WHERE company_id = ? AND order_year = ?`,
      [companyId, orderYear],
      (err, row) => {
        if (err) {
          console.error("DB-fel vid SELECT work order number:", err);
          return res.status(500).json({ error: "DB error" });
        }
        const nextNumber = Number(row?.max_number || 0) + 1;

        db.run(
          `INSERT INTO work_orders (
            company_id, order_number, order_year, title, description, instructions, project_id, priority, deadline,
            address, contact_name, contact_phone, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            nextNumber,
            orderYear,
            String(title).trim(),
            description ? String(description).trim() : null,
            instructions ? String(instructions).trim() : null,
            project_id || null,
            cleanPriority,
            deadline || null,
            address ? String(address).trim() : null,
            contact_name ? String(contact_name).trim() : null,
            contact_phone ? String(contact_phone).trim() : null,
            cleanStatus,
          ],
          function (iErr) {
            if (iErr) {
              console.error("DB-fel vid INSERT work_order:", iErr);
              return res.status(500).json({ error: "DB error" });
            }
            const workOrderId = this.lastID;

            const insertAssignees = () => {
              if (!uniqueAssignees.length) return finish(workOrderId, []);

              const values = uniqueAssignees.map((userId) => [workOrderId, userId]);
              const placeholders = values.map(() => "(?, ?)").join(", ");
              const flatValues = values.flat();

              db.run(
                `INSERT INTO work_order_assignees (work_order_id, user_id) VALUES ${placeholders}`,
                flatValues,
                (aErr) => {
                  if (aErr) {
                    console.error("DB-fel vid INSERT work_order_assignees:", aErr);
                    return res.status(500).json({ error: "DB error" });
                  }
                  finish(workOrderId, uniqueAssignees);
                }
              );
            };

            const finish = (id, assigneeIds) => {
              db.get(
                `SELECT wo.*, p.name AS project_name
                 FROM work_orders wo
                 LEFT JOIN projects p ON p.id = wo.project_id AND p.company_id = wo.company_id
                 WHERE wo.id = ?`,
                [id],
                (gErr, row) => {
                  if (gErr || !row) {
                    if (gErr) console.error("DB-fel vid SELECT work_order:", gErr);
                    return res.status(500).json({ error: "DB error" });
                  }
                  if (!assigneeIds.length) return res.json({ ...row, assignees: [] });
                  const placeholders = assigneeIds.map(() => "?").join(", ");
                  db.all(
                    `SELECT id, (first_name || ' ' || last_name) AS full_name, email FROM users WHERE id IN (${placeholders})`,
                    assigneeIds,
                    (uErr, uRows) => {
                      if (uErr) {
                        console.error("DB-fel vid SELECT assignees:", uErr);
                        return res.status(500).json({ error: "DB error" });
                      }
                      res.json({ ...row, assignees: uRows || [] });
                    }
                  );
                }
              );
            };

            insertAssignees();
          }
        );
      }
    );
  };

  const validateAssignees = () => {
    if (!uniqueAssignees.length) return continueInsert();
    const placeholders = uniqueAssignees.map(() => "?").join(", ");
    db.all(
      `SELECT id FROM users WHERE id IN (${placeholders}) AND company_id = ?`,
      [...uniqueAssignees, companyId],
      (uErr, rows) => {
        if (uErr) {
          console.error("DB-fel vid SELECT assignees validation:", uErr);
          return res.status(500).json({ error: "DB error" });
        }
        if ((rows || []).length !== uniqueAssignees.length) {
          return res.status(400).json({ error: "Invalid assignees" });
        }
        continueInsert();
      }
    );
  };

  if (project_id) {
    db.get(
      `SELECT id FROM projects WHERE id = ? AND company_id = ?`,
      [project_id, companyId],
      (pErr, pRow) => {
        if (pErr) {
          console.error("DB-fel vid SELECT project for work_order:", pErr);
          return res.status(500).json({ error: "DB error" });
        }
        if (!pRow) return res.status(400).json({ error: "Invalid project_id" });
        validateAssignees();
      }
    );
  } else {
    validateAssignees();
  }
});

// Delete work order (admin)
app.delete("/work-orders/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });
  const id = req.params.id;

  db.get(`SELECT company_id FROM work_orders WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("DB-fel vid SELECT work_order för DELETE:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row || String(row.company_id) !== String(companyId)) return res.status(404).json({ error: "Not found" });

    // Remove assignees
    db.run(`DELETE FROM work_order_assignees WHERE work_order_id = ?`, [id], (aErr) => {
      if (aErr) console.error("DB-fel vid DELETE work_order_assignees:", aErr);

      // Remove comments
      db.run(`DELETE FROM work_order_comments WHERE work_order_id = ?`, [id], (cErr) => {
        if (cErr) console.error("DB-fel vid DELETE work_order_comments:", cErr);

        // Finally remove the work order
        db.run(`DELETE FROM work_orders WHERE id = ? AND company_id = ?`, [id, companyId], function (dErr) {
          if (dErr) {
            console.error("DB-fel vid DELETE work_order:", dErr);
            return res.status(500).json({ error: "DB error" });
          }
          if (this.changes === 0) return res.status(404).json({ error: "Not found" });
          res.status(204).end();
        });
      });
    });
  });
});

// Update work order (admin)
app.put("/work-orders/:id", requireAuth, requireAdmin, (req, res) => {
  const scopedCompanyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  let companyId = scopedCompanyId;

  if (!companyId && allowAll && req.body?.company_id) {
    companyId = req.body.company_id;
  }
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  const {
    title,
    description = null,
    instructions = null,
    project_id = null,
    priority = null,
    deadline = null,
    address = null,
    contact_name = null,
    contact_phone = null,
    status = null,
    assignees = null,
  } = req.body || {};

  db.get(`SELECT company_id FROM work_orders WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("DB-fel vid SELECT work_order för UPDATE:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row || String(row.company_id) !== String(companyId)) return res.status(404).json({ error: "Not found" });

    const updates = [];
    const params = [];
    if (typeof title !== "undefined") {
      updates.push("title = ?");
      params.push(String(title).trim());
    }
    if (typeof description !== "undefined") {
      updates.push("description = ?");
      params.push(description ? String(description).trim() : null);
    }
    if (typeof instructions !== "undefined") {
      updates.push("instructions = ?");
      params.push(instructions ? String(instructions).trim() : null);
    }
    if (typeof project_id !== "undefined") {
      updates.push("project_id = ?");
      params.push(project_id || null);
    }
    if (typeof priority !== "undefined") {
      updates.push("priority = ?");
      params.push(priority || null);
    }
    if (typeof deadline !== "undefined") {
      updates.push("deadline = ?");
      params.push(deadline || null);
    }
    if (typeof address !== "undefined") {
      updates.push("address = ?");
      params.push(address ? String(address).trim() : null);
    }
    if (typeof contact_name !== "undefined") {
      updates.push("contact_name = ?");
      params.push(contact_name ? String(contact_name).trim() : null);
    }
    if (typeof contact_phone !== "undefined") {
      updates.push("contact_phone = ?");
      params.push(contact_phone ? String(contact_phone).trim() : null);
    }
    if (typeof status !== "undefined") {
      updates.push("status = ?");
      params.push(status || null);
    }

    if (updates.length === 0) {
      // Nothing to update, but still process assignees if provided
      processAssignees();
    } else {
      params.push(id);
      const sql = `UPDATE work_orders SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`;
      db.run(sql, params, function (uErr) {
        if (uErr) {
          console.error("DB-fel vid UPDATE work_order:", uErr);
          return res.status(500).json({ error: "DB error" });
        }
        processAssignees();
      });
    }

    function processAssignees() {
      if (!Array.isArray(assignees)) return finish();
      const parsed = assignees.map((v) => Number(v)).filter((n) => Number.isFinite(n));
      const unique = Array.from(new Set(parsed));
      if (!unique.length) {
        // Remove existing assignees
        db.run(`DELETE FROM work_order_assignees WHERE work_order_id = ?`, [id], (dErr) => {
          if (dErr) console.error("DB-fel vid DELETE work_order_assignees:", dErr);
          return finish();
        });
        return;
      }
      const placeholders = unique.map(() => "?").join(", ");
      db.all(`SELECT id FROM users WHERE id IN (${placeholders}) AND company_id = ?`, [...unique, companyId], (uErr, rows) => {
        if (uErr) {
          console.error("DB-fel vid SELECT assignees validation:", uErr);
          return res.status(500).json({ error: "DB error" });
        }
        if ((rows || []).length !== unique.length) return res.status(400).json({ error: "Invalid assignees" });

        // Replace assignees atomically-ish: delete then insert
        db.run(`DELETE FROM work_order_assignees WHERE work_order_id = ?`, [id], (delErr) => {
          if (delErr) console.error("DB-fel vid DELETE work_order_assignees:", delErr);
          const values = unique.map((userId) => [id, userId]);
          const ph = values.map(() => "(?, ?)").join(", ");
          const flat = values.flat();
          db.run(`INSERT INTO work_order_assignees (work_order_id, user_id) VALUES ${ph}`, flat, (iErr) => {
            if (iErr) {
              console.error("DB-fel vid INSERT work_order_assignees:", iErr);
              return res.status(500).json({ error: "DB error" });
            }
            return finish();
          });
        });
      });
    }

    function finish() {
      db.get(
        `SELECT wo.*, p.name AS project_name FROM work_orders wo LEFT JOIN projects p ON p.id = wo.project_id AND p.company_id = wo.company_id WHERE wo.id = ?`,
        [id],
        (gErr, row) => {
          if (gErr || !row) {
            if (gErr) console.error("DB-fel vid SELECT work_order efter UPDATE:", gErr);
            return res.status(500).json({ error: "DB error" });
          }
          // fetch assignees
          db.all(`SELECT u.id, (u.first_name || ' ' || u.last_name) AS full_name, u.email FROM users u JOIN work_order_assignees w ON w.user_id = u.id WHERE w.work_order_id = ?`, [id], (aErr, aRows) => {
            if (aErr) {
              console.error("DB-fel vid SELECT assignees efter UPDATE:", aErr);
              return res.status(500).json({ error: "DB error" });
            }
            res.json({ ...row, assignees: aRows || [] });
          });
        }
      );
    }
  });
});

// Start work order (assigned user)
app.post("/work-orders/:id/start", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id;

  db.get(
    `SELECT wo.id, wo.company_id, wo.status FROM work_orders wo WHERE wo.id = ? AND wo.company_id = ?`,
    [id, companyId],
    (err, row) => {
      if (err) {
        console.error("DB-fel vid SELECT work_order start:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (!row) return res.status(404).json({ error: "Not found" });

      db.get(
        `SELECT id FROM work_order_assignees WHERE work_order_id = ? AND user_id = ?`,
        [id, userId],
        (aErr, aRow) => {
          if (aErr) {
            console.error("DB-fel vid SELECT work_order_assignees start:", aErr);
            return res.status(500).json({ error: "DB error" });
          }
          if (!aRow) return res.status(403).json({ error: "Forbidden" });

          db.run(
            `UPDATE work_orders
             SET status = 'in_progress',
                 started_at = COALESCE(started_at, datetime('now')),
                 started_by = COALESCE(started_by, ?),
                 updated_at = datetime('now')
             WHERE id = ?`,
            [userId, id],
            function (uErr) {
              if (uErr) {
                console.error("DB-fel vid UPDATE work_order start:", uErr);
                return res.status(500).json({ error: "DB error" });
              }
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

// Pause work order (assigned user)
app.post("/work-orders/:id/pause", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id;

  db.get(`SELECT company_id FROM work_orders WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("DB-fel vid SELECT work_order pause:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row || String(row.company_id) !== String(companyId)) return res.status(404).json({ error: "Not found" });

    db.get(
      `SELECT id FROM work_order_assignees WHERE work_order_id = ? AND user_id = ?`,
      [id, userId],
      (aErr, aRow) => {
        if (aErr) {
          console.error("DB-fel vid SELECT work_order_assignees pause:", aErr);
          return res.status(500).json({ error: "DB error" });
        }
        if (!aRow) return res.status(403).json({ error: "Forbidden" });

        db.run(
          `UPDATE work_orders
           SET status = 'paused',
               updated_at = datetime('now')
           WHERE id = ?`,
          [id],
          function (uErr) {
            if (uErr) {
              console.error("DB-fel vid UPDATE work_order pause:", uErr);
              return res.status(500).json({ error: "DB error" });
            }
            res.json({ success: true });
          }
        );
      }
    );
  });
});

// Save report text (assigned user)
app.post("/work-orders/:id/report", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id;
  const reportText = String(req.body?.report_text || "").trim();
  if (!reportText) return res.status(400).json({ error: "report_text required" });

  db.get(`SELECT company_id FROM work_orders WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("DB-fel vid SELECT work_order report:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row || String(row.company_id) !== String(companyId)) return res.status(404).json({ error: "Not found" });

    db.get(
      `SELECT id FROM work_order_assignees WHERE work_order_id = ? AND user_id = ?`,
      [id, userId],
      (aErr, aRow) => {
        if (aErr) {
          console.error("DB-fel vid SELECT work_order_assignees report:", aErr);
          return res.status(500).json({ error: "DB error" });
        }
        if (!aRow) return res.status(403).json({ error: "Forbidden" });

        db.run(
          `UPDATE work_orders
           SET report_text = ?,
               report_updated_at = datetime('now'),
               report_updated_by = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
          [reportText, userId, id],
          function (uErr) {
            if (uErr) {
              console.error("DB-fel vid UPDATE work_order report:", uErr);
              return res.status(500).json({ error: "DB error" });
            }
            res.json({ success: true });
          }
        );
      }
    );
  });
});

// Close work order (assigned user)
app.post("/work-orders/:id/close", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id;
  const reportText = String(req.body?.report_text || "").trim();

  db.get(`SELECT company_id FROM work_orders WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("DB-fel vid SELECT work_order close:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row || String(row.company_id) !== String(companyId)) return res.status(404).json({ error: "Not found" });

    db.get(
      `SELECT id FROM work_order_assignees WHERE work_order_id = ? AND user_id = ?`,
      [id, userId],
      (aErr, aRow) => {
        if (aErr) {
          console.error("DB-fel vid SELECT work_order_assignees close:", aErr);
          return res.status(500).json({ error: "DB error" });
        }
        if (!aRow) return res.status(403).json({ error: "Forbidden" });

        db.run(
          `UPDATE work_orders
           SET status = 'closed',
               report_text = COALESCE(?, report_text),
               report_updated_at = datetime('now'),
               report_updated_by = ?,
               closed_at = datetime('now'),
               closed_by = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
          [reportText || null, userId, userId, id],
          function (uErr) {
            if (uErr) {
              console.error("DB-fel vid UPDATE work_order close:", uErr);
              return res.status(500).json({ error: "DB error" });
            }
            res.json({ success: true });
          }
        );
      }
    );
  });
});

// Attest work order (admin)
app.post("/work-orders/:id/attest", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });
  const userId = getAuthUserId(req);
  const id = req.params.id;

  db.get(`SELECT company_id FROM work_orders WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("DB-fel vid SELECT work_order attest:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row || String(row.company_id) !== String(companyId)) return res.status(404).json({ error: "Not found" });

    db.run(
      `UPDATE work_orders
       SET status = 'attested',
           attested_at = datetime('now'),
           attested_by = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [userId, id],
      function (uErr) {
        if (uErr) {
          console.error("DB-fel vid UPDATE work_order attest:", uErr);
          return res.status(500).json({ error: "DB error" });
        }
        res.json({ success: true });
      }
    );
  });
});

// Download work order PDF
app.get("/work-orders/:id/pdf", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id;
  const isAdminUser = isAdminRole(req);
  const targetCompanyId = companyId || (allowAll && req.query.company_id ? req.query.company_id : null);

  const params = [id];
  let where = "wo.id = ?";
  if (targetCompanyId) {
    where += " AND wo.company_id = ?";
    params.push(targetCompanyId);
  }

  db.get(
    `
      SELECT
        wo.*,
        p.name AS project_name,
        c.name AS company_name,
        (SELECT first_name || ' ' || last_name FROM users WHERE id = wo.started_by) AS started_by_name,
        (SELECT first_name || ' ' || last_name FROM users WHERE id = wo.closed_by) AS closed_by_name,
        (SELECT first_name || ' ' || last_name FROM users WHERE id = wo.attested_by) AS attested_by_name,
        (SELECT first_name || ' ' || last_name FROM users WHERE id = wo.report_updated_by) AS report_updated_by_name
      FROM work_orders wo
      LEFT JOIN projects p ON p.id = wo.project_id AND p.company_id = wo.company_id
      LEFT JOIN companies c ON c.id = wo.company_id
      WHERE ${where}
    `,
    params,
    (err, order) => {
      if (err) {
        console.error("DB-fel vid SELECT work_order pdf:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (!order) return res.status(404).json({ error: "Not found" });

      const ensureAccess = (next) => {
        if (isAdminUser) return next();
        db.get(
          `SELECT id FROM work_order_assignees WHERE work_order_id = ? AND user_id = ?`,
          [id, userId],
          (aErr, aRow) => {
            if (aErr) {
              console.error("DB-fel vid SELECT work_order_assignees pdf:", aErr);
              return res.status(500).json({ error: "DB error" });
            }
            if (!aRow) return res.status(403).json({ error: "Forbidden" });
            return next();
          }
        );
      };

      ensureAccess(() => {
        db.all(
          `SELECT u.first_name || ' ' || u.last_name AS full_name, u.email
           FROM work_order_assignees woa
           LEFT JOIN users u ON u.id = woa.user_id
           WHERE woa.work_order_id = ?`,
          [id],
          (aErr, rows) => {
            if (aErr) {
              console.error("DB-fel vid SELECT work_order_assignees list:", aErr);
              return res.status(500).json({ error: "DB error" });
            }

            const assigneesText = (rows || [])
              .map((row) => row.full_name || row.email)
              .filter(Boolean)
              .join(", ");
            const statusValue = String(order.status || "not_started").toLowerCase();
            const statusLabel =
              statusValue === "attested" || statusValue === "closed"
                ? "Avslutad"
                : statusValue === "paused"
                ? "Pausad"
                : statusValue === "in_progress"
                ? "Pågående"
                : "Ej påbörjad";
            const orderCode = `AO ${order.order_year}-${String(order.order_number).padStart(4, "0")}`;

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=arbetsorder_${order.id}.pdf`);

            const doc = new PDFDocument({ margin: 40, size: "A4" });
            doc.pipe(res);

            // Header
            doc.fillColor("#0f172a");
            doc.fontSize(18).font("Helvetica-Bold").text("Arbetsorder", { align: "left" });
            doc.moveDown(0.25);
            doc.fontSize(10).font("Helvetica");

            // Order code and company block
            const startX = doc.x;
            const metaTop = doc.y;
            doc.rect(startX, metaTop - 2, 520, 58).stroke();

            // Left column: key info
            const leftX = startX + 8;
            let cursorY = metaTop + 4;
            doc.fontSize(10).font("Helvetica-Bold").text(orderCode, leftX, cursorY);
            cursorY += 14;
            if (order.company_name) {
              doc.fontSize(9).font("Helvetica").text(`Företag: ${order.company_name}`, leftX, cursorY);
              cursorY += 12;
            }
            if (order.project_name) {
              doc.fontSize(9).font("Helvetica").text(`Projekt: ${order.project_name}`, leftX, cursorY);
            }

            // Right column: status/prio/deadline
            const rightX = startX + 300;
            let ry = metaTop + 4;
            doc.fontSize(9).font("Helvetica-Bold").text("Status:", rightX, ry);
            doc.font("Helvetica").text(statusLabel, rightX + 48, ry);
            ry += 12;
            doc.font("Helvetica-Bold").text("Prioritet:", rightX, ry);
            doc.font("Helvetica").text(order.priority || "-", rightX + 64, ry);
            ry += 12;
            doc.font("Helvetica-Bold").text("Deadline:", rightX, ry);
            doc.font("Helvetica").text(order.deadline || "-", rightX + 56, ry);

            doc.moveDown(4);

            // Assignees line
            doc.fontSize(10).font("Helvetica-Bold").text("Tilldelade:", { continued: true });
            doc.font("Helvetica").text(` ${assigneesText || "-"}`);

            doc.moveDown(0.5);

            // Sections with clear headings
            const section = (title, content) => {
              doc.moveDown(0.25);
              doc.fontSize(12).font("Helvetica-Bold").text(title);
              doc.moveDown(0.15);
              doc.fontSize(10).font("Helvetica").text(content || "-", { width: 520 });
            };

            section("Beskrivning", order.description);
            section("Instruktioner", order.instructions);
            section("Utfört arbete", order.report_text);

            doc.moveDown(0.5);
            doc.fontSize(12).font("Helvetica-Bold").text("Kontaktuppgifter");
            doc.moveDown(0.15);
            doc.fontSize(10).font("Helvetica");
            doc.text(`Adress: ${order.address || "-"}`);
            doc.text(`Kontakt: ${order.contact_name || "-"}`);
            doc.text(`Telefon: ${order.contact_phone || "-"}`);

            // Footer: meta timestamps
            doc.moveDown(1);
            doc.fontSize(9).fillColor("#374151");
            doc.text(`Skapad: ${order.created_at || "-"}`);
            doc.text(`Startad: ${order.started_at || "-"} — Startad av: ${order.started_by_name || "-"}`);
            doc.text(`Avslutad: ${order.closed_at || "-"} — Avslutad av: ${order.closed_by_name || "-"}`);
            doc.text(`Attesterad: ${order.attested_at || "-"} — Av: ${order.attested_by_name || "-"}`);

            doc.end();
          }
        );
      });
    }
  );
});

// Comments
app.get("/work-orders/:id/comments", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id;

  db.get(`SELECT company_id FROM work_orders WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("DB-fel vid SELECT work_order comments:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row) return res.status(404).json({ error: "Not found" });
    if (!allowAll && String(row.company_id) !== String(companyId)) return res.status(403).json({ error: "Forbidden" });

    const isAdminUser = isAdminRole(req);
    if (!isAdminUser) {
      db.get(
        `SELECT id FROM work_order_assignees WHERE work_order_id = ? AND user_id = ?`,
        [id, userId],
        (aErr, aRow) => {
          if (aErr) {
            console.error("DB-fel vid SELECT work_order_assignees comments:", aErr);
            return res.status(500).json({ error: "DB error" });
          }
          if (!aRow) return res.status(403).json({ error: "Forbidden" });
          fetchComments();
        }
      );
    } else {
      fetchComments();
    }

    function fetchComments() {
      db.all(
        `SELECT c.id, c.comment, c.created_at, u.id AS user_id, (u.first_name || ' ' || u.last_name) AS full_name, u.email
         FROM work_order_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.work_order_id = ?
         ORDER BY c.created_at DESC`,
        [id],
        (cErr, rows) => {
          if (cErr) {
            console.error("DB-fel vid SELECT work_order_comments:", cErr);
            return res.status(500).json({ error: "DB error" });
          }
          res.json(rows || []);
        }
      );
    }
  });
});

app.post("/work-orders/:id/comments", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id;
  const comment = String(req.body?.comment || "").trim();
  if (!comment) return res.status(400).json({ error: "comment required" });

  db.get(`SELECT company_id FROM work_orders WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("DB-fel vid SELECT work_order comment:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row) return res.status(404).json({ error: "Not found" });
    if (!allowAll && String(row.company_id) !== String(companyId)) return res.status(403).json({ error: "Forbidden" });

    const isAdminUser = isAdminRole(req);
    if (!isAdminUser) {
      db.get(
        `SELECT id FROM work_order_assignees WHERE work_order_id = ? AND user_id = ?`,
        [id, userId],
        (aErr, aRow) => {
          if (aErr) {
            console.error("DB-fel vid SELECT work_order_assignees comment:", aErr);
            return res.status(500).json({ error: "DB error" });
          }
          if (!aRow) return res.status(403).json({ error: "Forbidden" });
          insertComment();
        }
      );
    } else {
      insertComment();
    }

    function insertComment() {
      db.run(
        `INSERT INTO work_order_comments (work_order_id, user_id, comment) VALUES (?, ?, ?)`,
        [id, userId, comment],
        function (iErr) {
          if (iErr) {
            console.error("DB-fel vid INSERT work_order_comments:", iErr);
            return res.status(500).json({ error: "DB error" });
          }
          res.json({ success: true });
        }
      );
    }
  });
});

// Login med email + lösenord + company_id (valfritt)
app.post("/login", (req, res) => {
  const { email, password, company_id } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E‑post och lösenord krävs." });
  }

  const cleanEmail = String(email || "").trim().toLowerCase();

  db.all(
    `SELECT * FROM users WHERE lower(email) = ? AND (is_active IS NULL OR is_active = 1)`,
    [cleanEmail],
    async (err, rows) => {
      const users = rows || [];
      if (err) {
        console.error("DB-fel vid login:", err);
        return res.status(500).json({ error: "Tekniskt fel." });
      }

      if (users.length === 0) {
        logAudit({
          req,
          companyId: company_id || null,
          actorUserId: null,
          action: "LOGIN_FAILED",
          entityType: "auth",
          metadata: { email: cleanEmail, reason: "invalid_credentials" },
          success: false
        });
        return res.status(400).json({ error: "Fel e‑post eller lösenord." });
      }

      let user = users[0];
      if (users.length > 1) {
        if (!company_id) {
          logAudit({
            req,
            companyId: null,
            actorUserId: null,
            action: "LOGIN_FAILED",
            entityType: "auth",
            metadata: { email: cleanEmail, reason: "multiple_companies" },
            success: false
          });
          return res.status(409).json({ error: "Multiple companies", code: "MULTIPLE_COMPANIES" });
        }
        const match = users.find((u) => String(u.company_id) === String(company_id));
        if (!match) {
          logAudit({
            req,
            companyId: company_id,
            actorUserId: null,
            action: "LOGIN_FAILED",
            entityType: "auth",
            metadata: { email: cleanEmail, reason: "wrong_company" },
            success: false
          });
          return res.status(403).json({ error: "Wrong company" });
        }
        user = match;
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        logAudit({
          req,
          companyId: user.company_id,
          actorUserId: user.id,
          action: "LOGIN_FAILED",
          entityType: "auth",
          metadata: { email: cleanEmail, reason: "invalid_credentials" },
          success: false
        });
        return res.status(400).json({ error: "Fel e‑post eller lösenord." });
      }

      const token = jwt.sign(
        { user_id: user.id, role: user.role, company_id: user.company_id },
        JWT_SECRET,
        { expiresIn: "12h" }
      );

      logAudit({
        req,
        companyId: user.company_id,
        actorUserId: user.id,
        action: "LOGIN_SUCCESS",
        entityType: "auth",
        metadata: { email: cleanEmail },
        success: true
      });
      res.json({
        message: "Inloggad",
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          company_id: user.company_id,
          first_name: user.first_name,
          last_name: user.last_name,
          hourly_wage: user.hourly_wage
        }
      });
    }
  );
});

// Lovable-compatible auth login endpoint (keeps existing /login)
app.post("/auth/login", (req, res) => {
  const { email, password, company_id } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();

  db.all(
    `SELECT id, email, password AS password_hash, role, company_id, (first_name || ' ' || last_name) AS full_name
     FROM users
     WHERE lower(email) = ? AND (is_active IS NULL OR is_active = 1)`,
    [cleanEmail],
    async (err, rows) => {
      const users = rows || [];
      if (err || users.length === 0) {
        logAudit({
          req,
          companyId: company_id || null,
          actorUserId: null,
          action: "LOGIN_FAILED",
          entityType: "auth",
          metadata: { email: cleanEmail, reason: "invalid_credentials" },
          success: false
        });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      let user = users[0];
      if (users.length > 1) {
        if (!company_id) {
          logAudit({
            req,
            companyId: null,
            actorUserId: null,
            action: "LOGIN_FAILED",
            entityType: "auth",
            metadata: { email: cleanEmail, reason: "multiple_companies" },
            success: false
          });
          return res.status(409).json({ error: "Multiple companies", code: "MULTIPLE_COMPANIES" });
        }
        const match = users.find((u) => String(u.company_id) === String(company_id));
        if (!match) {
          logAudit({
            req,
            companyId: company_id,
            actorUserId: null,
            action: "LOGIN_FAILED",
            entityType: "auth",
            metadata: { email: cleanEmail, reason: "wrong_company" },
            success: false
          });
          return res.status(403).json({ error: "Wrong company" });
        }
        user = match;
      }

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        logAudit({
          req,
          companyId: user.company_id,
          actorUserId: user.id,
          action: "LOGIN_FAILED",
          entityType: "auth",
          metadata: { email: cleanEmail, reason: "invalid_credentials" },
          success: false
        });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const role = (user.role || "").toLowerCase();
      const isSuperAdmin = role === "super_admin";
      if (company_id && String(company_id) !== String(user.company_id) && !isSuperAdmin) {
        logAudit({
          req,
          companyId: user.company_id,
          actorUserId: user.id,
          action: "LOGIN_FAILED",
          entityType: "auth",
          metadata: { email: cleanEmail, reason: "wrong_company" },
          success: false
        });
        return res.status(403).json({ error: "Wrong company" });
      }

      const finalizeLogin = (companyId) => {
        const token = jwt.sign(
          { user_id: user.id, role: user.role, company_id: companyId },
          JWT_SECRET,
          { expiresIn: "12h" }
        );

        logAudit({
          req,
          companyId,
          actorUserId: user.id,
          action: "LOGIN_SUCCESS",
          entityType: "auth",
          metadata: { email: cleanEmail },
          success: true
        });
        res.json({
          access_token: token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            company_id: companyId,
            full_name: user.full_name
          }
        });
      };

      if (isSuperAdmin) {
        resolveSuperAdminCompanyId((companyErr, homeCompanyId) => {
          if (companyErr) {
            console.error("DB-fel vid resolveSuperAdminCompanyId:", companyErr);
          }
          finalizeLogin(homeCompanyId || user.company_id);
        });
        return;
      }

      finalizeLogin(user.company_id);
    }
  );
});

// Lookup company options for a given email (used by login UI)
app.post("/auth/company-options", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.json({ companies: [] });

  db.all(
    `SELECT DISTINCT c.id, c.name, c.code, c.logo_url
     FROM users u
     JOIN companies c ON c.id = u.company_id
     WHERE lower(u.email) = ? AND (u.is_active IS NULL OR u.is_active = 1)
     ORDER BY c.name`,
    [email],
    (err, rows) => {
      if (err) {
        console.error("DB-fel vid POST /auth/company-options:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.json({ companies: rows || [] });
    }
  );
});

// Superadmin impersonation endpoints for Lovable
app.post("/superadmin/impersonate", requireAuth, requireSuperAdmin, (req, res) => {
  const { company_id, user_id } = req.body || {};

  if (!company_id) return res.status(400).json({ error: "company_id required" });

  if (user_id) {
    // Validate user exists and belongs to company
    db.get(
      "SELECT id, role, company_id FROM users WHERE id = ?",
      [user_id],
      (err, u) => {
        if (err || !u) return res.status(404).json({ error: "User not found" });
        if (String(u.company_id) !== String(company_id)) {
          return res.status(400).json({ error: "User not in company" });
        }

        const token = jwt.sign(
          { user_id: u.id, role: "super_admin", company_id: company_id, impersonated: true, acting_as_user_id: u.id },
          JWT_SECRET,
          { expiresIn: "2h" }
        );

        logAudit({
          req,
          companyId: company_id,
          actorUserId: getAuthUserId(req),
          action: "IMPERSONATE_START",
          entityType: "user",
          entityId: u.id,
          metadata: { target_user_id: u.id, target_company_id: company_id },
          success: true
        });
        return res.json({ access_token: token });
      }
    );
  } else {
    // Company-switch only (superadmin scoped to the chosen company)
    const token = jwt.sign(
      { user_id: req.user.user_id, role: "super_admin", company_id: company_id, impersonated: true },
      JWT_SECRET,
      { expiresIn: "2h" }
    );
    logAudit({
      req,
      companyId: company_id,
      actorUserId: getAuthUserId(req),
      action: "IMPERSONATE_START",
      entityType: "company",
      entityId: company_id,
      metadata: { target_company_id: company_id },
      success: true
    });
    return res.json({ access_token: token });
  }
});

// Superadmin AI helper for troubleshooting error codes
app.post("/superadmin/ai", requireAuth, requireSuperAdmin, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY missing" });

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const cleaned = incoming
    .filter((msg) => msg && typeof msg.content === "string")
    .map((msg) => ({
      role: msg.role === "assistant" || msg.role === "system" ? msg.role : "user",
      content: String(msg.content).slice(0, 4000)
    }))
    .slice(-12);

  const messages = [
    {
      role: "system",
      content:
        "Du är en kortfattad svensk felsökningsassistent för Super Admin. Hjälp till att tolka felkoder/loggar och ge tydliga steg: orsak, var det sker (frontend/backend), och vad man ska kontrollera eller ändra."
    },
    ...cleaned
  ];

  try {
    const result = await requestOpenAi({ model, messages, temperature: 0.2 }, apiKey);
    if (!result.ok) return res.status(502).json({ error: result.data?.error?.message || "OpenAI error" });
    const data = result.data || {};
    const reply = data?.choices?.[0]?.message?.content || "";
    res.json({ reply });
  } catch (err) {
    console.error("AI request failed:", err);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.post("/superadmin/stop-impersonate", requireAuth, requireSuperAdmin, (req, res) => {
  const superAdminId = req.user.user_id || req.user.id;
  if (!superAdminId) return res.status(401).json({ error: "Unauthorized" });

  resolveSuperAdminCompanyId((companyErr, homeCompanyId) => {
    if (companyErr) {
      console.error("DB-fel vid resolveSuperAdminCompanyId:", companyErr);
    }
    if (homeCompanyId) {
      const token = jwt.sign(
        { user_id: superAdminId, role: "super_admin", company_id: homeCompanyId, impersonated: false },
        JWT_SECRET,
        { expiresIn: "12h" }
      );
      logAudit({
        req,
        companyId: homeCompanyId,
        actorUserId: superAdminId,
        action: "IMPERSONATE_STOP",
        entityType: "company",
        entityId: homeCompanyId,
        metadata: { company_id: homeCompanyId },
        success: true
      });
      return res.json({ access_token: token });
    }

    db.get("SELECT company_id FROM users WHERE id = ?", [superAdminId], (err, row) => {
      if (err || !row) {
        console.error("DB-fel vid POST /superadmin/stop-impersonate:", err);
        return res.status(500).json({ error: "DB error" });
      }
      const token = jwt.sign(
        { user_id: superAdminId, role: "super_admin", company_id: row.company_id, impersonated: false },
        JWT_SECRET,
        { expiresIn: "12h" }
      );
      logAudit({
        req,
        companyId: row.company_id,
        actorUserId: superAdminId,
        action: "IMPERSONATE_STOP",
        entityType: "company",
        entityId: row.company_id,
        metadata: { company_id: row.company_id },
        success: true
      });
      return res.json({ access_token: token });
    });
  });
});

// ======================
//   ADMIN: USERS
// ======================
// Hämta användare (admin) – scoped per company via getScopedCompanyId
app.get("/admin/users", requireAuth, requireAdmin, (req, res) => {
  const actorRole = (req.user.role || "").toLowerCase();
  const wantsAll =
    actorRole === "super_admin" &&
    ["1", "true", "yes", "all"].includes(String(req.query.all || "").toLowerCase());
  const companyId = wantsAll ? null : getScopedCompanyId(req);
  const allowAll = wantsAll || req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });
  const includeInactive = ["1", "true", "yes"].includes(String(req.query.include_inactive || "").toLowerCase());

  const baseWhere = allowAll ? "1=1" : "company_id = ?";
  const activeWhere = includeInactive ? "" : " AND (is_active IS NULL OR is_active = 1)";
  const sql = `
    SELECT
      id,
      email,
      role,
      company_id,
      is_active,
      (first_name || ' ' || last_name) as full_name,
      first_name,
      last_name,
      phone,
      hourly_wage,
      monthly_salary,
      emergency_contact,
      employee_type,
     employee_number,
     tax_table,
     created_at,
     deactivated_at,
     reactivated_at
     FROM users
     WHERE ${baseWhere}${activeWhere}
     ORDER BY id DESC`;
  const params = allowAll ? [] : [companyId];

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /admin/users:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows || []);
  });
});

// Skapa användare (admin)
app.post("/admin/users", requireAuth, requireAdmin, (req, res) => {
    const {
      first_name,
      last_name,
      email,
      phone = "",
      role = "user",
      password,
      company_id,
      hourly_wage = null,
      monthly_salary = null,
      emergency_contact = null,
      employee_type = null,
      employee_number = null,
      tax_table = null
    } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ error: "Förnamn, efternamn, e‑post och lösenord krävs." });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanRole = String(role || "user").toLowerCase();
  const username = cleanEmail; // använd e-post som användarnamn
  const hash = bcrypt.hashSync(password, 10);

  // Enforce company scoping: non-super_admin can only create users for their company
  const actorRole = (req.user.role || "").toLowerCase();
  if (actorRole !== "super_admin" && cleanRole === "super_admin") {
    return res.status(403).json({ error: "Endast superadmin kan skapa superadmin." });
  }
  let targetCompanyId = company_id || null;
  if (actorRole !== "super_admin") {
    targetCompanyId = req.user.company_id;
  }

  db.run(
    `INSERT INTO users
      (username, email, password, role, company_id, first_name, last_name, phone, hourly_wage, monthly_salary, emergency_contact, employee_type, employee_number, tax_table)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      username,
      cleanEmail,
      hash,
      cleanRole,
      targetCompanyId || null,
      first_name.trim(),
      last_name.trim(),
      String(phone || "").trim(),
      hourly_wage !== undefined && hourly_wage !== null && hourly_wage !== "" ? Number(hourly_wage) : null,
      monthly_salary !== undefined && monthly_salary !== null && monthly_salary !== "" ? Number(monthly_salary) : null,
      emergency_contact ? String(emergency_contact).trim() : null,
      employee_type ? String(employee_type).trim() : null,
      employee_number ? String(employee_number).trim() : null,
      tax_table !== undefined && tax_table !== null && tax_table !== "" ? Number(tax_table) : null
    ],
    function (err) {
      if (err) {
        console.error("DB-fel vid POST /admin/users:", err);
        if ((err.message || "").includes("UNIQUE")) {
          return res.status(400).json({ error: "E‑post eller användarnamn används redan." });
        }
        return res.status(500).json({ error: "Kunde inte skapa användare." });
      }

      logAudit({
        req,
        companyId: targetCompanyId || null,
        actorUserId: getAuthUserId(req),
        action: "USER_CREATED",
        entityType: "user",
        entityId: this.lastID,
        metadata: { email: cleanEmail, role: cleanRole },
        success: true
      });

      res.status(201).json({
        id: this.lastID,
        username,
        email: cleanEmail,
        role: cleanRole,
        company_id: targetCompanyId || null,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        phone: String(phone || "").trim(),
        hourly_wage:
          hourly_wage !== undefined && hourly_wage !== null && hourly_wage !== ""
            ? Number(hourly_wage)
            : null,
        monthly_salary:
          monthly_salary !== undefined && monthly_salary !== null && monthly_salary !== ""
            ? Number(monthly_salary)
            : null,
        emergency_contact: emergency_contact ? String(emergency_contact).trim() : null,
        employee_type: employee_type ? String(employee_type).trim() : null,
        employee_number: employee_number ? String(employee_number).trim() : null,
        tax_table: tax_table !== undefined && tax_table !== null && tax_table !== "" ? Number(tax_table) : null
      });
    }
  );
});

// Uppdatera användare (admin) – t.ex. timlön, roll, telefon
app.put("/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const {
    first_name,
    last_name,
    phone,
    role,
    hourly_wage,
    monthly_salary,
    emergency_contact,
    employee_type,
    employee_number,
    tax_table,
    password
  } = req.body;

  const fields = [];
  const params = [];
  const changedFields = [];

  if (first_name !== undefined) {
    fields.push("first_name = ?");
    params.push(first_name.trim());
    changedFields.push("first_name");
  }
  if (last_name !== undefined) {
    fields.push("last_name = ?");
    params.push(last_name.trim());
    changedFields.push("last_name");
  }
  if (phone !== undefined) {
    fields.push("phone = ?");
    params.push(String(phone || "").trim());
    changedFields.push("phone");
  }
  if (role !== undefined) {
    fields.push("role = ?");
    params.push(String(role).toLowerCase());
    changedFields.push("role");
  }
  if (hourly_wage !== undefined) {
    fields.push("hourly_wage = ?");
    params.push(
      hourly_wage !== null && hourly_wage !== "" ? Number(hourly_wage) : null
    );
    changedFields.push("hourly_wage");
  }
  if (monthly_salary !== undefined) {
    fields.push("monthly_salary = ?");
    params.push(
      monthly_salary !== null && monthly_salary !== "" ? Number(monthly_salary) : null
    );
    changedFields.push("monthly_salary");
  }
  if (emergency_contact !== undefined) {
    fields.push("emergency_contact = ?");
    params.push(emergency_contact ? String(emergency_contact).trim() : null);
    changedFields.push("emergency_contact");
  }
  if (employee_type !== undefined) {
    fields.push("employee_type = ?");
    params.push(employee_type ? String(employee_type).trim() : null);
    changedFields.push("employee_type");
  }
  if (employee_number !== undefined) {
    fields.push("employee_number = ?");
    params.push(employee_number ? String(employee_number).trim() : null);
    changedFields.push("employee_number");
  }
  if (tax_table !== undefined) {
    fields.push("tax_table = ?");
    params.push(tax_table !== null && tax_table !== "" ? Number(tax_table) : null);
    changedFields.push("tax_table");
  }
  if (password !== undefined) {
    fields.push("password = ?");
    params.push(password ? bcrypt.hashSync(password, 10) : null);
    changedFields.push("password");
  }

  if (!fields.length) {
    return res.status(400).json({ error: "Inget att uppdatera." });
  }

  params.push(id);
  // Ensure target user belongs to same company unless super_admin
  db.get(`SELECT company_id, role FROM users WHERE id = ?`, [id], (gErr, row) => {
    if (gErr) {
      console.error("DB-fel vid SELECT users for PUT:", gErr);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row) return res.status(404).json({ error: "Användaren hittades inte." });

    const actorRole = (req.user.role || "").toLowerCase();
    const scopedCompany = getScopedCompanyId(req);
    const prevRole = String(row.role || "").toLowerCase();
    const nextRole = role !== undefined ? String(role || "").toLowerCase() : prevRole;
    if (actorRole !== "super_admin" && String(row.company_id) !== String(scopedCompany)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (actorRole !== "super_admin" && String(row.role || "").toLowerCase() === "super_admin") {
      return res.status(403).json({ error: "Endast superadmin kan ändra superadmin." });
    }
    if (actorRole !== "super_admin" && role !== undefined) {
      if (nextRole === "super_admin") {
        return res.status(403).json({ error: "Endast superadmin kan ändra roll till superadmin." });
      }
    }

    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
    db.run(sql, params, function (err) {
      if (err) {
        console.error("DB-fel vid PUT /admin/users/:id:", err);
        return res.status(500).json({ error: "Kunde inte uppdatera användare." });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Användaren hittades inte." });
      }
      const action =
        prevRole !== nextRole ? "ROLE_CHANGED" : "USER_UPDATED";
      const metadata = {
        changed_fields: changedFields,
        from_role: prevRole !== nextRole ? prevRole : undefined,
        to_role: prevRole !== nextRole ? nextRole : undefined
      };

      logAudit({
        req,
        companyId: row.company_id,
        actorUserId: getAuthUserId(req),
        action,
        entityType: "user",
        entityId: id,
        metadata,
        success: true
      });

      res.json({ success: true });
    });
  });
});

// Ta bort användare (admin)
app.delete("/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;

  // Check target user's company
  db.get(`SELECT company_id, role FROM users WHERE id = ?`, [id], (gErr, row) => {
    if (gErr) {
      console.error("DB-fel vid SELECT users for DELETE:", gErr);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row) return res.status(404).json({ error: "Användaren hittades inte." });

    const actorRole = (req.user.role || "").toLowerCase();
    const scopedCompany = getScopedCompanyId(req);
    if (actorRole !== "super_admin" && String(row.company_id) !== String(scopedCompany)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (actorRole !== "super_admin" && String(row.role || "").toLowerCase() === "super_admin") {
      return res.status(403).json({ error: "Endast superadmin kan avaktivera superadmin." });
    }

    db.run(
      `UPDATE users
       SET is_active = 0,
           deactivated_at = datetime('now')
       WHERE id = ?`,
      [id],
      function (err) {
        if (err) {
          console.error("DB-fel vid SOFT DELETE /admin/users/:id:", err);
          return res.status(500).json({ error: "Kunde inte ta bort användare." });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: "Användaren hittades inte." });
        }

        logAudit({
          req,
          companyId: row.company_id,
          actorUserId: getAuthUserId(req),
          action: "USER_DEACTIVATED",
          entityType: "user",
          entityId: id,
          metadata: { role: row.role },
          success: true
        });
        res.json({ success: true });
      }
    );
  });
});

// Återaktivera användare (admin)
app.post("/admin/users/:id/reactivate", requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;

  db.get(`SELECT company_id, role FROM users WHERE id = ?`, [id], (gErr, row) => {
    if (gErr) {
      console.error("DB-fel vid SELECT users for REACTIVATE:", gErr);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row) return res.status(404).json({ error: "Användaren hittades inte." });

    const actorRole = (req.user.role || "").toLowerCase();
    const scopedCompany = getScopedCompanyId(req);
    if (actorRole !== "super_admin" && String(row.company_id) !== String(scopedCompany)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (actorRole !== "super_admin" && String(row.role || "").toLowerCase() === "super_admin") {
      return res.status(403).json({ error: "Endast superadmin kan aktivera superadmin." });
    }

    db.run(
      `UPDATE users
       SET is_active = 1,
           reactivated_at = datetime('now')
       WHERE id = ?`,
      [id],
      function (err) {
      if (err) {
        console.error("DB-fel vid REACTIVATE /admin/users/:id:", err);
        return res.status(500).json({ error: "Kunde inte aktivera användare." });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Användaren hittades inte." });
      }
      logAudit({
        req,
        companyId: row.company_id,
        actorUserId: getAuthUserId(req),
        action: "USER_REACTIVATED",
        entityType: "user",
        entityId: id,
        metadata: { role: row.role },
        success: true
      });
      res.json({ success: true });
    });
  });
});

// Återställ lösenord (admin)
app.post("/admin/users/:id/reset-password", requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "password required" });

  db.get(`SELECT company_id, role FROM users WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("DB-fel vid SELECT user for reset:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row) return res.status(404).json({ error: "Not found" });

    const actorRole = (req.user.role || "").toLowerCase();
    const scopedCompany = getScopedCompanyId(req);
    if (actorRole !== "super_admin" && String(row.company_id) !== String(scopedCompany)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (actorRole !== "super_admin" && String(row.role || "").toLowerCase() === "super_admin") {
      return res.status(403).json({ error: "Endast superadmin kan återställa lösenord för superadmin." });
    }

    const hash = bcrypt.hashSync(password, 10);
    db.run(`UPDATE users SET password = ? WHERE id = ?`, [hash, id], function (uErr) {
      if (uErr) {
        console.error("DB-fel vid reset password:", uErr);
        return res.status(500).json({ error: "DB error" });
      }
      logAudit({
        req,
        companyId: row.company_id,
        actorUserId: getAuthUserId(req),
        action: "USER_PASSWORD_RESET",
        entityType: "user",
        entityId: id,
        metadata: { role: row.role },
        success: true
      });
      res.json({ success: true });
    });
  });
});

// ======================
//   ADMIN: AUDIT LOGS
// ======================
app.get("/admin/audit-logs", requireAuth, requireAdmin, (req, res) => {
  const actorRole = (req.user.role || "").toLowerCase();
  const allowAll = actorRole === "super_admin";
  const scopedCompanyId = getScopedCompanyId(req);
  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : scopedCompanyId;

  if (!targetCompanyId && !allowAll) {
    return res.status(400).json({ error: "Company not found" });
  }

  const { from, to, user_id, action, entity_type, success, limit, offset } = req.query || {};
  const where = [];
  const params = [];

  if (!allowAll) {
    where.push("al.company_id = ?");
    params.push(targetCompanyId);
  } else if (req.query.company_id) {
    where.push("al.company_id = ?");
    params.push(targetCompanyId);
  }

  if (from) {
    where.push("datetime(al.created_at) >= datetime(?)");
    params.push(from);
  }
  if (to) {
    where.push("datetime(al.created_at) <= datetime(?)");
    params.push(to);
  }
  if (user_id) {
    where.push("al.actor_user_id = ?");
    params.push(user_id);
  }
  if (action) {
    where.push("al.action = ?");
    params.push(action);
  }
  if (entity_type) {
    where.push("al.entity_type = ?");
    params.push(entity_type);
  }
  if (success !== undefined && success !== null && success !== "") {
    const successValue = String(success).toLowerCase();
    const boolValue = successValue === "1" || successValue === "true" || successValue === "yes";
    where.push("al.success = ?");
    params.push(boolValue ? 1 : 0);
  }

  const limitValue = Math.min(1000, Math.max(1, Number(limit) || 200));
  const offsetValue = Math.max(0, Number(offset) || 0);

  const sql = `
    SELECT
      al.*,
      u.email AS actor_email,
      (u.first_name || ' ' || u.last_name) AS actor_name
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.actor_user_id
    WHERE ${where.length ? where.join(" AND ") : "1=1"}
    ORDER BY datetime(al.created_at) DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limitValue, offsetValue);

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /admin/audit-logs:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows || []);
  });
});

// ======================
//   ADMIN: CERTIFICATES
// ======================
app.get("/admin/certificates", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const { user_id } = req.query || {};
  const where = [];
  const params = [];

  if (!allowAll) {
    where.push("ec.company_id = ?");
    params.push(companyId);
  } else if (req.query.company_id) {
    where.push("ec.company_id = ?");
    params.push(req.query.company_id);
  }

  if (user_id) {
    where.push("ec.user_id = ?");
    params.push(user_id);
  }

  const sql = `
    SELECT
      ec.*,
      u.email AS user_email,
      u.employee_number AS employee_number,
      (u.first_name || ' ' || u.last_name) AS user_name
    FROM employee_certificates ec
    JOIN users u ON u.id = ec.user_id
    WHERE ${where.length ? where.join(" AND ") : "1=1"}
    ORDER BY datetime(ec.valid_to) ASC, datetime(ec.created_at) DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /admin/certificates:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows || []);
  });
});

app.post("/admin/certificates", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const {
    user_id,
    title,
    issuer = null,
    certificate_number = null,
    valid_from = null,
    valid_to = null,
    notes = null,
    filename,
    content_base64,
    company_id
  } = req.body || {};

  const targetCompanyId = allowAll && company_id ? company_id : companyId;
  if (!targetCompanyId) return res.status(400).json({ error: "Company not found" });
  if (!user_id || !title) return res.status(400).json({ error: "user_id and title required" });

  db.get("SELECT company_id FROM users WHERE id = ?", [user_id], (uErr, uRow) => {
    if (uErr || !uRow) return res.status(400).json({ error: "Invalid user_id" });
    if (String(uRow.company_id) !== String(targetCompanyId)) {
      return res.status(403).json({ error: "User not in company" });
    }

    let fileUrl = null;
    if (filename && content_base64) {
      const safeName = sanitizeUploadName(filename);
      if (!safeName) return res.status(400).json({ error: "Invalid filename" });
      const dir = path.join(__dirname, "uploads", "certificates", String(targetCompanyId));
      ensureDirExists(dir);
      const stampedName = `${Date.now()}-${safeName}`;
      const filePath = path.join(dir, stampedName);
      const data = String(content_base64).split(",").pop();
      fs.writeFileSync(filePath, data, { encoding: "base64" });
      fileUrl = `/uploads/certificates/${targetCompanyId}/${stampedName}`;
    }

    db.run(
      `INSERT INTO employee_certificates
        (company_id, user_id, title, issuer, certificate_number, valid_from, valid_to, notes, file_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        targetCompanyId,
        user_id,
        String(title).trim(),
        issuer ? String(issuer).trim() : null,
        certificate_number ? String(certificate_number).trim() : null,
        valid_from || null,
        valid_to || null,
        notes ? String(notes).trim() : null,
        fileUrl
      ],
      function (err) {
        if (err) {
          console.error("DB-fel vid POST /admin/certificates:", err);
          return res.status(500).json({ error: "DB error" });
        }
        logAudit({
          req,
          companyId: targetCompanyId,
          actorUserId: getAuthUserId(req),
          action: "CERT_CREATED",
          entityType: "certificate",
          entityId: this.lastID,
          metadata: { user_id, title: String(title).trim() },
          success: true
        });
        res.status(201).json({ id: this.lastID, file_url: fileUrl });
      }
    );
  });
});

app.put("/admin/certificates/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const { id } = req.params;
  const {
    title,
    issuer,
    certificate_number,
    valid_from,
    valid_to,
    notes,
    filename,
    content_base64,
    company_id
  } = req.body || {};
  const targetCompanyId = allowAll && company_id ? company_id : companyId;

  db.get(
    "SELECT * FROM employee_certificates WHERE id = ?",
    [id],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: "Not found" });
      if (!allowAll && String(row.company_id) !== String(targetCompanyId)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      let fileUrl = row.file_url || null;
      if (filename && content_base64) {
        const safeName = sanitizeUploadName(filename);
        if (!safeName) return res.status(400).json({ error: "Invalid filename" });
        const dir = path.join(__dirname, "uploads", "certificates", String(targetCompanyId));
        ensureDirExists(dir);
        const stampedName = `${Date.now()}-${safeName}`;
        const filePath = path.join(dir, stampedName);
        const data = String(content_base64).split(",").pop();
        fs.writeFileSync(filePath, data, { encoding: "base64" });
        fileUrl = `/uploads/certificates/${targetCompanyId}/${stampedName}`;
      }

      db.run(
        `UPDATE employee_certificates SET
          title = COALESCE(?, title),
          issuer = COALESCE(?, issuer),
          certificate_number = COALESCE(?, certificate_number),
          valid_from = COALESCE(?, valid_from),
          valid_to = COALESCE(?, valid_to),
          notes = COALESCE(?, notes),
          file_url = COALESCE(?, file_url),
          updated_at = datetime('now')
         WHERE id = ?`,
        [
          title !== undefined ? String(title).trim() : null,
          issuer !== undefined ? (issuer ? String(issuer).trim() : null) : null,
          certificate_number !== undefined ? (certificate_number ? String(certificate_number).trim() : null) : null,
          valid_from !== undefined ? valid_from || null : null,
          valid_to !== undefined ? valid_to || null : null,
          notes !== undefined ? (notes ? String(notes).trim() : null) : null,
          fileUrl,
          id
        ],
        function (uErr) {
          if (uErr) {
            console.error("DB-fel vid PUT /admin/certificates:", uErr);
            return res.status(500).json({ error: "DB error" });
          }
          logAudit({
            req,
            companyId: row.company_id,
            actorUserId: getAuthUserId(req),
            action: "CERT_UPDATED",
            entityType: "certificate",
            entityId: id,
            metadata: { title: title || row.title },
            success: true
          });
          res.json({ success: true, file_url: fileUrl });
        }
      );
    }
  );
});

app.delete("/admin/certificates/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const { id } = req.params;
  db.get("SELECT * FROM employee_certificates WHERE id = ?", [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Not found" });
    if (!allowAll && String(row.company_id) !== String(companyId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    db.run("DELETE FROM employee_certificates WHERE id = ?", [id], function (dErr) {
      if (dErr) {
        console.error("DB-fel vid DELETE /admin/certificates:", dErr);
        return res.status(500).json({ error: "DB error" });
      }
      if (row.file_url) {
        const normalized = String(row.file_url).replace(/^\/+/, "");
        const filePath = path.join(__dirname, normalized);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          console.warn("Kunde inte ta bort fil:", filePath, e);
        }
      }
      logAudit({
        req,
        companyId: row.company_id,
        actorUserId: getAuthUserId(req),
        action: "CERT_DELETED",
        entityType: "certificate",
        entityId: id,
        metadata: { title: row.title },
        success: true
      });
      res.json({ success: true });
    });
  });
});

app.get("/admin/certificates/export", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });
  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : companyId;

  const sql = `
    SELECT
      ec.*,
      u.email AS user_email,
      u.employee_number AS employee_number,
      (u.first_name || ' ' || u.last_name) AS user_name
    FROM employee_certificates ec
    JOIN users u ON u.id = ec.user_id
    WHERE ec.company_id = ?
    ORDER BY u.last_name, u.first_name, datetime(ec.valid_to)
  `;

  db.all(sql, [targetCompanyId], (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /admin/certificates/export:", err);
      return res.status(500).json({ error: "DB error" });
    }

    const escapeCsv = (value) => {
      const str = value == null ? "" : String(value);
      if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return `"${str.replace(/\"/g, "\"\"")}"`;
      }
      return str;
    };

    const today = new Date().toISOString().slice(0, 10);
    const lines = [
      [
        "Anställd",
        "E-post",
        "Anst.nr",
        "Intyg",
        "Utfärdare",
        "Intygsnummer",
        "Giltig från",
        "Giltig till",
        "Status",
        "Notering"
      ].map(escapeCsv).join(",")
    ];

    (rows || []).forEach((row) => {
      const validTo = row.valid_to || "";
      const status = validTo && validTo < today ? "Utgånget" : "Giltigt";
      lines.push(
        [
          row.user_name || "",
          row.user_email || "",
          row.employee_number || "",
          row.title || "",
          row.issuer || "",
          row.certificate_number || "",
          row.valid_from || "",
          row.valid_to || "",
          status,
          row.notes || ""
        ].map(escapeCsv).join(",")
      );
    });

    const csv = lines.join("\n");
    const filename = `kompetensmatris-${targetCompanyId || "company"}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  });
});

// --- Fortnox OAuth integration ---
app.get("/admin/fortnox/status", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : companyId;
  if (!targetCompanyId) return res.status(400).json({ error: "Company not found" });

  db.get(
    "SELECT scope, expires_at, updated_at FROM fortnox_connections WHERE company_id = ?",
    [targetCompanyId],
    (err, row) => {
      if (err) {
        console.error("DB-fel vid GET /admin/fortnox/status:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (!row) return res.json({ connected: false });
      res.json({
        connected: true,
        scope: row.scope || null,
        expires_at: row.expires_at || null,
        updated_at: row.updated_at || null,
      });
    }
  );
});

app.post("/admin/fortnox/connect", requireAuth, requireAdmin, (req, res) => {
  const { clientId } = getFortnoxCredentials();
  if (!clientId || !FORTNOX_REDIRECT_URI) {
    return res.status(500).json({ error: "Fortnox OAuth not configured" });
  }

  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : companyId;
  if (!targetCompanyId) return res.status(400).json({ error: "Company not found" });

  const state = jwt.sign(
    { company_id: String(targetCompanyId), actor_user_id: getAuthUserId(req) },
    JWT_SECRET,
    { expiresIn: "10m" }
  );
  const allowedScopes = getAllowedFortnoxScopes();
  const requestedScopes = Array.isArray(req.body?.scopes)
    ? req.body.scopes
    : typeof req.body?.scope === "string"
      ? req.body.scope.split(/\s+/)
      : [];
  const normalizedScopes = requestedScopes
    .map((scope) => String(scope || "").trim())
    .filter(Boolean);
  const effectiveScopes = normalizedScopes.length
    ? normalizedScopes.filter((scope) => allowedScopes.includes(scope))
    : allowedScopes;
  const authUrl = buildFortnoxAuthUrl({
    clientId,
    redirectUri: FORTNOX_REDIRECT_URI,
    state,
    scope: effectiveScopes.join(" "),
  });

  console.log('Built Fortnox auth_url, scope=', effectiveScopes.join(" "), 'auth_url=', authUrl);
  res.json({ auth_url: authUrl });
});

app.get("/admin/fortnox/scopes", requireAuth, requireAdmin, (req, res) => {
  res.json({ allowed: getAllowedFortnoxScopes() });
});

app.post("/admin/fortnox/disconnect", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : companyId;
  if (!targetCompanyId) return res.status(400).json({ error: "Company not found" });

  db.run(
    "DELETE FROM fortnox_connections WHERE company_id = ?",
    [targetCompanyId],
    function (err) {
      if (err) {
        console.error("DB-fel vid POST /admin/fortnox/disconnect:", err);
        return res.status(500).json({ error: "DB error" });
      }
      logAudit({
        req,
        companyId: targetCompanyId,
        actorUserId: getAuthUserId(req),
        action: "FORTNOX_DISCONNECTED",
        entityType: "fortnox",
        entityId: targetCompanyId,
        success: true,
      });
      res.json({ success: true });
    }
  );
});

// Push payroll XML to Fortnox (store and optionally forward using saved connection)
app.post("/admin/fortnox/push_payroll", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { xml, filename, company_id } = req.body || {};
    const allowAll = req.company_scope_all === true;
    const targetCompanyId = allowAll && company_id ? company_id : getScopedCompanyId(req);
    if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });

    if (!xml || typeof xml !== "string") return res.status(400).json({ error: "xml required" });

    // Ensure uploads dir
    const uploadsDir = path.join(__dirname, "uploads", "fortnox_payrolls");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const safeFilename = (filename || `payroll_${Date.now()}.xml`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(uploadsDir, safeFilename);
    fs.writeFileSync(filePath, xml, "utf8");

    // Log export in DB
    db.run(
      `INSERT INTO fortnox_export_logs
        (company_id, period_start, period_end, employee_count, entry_count, exported_by, filename)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [targetCompanyId, null, null, null, null, getAuthUserId(req), safeFilename],
      function (err) {
        if (err) console.error("DB-fel vid POST /fortnox_export_logs (push_payroll):", err);
      }
    );

    // Try to forward to Fortnox if we have an access token
    const accessToken = await getFortnoxAccessToken(targetCompanyId);
    if (!accessToken) {
      return res.json({ success: true, stored: true, forwarded: false, message: "Saved locally; no Fortnox token available." });
    }

    // Forward to Fortnox - upload as archive file (PAXml import is manual in Fortnox Lön)
    const fortnoxUrl = `${FORTNOX_API_BASE}${FORTNOX_PAYROLL_PATH}`;
    console.log('Using Fortnox payroll URL:', fortnoxUrl);
    try {
      // Inspect saved connection (scopes) for better error messages
      const conn = await getFortnoxConnection(targetCompanyId).catch(() => null);
      const savedScope = conn ? String(conn.scope || "").trim() : "";
      console.log("Fortnox connection scope for company", targetCompanyId, "=", savedScope);
      if (savedScope && !savedScope.includes("archive")) {
        // Warn the caller that the token likely lacks archive permission
        return res.status(403).json({
          success: false,
          forwarded: false,
          error: "Missing required Fortnox scope: archive",
          message: "Your Fortnox token does not include the 'archive' scope. Please reconnect the Fortnox app with the required permissions."
        });
      }

      const form = new FormData();
      // Node's global Blob/FormData may vary between runtimes; FormData usage mirrors existing code.
      form.append("file", new Blob([xml], { type: "application/xml" }), safeFilename);

      const response = await fetch(fortnoxUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json"
        },
        body: form,
      });

      const text = await response.text().catch(() => "");
      // Collect some response headers for debugging
      let responseHeaders = {};
      try {
        for (const [k, v] of response.headers.entries()) responseHeaders[k] = v;
      } catch (e) {
        responseHeaders = {};
      }

      if (!response.ok) {
        console.error("Fortnox push failed:", response.status, text, responseHeaders);
        return res.status(502).json({
          success: false,
          forwarded: false,
          status: response.status,
          error: text || "Fortnox returned an error",
          headers: responseHeaders,
          body: text
        });
      }
      return res.json({
        success: true,
        stored: true,
        forwarded: true,
        message: "Löneunderlag uppladdat i Fortnox Arkiv",
        headers: responseHeaders,
        body: text
      });
    } catch (err) {
      console.error("Error forwarding to Fortnox:", err);
      return res.status(500).json({ success: false, forwarded: false, error: err?.message || String(err) });
    }
  } catch (err) {
    console.error("Error in /admin/fortnox/push_payroll:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

// Push invoice file to Fortnox (store and optionally forward using saved connection)
app.post("/admin/fortnox/push_invoice", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { csv, invoice, filename, company_id } = req.body || {};
    const allowAll = req.company_scope_all === true;
    const targetCompanyId = allowAll && company_id ? company_id : getScopedCompanyId(req);
    if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });

    const hasInvoice = invoice && typeof invoice === "object";
    const hasCsv = csv && typeof csv === "string";
    if (!hasInvoice && !hasCsv) {
      return res.status(400).json({ error: "invoice or csv required" });
    }

    // Ensure uploads dir
    const uploadsDir = path.join(__dirname, "uploads", "fortnox_invoices");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const defaultName = hasInvoice ? `invoice_${Date.now()}.json` : `invoice_${Date.now()}.csv`;
    const safeFilename = (filename || defaultName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(uploadsDir, safeFilename);
    const storedBody = hasInvoice ? JSON.stringify({ Invoice: invoice }, null, 2) : csv;
    fs.writeFileSync(filePath, storedBody, "utf8");

    // Log export in DB
    db.run(
      `INSERT INTO fortnox_export_logs
        (company_id, period_start, period_end, employee_count, entry_count, exported_by, filename)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [targetCompanyId, null, null, null, null, getAuthUserId(req), safeFilename],
      function (err) {
        if (err) console.error("DB-fel vid POST /fortnox_export_logs (push_invoice):", err);
      }
    );

    // Try to forward to Fortnox if we have an access token
    const accessToken = await getFortnoxAccessToken(targetCompanyId);
    if (!accessToken) {
      return res.json({ success: true, stored: true, forwarded: false, message: "Saved locally; no Fortnox token available." });
    }

    // Forward to Fortnox
    const fortnoxUrl = `${FORTNOX_API_BASE}/invoices`;
    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": hasInvoice ? "application/json" : "text/csv",
      };
      const body = hasInvoice ? JSON.stringify({ Invoice: invoice }) : csv;
      const response = await fetch(fortnoxUrl, {
        method: "POST",
        headers,
        body,
      });
      const text = await response.text();
      if (!response.ok) {
        console.error("Fortnox invoice push failed:", response.status, text);
        return res.status(502).json({ success: false, forwarded: false, status: response.status, error: text, body: text });
      }
      return res.json({ success: true, stored: true, forwarded: true, body: text });
    } catch (err) {
      console.error("Error forwarding invoice to Fortnox:", err);
      return res.status(500).json({ success: false, forwarded: false, error: err?.message || String(err) });
    }
  } catch (err) {
    console.error("Error in /admin/fortnox/push_invoice:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

// Push offer file to Fortnox (store and optionally forward using saved connection)
app.post("/admin/fortnox/push_offer", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { offer, filename, company_id, pdf_base64 } = req.body || {};
    const allowAll = req.company_scope_all === true;
    const targetCompanyId = allowAll && company_id ? company_id : getScopedCompanyId(req);
    if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });

    const hasOffer = offer && typeof offer === "object";
    const hasPdf = typeof pdf_base64 === "string" && pdf_base64.trim().length > 0;
    if (!hasOffer && !hasPdf) {
      return res.status(400).json({ error: "offer or pdf_base64 required" });
    }

    // Ensure uploads dir
    const uploadsDir = path.join(__dirname, "uploads", "fortnox_offers");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const defaultName = hasPdf ? `offer_${Date.now()}.pdf` : `offer_${Date.now()}.json`;
    let safeFilename = (filename || defaultName).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (hasPdf && !safeFilename.toLowerCase().endsWith(".pdf")) {
      safeFilename += ".pdf";
    }
    const filePath = path.join(uploadsDir, safeFilename);
    let pdfBuffer = null;
    if (hasPdf) {
      const raw = pdf_base64.includes(",") ? pdf_base64.split(",").pop() : pdf_base64;
      pdfBuffer = Buffer.from(String(raw || ""), "base64");
      fs.writeFileSync(filePath, pdfBuffer);
    } else if (hasOffer) {
      const storedBody = JSON.stringify({ Offer: offer }, null, 2);
      fs.writeFileSync(filePath, storedBody, "utf8");
    }

    // Log export in DB
    db.run(
      `INSERT INTO fortnox_export_logs
        (company_id, period_start, period_end, employee_count, entry_count, exported_by, filename)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [targetCompanyId, null, null, null, null, getAuthUserId(req), safeFilename],
      function (err) {
        if (err) console.error("DB-fel vid POST /fortnox_export_logs (push_offer):", err);
      }
    );

    // Try to forward to Fortnox if we have an access token
    const accessToken = await getFortnoxAccessToken(targetCompanyId);
    if (!accessToken) {
      return res.json({
        success: true,
        stored: true,
        offer_forwarded: false,
        pdf_forwarded: false,
        message: "Saved locally; no Fortnox token available."
      });
    }

    try {
      let offerResponse = null;
      if (hasOffer) {
        const fortnoxUrl = `${FORTNOX_API_BASE}/offers`;
        const headers = {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        };
        const body = JSON.stringify({ Offer: offer });
        const response = await fetch(fortnoxUrl, {
          method: "POST",
          headers,
          body,
        });
        const text = await response.text();
        if (!response.ok) {
          console.error("Fortnox offer push failed:", response.status, text);
          return res.status(502).json({ success: false, offer_forwarded: false, status: response.status, error: text, body: text });
        }
        offerResponse = text;
      }

      let pdfResponse = null;
      if (hasPdf && pdfBuffer) {
        const conn = await getFortnoxConnection(targetCompanyId).catch(() => null);
        const savedScope = conn ? String(conn.scope || "").trim() : "";
        if (savedScope && !savedScope.includes("archive")) {
          return res.status(403).json({
            success: false,
            pdf_forwarded: false,
            error: "Missing required Fortnox scope: archive",
            message: "Your Fortnox token does not include the 'archive' scope. Please reconnect the Fortnox app with the required permissions."
          });
        }
        const archiveUrl = `${FORTNOX_API_BASE}${FORTNOX_PAYROLL_PATH}`;
        const form = new FormData();
        form.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), safeFilename);
        const response = await fetch(archiveUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json"
          },
          body: form,
        });
        const text = await response.text().catch(() => "");
        if (!response.ok) {
          console.error("Fortnox offer PDF push failed:", response.status, text);
          return res.status(502).json({ success: false, pdf_forwarded: false, status: response.status, error: text, body: text });
        }
        pdfResponse = text;
      }

      return res.json({
        success: true,
        stored: true,
        offer_forwarded: Boolean(offerResponse),
        pdf_forwarded: Boolean(pdfResponse),
        offer_body: offerResponse,
        pdf_body: pdfResponse
      });
    } catch (err) {
      console.error("Error forwarding offer to Fortnox:", err);
      return res.status(500).json({ success: false, offer_forwarded: false, pdf_forwarded: false, error: err?.message || String(err) });
    }
  } catch (err) {
    console.error("Error in /admin/fortnox/push_offer:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

// Push work order PDF to Fortnox (store and optionally forward using saved connection)
app.post("/admin/fortnox/push_work_order", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { pdf_base64, filename, company_id, work_order_id } = req.body || {};
    const allowAll = req.company_scope_all === true;
    const targetCompanyId = allowAll && company_id ? company_id : getScopedCompanyId(req);
    if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });

    const hasPdf = typeof pdf_base64 === "string" && pdf_base64.trim().length > 0;
    if (!hasPdf) {
      return res.status(400).json({ error: "pdf_base64 required" });
    }

    // Ensure uploads dir
    const uploadsDir = path.join(__dirname, "uploads", "fortnox_work_orders");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const defaultName = `work_order_${work_order_id || Date.now()}.pdf`;
    let safeFilename = (filename || defaultName).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!safeFilename.toLowerCase().endsWith(".pdf")) {
      safeFilename += ".pdf";
    }
    const filePath = path.join(uploadsDir, safeFilename);

    const raw = pdf_base64.includes(",") ? pdf_base64.split(",").pop() : pdf_base64;
    const pdfBuffer = Buffer.from(String(raw || ""), "base64");
    fs.writeFileSync(filePath, pdfBuffer);

    // Log export in DB
    db.run(
      `INSERT INTO fortnox_export_logs
        (company_id, period_start, period_end, employee_count, entry_count, exported_by, filename)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [targetCompanyId, null, null, null, null, getAuthUserId(req), safeFilename],
      function (err) {
        if (err) console.error("DB-fel vid POST /fortnox_export_logs (push_work_order):", err);
      }
    );

    // Try to forward to Fortnox if we have an access token
    const accessToken = await getFortnoxAccessToken(targetCompanyId);
    if (!accessToken) {
      return res.json({ success: true, stored: true, pdf_forwarded: false, message: "Saved locally; no Fortnox token available." });
    }

    const conn = await getFortnoxConnection(targetCompanyId).catch(() => null);
    const savedScope = conn ? String(conn.scope || "").trim() : "";
    if (savedScope && !savedScope.includes("archive")) {
      return res.status(403).json({
        success: false,
        pdf_forwarded: false,
        error: "Missing required Fortnox scope: archive",
        message: "Your Fortnox token does not include the 'archive' scope. Please reconnect the Fortnox app with the required permissions."
      });
    }

    const archiveUrl = `${FORTNOX_API_BASE}${FORTNOX_PAYROLL_PATH}`;
    try {
      const form = new FormData();
      form.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), safeFilename);
      const response = await fetch(archiveUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json"
        },
        body: form,
      });
      const text = await response.text().catch(() => "");
      if (!response.ok) {
        console.error("Fortnox work order PDF push failed:", response.status, text);
        return res.status(502).json({ success: false, pdf_forwarded: false, status: response.status, error: text, body: text });
      }
      return res.json({ success: true, stored: true, pdf_forwarded: true, body: text });
    } catch (err) {
      console.error("Error forwarding work order PDF to Fortnox:", err);
      return res.status(500).json({ success: false, pdf_forwarded: false, error: err?.message || String(err) });
    }
  } catch (err) {
    console.error("Error in /admin/fortnox/push_work_order:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

app.get("/admin/fortnox/articles", requireAuth, requireAdmin, async (req, res) => {
  try {
    const allowAll = req.company_scope_all === true;
    const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : getScopedCompanyId(req);
    if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });

    const accessToken = await getFortnoxAccessToken(targetCompanyId);
    if (!accessToken) {
      return res.status(409).json({ error: "Fortnox not connected" });
    }

    const articles = await fetchFortnoxArticles(accessToken);
    return res.json({ articles, total: articles.length });
  } catch (err) {
    console.error("Error fetching Fortnox articles:", err);
    return res.status(500).json({ error: err?.message || "Fortnox fetch failed" });
  }
});

app.get("/admin/fortnox/customers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const allowAll = req.company_scope_all === true;
    const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : getScopedCompanyId(req);
    if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });

    const connection = await getFortnoxConnection(targetCompanyId);
    if (!connection?.access_token) {
      return res.status(409).json({ error: "Fortnox not connected" });
    }
    if (!hasFortnoxCustomerScope(connection.scope)) {
      return res.status(409).json({
        error: "Fortnox saknar behörighet för kunder. Koppla om Fortnox med scope: customer.",
        missing_scopes: FORTNOX_REQUIRED_SCOPES,
      });
    }

    const accessToken = await getFortnoxAccessToken(targetCompanyId);
    if (!accessToken) {
      return res.status(409).json({ error: "Fortnox not connected" });
    }

    const customers = await fetchFortnoxCustomers(accessToken);
    if (!customers.length) {
      return res.json({ customers: [], imported: 0, updated: 0, total: 0 });
    }

    const existingRows = await new Promise((resolve, reject) => {
      db.all(
        "SELECT id, customer_number FROM customers WHERE company_id = ?",
        [targetCompanyId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
    const existingMap = new Map();
    existingRows.forEach((row) => {
      const key = String(row?.customer_number || "").trim();
      if (key) existingMap.set(key, row.id);
    });

    const runAsync = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve(this);
        });
      });

    let imported = 0;
    let updated = 0;

    await runAsync("BEGIN");
    try {
      for (const customer of customers) {
        const customerNumber = String(customer.customer_number || "").trim();
        if (!customerNumber && !customer.name) continue;

        const existingId = customerNumber ? existingMap.get(customerNumber) : null;
        if (existingId) {
          await runAsync(
            `UPDATE customers
             SET name = COALESCE(?, name),
                 customer_number = COALESCE(?, customer_number),
                 customer_type = COALESCE(?, customer_type),
                 orgnr = COALESCE(?, orgnr),
                 vat_number = COALESCE(?, vat_number),
                 invoice_address1 = COALESCE(?, invoice_address1),
                 invoice_address2 = COALESCE(?, invoice_address2),
                 postal_code = COALESCE(?, postal_code),
                 city = COALESCE(?, city),
                 country = COALESCE(?, country),
                 contact_name = COALESCE(?, contact_name),
                 contact_email = COALESCE(?, contact_email),
                 invoice_email = COALESCE(?, invoice_email),
                 contact_phone = COALESCE(?, contact_phone),
                 phone_secondary = COALESCE(?, phone_secondary),
                 their_reference = COALESCE(?, their_reference),
                 payment_terms = COALESCE(?, payment_terms)
             WHERE id = ? AND company_id = ?`,
            [
              customer.name ?? null,
              customer.customer_number ?? null,
              customer.customer_type ?? null,
              customer.orgnr ?? null,
              customer.vat_number ?? null,
              customer.invoice_address1 ?? null,
              customer.invoice_address2 ?? null,
              customer.postal_code ?? null,
              customer.city ?? null,
              customer.country ?? null,
              customer.contact_name ?? null,
              customer.contact_email ?? null,
              customer.invoice_email ?? null,
              customer.contact_phone ?? null,
              customer.phone_secondary ?? null,
              customer.their_reference ?? null,
              customer.payment_terms ?? null,
              existingId,
              targetCompanyId,
            ]
          );
          updated += 1;
          continue;
        }

        await runAsync(
          `INSERT INTO customers (
            company_id,
            customer_number,
            customer_type,
            name,
            orgnr,
            vat_number,
            invoice_address1,
            invoice_address2,
            postal_code,
            city,
            country,
            contact_name,
            contact_email,
            invoice_email,
            contact_phone,
            phone_secondary,
            their_reference,
            payment_terms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            targetCompanyId,
            customer.customer_number ?? null,
            customer.customer_type ?? null,
            customer.name || customer.customer_number,
            customer.orgnr ?? null,
            customer.vat_number ?? null,
            customer.invoice_address1 ?? null,
            customer.invoice_address2 ?? null,
            customer.postal_code ?? null,
            customer.city ?? null,
            customer.country ?? null,
            customer.contact_name ?? null,
            customer.contact_email ?? null,
            customer.invoice_email ?? null,
            customer.contact_phone ?? null,
            customer.phone_secondary ?? null,
            customer.their_reference ?? null,
            customer.payment_terms ?? null,
          ]
        );
        imported += 1;
      }
      await runAsync("COMMIT");
    } catch (err) {
      await runAsync("ROLLBACK");
      throw err;
    }

    return res.json({
      customers,
      imported,
      updated,
      total: customers.length,
    });
  } catch (err) {
    console.error("Error fetching Fortnox customers:", err);
    return res.status(500).json({ error: err?.message || "Fortnox fetch failed" });
  }
});

app.get("/fortnox/callback", async (req, res) => {
  const { code, state, error } = req.query || {};
  console.log('Incoming Fortnox callback, query=', req.query);
  if (error) {
    const redirectUrl = buildFortnoxRedirectUrl(false);
    if (redirectUrl) return res.redirect(redirectUrl);
    return res.status(400).send("Fortnox authorization failed.");
  }
  if (!code || !state) {
    return res.status(400).send("Missing Fortnox authorization data.");
  }

  let decoded;
  try {
    decoded = jwt.verify(String(state), JWT_SECRET);
  } catch {
    return res.status(400).send("Invalid Fortnox state.");
  }

  const companyId = decoded?.company_id;
  const actorUserId = decoded?.actor_user_id || null;
  if (!companyId) return res.status(400).send("Missing company for Fortnox callback.");
  if (!FORTNOX_REDIRECT_URI) return res.status(500).send("Fortnox redirect URI not configured.");

  try {
    const tokenData = await requestFortnoxToken({
      grantType: "authorization_code",
      code: String(code),
      redirectUri: FORTNOX_REDIRECT_URI,
    });
    await saveFortnoxTokens(companyId, tokenData);
    logAudit({
      req,
      companyId,
      actorUserId,
      action: "FORTNOX_CONNECTED",
      entityType: "fortnox",
      entityId: companyId,
      metadata: { scope: tokenData.scope || null },
      success: true,
    });

    const redirectUrl = buildFortnoxRedirectUrl(true);
    if (redirectUrl) return res.redirect(redirectUrl);
    return res.send("Fortnox connected.");
  } catch (err) {
    const errorMessage = err?.message || "Fortnox connection failed";
    console.error("Fortnox callback error:", err);
    const alreadyConnected = await hasFortnoxConnection(companyId);
    if (alreadyConnected) {
      logAudit({
        req,
        companyId,
        actorUserId,
        action: "FORTNOX_CONNECTED",
        entityType: "fortnox",
        entityId: companyId,
        metadata: { warning: errorMessage, already_connected: true },
        success: true,
      });
      const redirectUrl = buildFortnoxRedirectUrl(true);
      if (redirectUrl) return res.redirect(redirectUrl);
      return res.status(200).send("Redan kopplad.");
    }
    logAudit({
      req,
      companyId,
      actorUserId,
      action: "FORTNOX_CONNECTED",
      entityType: "fortnox",
      entityId: companyId,
      metadata: { error: errorMessage },
      success: false,
    });
    const redirectUrl = buildFortnoxRedirectUrl(false);
    if (redirectUrl) return res.redirect(redirectUrl);
    return res.status(500).send("Fortnox connection failed.");
  }
});

// Kontaktlista: alla användare i företag (ingen admin-krav, bara auth och tenant-scope)
app.get("/contacts", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  db.all(
    `SELECT
      id,
      email,
      role,
      company_id,
      (first_name || ' ' || last_name) AS full_name,
      first_name,
      last_name,
      phone,
      emergency_contact,
      employee_type,
      employee_number,
      tax_table,
      created_at
     FROM users
     WHERE company_id = ? AND (is_active IS NULL OR is_active = 1)
     ORDER BY first_name, last_name`,
    [companyId],
    (err, rows) => {
      if (err) {
        console.error("DB-fel vid GET /contacts:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.json(rows || []);
    }
  );
});

// Hämta inloggad användare (token)
app.get("/me", requireAuth, (req, res) => {
  db.get(
    `SELECT id, username, email, role, company_id, first_name, last_name, phone, hourly_wage
     FROM users
     WHERE id = ?`,
    [req.user.id],
    (err, row) => {
      if (err) {
        console.error("DB-fel vid GET /me:", err);
        return res.status(500).json({ error: "Kunde inte hämta användare." });
      }
      if (!row) return res.status(404).json({ error: "Användaren finns inte." });
      res.json(row);
    }
  );
});

// Lovable /auth/me kompatibel route
app.get("/auth/me", requireAuth, async (req, res) => {
  db.get(
    `SELECT id, email, role, company_id, (first_name || ' ' || last_name) as full_name FROM users WHERE id = ?`,
    [req.user.user_id || req.user.id],
    (err, user) => {
      if (err || !user) return res.status(404).json({ error: "User not found" });

      const isImpersonated = !!req.user.impersonated;
      const role = (user.role || "").toLowerCase();
      const isSuperAdmin = role === "super_admin";
      const tokenCompanyId = req.user.company_id || user.company_id;

      const respond = (homeCompanyId) => {
        const effectiveCompanyId = isSuperAdmin
          ? (isImpersonated ? tokenCompanyId : homeCompanyId)
          : user.company_id;

        res.json({
          user,
          role: user.role,
          company_id: effectiveCompanyId,
          home_company_id: homeCompanyId,
          is_admin: role === "admin" || role === "super_admin",
          is_super_admin: isSuperAdmin,
          impersonated: isImpersonated
        });
      };

      if (isSuperAdmin) {
        resolveSuperAdminCompanyId((companyErr, homeCompanyId) => {
          if (companyErr) {
            console.error("DB-fel vid resolveSuperAdminCompanyId:", companyErr);
          }
          respond(homeCompanyId || user.company_id);
        });
        return;
      }

      respond(user.company_id);
    }
  );
});

// Verify current password for authenticated user
app.post("/auth/verify-password", requireAuth, (req, res) => {
  const { email, password } = req.body || {};
  if (!password) return res.status(400).json({ error: "password required" });

  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  db.get(`SELECT id, email, password FROM users WHERE id = ?`, [userId], async (err, user) => {
    if (err) {
      console.error("DB-fel vid POST /auth/verify-password:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!user) return res.status(404).json({ error: "User not found" });

    if (email) {
      const cleanEmail = String(email || "").trim().toLowerCase();
      if (cleanEmail !== String(user.email || "").trim().toLowerCase()) {
        return res.status(403).json({ error: "Email mismatch" });
      }
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    res.json({ ok: true });
  });
});

// Update authenticated user (password)
app.put("/auth/me", requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "password required" });
  if (String(password).length < 6) return res.status(400).json({ error: "password too short" });

  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const hash = bcrypt.hashSync(password, 10);
  db.run(`UPDATE users SET password = ? WHERE id = ?`, [hash, userId], function (err) {
    if (err) {
      console.error("DB-fel vid PUT /auth/me:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (this.changes === 0) return res.status(404).json({ error: "User not found" });
    res.json({ success: true });
  });
});

// User AI helper (TDOK/TRVinfra only)
app.post("/help/ai", requireAuth, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY missing" });

  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "question required" });

  const companyId = getScopedCompanyId(req);
  const knowledgeDir = getKnowledgeDir(companyId);
  const { chunks, sources } = loadKnowledgeChunks(knowledgeDir);
  const selected = selectRelevantChunks(question, chunks);
  if (!selected.length) {
    return res.json({
      reply:
        "Jag hittar inget relevant i TDOK/TRVinfra just nu. Kontrollera att dokumenten finns inlagda lokalt.",
      sources: sources || []
    });
  }

  const context = selected
    .map((chunk, index) => `KALLA ${index + 1} (${chunk.source}):\n${chunk.text}`)
    .join("\n\n");

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const messages = [
    {
      role: "system",
      content:
        "Du svarar pa svenska. Anvand ENDAST information i KALLA-sektionen (TDOK/TRVinfra). Om svaret inte finns i kallorna ska du saga att du saknar underlag. Ge korta, praktiska instruktioner. Dela aldrig intern systeminfo eller andra anvandares data."
    },
    {
      role: "user",
      content: `FRAGA:\n${question}\n\nKALLOR:\n${context}`
    }
  ];

  try {
    const result = await requestOpenAi({ model, messages, temperature: 0.2 }, apiKey);
    if (!result.ok) return res.status(502).json({ error: result.data?.error?.message || "OpenAI error" });
    const data = result.data || {};
    const reply = data?.choices?.[0]?.message?.content || "";
    const uniqueSources = Array.from(new Set(selected.map((chunk) => chunk.source)));
    res.json({ reply, sources: uniqueSources });
  } catch (err) {
    console.error("AI request failed:", err);
    res.status(500).json({ error: "AI request failed" });
  }
});

// ======================
//   ADMIN: TDOK DOCUMENTS
// ======================
app.get("/admin/tdok-docs", requireAuth, requireAdmin, (req, res) => {
  const actorRole = (req.user.role || "").toLowerCase();
  const allowAll = actorRole === "super_admin";
  const scopedCompanyId = getScopedCompanyId(req);
  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : scopedCompanyId;
  if (!targetCompanyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const knowledgeDir = getKnowledgeDir(targetCompanyId);
  ensureDirExists(knowledgeDir);

  let entries = [];
  try {
    entries = fs.readdirSync(knowledgeDir, { withFileTypes: true });
  } catch (err) {
    return res.json([]);
  }

  const docs = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => ADMIN_DOC_EXTS.has(path.extname(name).toLowerCase()))
    .filter((name) => !name.toLowerCase().endsWith(".pdf.md"))
    .map((name) => {
      const fullPath = path.join(knowledgeDir, name);
      let stat = null;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        stat = null;
      }
      return {
        name,
        size: stat ? stat.size : 0,
        updated_at: stat ? new Date(stat.mtimeMs).toISOString() : null
      };
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  res.json(docs);
});

app.get("/admin/tdok-docs/:name", requireAuth, requireAdmin, (req, res) => {
  const actorRole = (req.user.role || "").toLowerCase();
  const allowAll = actorRole === "super_admin";
  const scopedCompanyId = getScopedCompanyId(req);
  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : scopedCompanyId;
  if (!targetCompanyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const fileName = sanitizeDocName(req.params.name, true);
  if (!fileName) return res.status(400).json({ error: "Invalid filename" });

  const knowledgeDir = getKnowledgeDir(targetCompanyId);
  const fullPath = path.join(knowledgeDir, fileName);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Not found" });

  try {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".pdf") {
      const sidecarPath = path.join(knowledgeDir, `${fileName}.md`);
      let extractedText = null;
      if (fs.existsSync(sidecarPath)) {
        try {
          extractedText = fs.readFileSync(sidecarPath, "utf8");
        } catch {
          extractedText = null;
        }
      }
      res.json({
        name: fileName,
        content: "",
        file_url: `/admin/tdok-docs/${encodeURIComponent(fileName)}/download`,
        is_binary: true,
        extracted_text: extractedText,
      });
      return;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    res.json({ name: fileName, content, is_binary: false });
  } catch (err) {
    console.error("Kunde inte läsa TDOK-dokument:", err);
    res.status(500).json({ error: "Could not read document" });
  }
});

app.get("/admin/tdok-docs/:name/download", requireAuth, requireAdmin, (req, res) => {
  const actorRole = (req.user.role || "").toLowerCase();
  const allowAll = actorRole === "super_admin";
  const scopedCompanyId = getScopedCompanyId(req);
  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : scopedCompanyId;
  if (!targetCompanyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const fileName = sanitizeDocName(req.params.name, true);
  if (!fileName) return res.status(400).json({ error: "Invalid filename" });

  const knowledgeDir = getKnowledgeDir(targetCompanyId);
  const fullPath = path.join(knowledgeDir, fileName);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Not found" });

  res.download(fullPath, fileName);
});

app.post("/admin/tdok-docs", requireAuth, requireAdmin, (req, res) => {
  const actorRole = (req.user.role || "").toLowerCase();
  const allowAll = actorRole === "super_admin";
  const scopedCompanyId = getScopedCompanyId(req);
  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : scopedCompanyId;
  if (!targetCompanyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const { name, content, content_base64, extracted_text, overwrite } = req.body || {};
  const fileName = sanitizeDocName(name, true);
  if (!fileName) return res.status(400).json({ error: "Invalid filename" });

  const knowledgeDir = getKnowledgeDir(targetCompanyId);
  ensureDirExists(knowledgeDir);
  const fullPath = path.join(knowledgeDir, fileName);

  if (!overwrite && fs.existsSync(fullPath)) {
    return res.status(409).json({ error: "File already exists" });
  }

  try {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".pdf") {
      if (!content_base64) return res.status(400).json({ error: "content_base64 required" });
      const data = String(content_base64).split(",").pop();
      fs.writeFileSync(fullPath, data, { encoding: "base64" });
      if (extracted_text && String(extracted_text).trim()) {
        const sidecarPath = path.join(knowledgeDir, `${fileName}.md`);
        fs.writeFileSync(sidecarPath, String(extracted_text).trim(), "utf8");
      }
    } else {
      fs.writeFileSync(fullPath, String(content || ""), "utf8");
    }
    logAudit({
      req,
      companyId: targetCompanyId,
      actorUserId: getAuthUserId(req),
      action: "TDOK_DOC_CREATED",
      entityType: "tdok_doc",
      entityId: fileName,
      metadata: { name: fileName },
      success: true
    });
    res.status(201).json({ name: fileName });
  } catch (err) {
    console.error("Kunde inte spara TDOK-dokument:", err);
    res.status(500).json({ error: "Could not save document" });
  }
});

app.put("/admin/tdok-docs/:name", requireAuth, requireAdmin, (req, res) => {
  const actorRole = (req.user.role || "").toLowerCase();
  const allowAll = actorRole === "super_admin";
  const scopedCompanyId = getScopedCompanyId(req);
  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : scopedCompanyId;
  if (!targetCompanyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const currentName = sanitizeDocName(req.params.name, true);
  if (!currentName) return res.status(400).json({ error: "Invalid filename" });
  const { content, content_base64, extracted_text, new_name } = req.body || {};
  const nextName = new_name ? sanitizeDocName(new_name, true) : currentName;
  if (!nextName) return res.status(400).json({ error: "Invalid filename" });

  const knowledgeDir = getKnowledgeDir(targetCompanyId);
  ensureDirExists(knowledgeDir);
  const currentPath = path.join(knowledgeDir, currentName);
  if (!fs.existsSync(currentPath)) return res.status(404).json({ error: "Not found" });

  const nextPath = path.join(knowledgeDir, nextName);
  if (nextName !== currentName && fs.existsSync(nextPath)) {
    return res.status(409).json({ error: "File already exists" });
  }

  try {
    if (nextName !== currentName) {
      fs.renameSync(currentPath, nextPath);
      if (path.extname(nextName).toLowerCase() === ".pdf") {
        const currentSidecar = path.join(knowledgeDir, `${currentName}.md`);
        const nextSidecar = path.join(knowledgeDir, `${nextName}.md`);
        if (fs.existsSync(currentSidecar)) {
          fs.renameSync(currentSidecar, nextSidecar);
        }
      }
    }
    const ext = path.extname(nextName).toLowerCase();
    if (ext === ".pdf") {
      if (content_base64) {
        const data = String(content_base64).split(",").pop();
        fs.writeFileSync(nextPath, data, { encoding: "base64" });
      }
      if (extracted_text && String(extracted_text).trim()) {
        const sidecarPath = path.join(knowledgeDir, `${nextName}.md`);
        fs.writeFileSync(sidecarPath, String(extracted_text).trim(), "utf8");
      }
    } else if (content !== undefined) {
      fs.writeFileSync(nextPath, String(content || ""), "utf8");
    }
    logAudit({
      req,
      companyId: targetCompanyId,
      actorUserId: getAuthUserId(req),
      action: "TDOK_DOC_UPDATED",
      entityType: "tdok_doc",
      entityId: nextName,
      metadata: { name: nextName, renamed: nextName !== currentName },
      success: true
    });
    res.json({ name: nextName });
  } catch (err) {
    console.error("Kunde inte uppdatera TDOK-dokument:", err);
    res.status(500).json({ error: "Could not update document" });
  }
});

app.delete("/admin/tdok-docs/:name", requireAuth, requireAdmin, (req, res) => {
  const actorRole = (req.user.role || "").toLowerCase();
  const allowAll = actorRole === "super_admin";
  const scopedCompanyId = getScopedCompanyId(req);
  const targetCompanyId = allowAll && req.query.company_id ? req.query.company_id : scopedCompanyId;
  if (!targetCompanyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const fileName = sanitizeDocName(req.params.name, true);
  if (!fileName) return res.status(400).json({ error: "Invalid filename" });

  const knowledgeDir = getKnowledgeDir(targetCompanyId);
  const fullPath = path.join(knowledgeDir, fileName);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Not found" });

  try {
    fs.unlinkSync(fullPath);
    if (path.extname(fileName).toLowerCase() === ".pdf") {
      const sidecarPath = path.join(knowledgeDir, `${fileName}.md`);
      if (fs.existsSync(sidecarPath)) {
        fs.unlinkSync(sidecarPath);
      }
    }
    logAudit({
      req,
      companyId: targetCompanyId,
      actorUserId: getAuthUserId(req),
      action: "TDOK_DOC_DELETED",
      entityType: "tdok_doc",
      entityId: fileName,
      metadata: { name: fileName },
      success: true
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Kunde inte radera TDOK-dokument:", err);
    res.status(500).json({ error: "Could not delete document" });
  }
});

// ======================
//   PROFILES
// ======================
// GET /profiles (company-scoped)
app.get("/profiles", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const isAdmin = isAdminRole(req);
  const requestedCompanyId = req.query.company_id;
  const targetCompanyId = isAdmin && requestedCompanyId ? requestedCompanyId : companyId;

  const where = [];
  const params = [];

  if (targetCompanyId) {
    where.push("company_id = ?");
    params.push(targetCompanyId);
  }

  if (!isAdmin) {
    where.push("id = ?");
    params.push(req.user.user_id);
  }

  let orderSql = "";
  if (req.query.order === "full_name") {
    orderSql = "ORDER BY first_name, last_name";
  } else if (req.query.order === "id") {
    orderSql = "ORDER BY id";
  }

  const sql = `
    SELECT
      id,
      email,
      role,
      company_id,
      first_name,
      last_name,
      (first_name || ' ' || last_name) AS full_name,
      phone,
      hourly_wage,
      monthly_salary,
      tax_table,
      employee_type,
      employee_number,
      is_active
    FROM users
    WHERE ${where.length ? where.join(" AND ") : "1=1"}
    ${orderSql}
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /profiles:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows || []);
  });
});

// GET /profiles/:id (company-scoped)
app.get("/profiles/:id", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const isAdmin = isAdminRole(req);
  const id = req.params.id;

  if (!isAdmin && Number(id) !== Number(req.user.user_id)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const sql = `
    SELECT
      id,
      email,
      role,
      company_id,
      first_name,
      last_name,
      (first_name || ' ' || last_name) AS full_name,
      phone,
      hourly_wage,
      monthly_salary,
      tax_table,
      employee_type,
      employee_number
     FROM users
     WHERE id = ?${allowAll ? "" : " AND company_id = ?"}
  `;
  const params = allowAll ? [id] : [id, companyId];

  db.get(sql, params, (err, row) => {
    if (err) {
      console.error("DB-fel vid GET /profiles/:id:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });
});

// Register push token for logged-in user
app.post("/push/register", requireAuth, (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token) return res.status(400).json({ error: "token required" });
  const platform = req.body?.platform ? String(req.body.platform) : null;
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Missing user" });

  db.run(
    `INSERT INTO push_tokens (user_id, token, platform, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, updated_at = datetime('now')`,
    [userId, token, platform],
    (err) => {
      if (err) {
        console.error("DB-fel vid POST /push/register:", err);
        return res.status(500).json({ error: "DB error" });
      }
      return res.json({ success: true });
    }
  );
});

// Unregister push token for logged-in user
app.delete("/push/register", requireAuth, (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token) return res.status(400).json({ error: "token required" });
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Missing user" });

  db.run(
    `DELETE FROM push_tokens WHERE token = ? AND user_id = ?`,
    [token, userId],
    (err) => {
      if (err) {
        console.error("DB-fel vid DELETE /push/register:", err);
        return res.status(500).json({ error: "DB error" });
      }
      return res.json({ success: true });
    }
  );
});

// Admin push notifications to selected users
app.post("/admin/push/send", requireAuth, requireAdmin, async (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId && req.company_scope_all !== true) {
    return res.status(400).json({ error: "Company not found" });
  }

  const userIds = Array.isArray(req.body?.user_ids) ? req.body.user_ids : [];
  const title = String(req.body?.title || "Tidrapportering");
  const body = String(req.body?.body || "").trim();

  if (!userIds.length) return res.status(400).json({ error: "user_ids required" });
  if (!body) return res.status(400).json({ error: "body required" });

  try {
    const tokens = await fetchPushTokensForUsers(
      userIds.map(String),
      companyId,
      req.company_scope_all === true
    );
    const result = await sendExpoPush(tokens, { title, body, data: { type: "admin_push" } });
    return res.json({ success: true, tokens: tokens.length, sent: result.sent });
  } catch (err) {
    console.error("Push send error:", err);
    return res.status(500).json({ error: "Push send failed" });
  }
});

// ======================
//   FORTNOX LÖNEKODER & MAPPNINGAR
// ======================
app.get("/fortnox_salary_codes", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  const requestedCompanyId = req.query.company_id;
  const targetCompanyId = allowAll && requestedCompanyId ? requestedCompanyId : companyId;

  if (!targetCompanyId && !allowAll) {
    return res.status(400).json({ error: "Company not found" });
  }

  const where = [];
  const params = [];
  if (!allowAll) {
    where.push("(company_id IS NULL OR company_id = ?)");
    params.push(targetCompanyId);
  } else if (requestedCompanyId) {
    where.push("(company_id IS NULL OR company_id = ?)");
    params.push(requestedCompanyId);
  }

  const sql = `
    SELECT code, name, description, category, default_fortnox_code, company_id
    FROM fortnox_salary_codes
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY name
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /fortnox_salary_codes:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows || []);
  });
});

app.post("/fortnox_salary_codes", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  const {
    code,
    name,
    description = null,
    category = "custom",
    default_fortnox_code = null,
    company_id
  } = req.body || {};

  const targetCompanyId = allowAll && company_id ? company_id : companyId;
  if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });
  if (!code || !name) return res.status(400).json({ error: "code and name required" });

  db.run(
    `INSERT INTO fortnox_salary_codes
     (code, name, description, category, default_fortnox_code, company_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [code, name, description, category, default_fortnox_code, targetCompanyId],
    function (err) {
      if (err) {
        console.error("DB-fel vid POST /fortnox_salary_codes:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.status(201).json({
        code,
        name,
        description,
        category,
        default_fortnox_code,
        company_id: targetCompanyId
      });
    }
  );
});

app.delete("/fortnox_salary_codes", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  const { code, company_id } = req.body || {};
  const targetCompanyId = allowAll && company_id ? company_id : companyId;

  if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });
  if (!code) return res.status(400).json({ error: "code required" });

  db.run(
    "DELETE FROM fortnox_salary_codes WHERE code = ? AND company_id = ?",
    [code, targetCompanyId],
    function (err) {
      if (err) {
        console.error("DB-fel vid DELETE /fortnox_salary_codes:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (this.changes === 0) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    }
  );
});

app.get("/fortnox_company_mappings", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  const requestedCompanyId = req.query.company_id;
  const targetCompanyId = allowAll && requestedCompanyId ? requestedCompanyId : companyId;

  if (!targetCompanyId && !allowAll) {
    return res.status(400).json({ error: "Company not found" });
  }

  const where = [];
  const params = [];
  if (!allowAll || requestedCompanyId) {
    where.push("company_id = ?");
    params.push(targetCompanyId);
  }

  const sql = `
    SELECT company_id, internal_code, fortnox_code, fortnox_description
    FROM fortnox_company_mappings
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY internal_code
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /fortnox_company_mappings:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows || []);
  });
});

app.post("/fortnox_company_mappings", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  const payload = req.body || {};
  const mappings = Array.isArray(payload) ? payload : [payload];

  if (!mappings.length) return res.status(400).json({ error: "No mappings provided" });

  const normalized = [];
  for (const mapping of mappings) {
    const targetCompanyId = allowAll && mapping.company_id ? mapping.company_id : companyId;
    if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });
    if (!mapping.internal_code || !mapping.fortnox_code) {
      return res.status(400).json({ error: "internal_code and fortnox_code required" });
    }
    normalized.push({
      company_id: targetCompanyId,
      internal_code: mapping.internal_code,
      fortnox_code: String(mapping.fortnox_code).trim(),
      fortnox_description: mapping.fortnox_description || null
    });
  }

  const sql = `
    INSERT INTO fortnox_company_mappings
      (company_id, internal_code, fortnox_code, fortnox_description, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(company_id, internal_code) DO UPDATE SET
      fortnox_code = excluded.fortnox_code,
      fortnox_description = excluded.fortnox_description,
      updated_at = CURRENT_TIMESTAMP
  `;

  let pending = normalized.length;
  let responded = false;
  for (const mapping of normalized) {
    db.run(
      sql,
      [
        mapping.company_id,
        mapping.internal_code,
        mapping.fortnox_code,
        mapping.fortnox_description
      ],
      (err) => {
        if (responded) return;
        if (err) {
          responded = true;
          console.error("DB-fel vid POST /fortnox_company_mappings:", err);
          return res.status(500).json({ error: "DB error" });
        }
        pending -= 1;
        if (pending === 0 && !responded) {
          res.json(normalized);
        }
      }
    );
  }
});

app.delete("/fortnox_company_mappings", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  const payload = req.body || {};
  const targetCompanyId = allowAll && payload.company_id ? payload.company_id : companyId;
  if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });

  const codes = Array.isArray(payload.internal_codes)
    ? payload.internal_codes.map((code) => String(code)).filter(Boolean)
    : [];

  let sql = "DELETE FROM fortnox_company_mappings WHERE company_id = ?";
  const params = [targetCompanyId];
  if (codes.length) {
    sql += ` AND internal_code IN (${codes.map(() => "?").join(",")})`;
    params.push(...codes);
  }

  db.run(sql, params, function (err) {
    if (err) {
      console.error("DB-fel vid DELETE /fortnox_company_mappings:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json({ success: true, deleted: this.changes || 0 });
  });
});

app.post("/fortnox_export_logs", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  const {
    company_id,
    period_start,
    period_end,
    employee_count,
    entry_count,
    exported_by,
    filename
  } = req.body || {};

  const targetCompanyId = allowAll && company_id ? company_id : companyId;
  if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });

  db.run(
    `INSERT INTO fortnox_export_logs
     (company_id, period_start, period_end, employee_count, entry_count, exported_by, filename)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      targetCompanyId,
      period_start || null,
      period_end || null,
      employee_count || 0,
      entry_count || 0,
      exported_by || getAuthUserId(req),
      filename || null
    ],
    function (err) {
      if (err) {
        console.error("DB-fel vid POST /fortnox_export_logs:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.post("/admin/fortnox/attendance", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { transactions, company_id } = req.body || {};
    const allowAll = req.company_scope_all === true;
    const targetCompanyId = allowAll && company_id ? company_id : getScopedCompanyId(req);
    if (!targetCompanyId) return res.status(400).json({ error: "company_id required" });

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: "transactions required" });
    }

    const accessToken = await getFortnoxAccessToken(targetCompanyId);
    if (!accessToken) {
      return res.status(409).json({ error: "Fortnox not connected" });
    }

    const endpoint = `${FORTNOX_API_BASE}/attendancetransactions`;
    for (const tx of transactions) {
      const payload = {
        AttendanceTransaction: {
          CauseCode: tx.CauseCode,
          Date: tx.Date,
          EmployeeId: tx.EmployeeId,
          Hours: String(tx.Hours),
          ...(tx.Project ? { Project: tx.Project } : {}),
          ...(tx.CostCenter ? { CostCenter: tx.CostCenter } : {}),
        }
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      if (!response.ok) {
        // Try to parse JSON error from Fortnox for clearer logs
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          parsed = null;
        }
        const errMessage =
          (parsed && (parsed.ErrorInformation?.message || parsed.ErrorInformation?.Message || parsed.error || parsed.message)) ||
          text ||
          `HTTP ${response.status}`;
        console.error("Fortnox attendance push failed:", response.status, errMessage, parsed || text);
        return res.status(502).json({
          success: false,
          status: response.status,
          error: errMessage,
          raw: parsed || text,
        });
      }
    }

    return res.json({ success: true, created: transactions.length });
  } catch (err) {
    console.error("Error in /admin/fortnox/attendance:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ======================
//   OB / ÖVERTID / RESTID INSTÄLLNINGAR
// ======================
// GET /shift_types_config (alias för frontend)
app.get("/shift_types_config", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  if (allowAll) {
    return res.json(DEFAULT_SHIFT_CONFIGS);
  }

  ensureShiftConfigs(companyId, (seedErr) => {
    if (seedErr) {
      console.error("DB-fel vid seed shift_types_config:", seedErr);
      return res.status(500).json({ error: "DB error" });
    }

    db.all(
      `SELECT * FROM shift_types_config
       WHERE company_id = ?
       ORDER BY CASE shift_type
         WHEN 'day' THEN 1
         WHEN 'evening' THEN 2
         WHEN 'night' THEN 3
         WHEN 'weekend' THEN 4
         WHEN 'overtime_day' THEN 5
         WHEN 'overtime_weekend' THEN 6
         ELSE 99
       END`,
      [companyId],
      (err, rows) => {
        if (err) {
          console.error("DB-fel vid GET /shift_types_config:", err);
          return res.status(500).json({ error: "DB error" });
        }
        res.json(rows || []);
      }
    );
  });
});

// GET /admin/ob-settings (read for all authenticated users)
app.get("/admin/ob-settings", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  if (allowAll) {
    return res.json(DEFAULT_SHIFT_CONFIGS);
  }

  ensureShiftConfigs(companyId, (seedErr) => {
    if (seedErr) {
      console.error("DB-fel vid seed shift_types_config:", seedErr);
      return res.status(500).json({ error: "DB error" });
    }

    db.all(
      `SELECT * FROM shift_types_config
       WHERE company_id = ?
       ORDER BY CASE shift_type
         WHEN 'day' THEN 1
         WHEN 'evening' THEN 2
         WHEN 'night' THEN 3
         WHEN 'weekend' THEN 4
         WHEN 'overtime_day' THEN 5
         WHEN 'overtime_weekend' THEN 6
         ELSE 99
       END`,
      [companyId],
      (err, rows) => {
        if (err) {
          console.error("DB-fel vid GET /admin/ob-settings:", err);
          return res.status(500).json({ error: "DB error" });
        }
        res.json(rows || []);
      }
    );
  });
});

// PATCH /admin/ob-settings/:id (admin)
app.patch("/admin/ob-settings/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const { id } = req.params;
  const { multiplier, start_hour, end_hour } = req.body || {};

  db.run(
    `UPDATE shift_types_config
     SET multiplier = COALESCE(?, multiplier),
         start_hour = COALESCE(?, start_hour),
         end_hour = COALESCE(?, end_hour)
     WHERE id = ? AND company_id = ?`,
    [
      multiplier ?? null,
      start_hour ?? null,
      end_hour ?? null,
      id,
      companyId
    ],
    function (err) {
      if (err) {
        console.error("DB-fel vid PATCH /admin/ob-settings:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (this.changes === 0) return res.status(404).json({ error: "Not found" });
      db.get(
        "SELECT * FROM shift_types_config WHERE id = ? AND company_id = ?",
        [id, companyId],
        (e2, row) => {
          if (e2 || !row) return res.status(404).json({ error: "Not found" });
          logAudit({
            req,
            companyId,
            actorUserId: getAuthUserId(req),
            action: "SETTINGS_UPDATED",
            entityType: "ob_settings",
            entityId: id,
            metadata: { multiplier, start_hour, end_hour },
            success: true
          });
          res.json(row);
        }
      );
    }
  );
});

// GET /admin/compensation-settings (restid)
app.get("/admin/compensation-settings", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  if (allowAll) {
    return res.json({ travel_rate: DEFAULT_TRAVEL_RATE });
  }

  ensureCompensationSettings(companyId, (seedErr) => {
    if (seedErr) {
      console.error("DB-fel vid seed compensation_settings:", seedErr);
      return res.status(500).json({ error: "DB error" });
    }
    db.get(
      "SELECT travel_rate FROM compensation_settings WHERE company_id = ?",
      [companyId],
      (err, row) => {
        if (err || !row) {
          console.error("DB-fel vid GET /admin/compensation-settings:", err);
          return res.status(500).json({ error: "DB error" });
        }
        res.json(row);
      }
    );
  });
});

// PATCH /admin/compensation-settings (admin)
app.patch("/admin/compensation-settings", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const { travel_rate } = req.body || {};
  if (travel_rate == null || Number.isNaN(Number(travel_rate))) {
    return res.status(400).json({ error: "travel_rate required" });
  }

  ensureCompensationSettings(companyId, (seedErr) => {
    if (seedErr) {
      console.error("DB-fel vid seed compensation_settings:", seedErr);
      return res.status(500).json({ error: "DB error" });
    }
    db.run(
      "UPDATE compensation_settings SET travel_rate = ? WHERE company_id = ?",
      [Number(travel_rate), companyId],
      function (err) {
        if (err) {
          console.error("DB-fel vid PATCH /admin/compensation-settings:", err);
          return res.status(500).json({ error: "DB error" });
        }
        db.get(
          "SELECT travel_rate FROM compensation_settings WHERE company_id = ?",
          [companyId],
          (e2, row) => {
            if (e2 || !row) return res.status(500).json({ error: "DB error" });
            logAudit({
              req,
              companyId,
              actorUserId: getAuthUserId(req),
              action: "SETTINGS_UPDATED",
              entityType: "compensation_settings",
              entityId: companyId,
              metadata: { travel_rate: Number(travel_rate) },
              success: true
            });
            res.json(row);
          }
        );
      }
    );
  });
});

// ======================
//   PLANERINGSUPPDRAG
// ======================
// Hämta planeringar: admin ser alla inom sitt företag, övriga ser sina egna
app.get("/plans", requireAuth, (req, res) => {
  const admin = isAdminRole(req);
  const companyId = getScopedCompanyId(req);
  const requestedUserId = req.query.user_id ? Number(req.query.user_id) : null;
  const params = [];
  const where = [];

  let sql = `
    SELECT p.*, u.first_name, u.last_name, u.email, u.company_id
    FROM plans p
    JOIN users u ON u.id = p.user_id
  `;

  if (companyId) {
    where.push("u.company_id = ?");
    params.push(companyId);
  }
  if (requestedUserId) {
    // Om specifik användare efterfrågas, säkerställ åtkomst
    if (!admin && requestedUserId !== Number(getAuthUserId(req))) {
      return res.status(403).json({ error: "Unauthorized to view andra användares planering" });
    }
    where.push("p.user_id = ?");
    params.push(requestedUserId);
  } else if (!admin) {
    where.push("p.user_id = ?");
    params.push(getAuthUserId(req));
  }

  if (where.length) {
    sql += " WHERE " + where.join(" AND ");
  }
  sql += " ORDER BY p.start_date, p.end_date";

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /plans:", err);
      return res.status(500).json({ error: "Kunde inte hämta planeringar." });
    }
    res.json(rows || []);
  });
});

// Alias för användarnas egen vy (frontend förväntar sig /scheduled-assignments)
app.get("/scheduled-assignments", requireAuth, (req, res) => {
  const admin = isAdminRole(req);
  const companyId = getScopedCompanyId(req);
  const userId = req.query.user_id ? Number(req.query.user_id) : Number(getAuthUserId(req));

  if (!admin && userId !== Number(getAuthUserId(req))) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const params = [userId];
  let sql = `
    SELECT p.*, u.company_id
    FROM plans p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ?
  `;
  if (companyId) {
    sql += " AND u.company_id = ?";
    params.push(companyId);
  }

  sql += " ORDER BY p.start_date, p.end_date";

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /scheduled-assignments:", err);
      return res.status(500).json({ error: "Kunde inte hämta planeringar." });
    }
    const mapped = (rows || []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      project_id: r.project || "",
      subproject_id: r.subproject || null,
      start_date: r.start_date,
      end_date: r.end_date,
      notes: r.notes,
      first_shift_start_time: r.first_shift_start_time || null,
      contact_person: r.contact_person || null,
      contact_phone: r.contact_phone || null,
      vehicle: r.vehicle || null,
      work_address: r.work_address || null,
      is_tentative: r.tentative === 1 || r.tentative === true,
      projects: { name: r.project || "" },
      subprojects: r.subproject ? { name: r.subproject } : null,
    }));
    res.json(mapped);
  });
});

// Skapa planering (admin/super_admin eller användare för sig själv)
app.post("/plans", requireAuth, (req, res) => {
  const {
    user_id,
    project,
    subproject = "",
    contact_person = "",
    contact_phone = "",
    vehicle = "",
    destination = "",
    start_date,
    end_date,
    tentative = false,
    notes = "",
    first_shift_start_time = null,
    work_address = null,
  } = req.body || {};

  if (!user_id || !project || !start_date || !end_date) {
    return res.status(400).json({ error: "user_id, project, start_date och end_date krävs." });
  }

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (isNaN(start) || isNaN(end)) {
    return res.status(400).json({ error: "Ogiltiga datum." });
  }
  if (end < start) {
    return res.status(400).json({ error: "Slutdatum kan inte vara före startdatum." });
  }

  const cleanTentative = tentative ? 1 : 0;
  db.get(`SELECT company_id FROM users WHERE id = ?`, [user_id], (uErr, uRow) => {
    if (uErr) {
      console.error("DB-fel vid SELECT user för plan:", uErr);
      return res.status(500).json({ error: "DB error" });
    }
    if (!uRow) return res.status(400).json({ error: "Okänd användare" });
    const scopedCompanyId = getScopedCompanyId(req);
    const isAdminUser = isAdminRole(req);
    if (scopedCompanyId && String(scopedCompanyId) !== String(uRow.company_id)) {
      return res.status(403).json({ error: "Användaren tillhör inte företaget" });
    }
    if (!isAdminUser && Number(user_id) !== Number(getAuthUserId(req))) {
      return res.status(403).json({ error: "Endast admin eller användaren själv kan skapa plan" });
    }

    const sql = `
      INSERT INTO plans
        (user_id, project, subproject, contact_person, contact_phone, vehicle, destination, start_date, end_date, tentative, notes, first_shift_start_time, work_address, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;
    const params = [
      user_id,
      String(project).trim(),
      String(subproject || "").trim(),
      String(contact_person || "").trim(),
      String(contact_phone || "").trim(),
      String(vehicle || "").trim(),
      String(destination || "").trim(),
      start_date,
      end_date,
      cleanTentative,
      String(notes || "").trim(),
      first_shift_start_time ? String(first_shift_start_time) : null,
      work_address ? String(work_address) : null,
    ];

    db.run(sql, params, function (err) {
      if (err) {
        console.error("DB-fel vid POST /plans:", err);
        return res.status(500).json({ error: "Kunde inte spara planeringen." });
      }
      db.get(
        `SELECT p.*, u.first_name, u.last_name, u.email
         FROM plans p
         JOIN users u ON u.id = p.user_id
         WHERE p.id = ?`,
        [this.lastID],
        (gErr, row) => {
          if (gErr) {
            console.error("DB-fel vid GET ny planering:", gErr);
            return res.status(201).json({ id: this.lastID });
          }
          const companyForPush = scopedCompanyId || uRow.company_id;
          fetchPushTokensForUsers([String(user_id)], companyForPush)
            .then((tokens) => {
              if (tokens.length === 0) return null;
              return sendExpoPush(tokens, {
                title: "Planering uppdaterad",
                body: `Ny planering: ${String(project).trim()}`,
                data: { type: "plan_updated", plan_id: this.lastID }
              });
            })
            .catch((pushErr) => {
              console.error("Push plan error:", pushErr);
            });
          res.status(201).json(row);
        }
      );
    });
  });
});

// =========================
//   YRKESROLLER (job_roles)
// =========================

// Hämta alla yrkesroller – används av både admin & tidrapport (företagsscope)
app.get("/job-roles", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const sql = allowAll
    ? `SELECT id, name FROM job_roles ORDER BY name`
    : `SELECT id, name FROM job_roles WHERE company_id = ? ORDER BY name`;
  const params = allowAll ? [] : [companyId];

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /job-roles:", err);
      return res.status(500).json({ error: "Kunde inte hämta yrkesroller." });
    }
    res.json(rows || []);
  });
});

// Skapa ny yrkesroll (admin)
app.post("/job-roles", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Namn på yrkesroll krävs." });
  }

  const cleanName = name.trim();

  db.run(
    `INSERT INTO job_roles (company_id, name) VALUES (?, ?)`,
    [companyId, cleanName],
    function (err) {
      if (err) {
        console.error("DB-fel vid POST /job-roles:", err);
        return res.status(500).json({ error: "Kunde inte spara yrkesroll." });
      }

      res.status(201).json({
        id: this.lastID,
        name: cleanName
      });
    }
  );
});

// Ta bort yrkesroll (admin)
app.delete("/job-roles/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const { id } = req.params;

  db.run(
    `DELETE FROM job_roles WHERE id = ? AND company_id = ?`,
    [id, companyId],
    function (err) {
      if (err) {
        console.error("DB-fel vid DELETE /job-roles:", err);
        return res.status(500).json({ error: "Kunde inte ta bort yrkesroll." });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Yrkesrollen hittades inte." });
      }

      res.json({ success: true });
    }
  );
});

// ===========================
//   MATERIALTYPER (förbrukning)
// ===========================

// Hämta alla materialtyper – används i material_types.html + tidrapporter (företagsscope)
app.get("/material-types", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const sql = allowAll
    ? `SELECT id, name, unit FROM material_types ORDER BY name`
    : `SELECT id, name, unit FROM material_types WHERE company_id = ? ORDER BY name`;
  const params = allowAll ? [] : [companyId];

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /material-types:", err);
      return res.status(500).json({ error: "Kunde inte hämta materialtyper." });
    }
    res.json(rows || []);
  });
});

// Skapa ny materialtyp (admin)
app.post("/material-types", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const { name, unit } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Namn på materialtyp krävs." });
  }

  const cleanName = name.trim();
  const cleanUnit = (unit || "").trim();

  db.run(
    `INSERT INTO material_types (company_id, name, unit) VALUES (?, ?, ?)`,
    [companyId, cleanName, cleanUnit],
    function (err) {
      if (err) {
        console.error("DB-fel vid POST /material-types:", err);
        return res.status(500).json({ error: "Kunde inte spara materialtyp." });
      }

      res.status(201).json({
        id: this.lastID,
        name: cleanName,
        unit: cleanUnit
      });
    }
  );
});

// Ta bort materialtyp (admin)
app.delete("/material-types/:id", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const { id } = req.params;

  db.run(
    `DELETE FROM material_types WHERE id = ? AND company_id = ?`,
    [id, companyId],
    function (err) {
      if (err) {
        console.error("DB-fel vid DELETE /material-types:", err);
        return res.status(500).json({ error: "Kunde inte ta bort materialtyp." });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Materialtypen hittades inte." });
      }

      res.json({ success: true });
    }
  );
});

// ======================
//   PRICE LISTS (prislista)
// ======================

app.get("/price-list", requireAuth, requireAdmin, (req, res) => {
  const scopedCompanyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  let companyId = scopedCompanyId;
  if (!companyId && allowAll && req.query.company_id) companyId = req.query.company_id;
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const year = Number(req.query.year) || new Date().getFullYear();
  const projectIdParam = req.query.project_id;
  const projectId = projectIdParam ? Number(projectIdParam) : null;
  if (projectIdParam && !Number.isFinite(projectId)) {
    return res.status(400).json({ error: "Invalid project_id" });
  }

  const DEFAULT_SETTINGS = {
    show_day: 1,
    show_evening: 1,
    show_night: 1,
    show_weekend: 1,
    show_overtime_weekday: 1,
    show_overtime_weekend: 1,
    day_start: "06:00",
    day_end: "18:00",
    evening_start: "18:00",
    evening_end: "21:00",
    night_start: "21:00",
    night_end: "06:00",
    weekend_start: "18:00",
    weekend_end: "06:00",
  };

  const normalizeSettings = (row) => ({
    show_day: row?.show_day ?? DEFAULT_SETTINGS.show_day,
    show_evening: row?.show_evening ?? DEFAULT_SETTINGS.show_evening,
    show_night: row?.show_night ?? DEFAULT_SETTINGS.show_night,
    show_weekend: row?.show_weekend ?? DEFAULT_SETTINGS.show_weekend,
    show_overtime_weekday: row?.show_overtime_weekday ?? DEFAULT_SETTINGS.show_overtime_weekday,
    show_overtime_weekend: row?.show_overtime_weekend ?? DEFAULT_SETTINGS.show_overtime_weekend,
    day_start: row?.day_start || DEFAULT_SETTINGS.day_start,
    day_end: row?.day_end || DEFAULT_SETTINGS.day_end,
    evening_start: row?.evening_start || DEFAULT_SETTINGS.evening_start,
    evening_end: row?.evening_end || DEFAULT_SETTINGS.evening_end,
    night_start: row?.night_start || DEFAULT_SETTINGS.night_start,
    night_end: row?.night_end || DEFAULT_SETTINGS.night_end,
    weekend_start: row?.weekend_start || DEFAULT_SETTINGS.weekend_start,
    weekend_end: row?.weekend_end || DEFAULT_SETTINGS.weekend_end,
  });

  const sendResponse = (jobRows, matRows, settings, settingsSource) => {
    res.json({
      year,
      project_id: projectId ? String(projectId) : null,
      settings,
      settings_source: settingsSource,
      job_roles: (jobRows || []).map((row) => ({
        id: String(row.id),
        name: row.name,
        article_number: row.article_number || "",
        day_article_number: row.day_article_number || "",
        evening_article_number: row.evening_article_number || "",
        night_article_number: row.night_article_number || "",
        weekend_article_number: row.weekend_article_number || "",
        overtime_weekday_article_number: row.overtime_weekday_article_number || "",
        overtime_weekend_article_number: row.overtime_weekend_article_number || "",
        per_diem_article_number: row.per_diem_article_number || "",
        travel_time_article_number: row.travel_time_article_number || "",
        day_rate: row.day_rate,
        evening_rate: row.evening_rate,
        night_rate: row.night_rate,
        weekend_rate: row.weekend_rate,
        overtime_weekday_rate: row.overtime_weekday_rate,
        overtime_weekend_rate: row.overtime_weekend_rate,
        per_diem_rate: row.per_diem_rate,
        travel_time_rate: row.travel_time_rate,
      })),
      material_types: (matRows || []).map((row) => ({
        id: String(row.id),
        name: row.name,
        article_number: row.article_number || "",
        price: row.price,
        unit: row.price_unit || row.default_unit || "",
      })),
    });
  };

  const loadRates = (jobRolesSql, jobParams, materialSql, materialParams, settings, settingsSource) => {
    db.all(jobRolesSql, jobParams, (jobErr, jobRows) => {
      if (jobErr) {
        console.error("DB-fel vid GET /price-list job_roles:", jobErr);
        return res.status(500).json({ error: "DB error" });
      }
      db.all(materialSql, materialParams, (matErr, matRows) => {
        if (matErr) {
          console.error("DB-fel vid GET /price-list material_types:", matErr);
          return res.status(500).json({ error: "DB error" });
        }
        sendResponse(jobRows, matRows, settings, settingsSource);
      });
    });
  };

  if (projectId) {
    db.get(
      `SELECT id FROM projects WHERE id = ? AND company_id = ?`,
      [projectId, companyId],
      (pErr, pRow) => {
        if (pErr) {
          console.error("DB-fel vid SELECT project /price-list:", pErr);
          return res.status(500).json({ error: "DB error" });
        }
        if (!pRow) return res.status(404).json({ error: "Project not found" });

        const jobRolesSql = `
          SELECT
            jr.id,
            jr.name,
            pr.article_number,
            pr.day_article_number,
            pr.evening_article_number,
            pr.night_article_number,
            pr.weekend_article_number,
            pr.overtime_weekday_article_number,
            pr.overtime_weekend_article_number,
            pr.per_diem_article_number,
            pr.travel_time_article_number,
            pr.day_rate,
            pr.evening_rate,
            pr.night_rate,
            pr.weekend_rate,
            pr.overtime_weekday_rate,
            pr.overtime_weekend_rate,
            pr.per_diem_rate,
            pr.travel_time_rate
          FROM job_roles jr
          LEFT JOIN project_job_role_rates pr
            ON pr.job_role_id = jr.id
            AND pr.company_id = jr.company_id
            AND pr.project_id = ?
            AND pr.year = ?
          WHERE jr.company_id = ?
          ORDER BY jr.name
        `;

        const materialSql = `
          SELECT
            mt.id,
            mt.name,
            mt.unit AS default_unit,
            pm.article_number,
            pm.price,
            pm.unit AS price_unit
          FROM material_types mt
          LEFT JOIN project_material_type_rates pm
            ON pm.material_type_id = mt.id
            AND pm.company_id = mt.company_id
            AND pm.project_id = ?
            AND pm.year = ?
          WHERE mt.company_id = ?
          ORDER BY mt.name
        `;

        db.get(
          `SELECT * FROM project_price_list_settings WHERE company_id = ? AND year = ? AND project_id = ?`,
          [companyId, year, projectId],
          (sErr, sRow) => {
            if (sErr) {
              console.error("DB-fel vid GET project_price_list_settings:", sErr);
              return res.status(500).json({ error: "DB error" });
            }
            if (sRow) {
              return loadRates(
                jobRolesSql,
                [projectId, year, companyId],
                materialSql,
                [projectId, year, companyId],
                normalizeSettings(sRow),
                "project"
              );
            }
            db.get(
              `SELECT * FROM price_list_settings WHERE company_id = ? AND year = ?`,
              [companyId, year],
              (baseErr, baseRow) => {
                if (baseErr) {
                  console.error("DB-fel vid GET price_list_settings fallback:", baseErr);
                  return res.status(500).json({ error: "DB error" });
                }
                loadRates(
                  jobRolesSql,
                  [projectId, year, companyId],
                  materialSql,
                  [projectId, year, companyId],
                  normalizeSettings(baseRow),
                  baseRow ? "standard" : "default"
                );
              }
            );
          }
        );
      }
    );
  } else {
    const jobRolesSql = `
      SELECT
        jr.id,
        jr.name,
        rr.article_number,
        rr.day_article_number,
        rr.evening_article_number,
        rr.night_article_number,
        rr.weekend_article_number,
        rr.overtime_weekday_article_number,
        rr.overtime_weekend_article_number,
        rr.per_diem_article_number,
        rr.travel_time_article_number,
        rr.day_rate,
        rr.evening_rate,
        rr.night_rate,
        rr.weekend_rate,
        rr.overtime_weekday_rate,
        rr.overtime_weekend_rate,
        rr.per_diem_rate,
        rr.travel_time_rate
      FROM job_roles jr
      LEFT JOIN job_role_rates rr
        ON rr.job_role_id = jr.id
        AND rr.company_id = jr.company_id
        AND rr.year = ?
      WHERE jr.company_id = ?
      ORDER BY jr.name
    `;

    const materialSql = `
      SELECT
        mt.id,
        mt.name,
        mt.unit AS default_unit,
        mr.article_number,
        mr.price,
        mr.unit AS price_unit
      FROM material_types mt
      LEFT JOIN material_type_rates mr
        ON mr.material_type_id = mt.id
        AND mr.company_id = mt.company_id
        AND mr.year = ?
      WHERE mt.company_id = ?
      ORDER BY mt.name
    `;

    db.get(
      `SELECT * FROM price_list_settings WHERE company_id = ? AND year = ?`,
      [companyId, year],
      (sErr, sRow) => {
        if (sErr) {
          console.error("DB-fel vid GET price_list_settings:", sErr);
          return res.status(500).json({ error: "DB error" });
        }
        loadRates(
          jobRolesSql,
          [year, companyId],
          materialSql,
          [year, companyId],
          normalizeSettings(sRow),
          sRow ? "standard" : "default"
        );
      }
    );
  }
});

app.put("/price-list", requireAuth, requireAdmin, async (req, res) => {
  const scopedCompanyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  let companyId = scopedCompanyId;
  if (!companyId && allowAll && req.query.company_id) companyId = req.query.company_id;
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const projectIdParam = req.query.project_id;
  const projectId = projectIdParam ? Number(projectIdParam) : null;
  if (projectIdParam && !Number.isFinite(projectId)) {
    return res.status(400).json({ error: "Invalid project_id" });
  }

  const year = Number(req.query.year || req.body?.year) || new Date().getFullYear();
  if (!Number.isFinite(year)) return res.status(400).json({ error: "Invalid year" });

  const jobRoles = Array.isArray(req.body?.job_roles) ? req.body.job_roles : [];
  const materialTypes = Array.isArray(req.body?.material_types) ? req.body.material_types : [];
  const settingsInput = req.body?.settings || {};

  const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };
  const normalizeArticleNumber = (value) => {
    const raw = String(value ?? "").trim();
    return raw ? raw : null;
  };

  const toBool = (value) => {
    if (value === null || value === undefined) return 1;
    if (value === true || value === "true" || value === 1 || value === "1") return 1;
    return 0;
  };

  const normalizeTime = (value, fallback) => {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    const match = raw.match(/^([0-1]\d|2[0-3]):([0-5]\d)$/);
    return match ? raw : fallback;
  };

  const DEFAULT_SETTINGS = {
    show_day: 1,
    show_evening: 1,
    show_night: 1,
    show_weekend: 1,
    show_overtime_weekday: 1,
    show_overtime_weekend: 1,
    day_start: "06:00",
    day_end: "18:00",
    evening_start: "18:00",
    evening_end: "21:00",
    night_start: "21:00",
    night_end: "06:00",
    weekend_start: "18:00",
    weekend_end: "06:00",
  };

  const normalizedSettings = {
    show_day: toBool(settingsInput.show_day),
    show_evening: toBool(settingsInput.show_evening),
    show_night: toBool(settingsInput.show_night),
    show_weekend: toBool(settingsInput.show_weekend),
    show_overtime_weekday: toBool(settingsInput.show_overtime_weekday),
    show_overtime_weekend: toBool(settingsInput.show_overtime_weekend),
    day_start: normalizeTime(settingsInput.day_start, DEFAULT_SETTINGS.day_start),
    day_end: normalizeTime(settingsInput.day_end, DEFAULT_SETTINGS.day_end),
    evening_start: normalizeTime(settingsInput.evening_start, DEFAULT_SETTINGS.evening_start),
    evening_end: normalizeTime(settingsInput.evening_end, DEFAULT_SETTINGS.evening_end),
    night_start: normalizeTime(settingsInput.night_start, DEFAULT_SETTINGS.night_start),
    night_end: normalizeTime(settingsInput.night_end, DEFAULT_SETTINGS.night_end),
    weekend_start: normalizeTime(settingsInput.weekend_start, DEFAULT_SETTINGS.weekend_start),
    weekend_end: normalizeTime(settingsInput.weekend_end, DEFAULT_SETTINGS.weekend_end),
  };

  const runAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });

  try {
    await runAsync("BEGIN");

    if (projectId) {
      const projectRow = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM projects WHERE id = ? AND company_id = ?`,
          [projectId, companyId],
          (pErr, pRow) => {
            if (pErr) reject(pErr);
            else resolve(pRow);
          }
        );
      });
      if (!projectRow) {
        await runAsync("ROLLBACK");
        return res.status(404).json({ error: "Project not found" });
      }

      for (const role of jobRoles) {
        const roleId = Number(role?.id);
        if (!Number.isFinite(roleId)) continue;
        const articleNumber = normalizeArticleNumber(role.article_number ?? role.artnr);
        const dayArticle = normalizeArticleNumber(role.day_article_number);
        const eveningArticle = normalizeArticleNumber(role.evening_article_number);
        const nightArticle = normalizeArticleNumber(role.night_article_number);
        const weekendArticle = normalizeArticleNumber(role.weekend_article_number);
        const overtimeWeekdayArticle = normalizeArticleNumber(role.overtime_weekday_article_number);
        const overtimeWeekendArticle = normalizeArticleNumber(role.overtime_weekend_article_number);
        const perDiemArticle = normalizeArticleNumber(role.per_diem_article_number);
        const travelArticle = normalizeArticleNumber(role.travel_time_article_number);
        await runAsync(
          `
            INSERT INTO project_job_role_rates (
              company_id, year, project_id, job_role_id, article_number,
              day_article_number, evening_article_number, night_article_number, weekend_article_number,
              overtime_weekday_article_number, overtime_weekend_article_number,
              per_diem_article_number, travel_time_article_number,
              day_rate, evening_rate, night_rate, weekend_rate,
              overtime_weekday_rate, overtime_weekend_rate, per_diem_rate, travel_time_rate,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(company_id, year, project_id, job_role_id) DO UPDATE SET
              article_number = excluded.article_number,
              day_article_number = excluded.day_article_number,
              evening_article_number = excluded.evening_article_number,
              night_article_number = excluded.night_article_number,
              weekend_article_number = excluded.weekend_article_number,
              overtime_weekday_article_number = excluded.overtime_weekday_article_number,
              overtime_weekend_article_number = excluded.overtime_weekend_article_number,
              per_diem_article_number = excluded.per_diem_article_number,
              travel_time_article_number = excluded.travel_time_article_number,
              day_rate = excluded.day_rate,
              evening_rate = excluded.evening_rate,
              night_rate = excluded.night_rate,
              weekend_rate = excluded.weekend_rate,
              overtime_weekday_rate = excluded.overtime_weekday_rate,
              overtime_weekend_rate = excluded.overtime_weekend_rate,
              per_diem_rate = excluded.per_diem_rate,
              travel_time_rate = excluded.travel_time_rate,
              updated_at = datetime('now')
          `,
          [
            companyId,
            year,
            projectId,
            roleId,
            articleNumber,
            dayArticle,
            eveningArticle,
            nightArticle,
            weekendArticle,
            overtimeWeekdayArticle,
            overtimeWeekendArticle,
            perDiemArticle,
            travelArticle,
            toNumberOrNull(role.day_rate),
            toNumberOrNull(role.evening_rate),
            toNumberOrNull(role.night_rate),
            toNumberOrNull(role.weekend_rate),
            toNumberOrNull(role.overtime_weekday_rate),
            toNumberOrNull(role.overtime_weekend_rate),
            toNumberOrNull(role.per_diem_rate),
            toNumberOrNull(role.travel_time_rate),
          ]
        );
      }

      for (const item of materialTypes) {
        const materialId = Number(item?.id);
        if (!Number.isFinite(materialId)) continue;
        const unit = String(item?.unit || "").trim() || null;
        const materialArticle = normalizeArticleNumber(item.article_number ?? item.artnr);
        await runAsync(
          `
            INSERT INTO project_material_type_rates (
              company_id, year, project_id, material_type_id, article_number, price, unit, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(company_id, year, project_id, material_type_id) DO UPDATE SET
              article_number = excluded.article_number,
              price = excluded.price,
              unit = excluded.unit,
              updated_at = datetime('now')
          `,
          [companyId, year, projectId, materialId, materialArticle, toNumberOrNull(item.price), unit]
        );
      }

      await runAsync(
        `
          INSERT INTO project_price_list_settings (
            company_id, year, project_id,
            show_day, show_evening, show_night, show_weekend,
            show_overtime_weekday, show_overtime_weekend,
            day_start, day_end, evening_start, evening_end,
            night_start, night_end, weekend_start, weekend_end,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(company_id, year, project_id) DO UPDATE SET
            show_day = excluded.show_day,
            show_evening = excluded.show_evening,
            show_night = excluded.show_night,
            show_weekend = excluded.show_weekend,
            show_overtime_weekday = excluded.show_overtime_weekday,
            show_overtime_weekend = excluded.show_overtime_weekend,
            day_start = excluded.day_start,
            day_end = excluded.day_end,
            evening_start = excluded.evening_start,
            evening_end = excluded.evening_end,
            night_start = excluded.night_start,
            night_end = excluded.night_end,
            weekend_start = excluded.weekend_start,
            weekend_end = excluded.weekend_end,
            updated_at = datetime('now')
        `,
        [
          companyId,
          year,
          projectId,
          normalizedSettings.show_day,
          normalizedSettings.show_evening,
          normalizedSettings.show_night,
          normalizedSettings.show_weekend,
          normalizedSettings.show_overtime_weekday,
          normalizedSettings.show_overtime_weekend,
          normalizedSettings.day_start,
          normalizedSettings.day_end,
          normalizedSettings.evening_start,
          normalizedSettings.evening_end,
          normalizedSettings.night_start,
          normalizedSettings.night_end,
          normalizedSettings.weekend_start,
          normalizedSettings.weekend_end,
        ]
      );
    } else {
      for (const role of jobRoles) {
        const roleId = Number(role?.id);
        if (!Number.isFinite(roleId)) continue;
        const articleNumber = normalizeArticleNumber(role.article_number ?? role.artnr);
        const dayArticle = normalizeArticleNumber(role.day_article_number);
        const eveningArticle = normalizeArticleNumber(role.evening_article_number);
        const nightArticle = normalizeArticleNumber(role.night_article_number);
        const weekendArticle = normalizeArticleNumber(role.weekend_article_number);
        const overtimeWeekdayArticle = normalizeArticleNumber(role.overtime_weekday_article_number);
        const overtimeWeekendArticle = normalizeArticleNumber(role.overtime_weekend_article_number);
        const perDiemArticle = normalizeArticleNumber(role.per_diem_article_number);
        const travelArticle = normalizeArticleNumber(role.travel_time_article_number);
        await runAsync(
          `
            INSERT INTO job_role_rates (
              company_id, year, job_role_id, article_number,
              day_article_number, evening_article_number, night_article_number, weekend_article_number,
              overtime_weekday_article_number, overtime_weekend_article_number,
              per_diem_article_number, travel_time_article_number,
              day_rate, evening_rate, night_rate, weekend_rate,
              overtime_weekday_rate, overtime_weekend_rate, per_diem_rate, travel_time_rate,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(company_id, year, job_role_id) DO UPDATE SET
              article_number = excluded.article_number,
              day_article_number = excluded.day_article_number,
              evening_article_number = excluded.evening_article_number,
              night_article_number = excluded.night_article_number,
              weekend_article_number = excluded.weekend_article_number,
              overtime_weekday_article_number = excluded.overtime_weekday_article_number,
              overtime_weekend_article_number = excluded.overtime_weekend_article_number,
              per_diem_article_number = excluded.per_diem_article_number,
              travel_time_article_number = excluded.travel_time_article_number,
              day_rate = excluded.day_rate,
              evening_rate = excluded.evening_rate,
              night_rate = excluded.night_rate,
              weekend_rate = excluded.weekend_rate,
              overtime_weekday_rate = excluded.overtime_weekday_rate,
              overtime_weekend_rate = excluded.overtime_weekend_rate,
              per_diem_rate = excluded.per_diem_rate,
              travel_time_rate = excluded.travel_time_rate,
              updated_at = datetime('now')
          `,
          [
            companyId,
            year,
            roleId,
            articleNumber,
            dayArticle,
            eveningArticle,
            nightArticle,
            weekendArticle,
            overtimeWeekdayArticle,
            overtimeWeekendArticle,
            perDiemArticle,
            travelArticle,
            toNumberOrNull(role.day_rate),
            toNumberOrNull(role.evening_rate),
            toNumberOrNull(role.night_rate),
            toNumberOrNull(role.weekend_rate),
            toNumberOrNull(role.overtime_weekday_rate),
            toNumberOrNull(role.overtime_weekend_rate),
            toNumberOrNull(role.per_diem_rate),
            toNumberOrNull(role.travel_time_rate),
          ]
        );
      }

      for (const item of materialTypes) {
        const materialId = Number(item?.id);
        if (!Number.isFinite(materialId)) continue;
        const unit = String(item?.unit || "").trim() || null;
        const materialArticle = normalizeArticleNumber(item.article_number ?? item.artnr);
        await runAsync(
          `
            INSERT INTO material_type_rates (
              company_id, year, material_type_id, article_number, price, unit, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(company_id, year, material_type_id) DO UPDATE SET
              article_number = excluded.article_number,
              price = excluded.price,
              unit = excluded.unit,
              updated_at = datetime('now')
          `,
          [companyId, year, materialId, materialArticle, toNumberOrNull(item.price), unit]
        );
      }

      await runAsync(
        `
          INSERT INTO price_list_settings (
            company_id, year,
            show_day, show_evening, show_night, show_weekend,
            show_overtime_weekday, show_overtime_weekend,
            day_start, day_end, evening_start, evening_end,
            night_start, night_end, weekend_start, weekend_end,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(company_id, year) DO UPDATE SET
            show_day = excluded.show_day,
            show_evening = excluded.show_evening,
            show_night = excluded.show_night,
            show_weekend = excluded.show_weekend,
            show_overtime_weekday = excluded.show_overtime_weekday,
            show_overtime_weekend = excluded.show_overtime_weekend,
            day_start = excluded.day_start,
            day_end = excluded.day_end,
            evening_start = excluded.evening_start,
            evening_end = excluded.evening_end,
            night_start = excluded.night_start,
            night_end = excluded.night_end,
            weekend_start = excluded.weekend_start,
            weekend_end = excluded.weekend_end,
            updated_at = datetime('now')
        `,
        [
          companyId,
          year,
          normalizedSettings.show_day,
          normalizedSettings.show_evening,
          normalizedSettings.show_night,
          normalizedSettings.show_weekend,
          normalizedSettings.show_overtime_weekday,
          normalizedSettings.show_overtime_weekend,
          normalizedSettings.day_start,
          normalizedSettings.day_end,
          normalizedSettings.evening_start,
          normalizedSettings.evening_end,
          normalizedSettings.night_start,
          normalizedSettings.night_end,
          normalizedSettings.weekend_start,
          normalizedSettings.weekend_end,
        ]
      );
    }

    await runAsync("COMMIT");
    res.json({ success: true });
  } catch (err) {
    try {
      await runAsync("ROLLBACK");
    } catch (rollbackErr) {
      console.error("DB-fel vid ROLLBACK /price-list:", rollbackErr);
    }
    console.error("DB-fel vid PUT /price-list:", err);
    res.status(500).json({ error: "DB error" });
  }
});

app.delete("/price-list", requireAuth, requireAdmin, (req, res) => {
  const scopedCompanyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  let companyId = scopedCompanyId;
  if (!companyId && allowAll && req.query.company_id) companyId = req.query.company_id;
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const projectIdParam = req.query.project_id;
  const projectId = projectIdParam ? Number(projectIdParam) : null;
  if (!projectId || !Number.isFinite(projectId)) {
    return res.status(400).json({ error: "project_id required" });
  }

  const year = Number(req.query.year) || new Date().getFullYear();
  if (!Number.isFinite(year)) return res.status(400).json({ error: "Invalid year" });

  db.get(
    `SELECT id FROM projects WHERE id = ? AND company_id = ?`,
    [projectId, companyId],
    (pErr, pRow) => {
      if (pErr) {
        console.error("DB-fel vid SELECT project /price-list delete:", pErr);
        return res.status(500).json({ error: "DB error" });
      }
      if (!pRow) return res.status(404).json({ error: "Project not found" });

      db.run(
        `DELETE FROM project_job_role_rates WHERE company_id = ? AND year = ? AND project_id = ?`,
        [companyId, year, projectId],
        (delErr) => {
          if (delErr) {
            console.error("DB-fel vid DELETE project_job_role_rates:", delErr);
            return res.status(500).json({ error: "DB error" });
          }
          db.run(
            `DELETE FROM project_material_type_rates WHERE company_id = ? AND year = ? AND project_id = ?`,
            [companyId, year, projectId],
            (delMatErr) => {
              if (delMatErr) {
                console.error("DB-fel vid DELETE project_material_type_rates:", delMatErr);
                return res.status(500).json({ error: "DB error" });
              }
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

// ======================
//   KONTAKTER (alla användare)
// ======================
app.get("/contacts", (req, res) => {
  db.all(
    `SELECT id, first_name, last_name, role, email, phone
     FROM users
     ORDER BY first_name, last_name, email`,
    (err, rows) => {
      if (err) {
        console.error("DB-fel vid GET /contacts:", err);
        return res.status(500).json({ error: "Kunde inte hämta kontakter." });
      }
      res.json(rows || []);
    }
  );
});

// Debug – visar users
app.get("/debug-users", (req, res) => {
  db.all(`SELECT id, email, username, role, company_id FROM users`, (err, rows) => {
    if (err) return res.status(500).json({ error: "DB-fel" });
    res.json(rows);
  });
});

// ==========================
//   TIME REPORTS (tidrapporter)
// ==========================

// Markera tidrapporter som fakturerade (admin)
app.post("/admin/time-entries/mark-invoiced", requireAuth, requireAdmin, (req, res) => {
  const { ids, invoiced = true, company_id } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids required" });
  }

  const allowAll = req.company_scope_all === true;
  const targetCompanyId = allowAll && company_id ? company_id : getScopedCompanyId(req);
  if (!targetCompanyId) return res.status(400).json({ error: "Company not found" });

  const normalizedIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));

  if (normalizedIds.length === 0) {
    return res.status(400).json({ error: "ids required" });
  }
  if (normalizedIds.length > 500) {
    return res.status(400).json({ error: "Too many ids" });
  }

  const flag = invoiced === false || invoiced === 0 || invoiced === "0" ? 0 : 1;
  const invoicedAt = flag ? new Date().toISOString() : null;
  const invoicedBy = flag ? getAuthUserId(req) : null;

  const placeholders = normalizedIds.map(() => "?").join(",");
  const sql = `
    UPDATE time_reports
    SET invoiced = ?, invoiced_at = ?, invoiced_by = ?
    WHERE id IN (${placeholders})
      AND user_id IN (SELECT id FROM users WHERE company_id = ?)
  `;

  db.run(sql, [flag, invoicedAt, invoicedBy, ...normalizedIds, targetCompanyId], function (err) {
    if (err) {
      console.error("DB-fel vid markera fakturerade tidrapporter:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json({ updated: this.changes || 0 });
  });
});

// Hämta tidrapporter
// Alias: TIME ENTRIES (tenant-scoped, with filters)
app.get("/time-entries", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const {
    from,
    to,
    user_id,
    status,
    project_id,
    customer_id,
    include_materials,
    limit
  } = req.query || {};

  const isAdmin = (req.user?.role || "").toLowerCase() === "admin" || (req.user?.role || "").toLowerCase() === "super_admin";
  const effectiveUserId = isAdmin ? user_id : req.user.user_id;

  const where = [];
  const params = [];

  if (!allowAll) {
    where.push("u.company_id = ?");
    params.push(companyId);
  }
  if (from) { where.push("date(tr.datum) >= date(?)"); params.push(from); }
  if (to) { where.push("date(tr.datum) <= date(?)"); params.push(to); }

  if (effectiveUserId) { where.push("tr.user_id = ?"); params.push(effectiveUserId); }
  if (status) { where.push("tr.status = ?"); params.push(status); }
  if (project_id) { where.push("tr.project_id = ?"); params.push(project_id); }

  let join = `JOIN users u ON u.id = tr.user_id`;
  join += ` LEFT JOIN projects p ON p.id = tr.project_id AND p.company_id = u.company_id`;
  join += ` LEFT JOIN subprojects sp ON sp.id = tr.subproject_id AND sp.company_id = u.company_id`;
  join += ` LEFT JOIN job_roles jr ON jr.id = tr.job_role_id AND jr.company_id = u.company_id`;
  join += ` LEFT JOIN customers c ON c.id = p.customer_id AND c.company_id = u.company_id`;

  if (customer_id) { where.push("p.customer_id = ?"); params.push(customer_id); }

  const limitNum = limit ? Math.min(500, Math.max(1, Number(limit))) : null;

  const sql = `
    SELECT
      tr.*,
      u.email AS user_email,
      (u.first_name || ' ' || u.last_name) AS user_full_name,
      p.name AS project_name,
      sp.name AS subproject_name,
      jr.name AS job_role_name,
      c.name AS customer_name
    FROM time_reports tr
    ${join}
    WHERE ${where.length ? where.join(" AND ") : "1=1"}
    ORDER BY date(tr.datum) DESC, tr.id DESC
    ${limitNum ? `LIMIT ${limitNum}` : ""}
  `;

  db.all(sql, params, async (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error", details: String(err) });

    if (String(include_materials) === "true") {
      const ids = rows.map(r => r.id);
      if (ids.length === 0) return res.json([]);

      const placeholders = ids.map(() => "?").join(",");
      db.all(
        `SELECT * FROM report_materials WHERE report_id IN (${placeholders})`,
        ids,
        (e2, mats) => {
          if (e2) return res.status(500).json({ error: "DB error", details: String(e2) });

          const byReport = new Map();
          for (const m of mats) {
            if (!byReport.has(m.report_id)) byReport.set(m.report_id, []);
            byReport.get(m.report_id).push(m);
          }
          const out = rows.map(r => ({ ...r, materials: byReport.get(r.id) || [] }));
          res.json(out);
        }
      );
    } else {
      res.json(rows);
    }
  });
});

// GET /comp-time-balance (sum of saved - taken comp time hours)
app.get("/comp-time-balance", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const isAdmin = isAdminRole(req);
  const targetUserId = isAdmin && req.query.user_id ? req.query.user_id : getAuthUserId(req);

  if (!targetUserId) return res.status(400).json({ error: "user_id required" });

  const sql = `
    SELECT
      SUM(
        CASE
          WHEN COALESCE(tr.comp_time_saved_hours, 0) > 0 THEN COALESCE(tr.comp_time_saved_hours, 0)
          WHEN tr.save_comp_time = 1 THEN COALESCE(tr.overtime_weekday_hours, 0) + COALESCE(tr.overtime_weekend_hours, 0)
          ELSE 0
        END
      ) AS saved_hours,
      SUM(COALESCE(tr.comp_time_taken_hours, 0)) AS taken_hours
    FROM time_reports tr
    JOIN users u ON u.id = tr.user_id
    WHERE u.company_id = ? AND tr.user_id = ?
  `;

  db.get(sql, [companyId, targetUserId], (err, row) => {
    if (err) {
      console.error("DB-fel vid GET /comp-time-balance:", err);
      return res.status(500).json({ error: "DB error" });
    }

    const saved = Number(row?.saved_hours || 0);
    const taken = Number(row?.taken_hours || 0);
    res.json({
      saved_hours: saved,
      taken_hours: taken,
      balance_hours: saved - taken
    });
  });
});

// POST /time-entries (create time report)
app.post("/time-entries", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const isAdmin = (req.user?.role || "").toLowerCase() === "admin" || (req.user?.role || "").toLowerCase() === "super_admin";
  const userId = isAdmin && req.body.user_id ? req.body.user_id : req.user.user_id;

  const {
    date, // maps to datum
    hours, // maps to timmar
    start_time,
    end_time,
    break_minutes = 0,
    job_role_id,
    project_id,
    subproject_id,
    description, // maps to comment
    status,
    allowance_type, // maps to traktamente_type
    allowance_amount, // maps to traktamente_amount
    deviation_title = null,
    deviation_description = null,
    deviation_status = null,
    travel_time_hours = 0,
    save_travel_compensation = 0,
    overtime_weekday_hours = 0,
    overtime_weekend_hours = 0,
    save_comp_time = 0,
    comp_time_saved_hours = 0,
    comp_time_taken_hours = 0,
    km,
    km_compensation
  } = req.body || {};

  if (!date) return res.status(400).json({ error: "date required" });

  const saveTravelFlag = save_travel_compensation === true || save_travel_compensation === 1 || save_travel_compensation === "1";
  const compTimeSavedValue = Number(comp_time_saved_hours) || 0;
  const saveCompTimeFlag =
    save_comp_time === true || save_comp_time === 1 || save_comp_time === "1" || compTimeSavedValue > 0;

  const calcHours = () => {
    if (!start_time || !end_time) return null;
    const [sH, sM] = start_time.split(":").map(Number);
    const [eH, eM] = end_time.split(":").map(Number);
    if ([sH, sM, eH, eM].some((v) => Number.isNaN(v))) return null;
    const startDate = new Date();
    startDate.setHours(sH, sM, 0, 0);
    const endDate = new Date();
    endDate.setHours(eH, eM, 0, 0);
    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
    const totalMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    const effectiveBreak = Math.max(0, Math.min(Number(break_minutes) || 0, totalMinutes));
    const workMinutes = Math.max(0, totalMinutes - effectiveBreak);
    return workMinutes > 0 ? workMinutes / 60 : 0;
  };

  const hoursValue = hours != null ? Number(hours) : calcHours();
  if (hoursValue == null || Number.isNaN(hoursValue) || hoursValue <= 0) {
    return res.status(400).json({ error: "hours required" });
  }

  // Validate target user belongs to the scoped company
  db.get("SELECT company_id FROM users WHERE id = ?", [userId], (uErr, uRow) => {
    if (uErr) {
      console.error("DB-fel vid SELECT user for time entry:", uErr);
      return res.status(500).json({ error: "DB error" });
    }
    if (!uRow) return res.status(400).json({ error: "Invalid user_id" });
    const effectiveCompanyId = allowAll ? uRow.company_id : companyId;
    if (!effectiveCompanyId) return res.status(400).json({ error: "Company not found" });
    if (String(uRow.company_id) !== String(effectiveCompanyId)) {
      return res.status(403).json({ error: "User not in company" });
    }

    // If project_id provided, ensure project belongs to company
    const checkProject = project_id ? `SELECT id FROM projects WHERE id = ? AND company_id = ?` : null;
    const checkSubproject = subproject_id ? `SELECT id, project_id FROM subprojects WHERE id = ? AND company_id = ?` : null;

    function performInsert() {
      db.run(
        `INSERT INTO time_reports (
          user_id, user_name, datum, starttid, sluttid, timmar, project_id, subproject_id, job_role_id, comment, deviation_title, deviation_description, deviation_status, restid, save_travel_compensation, overtime_weekday_hours, overtime_weekend_hours, save_comp_time, comp_time_saved_hours, comp_time_taken_hours, status, traktamente_type, traktamente_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          null,
          date,
          start_time || null,
          end_time || null,
          Number(hoursValue),
          project_id || null,
          subproject_id || null,
          job_role_id || null,
          description || null,
          deviation_title || null,
          deviation_description || null,
          deviation_status || null,
          Number(travel_time_hours) || 0,
          saveTravelFlag ? 1 : 0,
          Number(overtime_weekday_hours) || 0,
          Number(overtime_weekend_hours) || 0,
          saveCompTimeFlag ? 1 : 0,
          compTimeSavedValue,
          Number(comp_time_taken_hours) || 0,
          status || "draft",
          allowance_type || null,
          allowance_amount || null
        ],
        function (iErr) {
          if (iErr) {
            console.error("DB-fel vid INSERT time_report:", iErr);
            return res.status(500).json({ error: "DB error", details: String(iErr) });
          }
          const newId = this.lastID;
          db.get(`SELECT * FROM time_reports WHERE id = ?`, [newId], (gErr, row) => {
            if (gErr) {
              console.error("DB-fel vid SELECT ny time_report:", gErr);
              return res.status(500).json({ error: "DB error", details: String(gErr) });
            }
            logAudit({
              req,
              companyId: effectiveCompanyId,
              actorUserId: getAuthUserId(req),
              action: "TIME_ENTRY_CREATED",
              entityType: "time_entry",
              entityId: newId,
              metadata: { user_id: userId, date, hours: Number(hoursValue) || 0 },
              success: true
            });
            res.json(row);
          });
        }
      );
    }

    function doInsert() {
      if (!job_role_id) return performInsert();

      db.get(
        `SELECT id FROM job_roles WHERE id = ? AND company_id = ?`,
        [job_role_id, effectiveCompanyId],
        (jrErr, jrRow) => {
          if (jrErr) {
            console.error("DB-fel vid SELECT job_role för time entry:", jrErr);
            return res.status(500).json({ error: "DB error" });
          }
          if (!jrRow) return res.status(400).json({ error: "Invalid job_role_id" });
          performInsert();
        }
      );
    }

    if (checkProject) {
      db.get(checkProject, [project_id, effectiveCompanyId], (pErr, pRow) => {
        if (pErr) {
          console.error("DB-fel vid SELECT project for time entry:", pErr);
          return res.status(500).json({ error: "DB error" });
        }
        if (!pRow) return res.status(400).json({ error: "Invalid project_id" });

        if (checkSubproject) {
          db.get(checkSubproject, [subproject_id, effectiveCompanyId], (sErr, sRow) => {
            if (sErr) {
              console.error("DB-fel vid SELECT subproject for time entry:", sErr);
              return res.status(500).json({ error: "DB error" });
            }
            if (!sRow) return res.status(400).json({ error: "Invalid subproject_id" });
            // ensure subproject belongs to project
            if (String(sRow.project_id) !== String(project_id)) return res.status(400).json({ error: "Subproject does not belong to project" });
            doInsert();
          });
        } else {
          doInsert();
        }
      });
    } else if (checkSubproject) {
      db.get(checkSubproject, [subproject_id, effectiveCompanyId], (sErr, sRow) => {
        if (sErr) {
          console.error("DB-fel vid SELECT subproject for time entry (no project):", sErr);
          return res.status(500).json({ error: "DB error" });
        }
        if (!sRow) return res.status(400).json({ error: "Invalid subproject_id" });
        doInsert();
      });
    } else {
      doInsert();
    }
  });
});

// PUT /time-entries/:id (update time report)
app.put("/time-entries/:id", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  const isAdmin = (req.user?.role || "").toLowerCase() === "admin" || (req.user?.role || "").toLowerCase() === "super_admin";

  // Fetch the time_report, then validate the owner belongs to the scoped company
  db.get(`SELECT id, user_id FROM time_reports WHERE id = ?`, [id], (err, existing) => {
    if (err) {
      console.error("DB-fel vid SELECT time_report for PUT:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!existing) return res.status(404).json({ error: "Not found" });

    // Check that the user who owns the time entry belongs to the same company
    db.get("SELECT company_id FROM users WHERE id = ?", [existing.user_id], (uErr, uRow) => {
      if (uErr) {
        console.error("DB-fel vid SELECT user for time_report:", uErr);
        return res.status(500).json({ error: "DB error" });
      }
      const effectiveCompanyId = allowAll ? uRow?.company_id : companyId;
      if (!uRow || !effectiveCompanyId || String(uRow.company_id) !== String(effectiveCompanyId)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!isAdmin && Number(existing.user_id) !== Number(req.user.user_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const {
        date,
        hours,
        start_time,
        end_time,
        job_role_id,
        project_id,
        subproject_id,
        description,
        status,
        allowance_type,
        allowance_amount,
        deviation_title,
        deviation_description,
        deviation_status,
        travel_time_hours,
        save_travel_compensation,
        overtime_weekday_hours,
        overtime_weekend_hours,
        save_comp_time,
        comp_time_saved_hours,
        comp_time_taken_hours
      } = req.body || {};
      const changedFields = Object.keys(req.body || {});

      // If hours missing but start/end provided, calculate hours
      let normalizedHours = hours;
      if ((hours === undefined || hours === null) && start_time && end_time) {
        const [sH, sM] = start_time.split(":").map(Number);
        const [eH, eM] = end_time.split(":").map(Number);
        if (![sH, sM, eH, eM].some((v) => Number.isNaN(v))) {
          const startDate = new Date();
          startDate.setHours(sH, sM, 0, 0);
          const endDate = new Date();
          endDate.setHours(eH, eM, 0, 0);
          if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
          const minutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
          normalizedHours = minutes > 0 ? minutes / 60 : null;
        }
      }
      normalizedHours = normalizedHours != null ? Number(normalizedHours) : null;

      const saveTravelValue =
        save_travel_compensation === undefined
          ? null
          : save_travel_compensation === true || save_travel_compensation === 1 || save_travel_compensation === "1"
          ? 1
          : 0;
      const compTimeSavedValue =
        comp_time_saved_hours === undefined ? null : Number(comp_time_saved_hours) || 0;
      const saveCompTimeValue =
        comp_time_saved_hours !== undefined
          ? compTimeSavedValue > 0
            ? 1
            : 0
          : save_comp_time === undefined
          ? null
          : save_comp_time === true || save_comp_time === 1 || save_comp_time === "1"
          ? 1
          : 0;

      function performUpdate() {
        db.run(
        `UPDATE time_reports SET
          datum = COALESCE(?, datum),
          starttid = COALESCE(?, starttid),
          sluttid = COALESCE(?, sluttid),
          timmar = COALESCE(?, timmar),
          job_role_id = COALESCE(?, job_role_id),
          project_id = COALESCE(?, project_id),
          subproject_id = COALESCE(?, subproject_id),
          comment = COALESCE(?, comment),
          deviation_title = COALESCE(?, deviation_title),
          deviation_description = COALESCE(?, deviation_description),
          deviation_status = COALESCE(?, deviation_status),
          restid = COALESCE(?, restid),
          save_travel_compensation = COALESCE(?, save_travel_compensation),
          overtime_weekday_hours = COALESCE(?, overtime_weekday_hours),
          overtime_weekend_hours = COALESCE(?, overtime_weekend_hours),
          save_comp_time = COALESCE(?, save_comp_time),
          comp_time_saved_hours = COALESCE(?, comp_time_saved_hours),
          comp_time_taken_hours = COALESCE(?, comp_time_taken_hours),
          status = COALESCE(?, status),
          traktamente_type = COALESCE(?, traktamente_type),
          traktamente_amount = COALESCE(?, traktamente_amount)
        WHERE id = ?`,
        [
          date ?? null,
          start_time ?? null,
          end_time ?? null,
          normalizedHours ?? null,
          job_role_id ?? null,
          project_id ?? null,
          subproject_id ?? null,
          description ?? null,
          deviation_title ?? null,
          deviation_description ?? null,
          deviation_status ?? null,
          travel_time_hours ?? null,
          saveTravelValue,
          overtime_weekday_hours === undefined ? null : Number(overtime_weekday_hours) || 0,
          overtime_weekend_hours === undefined ? null : Number(overtime_weekend_hours) || 0,
          saveCompTimeValue,
          compTimeSavedValue,
          comp_time_taken_hours === undefined ? null : Number(comp_time_taken_hours) || 0,
          status ?? null,
          allowance_type ?? null,
          allowance_amount ?? null,
          id
        ],
          function (e2) {
            if (e2) {
              console.error("DB-fel vid UPDATE time_report:", e2);
              return res.status(500).json({ error: "DB error", details: String(e2) });
            }

            db.get(`SELECT * FROM time_reports WHERE id = ?`, [id], (e3, row) => {
              if (e3) {
                console.error("DB-fel vid SELECT uppdaterad time_report:", e3);
                return res.status(500).json({ error: "DB error" });
              }
              logAudit({
                req,
                companyId: effectiveCompanyId,
                actorUserId: getAuthUserId(req),
                action: "TIME_ENTRY_UPDATED",
                entityType: "time_entry",
                entityId: id,
                metadata: { fields: changedFields },
                success: true
              });
              res.json(row);
            });
          }
        );
      }

      if (job_role_id != null) {
        db.get(
          `SELECT id FROM job_roles WHERE id = ? AND company_id = ?`,
          [job_role_id, effectiveCompanyId],
          (jrErr, jrRow) => {
            if (jrErr) {
              console.error("DB-fel vid SELECT job_role för update:", jrErr);
              return res.status(500).json({ error: "DB error" });
            }
            if (!jrRow) return res.status(400).json({ error: "Invalid job_role_id" });
            performUpdate();
          }
        );
      } else {
        performUpdate();
      }
    });
  });
});

// DELETE /time-entries/:id
app.delete("/time-entries/:id", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  const isAdmin = (req.user?.role || "").toLowerCase() === "admin" || (req.user?.role || "").toLowerCase() === "super_admin";

  db.get(`SELECT id, user_id FROM time_reports WHERE id = ?`, [id], (err, existing) => {
    if (err) {
      console.error("DB-fel vid SELECT time_report for DELETE:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!existing) return res.status(404).json({ error: "Not found" });

    db.get("SELECT company_id FROM users WHERE id = ?", [existing.user_id], (uErr, uRow) => {
      if (uErr) {
        console.error("DB-fel vid SELECT user for time_report DELETE:", uErr);
        return res.status(500).json({ error: "DB error" });
      }
      const effectiveCompanyId = allowAll ? uRow?.company_id : companyId;
      if (!uRow || !effectiveCompanyId || String(uRow.company_id) !== String(effectiveCompanyId)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!isAdmin && Number(existing.user_id) !== Number(req.user.user_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Delete materials and deviations, then the report
      db.run(`DELETE FROM report_materials WHERE report_id = ?`, [id], (e2) => {
        if (e2) {
          console.error("DB-fel vid DELETE report_materials:", e2);
          return res.status(500).json({ error: "DB error" });
        }

        db.run(`DELETE FROM deviation_reports WHERE time_entry_id = ?`, [id], (e3) => {
          if (e3) {
            console.error("DB-fel vid DELETE deviation_reports:", e3);
            return res.status(500).json({ error: "DB error" });
          }

          db.run(`DELETE FROM time_reports WHERE id = ?`, [id], function (e4) {
            if (e4) {
              console.error("DB-fel vid DELETE time_report:", e4);
              return res.status(500).json({ error: "DB error" });
            }
            logAudit({
              req,
              companyId: effectiveCompanyId,
              actorUserId: getAuthUserId(req),
              action: "TIME_ENTRY_DELETED",
              entityType: "time_entry",
              entityId: id,
              metadata: { user_id: existing.user_id },
              success: true
            });
            res.status(204).end();
          });
        });
      });
    });
  });
});
app.get("/time-reports", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const isAdminUser = isAdminRole(req);
  const authUserId = getAuthUserId(req);
  const { user_id, status, project_id } = req.query || {};

  let sql = `
    SELECT tr.*, u.first_name, u.last_name, u.email
    FROM time_reports tr
    JOIN users u ON u.id = tr.user_id
    WHERE u.company_id = ?`;
  const params = [companyId];

  if (!isAdminUser) {
    sql += ` AND tr.user_id = ?`;
    params.push(authUserId);
  } else if (user_id) {
    sql += ` AND tr.user_id = ?`;
    params.push(user_id);
  }

  if (status) {
    sql += ` AND tr.status = ?`;
    params.push(status);
  }

  if (project_id) {
    sql += ` AND tr.project_id = ?`;
    params.push(project_id);
  }

  sql += ` ORDER BY tr.datum DESC, tr.id DESC`;

  db.all(sql, params, (err, reports) => {
    if (err) {
      console.error("DB-fel vid GET /time-reports:", err);
      return res.status(500).json({ error: "Kunde inte hämta tidrapporter." });
    }

    // Sätt fallback-namn
    reports.forEach((r) => {
      if (!r.user_name) {
        const name = `${r.first_name || ""} ${r.last_name || ""}`.trim();
        r.user_name = name || r.email || null;
      }
    });

    // Hämta materialrader för varje rapport
    const tasks = reports.map((r) => {
      return new Promise((resolve) => {
        db.all(
          `SELECT id, material_type_id, quantity, place FROM report_materials WHERE report_id = ?`,
          [r.id],
          (mErr, rows) => {
            if (!mErr) r.materials = rows || [];
            else r.materials = [];
            resolve();
          }
        );
      });
    });

    Promise.all(tasks).then(() => res.json(reports || []));
  });
});

// Skapa ny tidrapport
app.post("/time-reports", requireAuth, (req, res) => {
  const body = req.body || {};
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const isAdminUser = isAdminRole(req);
  const authUserId = getAuthUserId(req);

  const userId = isAdminUser && body.user_id ? body.user_id : authUserId;
  const datum = body.datum || body.date;
  if (!datum) return res.status(400).json({ error: "Datum krävs." });

  const starttid = body.starttid || body.start || null;
  const sluttid = body.sluttid || body.end || null;
  const timmar = body.timmar != null ? Number(body.timmar) : null;
  const projectId = body.project_id || body.projectId || null;
  const subprojectId = body.subproject_id || body.subProjectId || null;
  const jobRoleId = body.job_role_id || body.jobRoleId || null;
  const comment = body.comment || body.comment || null;
  const restid = body.restid != null ? Number(body.restid) : 0;
  const status = body.status || "Ny";
  const traktType = body.traktamente_type || body.traktType || null;
  const traktAmount = body.traktamente_amount != null ? Number(body.traktamente_amount) : (body.traktAmount != null ? Number(body.traktAmount) : 0);
  const materials = Array.isArray(body.materials) ? body.materials : null;

  if (!timmar || timmar <= 0) {
    return res.status(400).json({ error: "Antal timmar krävs." });
  }

  // säkerställ att användaren tillhör företaget
  db.get(`SELECT id, company_id, first_name, last_name, email FROM users WHERE id = ?`, [userId], (uErr, userRow) => {
    if (uErr) {
      console.error("DB-fel vid SELECT user för time_report:", uErr);
      return res.status(500).json({ error: "DB error" });
    }
    if (!userRow || String(userRow.company_id) !== String(companyId)) {
      return res.status(403).json({ error: "User not in company" });
    }

    const userName = (body.user_name || body.userName || `${userRow.first_name || ""} ${userRow.last_name || ""}`.trim()) || userRow.email || null;

    db.run(
      `INSERT INTO time_reports
        (user_id, user_name, datum, starttid, sluttid, timmar, project_id, subproject_id, job_role_id, comment, restid, status, traktamente_type, traktamente_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, userName, datum, starttid, sluttid, timmar, projectId, subprojectId, jobRoleId, comment, restid, status, traktType, traktAmount],
      function (err) {
        if (err) {
          console.error("DB-fel vid POST /time-reports:", err);
          return res.status(500).json({ error: "Kunde inte skapa tidrapport." });
        }

        const reportId = this.lastID;

        // Lägg till materialrader
        if (materials && materials.length) {
          const insertMat = db.prepare(`INSERT INTO report_materials (report_id, material_type_id, quantity, place) VALUES (?, ?, ?, ?)`);
          materials.forEach((m) => {
            insertMat.run([reportId, m.typeId || m.material_type_id, m.quantity || m.qty || 0, m.place || null]);
          });
          insertMat.finalize(() => {
            db.get(`SELECT * FROM time_reports WHERE id = ?`, [reportId], (gErr, row) => {
              if (gErr) return res.status(500).json({ error: "Kunde inte läsa ny tidrapport." });
              row.materials = materials;
              res.status(201).json(row);
            });
          });
        } else {
          db.get(`SELECT * FROM time_reports WHERE id = ?`, [reportId], (gErr, row) => {
            if (gErr) return res.status(500).json({ error: "Kunde inte läsa ny tidrapport." });
            res.status(201).json(row);
          });
        }
      }
    );
  });
});

// Uppdatera tidrapport
app.put("/time-reports/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const isAdminUser = isAdminRole(req);
  const authUserId = getAuthUserId(req);
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  db.get(
    `SELECT tr.*, u.company_id FROM time_reports tr JOIN users u ON u.id = tr.user_id WHERE tr.id = ?`,
    [id],
    (err, report) => {
      if (err) {
        console.error("DB-fel vid SELECT tidrapport:", err);
        return res.status(500).json({ error: "Tekniskt fel." });
      }
      if (!report) return res.status(404).json({ error: "Tidrapporten hittades inte." });
      if (String(report.company_id) !== String(companyId)) return res.status(403).json({ error: "Forbidden" });

      if (!isAdminUser) {
        if (report.user_id !== authUserId) return res.status(403).json({ error: "Du kan inte ändra andras tidrapporter." });
        if (report.status === "Attesterad") return res.status(403).json({ error: "Attesterade tidrapporter kan inte ändras av användare." });
      }

      const userName = body.user_name || body.userName || report.user_name;
      const datum = body.datum || body.date || report.datum;
      const starttid = body.starttid || body.start || report.starttid;
      const sluttid = body.sluttid || body.end || report.sluttid;
      const timmar = body.timmar != null ? Number(body.timmar) : report.timmar;
      const projectId = body.project_id || body.projectId || report.project_id;
      const subprojectId = body.subproject_id || body.subProjectId || report.subproject_id;
      const jobRoleId = body.job_role_id || body.jobRoleId || report.job_role_id;
      const comment = body.comment || report.comment;
      const restid = body.restid != null ? Number(body.restid) : report.restid;
      const status = body.status || report.status;
      const traktType = body.traktamente_type || body.traktType || report.traktamente_type || null;
      const traktAmount = body.traktamente_amount != null ? Number(body.traktamente_amount) : (body.traktAmount != null ? Number(body.traktAmount) : (report.traktamente_amount != null ? Number(report.traktamente_amount) : 0));
      const materials = Array.isArray(body.materials) ? body.materials : null;

      db.run(
        `UPDATE time_reports SET user_name = ?, datum = ?, starttid = ?, sluttid = ?, timmar = ?, project_id = ?, subproject_id = ?, job_role_id = ?, comment = ?, restid = ?, status = ?, traktamente_type = ?, traktamente_amount = ?, updated_at = datetime('now') WHERE id = ?`,
        [userName, datum, starttid, sluttid, timmar, projectId, subprojectId, jobRoleId, comment, restid, status, traktType, traktAmount, id],
        function (uErr) {
          if (uErr) {
            console.error("DB-fel vid UPDATE tidrapport:", uErr);
            return res.status(500).json({ error: "Kunde inte uppdatera tidrapport." });
          }

          // Uppdatera materialrader om skickade
          if (materials) {
            db.run(`DELETE FROM report_materials WHERE report_id = ?`, [id], (dErr) => {
              if (dErr) console.error("Kunde ta bort gamla materialrader:", dErr);
              const insertMat = db.prepare(`INSERT INTO report_materials (report_id, material_type_id, quantity, place) VALUES (?, ?, ?, ?)`);
              materials.forEach((m) => {
                insertMat.run([id, m.typeId || m.material_type_id, m.quantity || m.qty || 0, m.place || null]);
              });
              insertMat.finalize(() => {
                db.get(`SELECT * FROM time_reports WHERE id = ?`, [id], (gErr, row) => {
                  if (gErr) return res.status(500).json({ error: "Kunde läsa uppdaterad tidrapport." });
                  db.all(`SELECT id, material_type_id, quantity, place FROM report_materials WHERE report_id = ?`, [id], (mErr, rows) => {
                    row.materials = mErr ? [] : rows;
                    res.json(row);
                  });
                });
              });
            });
          } else {
            db.get(`SELECT * FROM time_reports WHERE id = ?`, [id], (gErr, row) => {
              if (gErr) return res.status(500).json({ error: "Kunde läsa uppdaterad tidrapport." });
              db.all(`SELECT id, material_type_id, quantity, place FROM report_materials WHERE report_id = ?`, [id], (mErr, rows) => {
                row.materials = mErr ? [] : rows;
                res.json(row);
              });
            });
          }
        }
      );
    }
  );
});

// Radera tidrapport
app.delete("/time-reports/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const isAdminUser = isAdminRole(req);
  const authUserId = getAuthUserId(req);
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  db.get(
    `SELECT tr.*, u.company_id FROM time_reports tr JOIN users u ON u.id = tr.user_id WHERE tr.id = ?`,
    [id],
    (err, report) => {
    if (err) return res.status(500).json({ error: "Tekniskt fel." });
    if (!report) return res.status(404).json({ error: "Tidrapporten hittades inte." });
    if (String(report.company_id) !== String(companyId)) return res.status(403).json({ error: "Forbidden" });

    if (!isAdminUser) {
      if (report.user_id !== authUserId) return res.status(403).json({ error: "Du kan inte ta bort andras tidrapporter." });
      if (report.status === "Attesterad") return res.status(403).json({ error: "Attesterade tidrapporter kan inte raderas av användare." });
    }

    db.run(`DELETE FROM time_reports WHERE id = ?`, [id], function (dErr) {
      if (dErr) {
        console.error("DB-fel vid DELETE time_reports:", dErr);
        return res.status(500).json({ error: "Kunde inte ta bort tidrapport." });
      }
      res.json({ success: true });
    });
  });
});

// Attestera / ta bort attest (admin)
app.post("/time-reports/:id/attest", requireAdmin, (req, res) => {
  const { id } = req.params;
  const action = (req.body && req.body.action) || "attest"; // 'attest' eller 'unattest'
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  db.get(
    `SELECT tr.*, u.company_id FROM time_reports tr JOIN users u ON u.id = tr.user_id WHERE tr.id = ?`,
    [id],
    (err, report) => {
    if (err) return res.status(500).json({ error: "Tekniskt fel." });
    if (!report) return res.status(404).json({ error: "Tidrapporten hittades inte." });
    if (String(report.company_id) !== String(companyId)) return res.status(403).json({ error: "Forbidden" });

    if (action === "attest") {
      db.run(`UPDATE time_reports SET status = 'Attesterad', attested_by = ?, attested_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [getAuthUserId(req), id], function (uErr) {
        if (uErr) return res.status(500).json({ error: "Kunde inte attesterar rapporten." });
        res.json({ success: true });
      });
    } else {
      db.run(`UPDATE time_reports SET status = 'Ny', attested_by = NULL, attested_at = NULL, updated_at = datetime('now') WHERE id = ?`, [id], function (uErr) {
        if (uErr) return res.status(500).json({ error: "Kunde inte ta bort attest." });
        res.json({ success: true });
      });
    }
    }
  );
});

// Lovable-style attest endpoint for time-entries (admin/super_admin within scoped company)
app.post("/time-entries/:id/attest", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const id = req.params.id;

  const approved = !!req.body.approved;

  db.get(`SELECT id, user_id FROM time_reports WHERE id = ?`, [id], (err, existing) => {
    if (err) {
      console.error("DB-fel vid SELECT time_report for attest:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!existing) return res.status(404).json({ error: "Not found" });

    // verify the owner belongs to scoped company
    db.get(`SELECT company_id FROM users WHERE id = ?`, [existing.user_id], (uErr, uRow) => {
      if (uErr) {
        console.error("DB-fel vid SELECT user for attest:", uErr);
        return res.status(500).json({ error: "DB error" });
      }
      if (!uRow || String(uRow.company_id) !== String(companyId)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const attestedBy = approved ? req.user.user_id : null;
      const attestedAt = approved ? new Date().toISOString() : null;
      const newStatus = approved ? "Attesterad" : "Ny";

      db.run(
        `UPDATE time_reports SET attested_by = ?, attested_at = ?, status = ? WHERE id = ?`,
        [attestedBy, attestedAt, newStatus, id],
        function (uErr) {
          if (uErr) {
            console.error("DB-fel vid UPDATE attest:", uErr);
            return res.status(500).json({ error: "DB error", details: String(uErr) });
          }
          db.get(`SELECT * FROM time_reports WHERE id = ?`, [id], (e3, row) => {
            if (e3) return res.status(500).json({ error: "DB error" });
            logAudit({
              req,
              companyId,
              actorUserId: getAuthUserId(req),
              action: approved ? "TIME_ENTRY_ATTESTED" : "TIME_ENTRY_REJECTED",
              entityType: "time_entry",
              entityId: id,
              metadata: { approved, user_id: existing.user_id },
              success: true
            });
            res.json(row);
          });
        }
      );
    });
  });
});

        // GET materials for a time-entry (Lovable-style)
        app.get("/time-entries/:id/materials", requireAuth, (req, res) => {
          const companyId = getScopedCompanyId(req);
          const id = req.params.id;

          const isAdmin = (req.user.role || "").toLowerCase() === "admin" || (req.user.role || "").toLowerCase() === "super_admin";

          db.get(`SELECT id, user_id FROM time_reports WHERE id = ?`, [id], (err, tr) => {
            if (err) {
              console.error("DB-fel vid SELECT time_report for materials:", err);
              return res.status(500).json({ error: "DB error" });
            }
            if (!tr) return res.status(404).json({ error: "Not found" });

            // verify the owner belongs to scoped company
            db.get(`SELECT company_id FROM users WHERE id = ?`, [tr.user_id], (uErr, uRow) => {
              if (uErr) {
                console.error("DB-fel vid SELECT user for materials:", uErr);
                return res.status(500).json({ error: "DB error" });
              }
              if (!uRow || String(uRow.company_id) !== String(companyId)) {
                return res.status(403).json({ error: "Forbidden" });
              }
              if (!isAdmin && Number(tr.user_id) !== Number(req.user.user_id)) return res.status(403).json({ error: "Forbidden" });

              db.all(
                `SELECT rm.*, mt.name AS material_name, mt.unit AS material_unit
                 FROM report_materials rm
                 LEFT JOIN material_types mt ON mt.id = rm.material_type_id AND mt.company_id = ?
                 WHERE rm.report_id = ?
                 ORDER BY rm.id DESC`,
                [companyId, id],
                (e2, rows) => {
                  if (e2) {
                    console.error("DB-fel vid SELECT report_materials:", e2);
                    return res.status(500).json({ error: "DB error" });
                  }
                  res.json(rows || []);
                }
              );
            });
          });
        });

        // POST a material for a time-entry (owner or admin)
        app.post("/time-entries/:id/materials", requireAuth, (req, res) => {
          const companyId = getScopedCompanyId(req);
          const reportId = req.params.id;

          const isAdmin = (req.user.role || "").toLowerCase() === "admin" || (req.user.role || "").toLowerCase() === "super_admin";

          const { material_type_id, quantity, notes, place } = req.body || {};
          if (!material_type_id) return res.status(400).json({ error: "material_type_id required" });
          if (quantity == null) return res.status(400).json({ error: "quantity required" });

          db.get(`SELECT id, user_id FROM time_reports WHERE id = ?`, [reportId], (err, tr) => {
            if (err) {
              console.error("DB-fel vid SELECT time_report for insert material:", err);
              return res.status(500).json({ error: "DB error" });
            }
            if (!tr) return res.status(404).json({ error: "Not found" });

            // verify owner's company via users table
            db.get(`SELECT company_id FROM users WHERE id = ?`, [tr.user_id], (uErr, uRow) => {
              if (uErr) {
                console.error("DB-fel vid SELECT user for insert material:", uErr);
                return res.status(500).json({ error: "DB error" });
              }
              if (!uRow || String(uRow.company_id) !== String(companyId)) {
                return res.status(403).json({ error: "Forbidden" });
              }
              if (!isAdmin && Number(tr.user_id) !== Number(req.user.user_id)) return res.status(403).json({ error: "Forbidden" });

              function insertMaterial() {
                const placeValue = place ?? notes ?? null;

                db.run(
                  `INSERT INTO report_materials (report_id, material_type_id, quantity, place)
                   VALUES (?, ?, ?, ?)`,
                  [reportId, material_type_id, quantity, placeValue],
                  function (e2) {
                    if (e2) {
                      console.error("DB-fel vid INSERT report_materials:", e2);
                      return res.status(500).json({ error: "DB error", details: String(e2) });
                    }
                    db.get(
                      `SELECT rm.*, mt.name AS material_name, mt.unit AS material_unit
                       FROM report_materials rm
                       LEFT JOIN material_types mt ON mt.id = rm.material_type_id AND mt.company_id = ?
                       WHERE rm.id = ?`,
                      [companyId, this.lastID],
                      (e3, row) => {
                        if (e3) {
                          console.error("DB-fel vid SELECT ny report_material:", e3);
                          return res.status(500).json({ error: "DB error" });
                        }
                        res.json(row);
                      }
                    );
                  }
                );
              }

              db.get(
                `SELECT id FROM material_types WHERE id = ? AND company_id = ?`,
                [material_type_id, companyId],
                (mtErr, mtRow) => {
                  if (mtErr) {
                    console.error("DB-fel vid SELECT material_type för insert:", mtErr);
                    return res.status(500).json({ error: "DB error" });
                  }
                  if (!mtRow) return res.status(400).json({ error: "Invalid material_type_id" });
                  insertMaterial();
                }
              );
            });
          });
        });

        // PUT update a material row for a time-entry (owner or admin)
        app.put("/time-entries/:id/materials/:materialRowId", requireAuth, (req, res) => {
          const companyId = getScopedCompanyId(req);
          const reportId = req.params.id;
          const rowId = req.params.materialRowId;

          const isAdmin = (req.user.role || "").toLowerCase() === "admin" || (req.user.role || "").toLowerCase() === "super_admin";
          const { quantity, notes, place } = req.body || {};

          db.get(`SELECT id, user_id FROM time_reports WHERE id = ?`, [reportId], (err, tr) => {
            if (err) {
              console.error("DB-fel vid SELECT time_report for update material:", err);
              return res.status(500).json({ error: "DB error" });
            }
            if (!tr) return res.status(404).json({ error: "Not found" });

            // verify owner's company via users table
            db.get(`SELECT company_id FROM users WHERE id = ?`, [tr.user_id], (uErr, uRow) => {
              if (uErr) {
                console.error("DB-fel vid SELECT user for update material:", uErr);
                return res.status(500).json({ error: "DB error" });
              }
              if (!uRow || String(uRow.company_id) !== String(companyId)) {
                return res.status(403).json({ error: "Forbidden" });
              }
              if (!isAdmin && Number(tr.user_id) !== Number(req.user.user_id)) return res.status(403).json({ error: "Forbidden" });

              const placeValue = place ?? notes ?? null;

              db.run(
                `UPDATE report_materials
                 SET quantity = COALESCE(?, quantity),
                     place = COALESCE(?, place)
                 WHERE id = ? AND report_id = ?`,
                [quantity ?? null, placeValue, rowId, reportId],
                function (e2) {
                  if (e2) {
                    console.error("DB-fel vid UPDATE report_materials:", e2);
                    return res.status(500).json({ error: "DB error", details: String(e2) });
                  }
                  if (this.changes === 0) return res.status(404).json({ error: "Not found" });
                  db.get(
                    `SELECT rm.*, mt.name AS material_name, mt.unit AS material_unit
                     FROM report_materials rm
                     LEFT JOIN material_types mt ON mt.id = rm.material_type_id AND mt.company_id = ?
                     WHERE rm.id = ?`,
                    [companyId, rowId],
                    (e3, row) => {
                      if (e3) {
                        console.error("DB-fel vid SELECT uppdaterad report_material:", e3);
                        return res.status(500).json({ error: "DB error" });
                      }
                      res.json(row);
                    }
                  );
                }
              );
            });
  });
});

// ======================
// DEVIATION REPORTS
// ======================

// GET /deviation-reports
app.get("/deviation-reports", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const allowAll = req.company_scope_all === true;
  if (!companyId && !allowAll) return res.status(400).json({ error: "Company not found" });

  const { user_id, include_images } = req.query || {};
  const isAdmin = (req.user?.role || "").toLowerCase() === "admin" || (req.user?.role || "").toLowerCase() === "super_admin";
  const effectiveUserId = isAdmin ? user_id : req.user.user_id;

  const where = [];
  const params = [];
  if (!allowAll) {
    where.push("dr.company_id = ?");
    params.push(companyId);
  }
  if (effectiveUserId) {
    where.push("dr.user_id = ?");
    params.push(effectiveUserId);
  }

  const sql = `
    SELECT
      dr.*,
      u.email AS user_email,
      (u.first_name || ' ' || u.last_name) AS user_full_name,
      tr.datum AS time_entry_date,
      tr.starttid AS time_entry_start,
      tr.sluttid AS time_entry_end,
      p.name AS project_name
    FROM deviation_reports dr
    JOIN users u ON u.id = dr.user_id
    JOIN time_reports tr ON tr.id = dr.time_entry_id
    LEFT JOIN projects p ON p.id = tr.project_id
    WHERE ${where.length ? where.join(" AND ") : "1=1"}
    ORDER BY datetime(dr.created_at) DESC, dr.id DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /deviation-reports:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (String(include_images) === "true" && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      db.all(`SELECT * FROM deviation_images WHERE deviation_report_id IN (${placeholders})`, ids, (imgErr, imgs) => {
        if (imgErr) {
          console.error("DB-fel vid SELECT deviation_images:", imgErr);
          return res.status(500).json({ error: "DB error" });
        }
        const byId = new Map();
        imgs.forEach((img) => {
          if (!byId.has(img.deviation_report_id)) byId.set(img.deviation_report_id, []);
          byId.get(img.deviation_report_id).push(img);
        });
        const out = rows.map((r) => ({ ...r, images: byId.get(r.id) || [] }));
        res.json(out);
      });
    } else {
      res.json(rows || []);
    }
  });
});

// POST /deviation-reports
app.post("/deviation-reports", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const isAdmin = (req.user?.role || "").toLowerCase() === "admin" || (req.user?.role || "").toLowerCase() === "super_admin";
  const targetUserId = isAdmin && req.body.user_id ? req.body.user_id : req.user.user_id;

  const { time_entry_id, title, description, severity = "medium", status = "open", resolved_at = null } = req.body || {};
  if (!time_entry_id) return res.status(400).json({ error: "time_entry_id required" });
  if (!title) return res.status(400).json({ error: "title required" });

  db.get(
    `SELECT tr.id, tr.user_id
     FROM time_reports tr
     JOIN users u ON u.id = tr.user_id
     WHERE tr.id = ? AND u.company_id = ?`,
    [time_entry_id, companyId],
    (err, row) => {
      if (err) {
        console.error("DB-fel vid kontroll av time_entry:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (!row) return res.status(404).json({ error: "Tidrapport hittades inte" });
      if (!isAdmin && String(row.user_id) !== String(targetUserId)) {
        return res.status(403).json({ error: "Kan inte koppla avvikelse till annan användare" });
      }

      db.run(
        `INSERT INTO deviation_reports (company_id, user_id, time_entry_id, title, description, severity, status, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyId, targetUserId, time_entry_id, title, description || null, severity, status, resolved_at],
        function (insErr) {
          if (insErr) {
            console.error("DB-fel vid POST /deviation-reports:", insErr);
            return res.status(500).json({ error: "Kunde inte spara avvikelse" });
          }
          db.get(`SELECT * FROM deviation_reports WHERE id = ?`, [this.lastID], (selErr, deviation) => {
            if (selErr) {
              console.error("DB-fel vid SELECT ny avvikelse:", selErr);
              return res.status(500).json({ error: "DB error" });
            }
            res.json(deviation);
          });
        }
      );
    }
  );
});

// PUT /deviation-reports/:id
app.put("/deviation-reports/:id", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const isAdmin = (req.user?.role || "").toLowerCase() === "admin" || (req.user?.role || "").toLowerCase() === "super_admin";
  const id = req.params.id;
  const { time_entry_id, title, description, severity, status, resolved_at } = req.body || {};

  db.get(
    `SELECT dr.*, tr.user_id AS entry_user_id
     FROM deviation_reports dr
     JOIN time_reports tr ON tr.id = dr.time_entry_id
     JOIN users u ON u.id = dr.user_id
     WHERE dr.id = ? AND dr.company_id = ?`,
    [id, companyId],
    (err, row) => {
      if (err) {
        console.error("DB-fel vid SELECT deviation:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (!row) return res.status(404).json({ error: "Avvikelse hittades inte" });
      if (!isAdmin && String(row.user_id) !== String(req.user.user_id)) {
        return res.status(403).json({ error: "Ingen behörighet" });
      }

      function performUpdate(validatedTimeEntryId) {
        db.run(
          `UPDATE deviation_reports
           SET time_entry_id = COALESCE(?, time_entry_id),
               title = COALESCE(?, title),
               description = COALESCE(?, description),
               severity = COALESCE(?, severity),
               status = COALESCE(?, status),
               resolved_at = COALESCE(?, resolved_at),
               updated_at = datetime('now')
           WHERE id = ?`,
          [
            validatedTimeEntryId ?? row.time_entry_id,
            title ?? null,
            description ?? null,
            severity ?? row.severity,
            status ?? row.status,
            resolved_at ?? (status === "resolved" && !row.resolved_at ? new Date().toISOString() : null),
            id
          ],
          function (updErr) {
            if (updErr) {
              console.error("DB-fel vid UPDATE deviation:", updErr);
              return res.status(500).json({ error: "Kunde inte uppdatera" });
            }
            db.get(`SELECT * FROM deviation_reports WHERE id = ?`, [id], (selErr, updated) => {
              if (selErr) {
                console.error("DB-fel vid SELECT uppdaterad deviation:", selErr);
                return res.status(500).json({ error: "DB error" });
              }
              res.json(updated);
            });
          }
        );
      }

      if (time_entry_id) {
        db.get(
          `SELECT tr.id, tr.user_id
           FROM time_reports tr
           JOIN users u ON u.id = tr.user_id
           WHERE tr.id = ? AND u.company_id = ?`,
          [time_entry_id, companyId],
          (teErr, teRow) => {
            if (teErr) {
              console.error("DB-fel vid kontroll av ny tidrapport för avvikelse:", teErr);
              return res.status(500).json({ error: "DB error" });
            }
            if (!teRow) return res.status(400).json({ error: "Ogiltig tidrapport" });
            if (!isAdmin && String(teRow.user_id) !== String(req.user.user_id)) {
              return res.status(403).json({ error: "Kan inte koppla annan användares rapport" });
            }
            performUpdate(time_entry_id);
          }
        );
      } else {
        performUpdate(null);
      }
    }
  );
});

// POST /deviation-reports/:id/images (base64 upload)
app.post("/deviation-reports/:id/images", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });
  const id = req.params.id;
  const { filename, content_base64 } = req.body || {};
  if (!filename || !content_base64) return res.status(400).json({ error: "filename och content_base64 krävs" });

  db.get(
    `SELECT dr.*, u.company_id FROM deviation_reports dr JOIN users u ON u.id = dr.user_id WHERE dr.id = ? AND dr.company_id = ?`,
    [id, companyId],
    (err, row) => {
      if (err) {
        console.error("DB-fel vid SELECT deviation för bild:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (!row) return res.status(404).json({ error: "Avvikelse hittades inte" });

      const uploadsDir = path.join(__dirname, "uploads", "deviation-images");
      try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) { console.error("Kunde inte skapa upload-mapp:", e); }

      const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
      const filePath = path.join(uploadsDir, safeName);

      try {
        const data = content_base64.split(",").pop();
        fs.writeFileSync(filePath, data, { encoding: "base64" });
      } catch (e) {
        console.error("Kunde inte skriva fil:", e);
        return res.status(500).json({ error: "Kunde inte spara fil" });
      }

      const storagePath = `/uploads/deviation-images/${safeName}`;
      db.run(
        `INSERT INTO deviation_images (deviation_report_id, file_name, storage_path) VALUES (?, ?, ?)`,
        [id, filename, storagePath],
        function (insErr) {
          if (insErr) {
            console.error("DB-fel vid INSERT deviation_images:", insErr);
            return res.status(500).json({ error: "DB error" });
          }
          db.get(`SELECT * FROM deviation_images WHERE id = ?`, [this.lastID], (selErr, imgRow) => {
            if (selErr) {
              console.error("DB-fel vid SELECT deviation_image:", selErr);
              return res.status(500).json({ error: "DB error" });
            }
            res.json(imgRow);
          });
        }
      );
    }
  );
});

// GET /deviation-reports/:id/images
app.get("/deviation-reports/:id/images", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });
  const id = req.params.id;

  db.get(
    `SELECT dr.id FROM deviation_reports dr WHERE dr.id = ? AND dr.company_id = ?`,
    [id, companyId],
    (err, row) => {
      if (err) {
        console.error("DB-fel vid kontroll av avvikelse:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (!row) return res.status(404).json({ error: "Avvikelse hittades inte" });

      db.all(`SELECT * FROM deviation_images WHERE deviation_report_id = ? ORDER BY id DESC`, [id], (imgErr, imgs) => {
        if (imgErr) {
          console.error("DB-fel vid SELECT deviation_images:", imgErr);
          return res.status(500).json({ error: "DB error" });
        }
        res.json(imgs || []);
      });
    }
  );
});

// GET /deviation-reports/:id/pdf (server-side PDF)
app.get("/deviation-reports/:id/pdf", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });
  const id = req.params.id;

  db.get(
    `SELECT dr.*, u.email AS user_email, (u.first_name || ' ' || u.last_name) AS user_full_name,
            tr.datum AS time_entry_date, tr.starttid AS time_entry_start, tr.sluttid AS time_entry_end,
            p.name AS project_name
     FROM deviation_reports dr
     JOIN users u ON u.id = dr.user_id
     JOIN time_reports tr ON tr.id = dr.time_entry_id
     LEFT JOIN projects p ON p.id = tr.project_id
     WHERE dr.id = ? AND dr.company_id = ?`,
    [id, companyId],
    (err, dev) => {
      if (err) {
        console.error("DB-fel vid SELECT avvikelse:", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (!dev) return res.status(404).json({ error: "Avvikelse hittades inte" });

      db.all(`SELECT * FROM deviation_images WHERE deviation_report_id = ?`, [id], (imgErr, imgs) => {
        if (imgErr) {
          console.error("DB-fel vid SELECT deviation_images:", imgErr);
          return res.status(500).json({ error: "DB error" });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=avvikelse_${id}.pdf`);

        const doc = new PDFDocument({ margin: 40, size: "A4" });
        doc.pipe(res);

        doc.fontSize(20).text("Avvikelse – Sammanställning", { align: "left" });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Rapport ID: ${id}`);
        doc.text(`Användare: ${dev.user_full_name || dev.user_email || "-"}`);
        doc.text(`Projekt: ${dev.project_name || "-"}`);
        doc.text(`Datum: ${dev.time_entry_date || "-"}`);
        doc.text(`Tid: ${dev.time_entry_start || ""} ${dev.time_entry_end ? "- " + dev.time_entry_end : ""}`);
        doc.moveDown();

        doc.fontSize(12).text("Detaljer", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Titel: ${dev.title}`);
        doc.text(`Allvarlighet: ${dev.severity || "-"}`);
        doc.text(`Status: ${dev.status || "-"}`);
        doc.moveDown(0.5);
        doc.fontSize(10).text("Beskrivning:");
        doc.fontSize(10).text(dev.description || "-", { width: 500 });
        doc.moveDown();

        if (imgs && imgs.length > 0) {
          doc.fontSize(12).text("Bilder", { underline: true });
          doc.moveDown(0.5);
          imgs.forEach((img) => {
            const filePath = path.join(__dirname, img.storage_path);
            if (fs.existsSync(filePath)) {
              try {
                doc.image(filePath, { fit: [200, 150] });
                doc.moveDown(0.5);
              } catch (e) {
                console.error("Kunde inte läsa bild:", e);
              }
            }
          });
        }

        doc.end();
      });
    }
  );
});

// ======================
// WELDING REPORTS
// ======================

const mapWeldingRow = (row) => {
  let entries = [];
  try {
    entries = row.welding_entries ? JSON.parse(row.welding_entries) : [];
  } catch (e) {
    console.error("Kunde inte parsa welding_entries:", e);
    entries = [];
  }
  return {
    id: String(row.id),
    user_id: row.user_id ? String(row.user_id) : null,
    company_id: row.company_id ? String(row.company_id) : null,
    report_date: row.report_date || null,
    own_ao_number: row.own_ao_number || null,
    customer_ao_number: row.customer_ao_number || null,
    welder_name: row.welder_name || "",
    welder_id: row.welder_id || "",
    report_year: row.report_year || null,
    report_month: row.report_month || null,
    bessy_anm_ofelia: row.bessy_anm_ofelia || null,
    welding_entries: entries,
    id_marked_weld: !!row.id_marked_weld,
    geometry_control: !!row.geometry_control,
    cleaned_workplace: !!row.cleaned_workplace,
    restored_rail_quantity: !!row.restored_rail_quantity,
    welded_in_cold_climate: !!row.welded_in_cold_climate,
    ensured_gas_flow: !!row.ensured_gas_flow,
    protected_cooling: !!row.protected_cooling,
    welding_supervisor: row.welding_supervisor || null,
    supervisor_phone: row.supervisor_phone || null,
    deviations: row.deviations || null,
    comments: row.comments || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const sanitizeWeldingEntry = (entry) => ({
  nr: Number(entry?.nr) || 0,
  date: entry?.date || "",
  location: entry?.location || "",
  switchImage: entry?.switchImage || "",
  beforeMm: entry?.beforeMm || "",
  afterMm: entry?.afterMm || "",
  temp: entry?.temp || "",
  model: entry?.model || "",
  material: entry?.material || "",
  rail: entry?.rail || "",
  workType: entry?.workType || "",
  weldingMethod: entry?.weldingMethod || "",
  additiveMaterial: entry?.additiveMaterial || "",
  batchNr: entry?.batchNr || "",
  wpsNr: entry?.wpsNr || "",
});

// Create (hyphen endpoint used by frontend form)
app.post("/welding-reports", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const {
    user_id,
    report_date,
    own_ao_number,
    customer_ao_number,
    welder_name,
    welder_id,
    report_year,
    report_month,
    bessy_anm_ofelia,
    welding_entries = [],
    id_marked_weld = false,
    geometry_control = false,
    cleaned_workplace = false,
    restored_rail_quantity = false,
    welded_in_cold_climate = false,
    ensured_gas_flow = false,
    protected_cooling = false,
    welding_supervisor,
    supervisor_phone,
    deviations,
    comments,
  } = req.body || {};

  const targetUserId = user_id || req.user.user_id;

  // verify user belongs to company
  db.get(`SELECT company_id FROM users WHERE id = ?`, [targetUserId], (err, uRow) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!uRow || String(uRow.company_id) !== String(companyId)) {
      return res.status(403).json({ error: "User not in company" });
    }

    db.run(
      `INSERT INTO welding_reports (
        user_id, company_id, report_date, own_ao_number, customer_ao_number,
        welder_name, welder_id, report_year, report_month, bessy_anm_ofelia,
        welding_entries, id_marked_weld, geometry_control, cleaned_workplace,
        restored_rail_quantity, welded_in_cold_climate, ensured_gas_flow, protected_cooling,
        welding_supervisor, supervisor_phone, deviations, comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetUserId,
        companyId,
        report_date || null,
        own_ao_number || null,
        customer_ao_number || null,
        welder_name || null,
        welder_id || null,
        report_year || null,
        report_month || null,
        bessy_anm_ofelia || null,
        JSON.stringify(welding_entries || []),
        id_marked_weld ? 1 : 0,
        geometry_control ? 1 : 0,
        cleaned_workplace ? 1 : 0,
        restored_rail_quantity ? 1 : 0,
        welded_in_cold_climate ? 1 : 0,
        ensured_gas_flow ? 1 : 0,
        protected_cooling ? 1 : 0,
        welding_supervisor || null,
        supervisor_phone || null,
        deviations || null,
        comments || null,
      ],
      function (insErr) {
        if (insErr) {
          console.error("DB-fel vid INSERT welding_report:", insErr);
          return res.status(500).json({ error: "DB error" });
        }
        db.get(`SELECT * FROM welding_reports WHERE id = ?`, [this.lastID], (selErr, row) => {
          if (selErr) return res.status(500).json({ error: "DB error" });
          res.json(mapWeldingRow(row));
        });
      }
    );
  });
});

// List (underscore endpoint used by admin)
app.get("/welding_reports", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const { report_year, report_month, user_id, include } = req.query || {};
  const isAdmin = isAdminRole(req);
  const effectiveUserId = isAdmin ? user_id : req.user.user_id;

  const where = ["wr.company_id = ?"];
  const params = [companyId];
  if (report_year) { where.push("wr.report_year = ?"); params.push(report_year); }
  if (report_month) { where.push("wr.report_month = ?"); params.push(report_month); }
  if (effectiveUserId) { where.push("wr.user_id = ?"); params.push(effectiveUserId); }

  const sql = `
    SELECT wr.*,
      (u.first_name || ' ' || u.last_name) AS user_full_name,
      u.email AS user_email
    FROM welding_reports wr
    JOIN users u ON u.id = wr.user_id
    WHERE ${where.join(" AND ")}
    ORDER BY datetime(wr.created_at) DESC, wr.id DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB-fel vid GET /welding_reports:", err);
      return res.status(500).json({ error: "DB error" });
    }

    let mapped = rows.map(mapWeldingRow);

    if (String(include).includes("profiles")) {
      mapped = mapped.map((r, idx) => ({
        ...r,
        profiles: { full_name: rows[idx].user_full_name || null },
      }));
    }

    res.json(mapped);
  });
});

// Append welding entries (owner or admin)
app.post("/welding_reports/:id/entries", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  const isAdmin = isAdminRole(req);
  const { welding_entries } = req.body || {};

  if (!Array.isArray(welding_entries) || welding_entries.length === 0) {
    return res.status(400).json({ error: "welding_entries required" });
  }

  db.get(`SELECT id, user_id, company_id, welding_entries FROM welding_reports WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!row) return res.status(404).json({ error: "Not found" });
    if (String(row.company_id) !== String(companyId)) return res.status(403).json({ error: "Forbidden" });
    if (!isAdmin && Number(row.user_id) !== Number(req.user.user_id)) return res.status(403).json({ error: "Forbidden" });

    let existingEntries = [];
    try {
      existingEntries = row.welding_entries ? JSON.parse(row.welding_entries) : [];
    } catch (parseErr) {
      console.error("Kunde inte parsa welding_entries:", parseErr);
      existingEntries = [];
    }

    const startNr = existingEntries.length;
    const appended = welding_entries.map(sanitizeWeldingEntry).map((entry, idx) => ({
      ...entry,
      nr: startNr + idx + 1,
    }));
    const updatedEntries = existingEntries.concat(appended);

    db.run(
      `UPDATE welding_reports SET welding_entries = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(updatedEntries), id],
      function (updErr) {
        if (updErr) {
          console.error("DB-fel vid UPDATE welding_entries:", updErr);
          return res.status(500).json({ error: "DB error" });
        }
        db.get(`SELECT * FROM welding_reports WHERE id = ?`, [id], (selErr, updated) => {
          if (selErr || !updated) return res.status(500).json({ error: "DB error" });
          res.json(mapWeldingRow(updated));
        });
      }
    );
  });
});

// DELETE
app.delete("/welding_reports/:id", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const id = req.params.id;
  const isAdmin = isAdminRole(req);

  db.get(`SELECT id, user_id, company_id FROM welding_reports WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!row) return res.status(404).json({ error: "Not found" });
    if (String(row.company_id) !== String(companyId)) return res.status(403).json({ error: "Forbidden" });
    if (!isAdmin && Number(row.user_id) !== Number(req.user.user_id)) return res.status(403).json({ error: "Forbidden" });

    db.run(`DELETE FROM welding_reports WHERE id = ?`, [id], function (delErr) {
      if (delErr) {
        console.error("DB-fel vid DELETE welding_report:", delErr);
        return res.status(500).json({ error: "DB error" });
      }
      res.status(204).end();
    });
  });
});

// DELETE a material row for a time-entry (owner or admin)
app.delete("/time-entries/:id/materials/:materialRowId", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  const reportId = req.params.id;
  const rowId = req.params.materialRowId;

  const isAdmin = (req.user.role || "").toLowerCase() === "admin" || (req.user.role || "").toLowerCase() === "super_admin";

  db.get(`SELECT id, user_id FROM time_reports WHERE id = ?`, [reportId], (err, tr) => {
    if (err) {
      console.error("DB-fel vid SELECT time_report for delete material:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!tr) return res.status(404).json({ error: "Not found" });

    // verify owner's company via users table
    db.get(`SELECT company_id FROM users WHERE id = ?`, [tr.user_id], (uErr, uRow) => {
      if (uErr) {
        console.error("DB-fel vid SELECT user for delete material:", uErr);
        return res.status(500).json({ error: "DB error" });
      }
      if (!uRow || String(uRow.company_id) !== String(companyId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!isAdmin && Number(tr.user_id) !== Number(req.user.user_id)) return res.status(403).json({ error: "Forbidden" });

      db.run(
        `DELETE FROM report_materials WHERE id = ? AND report_id = ?`,
        [rowId, reportId],
        function (e2) {
          if (e2) {
            console.error("DB-fel vid DELETE report_materials:", e2);
            return res.status(500).json({ error: "DB error", details: String(e2) });
          }
          if (this.changes === 0) return res.status(404).json({ error: "Not found" });
          res.status(204).end();
        }
      );
    });
  });
});

// Start a work order (mark as in_progress) - any assigned user in the same company can start
app.post("/work-orders/:id/start", requireAuth, (req, res) => {
  const companyId = req.user.company_id;
  const userId = req.user.user_id;
  const id = req.params.id;

  db.get(`SELECT id, company_id FROM work_orders WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("DB error selecting work_order for start:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row) return res.status(404).json({ error: "Not found" });
    if (String(row.company_id) !== String(companyId)) return res.status(403).json({ error: "Forbidden" });

    // mark as in_progress and record starter
    db.run(
      `UPDATE work_orders SET status = ?, started_at = datetime('now'), started_by = ? WHERE id = ?`,
      ["in_progress", userId, id],
      function (uErr) {
        if (uErr) {
          console.error("DB error updating work_order start:", uErr);
          return res.status(500).json({ error: "DB error" });
        }
        db.get(`SELECT * FROM work_orders WHERE id = ?`, [id], (selErr, updated) => {
          if (selErr) return res.status(500).json({ error: "DB error" });
          return res.json(updated);
        });
      }
    );
  });
});

// GET comp time balance (cumulative) for a user
app.get("/comp-time-balance", requireAuth, (req, res) => {
  const requestedUserId = req.query.user_id || req.user.user_id;
  if (!requestedUserId) return res.status(400).json({ error: "user_id required" });

  // Verify user exists and belongs to the same company as the requester
  db.get(`SELECT id, company_id FROM users WHERE id = ?`, [requestedUserId], (err, userRow) => {
    if (err) {
      console.error("DB error fetching user for comp-time-balance:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!userRow) return res.status(404).json({ error: "User not found" });

    const requesterCompanyId = req.user.company_id;
    if (String(userRow.company_id) !== String(requesterCompanyId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Sum saved and taken comp time from time_reports table
    db.get(
      `SELECT
         COALESCE(SUM(CAST(comp_time_saved_hours AS REAL)), 0) AS saved_hours,
         COALESCE(SUM(CAST(comp_time_taken_hours AS REAL)), 0) AS taken_hours
       FROM time_reports
       WHERE user_id = ? AND (company_id IS NULL OR company_id = ?)`,
      [requestedUserId, requesterCompanyId],
      (sumErr, sums) => {
        if (sumErr) {
          console.error("DB error calculating comp-time-balance:", sumErr);
          return res.status(500).json({ error: "DB error" });
        }

        const saved = Number(sums?.saved_hours || 0);
        const taken = Number(sums?.taken_hours || 0);
        const balance = saved - taken;
        res.json({ saved_hours: saved, taken_hours: taken, balance_hours: balance });
      }
    );
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Opero backend kör på http://localhost:${PORT}`);
});
