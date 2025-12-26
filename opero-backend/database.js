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
      code TEXT UNIQUE,
      billing_email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Lägg till ev. saknade kolumner i companies
  db.all(`PRAGMA table_info(companies);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för companies:", err);
      return;
    }
    const hasBilling = columns.some((col) => col.name === "billing_email");
    if (!hasBilling) {
      db.run(`ALTER TABLE companies ADD COLUMN billing_email TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till billing_email:", alterErr);
        else console.log('Kolumnen "billing_email" har lagts till i companies.');
      });
    }
    const hasCreatedAt = columns.some((col) => col.name === "created_at");
    if (!hasCreatedAt) {
      db.run(`ALTER TABLE companies ADD COLUMN created_at TEXT;`, (alterErr) => {
        if (alterErr) {
          console.error("Kunde inte lägga till created_at:", alterErr);
        } else {
          db.run(`UPDATE companies SET created_at = COALESCE(created_at, datetime('now')) WHERE created_at IS NULL;`);
          console.log('Kolumnen "created_at" har lagts till i companies.');
        }
      });
    }
  });

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
      monthly_salary REAL,
      emergency_contact TEXT,
      employee_type TEXT,
      employee_number TEXT,
      tax_table INTEGER,
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
    const hasMonthlySalary = columns.some((col) => col.name === "monthly_salary");
    if (!hasMonthlySalary) {
      db.run(`ALTER TABLE users ADD COLUMN monthly_salary REAL;`, (alterErr) => {
        if (alterErr) {
          console.error("Kunde inte lägga till kolumnen monthly_salary:", alterErr);
        } else {
          console.log('Kolumnen "monthly_salary" har lagts till i users.');
        }
      });
    }
    const hasEmergency = columns.some((col) => col.name === "emergency_contact");
    if (!hasEmergency) {
      db.run(`ALTER TABLE users ADD COLUMN emergency_contact TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till emergency_contact:", alterErr);
        else console.log('Kolumnen "emergency_contact" har lagts till i users.');
      });
    }
    const hasEmployeeType = columns.some((col) => col.name === "employee_type");
    if (!hasEmployeeType) {
      db.run(`ALTER TABLE users ADD COLUMN employee_type TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till employee_type:", alterErr);
        else console.log('Kolumnen "employee_type" har lagts till i users.');
      });
    }
    const hasEmployeeNumber = columns.some((col) => col.name === "employee_number");
    if (!hasEmployeeNumber) {
      db.run(`ALTER TABLE users ADD COLUMN employee_number TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till employee_number:", alterErr);
        else console.log('Kolumnen "employee_number" har lagts till i users.');
      });
    }
    const hasTaxTable = columns.some((col) => col.name === "tax_table");
    if (!hasTaxTable) {
      db.run(`ALTER TABLE users ADD COLUMN tax_table INTEGER;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till tax_table:", alterErr);
        else console.log('Kolumnen "tax_table" har lagts till i users.');
      });
    }
  });

  // --- Job roles (Yrkesroller) per företag ---
  db.run(`
    CREATE TABLE IF NOT EXISTS job_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      UNIQUE (company_id, name)
    );
  `);

  db.all(`PRAGMA table_info(job_roles);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för job_roles:", err);
      return;
    }
    const hasCompanyId = columns.some((col) => col.name === "company_id");
    if (!hasCompanyId) {
      // Migrera befintlig tabell till företagsscope (default company_id = 1)
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS job_roles_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            UNIQUE (company_id, name)
          );
        `, (createErr) => {
          if (createErr) {
            console.error("Kunde inte skapa job_roles_new:", createErr);
          }
        });
        db.run(
          `INSERT INTO job_roles_new (id, company_id, name, created_at)
           SELECT id, 1 AS company_id, name, created_at FROM job_roles;`,
          (copyErr) => {
            if (copyErr) console.error("Kunde inte kopiera data till job_roles_new:", copyErr);
          }
        );
        db.run(`DROP TABLE job_roles;`, (dropErr) => {
          if (dropErr) console.error("Kunde inte ta bort gamla job_roles:", dropErr);
        });
        db.run(`ALTER TABLE job_roles_new RENAME TO job_roles;`, (renameErr) => {
          if (renameErr) console.error("Kunde inte döpa om job_roles_new:", renameErr);
        });
      });
    }
    db.run(`CREATE INDEX IF NOT EXISTS idx_job_roles_company_id ON job_roles(company_id);`);
  });

  // --- Material types (Materialtyper) per företag ---
  db.run(`
    CREATE TABLE IF NOT EXISTS material_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      unit TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      UNIQUE (company_id, name)
    );
  `);

  db.all(`PRAGMA table_info(material_types);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för material_types:", err);
      return;
    }
    const hasCompanyId = columns.some((col) => col.name === "company_id");
    const hasUnit = columns.some((col) => col.name === "unit");

    if (!hasCompanyId) {
      // Migrera befintlig tabell till företagsscope (default company_id = 1)
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS material_types_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            unit TEXT,
            created_at TEXT,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            UNIQUE (company_id, name)
          );
        `, (createErr) => {
          if (createErr) console.error("Kunde inte skapa material_types_new:", createErr);
        });
        db.run(
          `INSERT INTO material_types_new (id, company_id, name, unit, created_at)
           SELECT id, 1 AS company_id, name, unit, created_at FROM material_types;`,
          (copyErr) => {
            if (copyErr) console.error("Kunde inte kopiera data till material_types_new:", copyErr);
          }
        );
        db.run(`DROP TABLE material_types;`, (dropErr) => {
          if (dropErr) console.error("Kunde inte ta bort gamla material_types:", dropErr);
        });
        db.run(`ALTER TABLE material_types_new RENAME TO material_types;`, (renameErr) => {
          if (renameErr) console.error("Kunde inte döpa om material_types_new:", renameErr);
        });
      });
    } else if (!hasUnit) {
      db.run(`ALTER TABLE material_types ADD COLUMN unit TEXT;`, (alterErr) => {
        if (alterErr) {
          console.error("Kunde inte lägga till kolumnen unit:", alterErr);
        } else {
          console.log('Kolumnen "unit" har lagts till i material_types.');
        }
      });
    }

    db.run(`CREATE INDEX IF NOT EXISTS idx_material_types_company_id ON material_types(company_id);`);
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
      deviation_title TEXT,
      deviation_description TEXT,
      deviation_status TEXT,
      restid REAL DEFAULT 0,
      save_travel_compensation INTEGER DEFAULT 0,
      overtime_weekday_hours REAL DEFAULT 0,
      overtime_weekend_hours REAL DEFAULT 0,
      save_comp_time INTEGER DEFAULT 0,
      comp_time_saved_hours REAL DEFAULT 0,
      comp_time_taken_hours REAL DEFAULT 0,
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
    const hasDevTitle = cols.some((c) => c.name === "deviation_title");
    const hasDevDesc = cols.some((c) => c.name === "deviation_description");
    const hasDevStatus = cols.some((c) => c.name === "deviation_status");
    const hasSaveTravel = cols.some((c) => c.name === "save_travel_compensation");
    const hasOvertimeWeekday = cols.some((c) => c.name === "overtime_weekday_hours");
    const hasOvertimeWeekend = cols.some((c) => c.name === "overtime_weekend_hours");
    const hasSaveCompTime = cols.some((c) => c.name === "save_comp_time");
    const hasCompTimeSaved = cols.some((c) => c.name === "comp_time_saved_hours");
    const hasCompTimeTaken = cols.some((c) => c.name === "comp_time_taken_hours");
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
    if (!hasDevTitle) {
      db.run(`ALTER TABLE time_reports ADD COLUMN deviation_title TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till deviation_title:", e);
      });
    }
    if (!hasDevDesc) {
      db.run(`ALTER TABLE time_reports ADD COLUMN deviation_description TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till deviation_description:", e);
      });
    }
    if (!hasDevStatus) {
      db.run(`ALTER TABLE time_reports ADD COLUMN deviation_status TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till deviation_status:", e);
      });
    }
    if (!hasSaveTravel) {
      db.run(`ALTER TABLE time_reports ADD COLUMN save_travel_compensation INTEGER DEFAULT 0;`, (e) => {
        if (e) console.error("Kunde inte lägga till save_travel_compensation:", e);
      });
    }
    if (!hasOvertimeWeekday) {
      db.run(`ALTER TABLE time_reports ADD COLUMN overtime_weekday_hours REAL DEFAULT 0;`, (e) => {
        if (e) console.error("Kunde inte lägga till overtime_weekday_hours:", e);
      });
    }
    if (!hasOvertimeWeekend) {
      db.run(`ALTER TABLE time_reports ADD COLUMN overtime_weekend_hours REAL DEFAULT 0;`, (e) => {
        if (e) console.error("Kunde inte lägga till overtime_weekend_hours:", e);
      });
    }
    if (!hasSaveCompTime) {
      db.run(`ALTER TABLE time_reports ADD COLUMN save_comp_time INTEGER DEFAULT 0;`, (e) => {
        if (e) console.error("Kunde inte lägga till save_comp_time:", e);
      });
    }
    if (!hasCompTimeSaved) {
      db.run(`ALTER TABLE time_reports ADD COLUMN comp_time_saved_hours REAL DEFAULT 0;`, (e) => {
        if (e) console.error("Kunde inte lägga till comp_time_saved_hours:", e);
      });
    }
    if (!hasCompTimeTaken) {
      db.run(`ALTER TABLE time_reports ADD COLUMN comp_time_taken_hours REAL DEFAULT 0;`, (e) => {
        if (e) console.error("Kunde inte lägga till comp_time_taken_hours:", e);
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

  // --- Deviation reports (linked to tidrapporter) ---
  db.run(`
    CREATE TABLE IF NOT EXISTS deviation_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      time_entry_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT,
      status TEXT,
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (time_entry_id) REFERENCES time_reports(id)
    );
  `);

  db.all(`PRAGMA table_info(deviation_reports);`, (err, cols) => {
    if (err) {
      console.error("Kunde inte läsa schema för deviation_reports:", err);
      return;
    }
    const hasSeverity = cols.some((c) => c.name === "severity");
    const hasStatus = cols.some((c) => c.name === "status");
    const hasResolvedAt = cols.some((c) => c.name === "resolved_at");
    const hasUpdatedAt = cols.some((c) => c.name === "updated_at");
    if (!hasSeverity) {
      db.run(`ALTER TABLE deviation_reports ADD COLUMN severity TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till severity i deviation_reports:", e);
      });
    }
    if (!hasStatus) {
      db.run(`ALTER TABLE deviation_reports ADD COLUMN status TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till status i deviation_reports:", e);
      });
    }
    if (!hasResolvedAt) {
      db.run(`ALTER TABLE deviation_reports ADD COLUMN resolved_at TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till resolved_at i deviation_reports:", e);
      });
    }
    if (!hasUpdatedAt) {
      db.run(`ALTER TABLE deviation_reports ADD COLUMN updated_at TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till updated_at i deviation_reports:", e);
        else db.run(`UPDATE deviation_reports SET updated_at = COALESCE(updated_at, created_at, datetime('now'));`);
      });
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_deviation_reports_company ON deviation_reports(company_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deviation_reports_user ON deviation_reports(user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deviation_reports_entry ON deviation_reports(time_entry_id);`);

  // --- Welding reports ---
  db.run(`
    CREATE TABLE IF NOT EXISTS welding_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      company_id INTEGER,
      report_date TEXT,
      own_ao_number TEXT,
      customer_ao_number TEXT,
      welder_name TEXT,
      welder_id TEXT,
      report_year INTEGER,
      report_month INTEGER,
      bessy_anm_ofelia TEXT,
      welding_entries TEXT, -- JSON-array
      id_marked_weld INTEGER DEFAULT 0,
      geometry_control INTEGER DEFAULT 0,
      cleaned_workplace INTEGER DEFAULT 0,
      restored_rail_quantity INTEGER DEFAULT 0,
      welded_in_cold_climate INTEGER DEFAULT 0,
      ensured_gas_flow INTEGER DEFAULT 0,
      protected_cooling INTEGER DEFAULT 0,
      welding_supervisor TEXT,
      supervisor_phone TEXT,
      deviations TEXT,
      comments TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_welding_reports_user ON welding_reports(user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_welding_reports_company ON welding_reports(company_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_welding_reports_year_month ON welding_reports(report_year, report_month);`);

  // --- Deviation images ---
  db.run(`
    CREATE TABLE IF NOT EXISTS deviation_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviation_report_id INTEGER NOT NULL,
      file_name TEXT,
      storage_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (deviation_report_id) REFERENCES deviation_reports(id) ON DELETE CASCADE
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deviation_images_report ON deviation_images(deviation_report_id);`);

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
      first_shift_start_time TEXT,
      work_address TEXT,
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
    const hasFirstShift = columns.some((c) => c.name === "first_shift_start_time");
    if (!hasFirstShift) {
      db.run(`ALTER TABLE plans ADD COLUMN first_shift_start_time TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till first_shift_start_time:", e);
      });
    }
    const hasWorkAddress = columns.some((c) => c.name === "work_address");
    if (!hasWorkAddress) {
      db.run(`ALTER TABLE plans ADD COLUMN work_address TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till work_address:", e);
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

  // --- Shift type configs (OB/övertid) ---
  db.run(`
    CREATE TABLE IF NOT EXISTS shift_types_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      shift_type TEXT NOT NULL,
      multiplier REAL DEFAULT 1.0,
      start_hour INTEGER,
      end_hour INTEGER,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, shift_type)
    )
  `);

  // --- Compensation settings (restid) ---
  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL UNIQUE,
      travel_rate REAL DEFAULT 170,
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
