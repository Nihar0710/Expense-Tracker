import * as SQLite from 'expo-sqlite';

let db;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('wallet.db');
  }
  return db;
}

// Creates all tables if they don't already exist. Call once on app start.
export async function initDatabase() {
  const database = await getDb();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
      amount REAL NOT NULL,
      payee_name TEXT,
      upi_id TEXT,
      category TEXT NOT NULL DEFAULT 'Other',
      note TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL UNIQUE,
      monthly_limit REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      upi_id TEXT NOT NULL UNIQUE
    );
  `);
}

// ---------- Transactions ----------

export async function insertPendingTransaction({ amount, payeeName, upiId, note }) {
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO transactions (type, amount, payee_name, upi_id, category, note, status, created_at)
     VALUES ('expense', ?, ?, ?, 'Other', ?, 'pending', ?)`,
    [amount, payeeName ?? null, upiId ?? null, note ?? null, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export async function confirmTransaction(id, category) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE transactions SET status = 'confirmed', category = ? WHERE id = ?`,
    [category, id]
  );
}

export async function discardTransaction(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
}

export async function addManualTransaction({ type, amount, category, note }) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO transactions (type, amount, category, note, status, created_at)
     VALUES (?, ?, ?, ?, 'confirmed', ?)`,
    [type, amount, category, note ?? null, new Date().toISOString()]
  );
}

export async function getAllTransactions() {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT * FROM transactions ORDER BY created_at DESC`
  );
}

export async function getPendingTransactions() {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT * FROM transactions WHERE status = 'pending' ORDER BY created_at DESC`
  );
}

export async function getMonthSummary() {
  const database = await getDb();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const rows = await database.getAllAsync(
    `SELECT type, SUM(amount) as total FROM transactions
     WHERE status = 'confirmed' AND created_at >= ?
     GROUP BY type`,
    [monthStart.toISOString()]
  );

  const summary = { income: 0, expense: 0 };
  rows.forEach((r) => {
    summary[r.type] = r.total ?? 0;
  });
  return summary;
}

export async function getCategoryBreakdown() {
  const database = await getDb();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return database.getAllAsync(
    `SELECT category, SUM(amount) as total FROM transactions
     WHERE status = 'confirmed' AND type = 'expense' AND created_at >= ?
     GROUP BY category
     ORDER BY total DESC`,
    [monthStart.toISOString()]
  );
}

// ---------- Budgets ----------

export async function setBudget(category, monthlyLimit) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO budgets (category, monthly_limit) VALUES (?, ?)
     ON CONFLICT(category) DO UPDATE SET monthly_limit = excluded.monthly_limit`,
    [category, monthlyLimit]
  );
}

export async function getBudgets() {
  const database = await getDb();
  return database.getAllAsync(`SELECT * FROM budgets`);
}

// ---------- Favorites ----------

export async function addFavorite(name, upiId) {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR IGNORE INTO favorites (name, upi_id) VALUES (?, ?)`,
    [name, upiId]
  );
}

export async function getFavorites() {
  const database = await getDb();
  return database.getAllAsync(`SELECT * FROM favorites ORDER BY name ASC`);
}
