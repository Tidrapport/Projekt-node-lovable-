// database.js
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

const db = new sqlite3.Database("./opero.db");

db.serialize(() => {
  // Slå på foreign keys (bra vana)
  db.run(`PRAGMA foreign_keys = ON;`);

  // --- Companies ---
  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE
    );
  `);

  // --- Users ---
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT UNIQUE,
      email      TEXT UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'user',
      company_id INTEGER,
      first_name TEXT,
      last_name  TEXT,
      phone      TEXT,
      hourly_wage REAL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );
  `);

  // Lägg till "hourly_wage" om den saknas
  db.all(`PRAGMA table_info(users);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för users:", err);
      return;
    }
    const hasHourly = columns.some((col) => col.name === "hourly_wage");
    if (!hasHourly) {
      db.run(`ALTER TABLE users ADD COLUMN hourly_wage REAL;`, (alterErr) => {
        if (alterErr) {
          console.error("Kunde inte lägga till kolumnen hourly_wage:", alterErr);
        } else {
          console.log('Kolumnen "hourly_wage" har lagts till i users.');
        }
      });
    }
  });

  // --- Job roles (Yrkesroller) ---
  db.run(`
    CREATE TABLE IF NOT EXISTS job_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // --- Material types (Materialtyper) ---
  db.run(`
    CREATE TABLE IF NOT EXISTS material_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Lägg till "unit"-kolumn om tabellen redan fanns utan den
  db.all(`PRAGMA table_info(material_types);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för material_types:", err);
      return;
    }
    const hasUnit = columns.some((col) => col.name === "unit");
    if (!hasUnit) {
      db.run(`ALTER TABLE material_types ADD COLUMN unit TEXT;`, (alterErr) => {
        if (alterErr) {
          console.error("Kunde inte lägga till kolumnen unit:", alterErr);
        } else {
          console.log('Kolumnen "unit" har lagts till i material_types.');
        }
      });
    }
  });

  // Standard‑företag (id = 1)
  db.run(
    `INSERT OR IGNORE INTO companies (id, name, code)
     VALUES (1, 'Rail Work AB', 'RWA');`
  );

  // --- Time reports ---
  db.run(`
    CREATE TABLE IF NOT EXISTS time_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT,
      datum TEXT NOT NULL,
      starttid TEXT,
      sluttid TEXT,
      timmar REAL,
      project_id INTEGER,
      subproject_id INTEGER,
      job_role_id INTEGER,
      comment TEXT,
      restid REAL DEFAULT 0,
      status TEXT DEFAULT 'Ny',
      attested_by INTEGER,
      attested_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Lägg till traktamente-kolumner om de saknas (migration)
  db.all(`PRAGMA table_info(time_reports);`, (err, cols) => {
    if (err) {
      console.error("Kunde inte läsa schema för time_reports:", err);
      return;
    }
    const hasType = cols.some((c) => c.name === "traktamente_type");
    const hasAmount = cols.some((c) => c.name === "traktamente_amount");
    if (!hasType) {
      db.run(`ALTER TABLE time_reports ADD COLUMN traktamente_type TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till traktamente_type:", e);
        else console.log('Kolumnen "traktamente_type" har lagts till i time_reports.');
      });
    }
    if (!hasAmount) {
      db.run(`ALTER TABLE time_reports ADD COLUMN traktamente_amount REAL DEFAULT 0;`, (e) => {
        if (e) console.error("Kunde inte lägga till traktamente_amount:", e);
        else console.log('Kolumnen "traktamente_amount" har lagts till i time_reports.');
      });
    }
  });

  // --- Report materials ---
  db.run(`
    CREATE TABLE IF NOT EXISTS report_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      material_type_id INTEGER,
      quantity REAL,
      place TEXT,
      FOREIGN KEY (report_id) REFERENCES time_reports(id) ON DELETE CASCADE,
      FOREIGN KEY (material_type_id) REFERENCES material_types(id)
    );
  `);

  // --- Planneringsuppdrag (admin skapar)
  db.run(`
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project TEXT NOT NULL,
      subproject TEXT,
      contact_person TEXT,
      contact_phone TEXT,
      vehicle TEXT,
      destination TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      tentative INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Lägg till subproject-kolumn om den saknas (migration)
  db.all(`PRAGMA table_info(plans);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för plans:", err);
      return;
    }
    const hasSubproject = columns.some((c) => c.name === "subproject");
    if (!hasSubproject) {
      db.run(`ALTER TABLE plans ADD COLUMN subproject TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till subproject:", e);
      });
    }
  });

  // Skapa admin‑användare om den inte finns
  const adminEmail = "edgar@test.se";
  const adminPasswordPlain = "1234";

  db.get(
    `SELECT id FROM users WHERE email = ?`,
    [adminEmail],
    (err, row) => {
      if (err) {
        console.error("Kunde inte läsa admin-användare:", err);
        return;
      }

      if (!row) {
        const hash = bcrypt.hashSync(adminPasswordPlain, 10);

        db.run(
          `INSERT INTO users
            (username, email, password, role, company_id, first_name, last_name, phone)
           VALUES (?, ?, ?, 'admin', 1, 'Edgar', 'Zubkov', '');`,
          [adminEmail, adminEmail, hash],
          (err2) => {
            if (err2) {
              console.error("Kunde inte skapa admin-användare:", err2);
            } else {
              console.log("Admin-användare skapad: edgar@test.se / 1234");
            }
          }
        );
      }
    }
  );

  // Skapa Lukas (admin) om saknas – efterfrågad testanvändare
  const lukasEmail = "lukas@test.se";
  const lukasPasswordPlain = "1234";

  db.get(
    `SELECT id FROM users WHERE email = ?`,
    [lukasEmail],
    (err, row) => {
      if (err) {
        console.error("Kunde inte läsa Lukas-användare:", err);
        return;
      }

      if (!row) {
        const hash = bcrypt.hashSync(lukasPasswordPlain, 10);
        db.run(
          `INSERT INTO users
            (username, email, password, role, company_id, first_name, last_name, phone)
           VALUES (?, ?, ?, 'admin', 1, 'Lukas', '', '');`,
          [lukasEmail, lukasEmail, hash],
          (err2) => {
            if (err2) {
              console.error("Kunde inte skapa Lukas-användare:", err2);
            } else {
              console.log("Admin-användare skapad: lukas@test.se / 1234");
            }
          }
        );
      }
    }
  );

  // --- Customers ---
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      orgnr TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --- Projects ---
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      customer_id INTEGER,
      name TEXT NOT NULL,
      code TEXT,
      is_active INTEGER DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --- Subprojects ---
  db.run(`
    CREATE TABLE IF NOT EXISTS subprojects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

module.exports = db;
