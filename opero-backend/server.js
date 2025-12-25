// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const db = require("./database");

const app = express();

// --- middleware ---
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ servera alla .html, .js, .css osv från samma mapp som server.js
app.use(express.static(__dirname));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Serve uppladdade filer (bilder m.m.)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("Missing JWT_SECRET in .env");

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

/**
 * Company scope:
 * - super_admin kan välja company via query (?company_id=) eller via impersonation-token
 * - andra: ALWAYS req.user.company_id
 */
function getScopedCompanyId(req) {
  if (!req.user) return null;
  const role = (req.user.role || "").toLowerCase();
  if (role === "super_admin") {
    return req.query.company_id || req.user.company_id || null;
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
    "SELECT id, name, code, code AS company_code FROM companies ORDER BY name",
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
    db.all("SELECT id, name, code, billing_email, created_at FROM companies ORDER BY name", [], (err, rows) => {
      if (err) {
        console.error("DB-fel vid /companies:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.json(rows || []);
    });
  } else {
    db.all(
      "SELECT id, name, code, billing_email, created_at FROM companies WHERE id = ?",
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

// Skapa företag (superadmin) + valfri admin-användare
app.post("/companies", requireAuth, requireSuperAdmin, (req, res) => {
  const { name, billing_email = null, code, admin_first_name, admin_last_name, admin_email, admin_password } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const companyCode = code || generateCompanyCode();

  db.run(
    `INSERT INTO companies (name, code, billing_email) VALUES (?, ?, ?)`,
    [name.trim(), companyCode.trim(), billing_email ? String(billing_email).trim() : null],
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
  const { name, billing_email, code } = req.body || {};
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

  const { name, orgnr, contact_name, contact_email, contact_phone, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });

  db.run(
    `INSERT INTO customers (company_id, name, orgnr, contact_name, contact_email, contact_phone, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [companyId, name, orgnr || null, contact_name || null, contact_email || null, contact_phone || null, notes || null],
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
  const { name, orgnr, contact_name, contact_email, contact_phone, notes } = req.body || {};

  db.get("SELECT id FROM customers WHERE id = ? AND company_id = ?", [id, companyId], (err, exists) => {
    if (err) {
      console.error("DB-fel vid SELECT customer for PUT:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!exists) return res.status(404).json({ error: "Not found" });

    db.run(
      `UPDATE customers
       SET name = COALESCE(?, name),
           orgnr = COALESCE(?, orgnr),
           contact_name = COALESCE(?, contact_name),
           contact_email = COALESCE(?, contact_email),
           contact_phone = COALESCE(?, contact_phone),
           notes = COALESCE(?, notes)
       WHERE id = ? AND company_id = ?`,
      [name ?? null, orgnr ?? null, contact_name ?? null, contact_email ?? null, contact_phone ?? null, notes ?? null, id, companyId],
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
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const customerId = req.query.customer_id;

  const sql = customerId
    ? `SELECT p.*, c.name AS customer_name
       FROM projects p
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE p.company_id = ? AND p.customer_id = ?
       ORDER BY p.name`
    : `SELECT p.*, c.name AS customer_name
       FROM projects p
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE p.company_id = ?
       ORDER BY p.name`;

  const params = customerId ? [companyId, customerId] : [companyId];

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
  db.run("DELETE FROM projects WHERE id = ? AND company_id = ?", [id, companyId], function (err) {
    if (err) {
      console.error("DB-fel vid DELETE project:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (this.changes === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });
});

// ======================
// SUBPROJECTS (tenant-scoped)
// ======================
// GET /subprojects (optional ?project_id=)
app.get("/subprojects", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const projectId = req.query.project_id;

  if (projectId) {
    db.all(
      "SELECT * FROM subprojects WHERE company_id = ? AND project_id = ? ORDER BY name",
      [companyId, projectId],
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
      "SELECT * FROM subprojects WHERE company_id = ? ORDER BY name",
      [companyId],
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

// Login med email + lösenord + company_id (valfritt)
app.post("/login", (req, res) => {
  const { email, password, company_id } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E‑post och lösenord krävs." });
  }

  let sql = `SELECT * FROM users WHERE email = ?`;
  const params = [email];

  if (company_id) {
    sql += ` AND company_id = ?`;
    params.push(company_id);
  }

  db.get(sql, params, async (err, user) => {
    if (err) {
      console.error("DB-fel vid login:", err);
      return res.status(500).json({ error: "Tekniskt fel." });
    }

    if (!user) {
      return res.status(400).json({ error: "Fel e‑post eller lösenord." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ error: "Fel e‑post eller lösenord." });
    }

    const token = jwt.sign(
      { user_id: user.id, role: user.role, company_id: user.company_id },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

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
  });
});

// Lovable-compatible auth login endpoint (keeps existing /login)
app.post("/auth/login", (req, res) => {
  const { email, password, company_id } = req.body || {};

  db.get(
    `SELECT id, email, password AS password_hash, role, company_id, (first_name || ' ' || last_name) AS full_name FROM users WHERE email = ?`,
    [email],
    async (err, user) => {
      if (err || !user) return res.status(401).json({ error: "Invalid credentials" });

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      if (company_id && String(company_id) !== String(user.company_id) && (user.role || "") !== "super_admin") {
        return res.status(403).json({ error: "Wrong company" });
      }

      const token = jwt.sign(
        { user_id: user.id, role: user.role, company_id: user.company_id },
        JWT_SECRET,
        { expiresIn: "12h" }
      );

      res.json({
        access_token: token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          company_id: user.company_id,
          full_name: user.full_name
        }
      });
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
    return res.json({ access_token: token });
  }
});

app.post("/superadmin/stop-impersonate", requireAuth, requireSuperAdmin, (req, res) => {
  // Return a normal token for the super_admin (without impersonated)
  const token = jwt.sign(
    { user_id: req.user.user_id, role: "super_admin", company_id: req.user.company_id, impersonated: false },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
  return res.json({ access_token: token });
});

// ======================
//   ADMIN: USERS
// ======================
// Hämta användare (admin) – scoped per company via getScopedCompanyId
app.get("/admin/users", requireAuth, requireAdmin, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  db.all(
    `SELECT
      id,
      email,
      role,
      company_id,
      (first_name || ' ' || last_name) as full_name,
      first_name,
      last_name,
      phone,
      hourly_wage,
      emergency_contact,
      employee_type,
      employee_number,
      tax_table,
      created_at
     FROM users
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId],
    (err, rows) => {
      if (err) {
        console.error("DB-fel vid GET /admin/users:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.json(rows || []);
    }
  );
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
  let targetCompanyId = company_id || null;
  if (actorRole !== "super_admin") {
    targetCompanyId = req.user.company_id;
  }

  db.run(
    `INSERT INTO users
      (username, email, password, role, company_id, first_name, last_name, phone, hourly_wage, emergency_contact, employee_type, employee_number, tax_table)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    emergency_contact,
    employee_type,
    employee_number,
    tax_table,
    password
  } = req.body;

  const fields = [];
  const params = [];

  if (first_name !== undefined) {
    fields.push("first_name = ?");
    params.push(first_name.trim());
  }
  if (last_name !== undefined) {
    fields.push("last_name = ?");
    params.push(last_name.trim());
  }
  if (phone !== undefined) {
    fields.push("phone = ?");
    params.push(String(phone || "").trim());
  }
  if (role !== undefined) {
    fields.push("role = ?");
    params.push(String(role).toLowerCase());
  }
  if (hourly_wage !== undefined) {
    fields.push("hourly_wage = ?");
    params.push(
      hourly_wage !== null && hourly_wage !== "" ? Number(hourly_wage) : null
    );
  }
  if (emergency_contact !== undefined) {
    fields.push("emergency_contact = ?");
    params.push(emergency_contact ? String(emergency_contact).trim() : null);
  }
  if (employee_type !== undefined) {
    fields.push("employee_type = ?");
    params.push(employee_type ? String(employee_type).trim() : null);
  }
  if (employee_number !== undefined) {
    fields.push("employee_number = ?");
    params.push(employee_number ? String(employee_number).trim() : null);
  }
  if (tax_table !== undefined) {
    fields.push("tax_table = ?");
    params.push(tax_table !== null && tax_table !== "" ? Number(tax_table) : null);
  }
  if (password !== undefined) {
    fields.push("password = ?");
    params.push(password ? bcrypt.hashSync(password, 10) : null);
  }

  if (!fields.length) {
    return res.status(400).json({ error: "Inget att uppdatera." });
  }

  params.push(id);
  // Ensure target user belongs to same company unless super_admin
  db.get(`SELECT company_id FROM users WHERE id = ?`, [id], (gErr, row) => {
    if (gErr) {
      console.error("DB-fel vid SELECT users for PUT:", gErr);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row) return res.status(404).json({ error: "Användaren hittades inte." });

    const actorRole = (req.user.role || "").toLowerCase();
    const scopedCompany = getScopedCompanyId(req);
    if (actorRole !== "super_admin" && String(row.company_id) !== String(scopedCompany)) {
      return res.status(403).json({ error: "Forbidden" });
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
      res.json({ success: true });
    });
  });
});

// Ta bort användare (admin)
app.delete("/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;

  // Check target user's company
  db.get(`SELECT company_id FROM users WHERE id = ?`, [id], (gErr, row) => {
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

    db.run(
      `DELETE FROM users WHERE id = ?`,
      [id],
      function (err) {
        if (err) {
          console.error("DB-fel vid DELETE /admin/users/:id:", err);
          return res.status(500).json({ error: "Kunde inte ta bort användare." });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: "Användaren hittades inte." });
        }

        res.json({ success: true });
      }
    );
  });
});

// Återställ lösenord (admin)
app.post("/admin/users/:id/reset-password", requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "password required" });

  db.get(`SELECT company_id FROM users WHERE id = ?`, [id], (err, row) => {
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

    const hash = bcrypt.hashSync(password, 10);
    db.run(`UPDATE users SET password = ? WHERE id = ?`, [hash, id], function (uErr) {
      if (uErr) {
        console.error("DB-fel vid reset password:", uErr);
        return res.status(500).json({ error: "DB error" });
      }
      res.json({ success: true });
    });
  });
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
     WHERE company_id = ?
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

      res.json({
        user,
        role: user.role,
        company_id: user.company_id,
        is_admin: (user.role || "").toLowerCase() === "admin" || (user.role || "").toLowerCase() === "super_admin",
        is_super_admin: (user.role || "").toLowerCase() === "super_admin",
        impersonated: !!req.user.impersonated
      });
    }
  );
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
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  db.all(
    `SELECT id, name FROM job_roles WHERE company_id = ? ORDER BY name`,
    [companyId],
    (err, rows) => {
      if (err) {
        console.error("DB-fel vid GET /job-roles:", err);
        return res.status(500).json({ error: "Kunde inte hämta yrkesroller." });
      }
      res.json(rows || []);
    }
  );
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
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  db.all(
    `SELECT id, name, unit FROM material_types WHERE company_id = ? ORDER BY name`,
    [companyId],
    (err, rows) => {
      if (err) {
        console.error("DB-fel vid GET /material-types:", err);
        return res.status(500).json({ error: "Kunde inte hämta materialtyper." });
      }
      res.json(rows || []);
    }
  );
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

// Hämta tidrapporter
// Alias: TIME ENTRIES (tenant-scoped, with filters)
app.get("/time-entries", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

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

  const where = ["u.company_id = ?"];
  const params = [companyId];

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
    WHERE ${where.join(" AND ")}
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

// POST /time-entries (create time report)
app.post("/time-entries", requireAuth, (req, res) => {
  const companyId = getScopedCompanyId(req);
  if (!companyId) return res.status(400).json({ error: "Company not found" });

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
    km,
    km_compensation
  } = req.body || {};

  if (!date) return res.status(400).json({ error: "date required" });

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
    if (String(uRow.company_id) !== String(companyId)) {
      return res.status(403).json({ error: "User not in company" });
    }

    // If project_id provided, ensure project belongs to company
    const checkProject = project_id ? `SELECT id FROM projects WHERE id = ? AND company_id = ?` : null;
    const checkSubproject = subproject_id ? `SELECT id, project_id FROM subprojects WHERE id = ? AND company_id = ?` : null;

    function performInsert() {
      db.run(
        `INSERT INTO time_reports (
          user_id, user_name, datum, starttid, sluttid, timmar, project_id, subproject_id, job_role_id, comment, deviation_title, deviation_description, deviation_status, restid, status, traktamente_type, traktamente_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          status || "draft",
          allowance_type || null,
          allowance_amount || null
        ],
        function (iErr) {
          if (iErr) {
            console.error("DB-fel vid INSERT time_report:", iErr);
            return res.status(500).json({ error: "DB error", details: String(iErr) });
          }
          db.get(`SELECT * FROM time_reports WHERE id = ?`, [this.lastID], (gErr, row) => {
            if (gErr) {
              console.error("DB-fel vid SELECT ny time_report:", gErr);
              return res.status(500).json({ error: "DB error", details: String(gErr) });
            }
            res.json(row);
          });
        }
      );
    }

    function doInsert() {
      if (!job_role_id) return performInsert();

      db.get(
        `SELECT id FROM job_roles WHERE id = ? AND company_id = ?`,
        [job_role_id, companyId],
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
      db.get(checkProject, [project_id, companyId], (pErr, pRow) => {
        if (pErr) {
          console.error("DB-fel vid SELECT project for time entry:", pErr);
          return res.status(500).json({ error: "DB error" });
        }
        if (!pRow) return res.status(400).json({ error: "Invalid project_id" });

        if (checkSubproject) {
          db.get(checkSubproject, [subproject_id, companyId], (sErr, sRow) => {
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
      db.get(checkSubproject, [subproject_id, companyId], (sErr, sRow) => {
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
  if (!companyId) return res.status(400).json({ error: "Company not found" });

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
      if (!uRow || String(uRow.company_id) !== String(companyId)) {
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
        travel_time_hours
      } = req.body || {};

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
              res.json(row);
            });
          }
        );
      }

      if (job_role_id != null) {
        db.get(
          `SELECT id FROM job_roles WHERE id = ? AND company_id = ?`,
          [job_role_id, companyId],
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
  if (!companyId) return res.status(400).json({ error: "Company not found" });

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
      if (!uRow || String(uRow.company_id) !== String(companyId)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!isAdmin && Number(existing.user_id) !== Number(req.user.user_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Delete materials then the report
      db.run(`DELETE FROM report_materials WHERE report_id = ?`, [id], (e2) => {
        if (e2) {
          console.error("DB-fel vid DELETE report_materials:", e2);
          return res.status(500).json({ error: "DB error" });
        }

        db.run(`DELETE FROM time_reports WHERE id = ?`, [id], function (e3) {
          if (e3) {
            console.error("DB-fel vid DELETE time_report:", e3);
            return res.status(500).json({ error: "DB error" });
          }
          res.status(204).end();
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
  if (!companyId) return res.status(400).json({ error: "Company not found" });

  const { user_id, include_images } = req.query || {};
  const isAdmin = (req.user?.role || "").toLowerCase() === "admin" || (req.user?.role || "").toLowerCase() === "super_admin";
  const effectiveUserId = isAdmin ? user_id : req.user.user_id;

  const where = ["dr.company_id = ?"];
  const params = [companyId];
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
    WHERE ${where.join(" AND ")}
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Opero backend kör på http://localhost:${PORT}`);
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
