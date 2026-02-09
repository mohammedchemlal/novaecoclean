const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Expo } = require('expo-server-sdk');
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

// ===== Supabase realtime listener for new tasks -> push notifications =====
try {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️ Supabase env not set; push notifications disabled. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  } else {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    const expo = new Expo();

    const channel = supabase.channel('tasks-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, async (payload) => {
        try {
          const task = payload.new || {};
          if (!task.assigned_to) return;
          // Fetch push tokens for the assigned user
          const { data: tokens, error } = await supabase
            .from('push_tokens')
            .select('token')
            .eq('user_id', task.assigned_to);
          if (error) {
            console.error('Supabase tokens fetch error:', error);
            return;
          }
          if (!tokens || tokens.length === 0) return;

          // Prepare messages
          const messages = tokens
            .map((t) => t.token)
            .filter((token) => Expo.isExpoPushToken(token))
            .map((token) => ({
              to: token,
              sound: 'default',
              title: 'Nouvelle tâche assignée',
              body: `${task.title || 'Tâche'} — ${task.client_name || ''}`,
              data: { taskId: task.id },
            }));

          if (messages.length === 0) return;

          const chunks = expo.chunkPushNotifications(messages);
          for (const chunk of chunks) {
            try {
              const receipts = await expo.sendPushNotificationsAsync(chunk);
              console.log('📣 Push receipts:', receipts);
            } catch (err) {
              console.error('Expo push error:', err);
            }
          }
        } catch (err) {
          console.error('Task notify handler error:', err);
        }
      })
      .subscribe((status) => {
        console.log('📡 Supabase realtime status:', status);
      });

    process.on('SIGINT', async () => {
      try { await supabase.removeChannel(channel); } catch {}
      process.exit(0);
    });

    // Test route to send a manual push (for setup verification)
    app.post('/notify-test', async (req, res) => {
      try {
        const { user_id, title, body } = req.body || {};
        if (!user_id) return res.status(400).json({ ok: false, message: 'user_id required' });
        const { data: tokens, error } = await supabase
          .from('push_tokens')
          .select('token')
          .eq('user_id', user_id);
        if (error) return res.status(500).json({ ok: false, message: 'Token fetch error', error });
        const messages = (tokens || [])
          .map((t) => t.token)
          .filter((token) => Expo.isExpoPushToken(token))
          .map((token) => ({
            to: token,
            sound: 'default',
            title: title || 'Test notification',
            body: body || 'Push setup successful',
          }));
        const chunks = expo.chunkPushNotifications(messages);
        const receipts = [];
        for (const chunk of chunks) {
          const r = await expo.sendPushNotificationsAsync(chunk);
          receipts.push(...r);
        }
        return res.json({ ok: true, receipts });
      } catch (err) {
        console.error('Notify-test error:', err);
        return res.status(500).json({ ok: false, message: 'Notify-test failed' });
      }
    });
  }
} catch (err) {
  console.error('Failed to init Supabase realtime push:', err);
}
