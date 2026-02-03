const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

// Track DB connectivity without crashing the process (useful on hosted platforms)
let dbConnected = false;
const checkDb = () => {
  db.getConnection((err, connection) => {
    if (err) {
      dbConnected = false;
      console.error('❌ MySQL connection error:', err && err.message ? err.message : err);
      return;
    }
    dbConnected = true;
    console.log('✅ Connected to MySQL');
    try { connection.release(); } catch (e) {}
  });
};

// initial check and periodic re-check
checkDb();
setInterval(checkDb, 30 * 1000);

// 🔹 PING
app.get('/ping', (req, res) => {
  res.json({ ok: true });
});

// 🔹 STATUS - includes DB connectivity info
app.get('/status', async (req, res) => {
  try {
    if (!dbConnected) return res.status(503).json({ ok: false, db: false, message: 'DB not connected' });
    // quick test query
    db.query('SELECT 1 AS ok', (err) => {
      if (err) return res.status(500).json({ ok: false, db: false, message: 'DB query failed' });
      return res.json({ ok: true, db: true });
    });
  } catch (e) {
    return res.status(500).json({ ok: false, db: false, message: 'Status check error' });
  }
});

// 🔹 DIAG - returns presence of env vars and DB connectivity (no secrets)
app.get('/diag', (req, res) => {
  try {
    const envKeys = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'PORT'];
    const env = {};
    envKeys.forEach((k) => { env[k] = !!process.env[k]; });
    return res.json({ ok: true, env, dbConnected: !!dbConnected, nodeEnv: process.env.NODE_ENV || 'not-set', ts: Date.now() });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Diag error' });
  }
});

// 🔹 LOGIN
app.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }

  const sql = `
    SELECT id, email, type 
    FROM users 
    WHERE email = ? AND password = ?
    LIMIT 1
  `;

  db.execute(sql, [email, password], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (!dbConnected) {
      return res.status(503).json({ message: 'Service non disponible (DB inaccessible)' });
    }

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }

    if (rows[0].type !== 'employe') {
      return res.status(403).json({
        message: "Accès refusé : utilisateur non autorisé",
      });
    }

    return res.json({
      ok: true,
      user: rows[0],
    });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () =>
  console.log(`🚀 Server running on port ${PORT}`)
);

// Note: localtunnel removed for production hosting. When deployed to Hostinger
// or another provider the app will be reachable at the service URL/Domain.
