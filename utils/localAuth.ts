import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

const db = SQLite.openDatabase('novaeco_local.db');

const run = (sql: string, params: any[] = []) =>
  new Promise<{ rows: { _array: any[] } }>((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        sql,
        params,
        (_tx, result) => resolve(result as any),
        (_tx, err) => {
          reject(err);
          return false;
        }
      );
    });
  });

export async function initDb() {
  await run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      type TEXT NOT NULL
    )`
  );
}

async function hashPassword(password: string) {
  // SHA-256 hashing for prototype. For production, use stronger KDF.
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
}

export async function createUser(email: string, password: string, type = 'employe') {
  const pwHash = await hashPassword(password);
  try {
    await run('INSERT INTO users (email, password_hash, type) VALUES (?, ?, ?)', [email, pwHash, type]);
    return true;
  } catch (e) {
    return false;
  }
}

export async function findUserByEmailAndPassword(email: string, password: string) {
  const pwHash = await hashPassword(password);
  try {
    const res = await run('SELECT id, email, type FROM users WHERE email = ? AND password_hash = ? LIMIT 1', [email, pwHash]);
    return res.rows._array[0] || null;
  } catch (e) {
    return null;
  }
}

export async function ensureSampleUser() {
  try {
    const res = await run('SELECT id FROM users WHERE email = ? LIMIT 1', ['admin@local']);
    if (res.rows._array.length === 0) {
      await createUser('admin@local', 'Password123!', 'employe');
    }
  } catch (e) {
    // ignore
  }
}

export default {
  initDb,
  createUser,
  findUserByEmailAndPassword,
  ensureSampleUser,
};
