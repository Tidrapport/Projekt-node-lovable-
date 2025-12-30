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
      address_line1 TEXT,
      address_line2 TEXT,
      postal_code TEXT,
      city TEXT,
      country TEXT,
      phone TEXT,
      bankgiro TEXT,
      bic_number TEXT,
      iban_number TEXT,
      logo_url TEXT,
      org_number TEXT,
      vat_number TEXT,
      f_skatt INTEGER DEFAULT 0,
      invoice_payment_terms TEXT,
      invoice_our_reference TEXT,
      invoice_late_interest TEXT,
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
    const hasAddressLine1 = columns.some((col) => col.name === "address_line1");
    if (!hasAddressLine1) {
      db.run(`ALTER TABLE companies ADD COLUMN address_line1 TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till address_line1:", alterErr);
      });
    }
    const hasAddressLine2 = columns.some((col) => col.name === "address_line2");
    if (!hasAddressLine2) {
      db.run(`ALTER TABLE companies ADD COLUMN address_line2 TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till address_line2:", alterErr);
      });
    }
    const hasPostalCode = columns.some((col) => col.name === "postal_code");
    if (!hasPostalCode) {
      db.run(`ALTER TABLE companies ADD COLUMN postal_code TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till postal_code:", alterErr);
      });
    }
    const hasCity = columns.some((col) => col.name === "city");
    if (!hasCity) {
      db.run(`ALTER TABLE companies ADD COLUMN city TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till city:", alterErr);
      });
    }
    const hasCountry = columns.some((col) => col.name === "country");
    if (!hasCountry) {
      db.run(`ALTER TABLE companies ADD COLUMN country TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till country:", alterErr);
      });
    }
    const hasPhone = columns.some((col) => col.name === "phone");
    if (!hasPhone) {
      db.run(`ALTER TABLE companies ADD COLUMN phone TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till phone:", alterErr);
      });
    }
    const hasBankgiro = columns.some((col) => col.name === "bankgiro");
    if (!hasBankgiro) {
      db.run(`ALTER TABLE companies ADD COLUMN bankgiro TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till bankgiro:", alterErr);
      });
    }
    const hasBicNumber = columns.some((col) => col.name === "bic_number");
    if (!hasBicNumber) {
      db.run(`ALTER TABLE companies ADD COLUMN bic_number TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till bic_number:", alterErr);
      });
    }
    const hasIbanNumber = columns.some((col) => col.name === "iban_number");
    if (!hasIbanNumber) {
      db.run(`ALTER TABLE companies ADD COLUMN iban_number TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till iban_number:", alterErr);
      });
    }
    const hasLogoUrl = columns.some((col) => col.name === "logo_url");
    if (!hasLogoUrl) {
      db.run(`ALTER TABLE companies ADD COLUMN logo_url TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till logo_url:", alterErr);
      });
    }
    const hasOrgNumber = columns.some((col) => col.name === "org_number");
    if (!hasOrgNumber) {
      db.run(`ALTER TABLE companies ADD COLUMN org_number TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till org_number:", alterErr);
      });
    }
    const hasVatNumber = columns.some((col) => col.name === "vat_number");
    if (!hasVatNumber) {
      db.run(`ALTER TABLE companies ADD COLUMN vat_number TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till vat_number:", alterErr);
      });
    }
    const hasFSkatt = columns.some((col) => col.name === "f_skatt");
    if (!hasFSkatt) {
      db.run(`ALTER TABLE companies ADD COLUMN f_skatt INTEGER DEFAULT 0;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till f_skatt:", alterErr);
      });
    }
    const hasInvoiceTerms = columns.some((col) => col.name === "invoice_payment_terms");
    if (!hasInvoiceTerms) {
      db.run(`ALTER TABLE companies ADD COLUMN invoice_payment_terms TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till invoice_payment_terms:", alterErr);
      });
    }
    const hasInvoiceReference = columns.some((col) => col.name === "invoice_our_reference");
    if (!hasInvoiceReference) {
      db.run(`ALTER TABLE companies ADD COLUMN invoice_our_reference TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till invoice_our_reference:", alterErr);
      });
    }
    const hasInvoiceLateInterest = columns.some((col) => col.name === "invoice_late_interest");
    if (!hasInvoiceLateInterest) {
      db.run(`ALTER TABLE companies ADD COLUMN invoice_late_interest TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till invoice_late_interest:", alterErr);
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
    const hasIsActive = columns.some((col) => col.name === "is_active");
    if (!hasIsActive) {
      db.run(`ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till is_active:", alterErr);
        else console.log('Kolumnen "is_active" har lagts till i users.');
      });
    }
    const hasDeactivatedAt = columns.some((col) => col.name === "deactivated_at");
    if (!hasDeactivatedAt) {
      db.run(`ALTER TABLE users ADD COLUMN deactivated_at TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till deactivated_at:", alterErr);
        else console.log('Kolumnen "deactivated_at" har lagts till i users.');
      });
    }
    const hasReactivatedAt = columns.some((col) => col.name === "reactivated_at");
    if (!hasReactivatedAt) {
      db.run(`ALTER TABLE users ADD COLUMN reactivated_at TEXT;`, (alterErr) => {
        if (alterErr) console.error("Kunde inte lägga till reactivated_at:", alterErr);
        else console.log('Kolumnen "reactivated_at" har lagts till i users.');
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

  // --- Price lists (Prislistor) per år ---
  db.run(`
    CREATE TABLE IF NOT EXISTS job_role_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      job_role_id INTEGER NOT NULL,
      article_number TEXT,
      day_article_number TEXT,
      evening_article_number TEXT,
      night_article_number TEXT,
      weekend_article_number TEXT,
      overtime_weekday_article_number TEXT,
      overtime_weekend_article_number TEXT,
      per_diem_article_number TEXT,
      travel_time_article_number TEXT,
      base_rate REAL,
      day_rate REAL,
      evening_rate REAL,
      night_rate REAL,
      weekend_rate REAL,
      overtime_weekday_rate REAL,
      overtime_weekend_rate REAL,
      per_diem_rate REAL,
      travel_time_rate REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (job_role_id) REFERENCES job_roles(id),
      UNIQUE (company_id, year, job_role_id)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_job_role_rates_company_year ON job_role_rates(company_id, year);`);
  db.all(`PRAGMA table_info(job_role_rates);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för job_role_rates:", err);
      return;
    }
    const hasColumn = (name) => columns.some((col) => col.name === name);
    const addColumn = (sql, label) => {
      db.run(sql, (alterErr) => {
        if (alterErr) {
          console.error(`Kunde inte lägga till kolumnen ${label}:`, alterErr);
        }
      });
    };
    if (!hasColumn("article_number")) addColumn(`ALTER TABLE job_role_rates ADD COLUMN article_number TEXT;`, "article_number");
    if (!hasColumn("day_article_number"))
      addColumn(`ALTER TABLE job_role_rates ADD COLUMN day_article_number TEXT;`, "day_article_number");
    if (!hasColumn("evening_article_number"))
      addColumn(`ALTER TABLE job_role_rates ADD COLUMN evening_article_number TEXT;`, "evening_article_number");
    if (!hasColumn("night_article_number"))
      addColumn(`ALTER TABLE job_role_rates ADD COLUMN night_article_number TEXT;`, "night_article_number");
    if (!hasColumn("weekend_article_number"))
      addColumn(`ALTER TABLE job_role_rates ADD COLUMN weekend_article_number TEXT;`, "weekend_article_number");
    if (!hasColumn("overtime_weekday_article_number"))
      addColumn(
        `ALTER TABLE job_role_rates ADD COLUMN overtime_weekday_article_number TEXT;`,
        "overtime_weekday_article_number"
      );
    if (!hasColumn("overtime_weekend_article_number"))
      addColumn(
        `ALTER TABLE job_role_rates ADD COLUMN overtime_weekend_article_number TEXT;`,
        "overtime_weekend_article_number"
      );
    if (!hasColumn("per_diem_article_number"))
      addColumn(`ALTER TABLE job_role_rates ADD COLUMN per_diem_article_number TEXT;`, "per_diem_article_number");
    if (!hasColumn("travel_time_article_number"))
      addColumn(
        `ALTER TABLE job_role_rates ADD COLUMN travel_time_article_number TEXT;`,
        "travel_time_article_number"
      );
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS material_type_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      material_type_id INTEGER NOT NULL,
      article_number TEXT,
      price REAL,
      unit TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (material_type_id) REFERENCES material_types(id),
      UNIQUE (company_id, year, material_type_id)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_material_type_rates_company_year ON material_type_rates(company_id, year);`);
  db.all(`PRAGMA table_info(material_type_rates);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för material_type_rates:", err);
      return;
    }
    const hasColumn = (name) => columns.some((col) => col.name === name);
    if (!hasColumn("article_number")) {
      db.run(`ALTER TABLE material_type_rates ADD COLUMN article_number TEXT;`, (alterErr) => {
        if (alterErr) {
          console.error("Kunde inte lägga till kolumnen article_number:", alterErr);
        }
      });
    }
  });

  // --- Project-specific price lists (external) ---
  db.run(`
    CREATE TABLE IF NOT EXISTS price_list_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      show_day INTEGER DEFAULT 1,
      show_evening INTEGER DEFAULT 1,
      show_night INTEGER DEFAULT 1,
      show_weekend INTEGER DEFAULT 1,
      show_overtime_weekday INTEGER DEFAULT 1,
      show_overtime_weekend INTEGER DEFAULT 1,
      day_start TEXT,
      day_end TEXT,
      evening_start TEXT,
      evening_end TEXT,
      night_start TEXT,
      night_end TEXT,
      weekend_start TEXT,
      weekend_end TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      UNIQUE (company_id, year)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_price_list_settings_company_year ON price_list_settings(company_id, year);`);
  db.all(`PRAGMA table_info(price_list_settings);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för price_list_settings:", err);
      return;
    }
    const hasColumn = (name) => columns.some((col) => col.name === name);
    const addColumn = (sql, label) => {
      db.run(sql, (alterErr) => {
        if (alterErr) console.error(`Kunde inte lägga till ${label}:`, alterErr);
      });
    };
    if (!hasColumn("show_day")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN show_day INTEGER DEFAULT 1;`, "show_day");
    if (!hasColumn("show_evening")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN show_evening INTEGER DEFAULT 1;`, "show_evening");
    if (!hasColumn("show_night")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN show_night INTEGER DEFAULT 1;`, "show_night");
    if (!hasColumn("show_weekend")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN show_weekend INTEGER DEFAULT 1;`, "show_weekend");
    if (!hasColumn("show_overtime_weekday")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN show_overtime_weekday INTEGER DEFAULT 1;`, "show_overtime_weekday");
    if (!hasColumn("show_overtime_weekend")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN show_overtime_weekend INTEGER DEFAULT 1;`, "show_overtime_weekend");
    if (!hasColumn("day_start")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN day_start TEXT;`, "day_start");
    if (!hasColumn("day_end")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN day_end TEXT;`, "day_end");
    if (!hasColumn("evening_start")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN evening_start TEXT;`, "evening_start");
    if (!hasColumn("evening_end")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN evening_end TEXT;`, "evening_end");
    if (!hasColumn("night_start")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN night_start TEXT;`, "night_start");
    if (!hasColumn("night_end")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN night_end TEXT;`, "night_end");
    if (!hasColumn("weekend_start")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN weekend_start TEXT;`, "weekend_start");
    if (!hasColumn("weekend_end")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN weekend_end TEXT;`, "weekend_end");
    if (!hasColumn("created_at")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN created_at TEXT;`, "created_at");
    if (!hasColumn("updated_at")) addColumn(`ALTER TABLE price_list_settings ADD COLUMN updated_at TEXT;`, "updated_at");
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS project_price_list_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      show_day INTEGER DEFAULT 1,
      show_evening INTEGER DEFAULT 1,
      show_night INTEGER DEFAULT 1,
      show_weekend INTEGER DEFAULT 1,
      show_overtime_weekday INTEGER DEFAULT 1,
      show_overtime_weekend INTEGER DEFAULT 1,
      day_start TEXT,
      day_end TEXT,
      evening_start TEXT,
      evening_end TEXT,
      night_start TEXT,
      night_end TEXT,
      weekend_start TEXT,
      weekend_end TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      UNIQUE (company_id, year, project_id)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_price_list_settings_company_year ON project_price_list_settings(company_id, year);`);
  db.all(`PRAGMA table_info(project_price_list_settings);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för project_price_list_settings:", err);
      return;
    }
    const hasColumn = (name) => columns.some((col) => col.name === name);
    const addColumn = (sql, label) => {
      db.run(sql, (alterErr) => {
        if (alterErr) console.error(`Kunde inte lägga till ${label}:`, alterErr);
      });
    };
    if (!hasColumn("show_day")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN show_day INTEGER DEFAULT 1;`, "show_day");
    if (!hasColumn("show_evening")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN show_evening INTEGER DEFAULT 1;`, "show_evening");
    if (!hasColumn("show_night")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN show_night INTEGER DEFAULT 1;`, "show_night");
    if (!hasColumn("show_weekend")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN show_weekend INTEGER DEFAULT 1;`, "show_weekend");
    if (!hasColumn("show_overtime_weekday")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN show_overtime_weekday INTEGER DEFAULT 1;`, "show_overtime_weekday");
    if (!hasColumn("show_overtime_weekend")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN show_overtime_weekend INTEGER DEFAULT 1;`, "show_overtime_weekend");
    if (!hasColumn("day_start")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN day_start TEXT;`, "day_start");
    if (!hasColumn("day_end")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN day_end TEXT;`, "day_end");
    if (!hasColumn("evening_start")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN evening_start TEXT;`, "evening_start");
    if (!hasColumn("evening_end")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN evening_end TEXT;`, "evening_end");
    if (!hasColumn("night_start")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN night_start TEXT;`, "night_start");
    if (!hasColumn("night_end")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN night_end TEXT;`, "night_end");
    if (!hasColumn("weekend_start")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN weekend_start TEXT;`, "weekend_start");
    if (!hasColumn("weekend_end")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN weekend_end TEXT;`, "weekend_end");
    if (!hasColumn("created_at")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN created_at TEXT;`, "created_at");
    if (!hasColumn("updated_at")) addColumn(`ALTER TABLE project_price_list_settings ADD COLUMN updated_at TEXT;`, "updated_at");
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS project_job_role_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      job_role_id INTEGER NOT NULL,
      article_number TEXT,
      day_article_number TEXT,
      evening_article_number TEXT,
      night_article_number TEXT,
      weekend_article_number TEXT,
      overtime_weekday_article_number TEXT,
      overtime_weekend_article_number TEXT,
      per_diem_article_number TEXT,
      travel_time_article_number TEXT,
      day_rate REAL,
      evening_rate REAL,
      night_rate REAL,
      weekend_rate REAL,
      overtime_weekday_rate REAL,
      overtime_weekend_rate REAL,
      per_diem_rate REAL,
      travel_time_rate REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (job_role_id) REFERENCES job_roles(id),
      UNIQUE (company_id, year, project_id, job_role_id)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_job_role_rates_company_year ON project_job_role_rates(company_id, year);`);
  db.all(`PRAGMA table_info(project_job_role_rates);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för project_job_role_rates:", err);
      return;
    }
    const hasColumn = (name) => columns.some((col) => col.name === name);
    const addColumn = (sql, label) => {
      db.run(sql, (alterErr) => {
        if (alterErr) console.error(`Kunde inte lägga till ${label}:`, alterErr);
      });
    };
    if (!hasColumn("day_rate")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN day_rate REAL;`, "day_rate");
    if (!hasColumn("article_number")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN article_number TEXT;`, "article_number");
    if (!hasColumn("day_article_number"))
      addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN day_article_number TEXT;`, "day_article_number");
    if (!hasColumn("evening_article_number"))
      addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN evening_article_number TEXT;`, "evening_article_number");
    if (!hasColumn("night_article_number"))
      addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN night_article_number TEXT;`, "night_article_number");
    if (!hasColumn("weekend_article_number"))
      addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN weekend_article_number TEXT;`, "weekend_article_number");
    if (!hasColumn("overtime_weekday_article_number"))
      addColumn(
        `ALTER TABLE project_job_role_rates ADD COLUMN overtime_weekday_article_number TEXT;`,
        "overtime_weekday_article_number"
      );
    if (!hasColumn("overtime_weekend_article_number"))
      addColumn(
        `ALTER TABLE project_job_role_rates ADD COLUMN overtime_weekend_article_number TEXT;`,
        "overtime_weekend_article_number"
      );
    if (!hasColumn("per_diem_article_number"))
      addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN per_diem_article_number TEXT;`, "per_diem_article_number");
    if (!hasColumn("travel_time_article_number"))
      addColumn(
        `ALTER TABLE project_job_role_rates ADD COLUMN travel_time_article_number TEXT;`,
        "travel_time_article_number"
      );
    if (!hasColumn("evening_rate")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN evening_rate REAL;`, "evening_rate");
    if (!hasColumn("night_rate")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN night_rate REAL;`, "night_rate");
    if (!hasColumn("weekend_rate")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN weekend_rate REAL;`, "weekend_rate");
    if (!hasColumn("overtime_weekday_rate")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN overtime_weekday_rate REAL;`, "overtime_weekday_rate");
    if (!hasColumn("overtime_weekend_rate")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN overtime_weekend_rate REAL;`, "overtime_weekend_rate");
    if (!hasColumn("per_diem_rate")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN per_diem_rate REAL;`, "per_diem_rate");
    if (!hasColumn("travel_time_rate")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN travel_time_rate REAL;`, "travel_time_rate");
    if (!hasColumn("created_at")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN created_at TEXT;`, "created_at");
    if (!hasColumn("updated_at")) addColumn(`ALTER TABLE project_job_role_rates ADD COLUMN updated_at TEXT;`, "updated_at");
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS project_material_type_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      material_type_id INTEGER NOT NULL,
      article_number TEXT,
      price REAL,
      unit TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (material_type_id) REFERENCES material_types(id),
      UNIQUE (company_id, year, project_id, material_type_id)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_material_type_rates_company_year ON project_material_type_rates(company_id, year);`);
  db.all(`PRAGMA table_info(project_material_type_rates);`, (err, columns) => {
    if (err) {
      console.error("Kunde inte läsa schema för project_material_type_rates:", err);
      return;
    }
    const hasColumn = (name) => columns.some((col) => col.name === name);
    const addColumn = (sql, label) => {
      db.run(sql, (alterErr) => {
        if (alterErr) console.error(`Kunde inte lägga till ${label}:`, alterErr);
      });
    };
    if (!hasColumn("article_number"))
      addColumn(`ALTER TABLE project_material_type_rates ADD COLUMN article_number TEXT;`, "article_number");
    if (!hasColumn("price")) addColumn(`ALTER TABLE project_material_type_rates ADD COLUMN price REAL;`, "price");
    if (!hasColumn("unit")) addColumn(`ALTER TABLE project_material_type_rates ADD COLUMN unit TEXT;`, "unit");
    if (!hasColumn("created_at")) addColumn(`ALTER TABLE project_material_type_rates ADD COLUMN created_at TEXT;`, "created_at");
    if (!hasColumn("updated_at")) addColumn(`ALTER TABLE project_material_type_rates ADD COLUMN updated_at TEXT;`, "updated_at");
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

  // --- Work orders ---
  db.run(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      order_number INTEGER NOT NULL,
      order_year INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      instructions TEXT,
      project_id INTEGER,
      priority TEXT DEFAULT 'medium',
      deadline TEXT,
      address TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      status TEXT DEFAULT 'active',
      report_text TEXT,
      report_updated_at TEXT,
      report_updated_by INTEGER,
      started_at TEXT,
      started_by INTEGER,
      closed_at TEXT,
      closed_by INTEGER,
      attested_at TEXT,
      attested_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      UNIQUE (company_id, order_year, order_number)
    );
  `);

  db.all(`PRAGMA table_info(work_orders);`, (err, cols) => {
    if (err) {
      console.error("Kunde inte läsa schema för work_orders:", err);
      return;
    }
    const hasReportText = cols.some((c) => c.name === "report_text");
    const hasReportUpdatedAt = cols.some((c) => c.name === "report_updated_at");
    const hasReportUpdatedBy = cols.some((c) => c.name === "report_updated_by");
    const hasStartedAt = cols.some((c) => c.name === "started_at");
    const hasStartedBy = cols.some((c) => c.name === "started_by");
    const hasClosedAt = cols.some((c) => c.name === "closed_at");
    const hasClosedBy = cols.some((c) => c.name === "closed_by");
    const hasAttestedAt = cols.some((c) => c.name === "attested_at");
    const hasAttestedBy = cols.some((c) => c.name === "attested_by");

    if (!hasReportText) {
      db.run(`ALTER TABLE work_orders ADD COLUMN report_text TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till report_text:", e);
      });
    }
    if (!hasReportUpdatedAt) {
      db.run(`ALTER TABLE work_orders ADD COLUMN report_updated_at TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till report_updated_at:", e);
      });
    }
    if (!hasReportUpdatedBy) {
      db.run(`ALTER TABLE work_orders ADD COLUMN report_updated_by INTEGER;`, (e) => {
        if (e) console.error("Kunde inte lägga till report_updated_by:", e);
      });
    }
    if (!hasStartedAt) {
      db.run(`ALTER TABLE work_orders ADD COLUMN started_at TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till started_at:", e);
      });
    }
    if (!hasStartedBy) {
      db.run(`ALTER TABLE work_orders ADD COLUMN started_by INTEGER;`, (e) => {
        if (e) console.error("Kunde inte lägga till started_by:", e);
      });
    }
    if (!hasClosedAt) {
      db.run(`ALTER TABLE work_orders ADD COLUMN closed_at TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till closed_at:", e);
      });
    }
    if (!hasClosedBy) {
      db.run(`ALTER TABLE work_orders ADD COLUMN closed_by INTEGER;`, (e) => {
        if (e) console.error("Kunde inte lägga till closed_by:", e);
      });
    }
    if (!hasAttestedAt) {
      db.run(`ALTER TABLE work_orders ADD COLUMN attested_at TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till attested_at:", e);
      });
    }
    if (!hasAttestedBy) {
      db.run(`ALTER TABLE work_orders ADD COLUMN attested_by INTEGER;`, (e) => {
        if (e) console.error("Kunde inte lägga till attested_by:", e);
      });
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS work_order_assignees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE (work_order_id, user_id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS work_order_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON work_orders(company_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_work_orders_year ON work_orders(order_year);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_work_order_assignees_work_order_id ON work_order_assignees(work_order_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_work_order_comments_work_order_id ON work_order_comments(work_order_id);`);

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
      customer_number TEXT,
      customer_type TEXT,
      name TEXT NOT NULL,
      orgnr TEXT,
      vat_number TEXT,
      invoice_address1 TEXT,
      invoice_address2 TEXT,
      postal_code TEXT,
      city TEXT,
      country TEXT,
      contact_name TEXT,
      contact_email TEXT,
      invoice_email TEXT,
      contact_phone TEXT,
      phone_secondary TEXT,
      their_reference TEXT,
      notes TEXT,
      payment_terms TEXT,
      reverse_vat INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.all(`PRAGMA table_info(customers);`, (err, cols) => {
    if (err) {
      console.error("Kunde inte läsa schema för customers:", err);
      return;
    }
    const hasCustomerNumber = cols.some((c) => c.name === "customer_number");
    if (!hasCustomerNumber) {
      db.run(`ALTER TABLE customers ADD COLUMN customer_number TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till customer_number:", e);
      });
    }
    const hasCustomerType = cols.some((c) => c.name === "customer_type");
    if (!hasCustomerType) {
      db.run(`ALTER TABLE customers ADD COLUMN customer_type TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till customer_type:", e);
      });
    }
    const hasVatNumber = cols.some((c) => c.name === "vat_number");
    if (!hasVatNumber) {
      db.run(`ALTER TABLE customers ADD COLUMN vat_number TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till vat_number:", e);
      });
    }
    const hasInvoiceAddress1 = cols.some((c) => c.name === "invoice_address1");
    if (!hasInvoiceAddress1) {
      db.run(`ALTER TABLE customers ADD COLUMN invoice_address1 TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till invoice_address1:", e);
      });
    }
    const hasInvoiceAddress2 = cols.some((c) => c.name === "invoice_address2");
    if (!hasInvoiceAddress2) {
      db.run(`ALTER TABLE customers ADD COLUMN invoice_address2 TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till invoice_address2:", e);
      });
    }
    const hasPostalCode = cols.some((c) => c.name === "postal_code");
    if (!hasPostalCode) {
      db.run(`ALTER TABLE customers ADD COLUMN postal_code TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till postal_code:", e);
      });
    }
    const hasCity = cols.some((c) => c.name === "city");
    if (!hasCity) {
      db.run(`ALTER TABLE customers ADD COLUMN city TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till city:", e);
      });
    }
    const hasCountry = cols.some((c) => c.name === "country");
    if (!hasCountry) {
      db.run(`ALTER TABLE customers ADD COLUMN country TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till country:", e);
      });
    }
    const hasPhoneSecondary = cols.some((c) => c.name === "phone_secondary");
    if (!hasPhoneSecondary) {
      db.run(`ALTER TABLE customers ADD COLUMN phone_secondary TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till phone_secondary:", e);
      });
    }
    const hasTheirReference = cols.some((c) => c.name === "their_reference");
    if (!hasTheirReference) {
      db.run(`ALTER TABLE customers ADD COLUMN their_reference TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till their_reference:", e);
      });
    }
    const hasInvoiceEmail = cols.some((c) => c.name === "invoice_email");
    if (!hasInvoiceEmail) {
      db.run(`ALTER TABLE customers ADD COLUMN invoice_email TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till invoice_email:", e);
      });
    }
    const hasPaymentTerms = cols.some((c) => c.name === "payment_terms");
    if (!hasPaymentTerms) {
      db.run(`ALTER TABLE customers ADD COLUMN payment_terms TEXT;`, (e) => {
        if (e) console.error("Kunde inte lägga till payment_terms:", e);
      });
    }
    const hasReverseVat = cols.some((c) => c.name === "reverse_vat");
    if (!hasReverseVat) {
      db.run(`ALTER TABLE customers ADD COLUMN reverse_vat INTEGER DEFAULT 0;`, (e) => {
        if (e) console.error("Kunde inte lägga till reverse_vat:", e);
      });
    }
  });

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

  // --- Fortnox salary codes & mappings ---
  db.run(`
    CREATE TABLE IF NOT EXISTS fortnox_salary_codes (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      default_fortnox_code TEXT,
      company_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fortnox_company_mappings (
      company_id INTEGER NOT NULL,
      internal_code TEXT NOT NULL,
      fortnox_code TEXT NOT NULL,
      fortnox_description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (company_id, internal_code),
      FOREIGN KEY (internal_code) REFERENCES fortnox_salary_codes(code) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fortnox_export_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      period_start TEXT,
      period_end TEXT,
      employee_count INTEGER,
      entry_count INTEGER,
      exported_by INTEGER,
      filename TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --- Fortnox OAuth connection per company ---
  db.run(`
    CREATE TABLE IF NOT EXISTS fortnox_connections (
      company_id INTEGER PRIMARY KEY,
      access_token TEXT,
      refresh_token TEXT,
      token_type TEXT,
      scope TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  `);

  // --- Audit logs ---
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      company_id INTEGER,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      metadata TEXT,
      success INTEGER DEFAULT 1,
      ip TEXT,
      user_agent TEXT
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created_at ON audit_logs(company_id, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id, created_at)`);

  // --- Employee certificates ---
  db.run(`
    CREATE TABLE IF NOT EXISTS employee_certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      issuer TEXT,
      certificate_number TEXT,
      valid_from TEXT,
      valid_to TEXT,
      notes TEXT,
      file_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_employee_certificates_company_user ON employee_certificates(company_id, user_id)`);

  const defaultFortnoxCodes = [
    {
      code: "ARBETE",
      name: "Arbetade timmar",
      description: "Arbetade timmar",
      category: "base",
      default_fortnox_code: "11"
    },
    {
      code: "OVERTID_VARDAG",
      name: "Övertid vardag",
      description: "Övertid vardag",
      category: "base",
      default_fortnox_code: "310"
    },
    {
      code: "OVERTID_HELG",
      name: "Övertid helg",
      description: "Övertid helg",
      category: "base",
      default_fortnox_code: "320"
    },
    {
      code: "OB_KVALL",
      name: "OB kväll",
      description: "OB kväll",
      category: "base",
      default_fortnox_code: "530"
    },
    {
      code: "OB_NATT",
      name: "OB natt",
      description: "OB natt",
      category: "base",
      default_fortnox_code: "540"
    },
    {
      code: "OB_HELG",
      name: "OB helg",
      description: "OB helg",
      category: "base",
      default_fortnox_code: "550"
    },
    {
      code: "RESTID",
      name: "Restid",
      description: "Restid",
      category: "base",
      default_fortnox_code: "600"
    },
    {
      code: "TRAKTAMENTE_HEL",
      name: "Heldagstraktamente",
      description: "Heldagstraktamente",
      category: "base",
      default_fortnox_code: "710"
    },
    {
      code: "TRAKTAMENTE_HALV",
      name: "Halvdagstraktamente",
      description: "Halvdagstraktamente",
      category: "base",
      default_fortnox_code: "720"
    }
  ];

  defaultFortnoxCodes.forEach((code) => {
    db.get(
      "SELECT code FROM fortnox_salary_codes WHERE code = ?",
      [code.code],
      (err, row) => {
        if (err) {
          console.error("Kunde inte läsa fortnox_salary_codes:", err);
          return;
        }
        if (row) return;
        db.run(
          `INSERT INTO fortnox_salary_codes
           (code, name, description, category, default_fortnox_code)
           VALUES (?, ?, ?, ?, ?)`,
          [
            code.code,
            code.name,
            code.description,
            code.category,
            code.default_fortnox_code
          ],
          (insertErr) => {
            if (insertErr) {
              console.error("Kunde inte lägga till Fortnox-kod:", insertErr);
            }
          }
        );
      }
    );
  });
});

module.exports = db;
