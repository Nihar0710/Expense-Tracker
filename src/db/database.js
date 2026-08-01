import * as SQLite from 'expo-sqlite';

let db;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('wallet.db');
  }
  return db;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
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
      upi_id TEXT NOT NULL UNIQUE,
      last_used_at TEXT,
      use_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      note TEXT,
      frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
      next_run_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT 'pricetag',
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Migrate: add new columns to favorites if upgrading from old schema
  try {
    await database.execAsync(`ALTER TABLE favorites ADD COLUMN last_used_at TEXT`);
  } catch (_) {}
  try {
    await database.execAsync(`ALTER TABLE favorites ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
}

// ─── Transactions ─────────────────────────────────────────────────────────────

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
  return database.getAllAsync(`SELECT * FROM transactions ORDER BY created_at DESC`);
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
  rows.forEach((r) => { summary[r.type] = r.total ?? 0; });
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

/**
 * Filtered transaction search — all filters are optional.
 * @param {object} opts
 * @param {string} opts.search   - matches payee_name, note, upi_id (LIKE)
 * @param {string} opts.status   - 'all' | 'pending' | 'confirmed'
 * @param {string} opts.category - 'all' | category name
 */
export async function searchTransactions({ search = '', status = 'all', category = 'all' } = {}) {
  const database = await getDb();
  const conditions = [];
  const params = [];

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(`(payee_name LIKE ? OR note LIKE ? OR upi_id LIKE ?)`);
    params.push(term, term, term);
  }
  if (status !== 'all') {
    conditions.push(`status = ?`);
    params.push(status);
  }
  if (category !== 'all') {
    conditions.push(`category = ?`);
    params.push(category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return database.getAllAsync(
    `SELECT * FROM transactions ${where} ORDER BY created_at DESC`,
    params
  );
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

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

// ─── Favorites ────────────────────────────────────────────────────────────────

/**
 * Upsert a favorite entry and increment use_count.
 * Called automatically every time a UPI payment is initiated.
 */
export async function markFavoriteUsed(upiId, name) {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO favorites (name, upi_id, last_used_at, use_count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(upi_id) DO UPDATE SET
       name         = excluded.name,
       last_used_at = excluded.last_used_at,
       use_count    = use_count + 1`,
    [name || upiId, upiId, now]
  );
}

export async function getFavorites() {
  const database = await getDb();
  // Most used first; break ties by most recently used
  return database.getAllAsync(
    `SELECT * FROM favorites ORDER BY use_count DESC, last_used_at DESC`
  );
}

export async function deleteFavorite(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM favorites WHERE id = ?`, [id]);
}

// ─── Recurring transactions ───────────────────────────────────────────────────

export async function getRecurringRules() {
  const database = await getDb();
  return database.getAllAsync(`SELECT * FROM recurring_transactions ORDER BY id DESC`);
}

export async function addRecurringRule({ type, amount, category, note, frequency }) {
  const database = await getDb();
  const nextRun = computeNextRun(new Date(), frequency).toISOString();
  await database.runAsync(
    `INSERT INTO recurring_transactions (type, amount, category, note, frequency, next_run_at, active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [type, amount, category, note ?? null, frequency, nextRun]
  );
}

export async function toggleRecurringRule(id, active) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE recurring_transactions SET active = ? WHERE id = ?`,
    [active ? 1 : 0, id]
  );
}

export async function deleteRecurringRule(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM recurring_transactions WHERE id = ?`, [id]);
}

/**
 * Run any overdue recurring rules on app start.
 * Safety cap: max 31 insertions per rule (prevents thousands of entries
 * if the app hasn't been opened for a long time).
 */
export async function processRecurringTransactions() {
  const database = await getDb();
  const now = new Date();
  const rules = await database.getAllAsync(
    `SELECT * FROM recurring_transactions WHERE active = 1 AND next_run_at <= ?`,
    [now.toISOString()]
  );

  for (const rule of rules) {
    let nextRun = new Date(rule.next_run_at);
    let iterations = 0;
    const MAX_CATCH_UP = 31;

    while (nextRun <= now && iterations < MAX_CATCH_UP) {
      await database.runAsync(
        `INSERT INTO transactions (type, amount, category, note, status, created_at)
         VALUES (?, ?, ?, ?, 'confirmed', ?)`,
        [rule.type, rule.amount, rule.category, rule.note ?? null, nextRun.toISOString()]
      );
      nextRun = computeNextRun(nextRun, rule.frequency);
      iterations++;
    }

    await database.runAsync(
      `UPDATE recurring_transactions SET next_run_at = ? WHERE id = ?`,
      [nextRun.toISOString(), rule.id]
    );
  }
}

function computeNextRun(from, frequency) {
  const d = new Date(from);
  if (frequency === 'daily')   d.setDate(d.getDate() + 1);
  if (frequency === 'weekly')  d.setDate(d.getDate() + 7);
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  return d;
}

// ─── Custom categories ────────────────────────────────────────────────────────

export async function getCustomCategories() {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT * FROM custom_categories ORDER BY created_at ASC`
  );
}

/**
 * Insert a new custom category. Color is assigned by the caller.
 * Uses COLLATE NOCASE so "gym" and "Gym" are treated as the same name.
 */
export async function addCustomCategory({ name, icon = 'pricetag', color }) {
  const database = await getDb();
  // Check case-insensitively first, then insert if truly new
  const existing = await database.getFirstAsync(
    `SELECT id FROM custom_categories WHERE name = ? COLLATE NOCASE`,
    [name]
  );
  if (existing) return; // already exists, skip
  await database.runAsync(
    `INSERT INTO custom_categories (name, icon, color, created_at) VALUES (?, ?, ?, ?)`,
    [name, icon, color, new Date().toISOString()]
  );
}

export async function deleteCustomCategory(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM custom_categories WHERE id = ?`, [id]);
}

// ─── Settings (theme preference) ─────────────────────────────────────────────

export async function getThemePref() {
  const database = await getDb();
  const row = await database.getFirstAsync(
    `SELECT value FROM settings WHERE key = 'theme'`
  );
  return row?.value ?? 'system';
}

export async function setThemePref(value) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO settings (key, value) VALUES ('theme', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [value]
  );
}
