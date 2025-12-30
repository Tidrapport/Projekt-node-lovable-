const sqlite3 = require('sqlite3').verbose();
const path = require('path');

(async () => {
  try {
    const dbPath = path.join(__dirname, '..', 'opero.db');
    const db = new sqlite3.Database(dbPath);

    const row = await new Promise((resolve, reject) => {
      db.get('SELECT company_id, access_token, scope, expires_at FROM fortnox_connections LIMIT 1', (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });

    if (!row) {
      console.error('No Fortnox connection row found in DB.');
      process.exit(2);
    }

    const accessToken = row.access_token;
    const companyId = row.company_id;
    const apiBase = process.env.FORTNOX_API_BASE || 'https://api.fortnox.se/3';

    // Use global fetch if available (Node 18+). If not, exit with instruction.
    if (typeof fetch !== 'function') {
      console.error('Global fetch is not available in this Node version. Install `node-fetch` or use Node 18+');
      process.exit(3);
    }

    // Build a minimal attendance transaction payload
    const endpoint = `${apiBase}/attendancetransactions`;
    const payload = {
      AttendanceTransaction: {
        CauseCode: 'ARBETE',
        Date: new Date().toISOString().slice(0, 10),
        EmployeeId: '1',
        Hours: '1'
      }
    };

    console.log('Sending test attendance POST to Fortnox (will NOT print token).');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload),
      timeout: 20000,
    });

    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = text; }

    console.log('HTTP status:', res.status);
    console.log('Parsed response:');
    console.log(typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));

    db.close();
  } catch (err) {
    console.error('Error running test:', err.message || err);
    process.exit(1);
  }
})();
