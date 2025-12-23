// auth.js
// ------------------------------------------------------
// Grundinställningar
// ------------------------------------------------------
const ADMIN_EMAIL = "edgar@test.se";
const ADMIN_PASSWORD = "1234"; // samma som i backend/database.js

// ------------------------------------------------------
// Helpers för users i localStorage (används av admin-users / contacts)
// ------------------------------------------------------
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem("users")) || [];
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

// Skapa standard-admin om den saknas (endast i localStorage-demot)
function ensureDefaultAdmin() {
  let users = getUsers();
  const exists = users.some((u) => u.email === ADMIN_EMAIL);

  if (!exists) {
    const adminUser = {
      id: Date.now(),
      firstName: "Edgar",
      lastName: "Zubkov",
      email: ADMIN_EMAIL,
      role: "admin", // admin / anställd / platschef / inhyrd
      phone: "",
      password: ADMIN_PASSWORD, // endast för ren front-end-inloggning
    };
    users.push(adminUser);
    saveUsers(users);
    console.log("Skapade standard-admin:", ADMIN_EMAIL, "/", ADMIN_PASSWORD);
  }
}

// ------------------------------------------------------
// Inloggad användare (gemensamt format)
// ------------------------------------------------------

// Anropas på login-sidan när backend /login lyckas
function setCurrentUser(user) {
  if (!user) return;

  // Spara full user från backend
  localStorage.setItem("currentUser", JSON.stringify(user));
  if (user.company_id) {
    localStorage.setItem("company_id", user.company_id);
  }
  if (user.company_name) {
    localStorage.setItem("company_name", user.company_name);
  }

  // Extra fält för äldre sidor
  const name =
    (user.first_name || user.firstName || "") +
    (user.last_name || user.lastName ? " " + (user.last_name || user.lastName) : "");

  localStorage.setItem("name", name.trim() || user.email || "");
  localStorage.setItem("role", user.role || "user");
  localStorage.setItem("email", user.email || "");
  localStorage.setItem("token", localStorage.getItem("token") || "loggedin");
}

// Hämta inloggad användare
function getCurrentUser() {
  try {
    const raw = localStorage.getItem("currentUser");
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignorera parse-fel och fortsätt
  }

  // Fallback om bara role/name/email finns sparat (äldre sidor)
  const role = localStorage.getItem("role");
  const email = localStorage.getItem("email");
  const name = localStorage.getItem("name");
  if (!role && !email) return null;

  const [firstName, ...rest] = (name || "").split(" ");
  const lastName = rest.join(" ").trim() || "";

  return {
    firstName: firstName || "",
    lastName,
    email: email || "",
    role: role || "user",
  };
}

// Kräv att man är inloggad – annars tillbaka till login.html
function requireLogin() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

// Är användaren admin?
function isAdmin(user) {
  return user && user.role === "admin";
}

function getCompanyNameFromStorage() {
  return localStorage.getItem("company_name") || "";
}

function applyCompanyBranding(companyName) {
  if (!companyName) return;
  localStorage.setItem("company_name", companyName);

  document.querySelectorAll(".company-name").forEach((el) => {
    el.textContent = companyName;
  });

  // uppdatera sidtitel om den använder "–"
  if (document.title.includes("–")) {
    const parts = document.title.split("–");
    if (parts.length >= 2) {
      parts[0] = `${companyName} `;
      document.title = parts.join("–");
    }
  }
}

function getUserDisplayName(user) {
  return (
    (user.first_name || user.firstName || "") +
    ((user.last_name || user.lastName) ? " " + (user.last_name || user.lastName) : "")
  ).trim();
}

function applyWelcomeText(user, companyName) {
  const welcomeEls = document.querySelectorAll("#welcomeText, .welcome");
  const label = getUserDisplayName(user) || user.email || "";
  if (!label && !companyName) return;

  const companyLabel = companyName || getCompanyNameFromStorage();
  const welcome = label ? `Välkommen, ${label}` : "Välkommen";
  const full = companyLabel ? `${welcome} · ${companyLabel}` : welcome;

  welcomeEls.forEach((el) => {
    el.textContent = full;
  });
}

async function refreshCompanyNameFromApi() {
  const token = localStorage.getItem("token");
  const companyId = localStorage.getItem("company_id");
  if (!token || !companyId) return null;

  try {
    const res = await fetch("/companies", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;

    const match = data.find((c) => String(c.id) === String(companyId)) || data[0];
    if (match?.name) {
      applyCompanyBranding(match.name);
      const user = getCurrentUser();
      if (user) applyWelcomeText(user, match.name);
      return match.name;
    }
  } catch (e) {
    return null;
  }
  return null;
}

// ------------------------------------------------------
// Meny & header (vänstersida + välkomsttext)
// ------------------------------------------------------
function setupSidebarForUser(user) {
  if (!user) return;

  // Dölj alla element med klassen .admin-only om inte admin
  const adminEls = document.querySelectorAll(".admin-only");
  if (!isAdmin(user)) {
    adminEls.forEach((el) => {
      el.style.display = "none";
    });
  }

  const companyName = getCompanyNameFromStorage();
  applyCompanyBranding(companyName);
  applyWelcomeText(user, companyName);
  refreshCompanyNameFromApi();
}

// ------------------------------------------------------
// Lösenordsgenerator (används t.ex. på admin-users.html)
// ------------------------------------------------------
function generatePassword(length = 10) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

// ------------------------------------------------------
// Körs automatiskt på alla sidor som laddar auth.js
// ------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  ensureDefaultAdmin(); // påverkar bara localStorage-demot

  // Lägg på ikoner i sidomenyn (monokroma/utan färg)
  const iconStyleId = "nav-icon-style";
  if (!document.getElementById(iconStyleId)) {
    const style = document.createElement("style");
    style.id = iconStyleId;
    style.textContent = `
      .sidebar .nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        letter-spacing: 0.2px;
        color: #e5e7eb;
      }
      .sidebar .nav-item .nav-icon {
        font-size: 16px;
        opacity: 0.9;
        color: #e5e7eb;
        font-family: "Inter", "Segoe UI", sans-serif;
        width: 18px;
        min-width: 18px;
        display: inline-flex;
        justify-content: center;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  const icons = {
    "Översikt": "⟳",          // modern dashboard/refresh symbol
    "Tidrapporter": "⌚",      // watch/clock
    "Planering": "🗓︎",       // calendar
    "Avvikelser": "⚡",        // alert/issue
    "Svetsrapport": "🧾︎",     // receipt/doc
    "Lönöversikt": "¤",       // currency
    "Fakturering": "🧾",      // invoice
    "Kontakter": "👥︎",        // people
    "Attestering": "✔︎",      // check
    "Projekt": "🏗︎",         // crane/build
    "Yrkesroller": "🛠︎",      // tools
    "Materialtyper": "⬚",     // box/placeholder
    "OB-inställningar": "⏱",  // stopwatch
    "Användare": "👤︎",        // user
  };

  document.querySelectorAll(".sidebar .nav-item").forEach((link) => {
    const text = (link.textContent || "").trim();
    const icon = icons[text];
    if (!icon) return;
    if (link.querySelector(".nav-icon")) return;
    const span = document.createElement("span");
    span.className = "nav-icon";
    span.textContent = icon;
    link.insertBefore(span, link.firstChild);
  });
});
