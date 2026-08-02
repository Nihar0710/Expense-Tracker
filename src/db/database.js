import * as SQLite from 'expo-sqlite';

let db;

export async function getDb() {
  if (!db) db = await SQLite.openDatabaseAsync('wallet.db');
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
      receipt_uri TEXT,
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

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS transaction_tags (
      transaction_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (transaction_id, tag_id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      target_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bill_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL,
      due_date TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Bills',
      recurring INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS split_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS split_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS split_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_by_member_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS split_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      split_expense_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      share_amount REAL NOT NULL,
      settled INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (split_expense_id) REFERENCES split_expenses(id) ON DELETE CASCADE
    );
  `);

  // ── Migrations ────────────────────────────────────────────────────────────
  const migrations = [
    `ALTER TABLE favorites ADD COLUMN last_used_at TEXT`,
    `ALTER TABLE favorites ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE transactions ADD COLUMN receipt_uri TEXT`,
    // Feature 1: Cash mode
    `ALTER TABLE transactions ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'upi'`,
    // Feature 2: Payee notes
    `ALTER TABLE favorites ADD COLUMN notes TEXT`,
    // Feature 9: IOU tracker
    `CREATE TABLE IF NOT EXISTS ious (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_name TEXT NOT NULL,
      amount REAL NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('owed_to_me','i_owe')),
      note TEXT,
      settled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
  ];
  for (const sql of migrations) {
    try { await database.execAsync(sql); } catch (_) {}
  }
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

export async function confirmTransactionWithReceipt(id, category, receiptUri) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE transactions SET status = 'confirmed', category = ?, receipt_uri = ? WHERE id = ?`,
    [category, receiptUri ?? null, id]
  );
}

export async function discardTransaction(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
}

export async function addManualTransaction({ type, amount, category, note, receiptUri, tags, paymentMethod }) {
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO transactions (type, amount, category, note, status, receipt_uri, payment_method, created_at)
     VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
    [type, amount, category, note ?? null, receiptUri ?? null, paymentMethod ?? 'upi', new Date().toISOString()]
  );
  if (tags && tags.length > 0) {
    await setTransactionTags(result.lastInsertRowId, tags);
  }
  return result.lastInsertRowId;
}

export async function updateTransactionReceipt(id, receiptUri) {
  const database = await getDb();
  await database.runAsync(`UPDATE transactions SET receipt_uri = ? WHERE id = ?`, [receiptUri, id]);
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
     GROUP BY category ORDER BY total DESC`,
    [monthStart.toISOString()]
  );
}

export async function searchTransactions({ search = '', status = 'all', category = 'all', tagId = null, paymentMethod = 'all' } = {}) {
  const database = await getDb();
  const conditions = [];
  const params = [];

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(`(t.payee_name LIKE ? OR t.note LIKE ? OR t.upi_id LIKE ?)`);
    params.push(term, term, term);
  }
  if (status !== 'all') { conditions.push(`t.status = ?`); params.push(status); }
  if (category !== 'all') { conditions.push(`t.category = ?`); params.push(category); }
  if (paymentMethod !== 'all') { conditions.push(`t.payment_method = ?`); params.push(paymentMethod); }
  if (tagId) {
    conditions.push(`EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id = t.id AND tt.tag_id = ?)`);
    params.push(tagId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return database.getAllAsync(
    `SELECT t.* FROM transactions t ${where} ORDER BY t.created_at DESC`,
    params
  );
}

// ── Monthly report ────────────────────────────────────────────────────────────

export async function getMonthlyReport(year, month) {
  const database = await getDb();
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);
  const rows = await database.getAllAsync(
    `SELECT * FROM transactions
     WHERE status = 'confirmed' AND type IN ('expense','income')
       AND created_at >= ? AND created_at < ?
     ORDER BY created_at DESC`,
    [start.toISOString(), end.toISOString()]
  );
  return rows;
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

export async function markFavoriteUsed(upiId, name) {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO favorites (name, upi_id, last_used_at, use_count) VALUES (?, ?, ?, 1)
     ON CONFLICT(upi_id) DO UPDATE SET
       name = excluded.name, last_used_at = excluded.last_used_at, use_count = use_count + 1`,
    [name || upiId, upiId, now]
  );
}

export async function getFavorites() {
  const database = await getDb();
  return database.getAllAsync(`SELECT * FROM favorites ORDER BY use_count DESC, last_used_at DESC`);
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
  await database.runAsync(`UPDATE recurring_transactions SET active = ? WHERE id = ?`, [active ? 1 : 0, id]);
}

export async function deleteRecurringRule(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM recurring_transactions WHERE id = ?`, [id]);
}

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
    while (nextRun <= now && iterations < 31) {
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
  return database.getAllAsync(`SELECT * FROM custom_categories ORDER BY created_at ASC`);
}

export async function addCustomCategory({ name, icon = 'pricetag', color }) {
  const database = await getDb();
  const existing = await database.getFirstAsync(
    `SELECT id FROM custom_categories WHERE name = ? COLLATE NOCASE`, [name]
  );
  if (existing) return;
  await database.runAsync(
    `INSERT INTO custom_categories (name, icon, color, created_at) VALUES (?, ?, ?, ?)`,
    [name, icon, color, new Date().toISOString()]
  );
}

export async function deleteCustomCategory(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM custom_categories WHERE id = ?`, [id]);
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function getAllTags() {
  const database = await getDb();
  return database.getAllAsync(`SELECT * FROM tags ORDER BY name ASC`);
}

export async function getOrCreateTag(name) {
  const database = await getDb();
  const trimmed = name.trim();
  let tag = await database.getFirstAsync(
    `SELECT * FROM tags WHERE name = ? COLLATE NOCASE`, [trimmed]
  );
  if (!tag) {
    const result = await database.runAsync(`INSERT INTO tags (name) VALUES (?)`, [trimmed]);
    tag = { id: result.lastInsertRowId, name: trimmed };
  }
  return tag;
}

export async function setTransactionTags(transactionId, tagNames) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM transaction_tags WHERE transaction_id = ?`, [transactionId]);
  for (const name of tagNames) {
    if (!name.trim()) continue;
    const tag = await getOrCreateTag(name);
    await database.runAsync(
      `INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`,
      [transactionId, tag.id]
    );
  }
}

export async function getTransactionTags(transactionId) {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT t.* FROM tags t
     JOIN transaction_tags tt ON tt.tag_id = t.id
     WHERE tt.transaction_id = ?`,
    [transactionId]
  );
}

// ─── Savings goals ────────────────────────────────────────────────────────────

export async function getSavingsGoals() {
  const database = await getDb();
  return database.getAllAsync(`SELECT * FROM savings_goals ORDER BY created_at DESC`);
}

export async function addSavingsGoal({ name, targetAmount, targetDate }) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO savings_goals (name, target_amount, current_amount, target_date, created_at)
     VALUES (?, ?, 0, ?, ?)`,
    [name, targetAmount, targetDate ?? null, new Date().toISOString()]
  );
}

export async function updateSavingsGoal(id, { name, targetAmount, targetDate }) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE savings_goals SET name = ?, target_amount = ?, target_date = ? WHERE id = ?`,
    [name, targetAmount, targetDate ?? null, id]
  );
}

export async function addFundsToGoal(id, amount) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ?`,
    [amount, id]
  );
  // Log as an expense with category 'Savings' so it shows in transactions
  // without distorting income totals
  await database.runAsync(
    `INSERT INTO transactions (type, amount, category, note, status, created_at)
     VALUES ('expense', ?, 'Savings', 'Savings goal contribution', 'confirmed', ?)`,
    [amount, new Date().toISOString()]
  );
}

export async function deleteSavingsGoal(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM savings_goals WHERE id = ?`, [id]);
}

// ─── Bill reminders ───────────────────────────────────────────────────────────

export async function getBillReminders() {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT * FROM bill_reminders WHERE active = 1 ORDER BY due_date ASC`
  );
}

export async function addBillReminder({ name, amount, dueDate, category, recurring }) {
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO bill_reminders (name, amount, due_date, category, recurring, active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [name, amount ?? null, dueDate, category ?? 'Bills', recurring ? 1 : 0, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export async function updateBillReminder(id, { name, amount, dueDate, category, recurring }) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE bill_reminders SET name = ?, amount = ?, due_date = ?, category = ?, recurring = ? WHERE id = ?`,
    [name, amount ?? null, dueDate, category ?? 'Bills', recurring ? 1 : 0, id]
  );
}

export async function markBillPaid(id) {
  const database = await getDb();
  const bill = await database.getFirstAsync(`SELECT * FROM bill_reminders WHERE id = ?`, [id]);
  if (!bill) return;
  // Optionally log as a transaction
  if (bill.amount) {
    await database.runAsync(
      `INSERT INTO transactions (type, amount, category, note, status, created_at)
       VALUES ('expense', ?, ?, ?, 'confirmed', ?)`,
      [bill.amount, bill.category, `Bill: ${bill.name}`, new Date().toISOString()]
    );
  }
  if (bill.recurring) {
    // Advance due_date by 1 month
    const next = new Date(bill.due_date);
    next.setMonth(next.getMonth() + 1);
    await database.runAsync(`UPDATE bill_reminders SET due_date = ? WHERE id = ?`, [next.toISOString(), id]);
  } else {
    await database.runAsync(`UPDATE bill_reminders SET active = 0 WHERE id = ?`, [id]);
  }
}

export async function deleteBillReminder(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM bill_reminders WHERE id = ?`, [id]);
}

// ─── Split groups / expenses ──────────────────────────────────────────────────

export async function getSplitGroups() {
  const database = await getDb();
  return database.getAllAsync(`SELECT * FROM split_groups ORDER BY created_at DESC`);
}

export async function createSplitGroup(name) {
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO split_groups (name, created_at) VALUES (?, ?)`,
    [name, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export async function deleteSplitGroup(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM split_groups WHERE id = ?`, [id]);
}

export async function getGroupMembers(groupId) {
  const database = await getDb();
  return database.getAllAsync(`SELECT * FROM split_members WHERE group_id = ? ORDER BY id ASC`, [groupId]);
}

export async function addGroupMember(groupId, name) {
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO split_members (group_id, name) VALUES (?, ?)`, [groupId, name]
  );
  return result.lastInsertRowId;
}

export async function deleteGroupMember(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM split_members WHERE id = ?`, [id]);
}

export async function getGroupExpenses(groupId) {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT se.*, sm.name as paid_by_name FROM split_expenses se
     JOIN split_members sm ON sm.id = se.paid_by_member_id
     WHERE se.group_id = ? ORDER BY se.created_at DESC`,
    [groupId]
  );
}

export async function addSplitExpense({ groupId, description, amount, paidByMemberId, shares }) {
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO split_expenses (group_id, description, amount, paid_by_member_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [groupId, description, amount, paidByMemberId, new Date().toISOString()]
  );
  const expenseId = result.lastInsertRowId;
  for (const share of shares) {
    await database.runAsync(
      `INSERT INTO split_shares (split_expense_id, member_id, share_amount, settled) VALUES (?, ?, ?, 0)`,
      [expenseId, share.memberId, share.amount]
    );
  }
  return expenseId;
}

export async function getExpenseShares(expenseId) {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT ss.*, sm.name as member_name FROM split_shares ss
     JOIN split_members sm ON sm.id = ss.member_id
     WHERE ss.split_expense_id = ?`,
    [expenseId]
  );
}

export async function settleShare(shareId, settled) {
  const database = await getDb();
  await database.runAsync(`UPDATE split_shares SET settled = ? WHERE id = ?`, [settled ? 1 : 0, shareId]);
}

/** Returns a "who owes whom" summary for a group */
export async function getGroupBalances(groupId) {
  const database = await getDb();
  const members = await getGroupMembers(groupId);
  const expenses = await getGroupExpenses(groupId);

  // net[memberId] = positive means "is owed money", negative means "owes money"
  const net = {};
  members.forEach((m) => { net[m.id] = 0; });

  for (const exp of expenses) {
    // The payer is owed back their full amount
    net[exp.paid_by_member_id] = (net[exp.paid_by_member_id] || 0) + exp.amount;
    // Each share reduces that member's net (they owe their portion)
    const shares = await getExpenseShares(exp.id);
    for (const share of shares) {
      if (!share.settled) {
        net[share.member_id] = (net[share.member_id] || 0) - share.share_amount;
      }
    }
  }

  return members.map((m) => ({ ...m, net: net[m.id] || 0 }));
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getThemePref() {
  const database = await getDb();
  const row = await database.getFirstAsync(`SELECT value FROM settings WHERE key = 'theme'`);
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

export async function getSetting(key) {
  const database = await getDb();
  const row = await database.getFirstAsync(`SELECT value FROM settings WHERE key = ?`, [key]);
  return row?.value ?? null;
}

export async function setSetting(key, value) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

// ─── Feature 2: Payee notes ───────────────────────────────────────────────────

export async function updateFavoriteNote(upiId, note) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE favorites SET notes = ? WHERE upi_id = ?`,
    [note ?? null, upiId]
  );
}

export async function getFavoriteByUpiId(upiId) {
  const database = await getDb();
  return database.getFirstAsync(`SELECT * FROM favorites WHERE upi_id = ?`, [upiId]);
}

// ─── Feature 3: No-spend streaks ─────────────────────────────────────────────

/**
 * Returns { current, longest } no-spend streaks (days with no confirmed expenses).
 * Pure JS calculation from the transactions array passed in.
 */
export function computeNoSpendStreaks(transactions) {
  // Build a set of YYYY-MM-DD dates that have at least one confirmed expense
  const spendDays = new Set();
  for (const tx of transactions) {
    if (tx.type === 'expense' && tx.status === 'confirmed') {
      spendDays.add(tx.created_at.slice(0, 10));
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Current streak: count back from today/yesterday
  let current = 0;
  const cursor = new Date(today);
  while (true) {
    const d = cursor.toISOString().slice(0, 10);
    if (spendDays.has(d)) break;
    current++;
    cursor.setDate(cursor.getDate() - 1);
    // Stop if we go back more than 365 days
    if (current > 365) break;
  }

  // Longest streak: find the longest consecutive run of no-spend days
  // in the last 90 days
  let longest = current;
  let run = 0;
  const check = new Date(today);
  check.setDate(check.getDate() - 1); // start from yesterday
  for (let i = 0; i < 90; i++) {
    const d = check.toISOString().slice(0, 10);
    if (!spendDays.has(d)) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
    check.setDate(check.getDate() - 1);
  }

  return { current, longest };
}

// ─── Feature 5: Spending patterns ────────────────────────────────────────────

/**
 * Returns spending pattern insights from confirmed expense transactions.
 * { weekendAvg, weekdayAvg, weekendPct, impulseCategory, topHour }
 */
export function computeSpendingPatterns(transactions) {
  const expenses = transactions.filter((t) => t.type === 'expense' && t.status === 'confirmed');
  if (expenses.length === 0) return null;

  // Weekend vs weekday
  let weekendTotal = 0, weekendCount = 0;
  let weekdayTotal = 0, weekdayCount = 0;
  const catCount = {};
  const hourBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };

  for (const tx of expenses) {
    const d = new Date(tx.created_at);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) {
      weekendTotal += tx.amount; weekendCount++;
    } else {
      weekdayTotal += tx.amount; weekdayCount++;
    }
    catCount[tx.category] = (catCount[tx.category] || 0) + 1;
    const h = d.getHours();
    if (h >= 6 && h < 12) hourBuckets.morning++;
    else if (h >= 12 && h < 17) hourBuckets.afternoon++;
    else if (h >= 17 && h < 21) hourBuckets.evening++;
    else hourBuckets.night++;
  }

  const weekendAvg = weekendCount > 0 ? weekendTotal / weekendCount : 0;
  const weekdayAvg = weekdayCount > 0 ? weekdayTotal / weekdayCount : 0;
  const weekendPct = weekdayAvg > 0
    ? Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100)
    : 0;

  const impulseCategory = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const impulseCount = catCount[impulseCategory] ?? 0;

  const topHour = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0][0];

  return { weekendAvg, weekdayAvg, weekendPct, impulseCategory, impulseCount, topHour };
}

// ─── Feature 6: Emergency fund ────────────────────────────────────────────────

/**
 * Returns average monthly expense over the last 3 complete months.
 */
export async function getAvgMonthlyExpense() {
  const database = await getDb();
  const now = new Date();
  const results = [];
  for (let i = 1; i <= 3; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const row = await database.getFirstAsync(
      `SELECT SUM(amount) as total FROM transactions
       WHERE type='expense' AND status='confirmed'
         AND created_at >= ? AND created_at < ?`,
      [start.toISOString(), end.toISOString()]
    );
    results.push(row?.total ?? 0);
  }
  return results.reduce((s, v) => s + v, 0) / 3;
}

// ─── Feature 7: Subscription detection ───────────────────────────────────────

/**
 * Groups confirmed expense transactions by payee/amount, detects recurring
 * patterns (~monthly or ~weekly), returns detected subscriptions.
 */
export async function detectSubscriptions() {
  const database = await getDb();
  const rows = await database.getAllAsync(
    `SELECT payee_name, upi_id, amount, created_at FROM transactions
     WHERE type='expense' AND status='confirmed'
       AND (payee_name IS NOT NULL OR upi_id IS NOT NULL)
     ORDER BY created_at ASC`
  );

  // Group by key = (payee_name or upi_id) + rounded amount (±5%)
  const groups = {};
  for (const tx of rows) {
    const key = `${tx.payee_name || tx.upi_id}__${Math.round(tx.amount / 10) * 10}`;
    if (!groups[key]) groups[key] = { name: tx.payee_name || tx.upi_id, amounts: [], dates: [] };
    groups[key].amounts.push(tx.amount);
    groups[key].dates.push(new Date(tx.created_at));
  }

  const subscriptions = [];
  for (const [, g] of Object.entries(groups)) {
    if (g.dates.length < 2) continue;
    // Check if gaps between occurrences are roughly 7 or 30 days
    const gaps = [];
    for (let i = 1; i < g.dates.length; i++) {
      gaps.push((g.dates[i] - g.dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const avgGap = gaps.reduce((s, v) => s + v, 0) / gaps.length;
    let frequency = null;
    if (avgGap >= 6 && avgGap <= 9) frequency = 'weekly';
    else if (avgGap >= 25 && avgGap <= 35) frequency = 'monthly';
    if (!frequency) continue;

    const avgAmount = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length;
    const lastAmount = g.amounts[g.amounts.length - 1];
    const priceChanged = Math.abs(lastAmount - avgAmount) / avgAmount > 0.1;
    const monthlyEquivalent = frequency === 'weekly' ? avgAmount * 4.33 : avgAmount;

    subscriptions.push({
      name: g.name,
      frequency,
      avgAmount,
      lastAmount,
      monthlyEquivalent,
      occurrences: g.dates.length,
      priceChanged,
    });
  }

  return subscriptions.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
}

// ─── Feature 9: IOU tracker ───────────────────────────────────────────────────

export async function getIous() {
  const database = await getDb();
  return database.getAllAsync(`SELECT * FROM ious ORDER BY settled ASC, created_at DESC`);
}

export async function addIou({ personName, amount, direction, note }) {
  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO ious (person_name, amount, direction, note, settled, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [personName, amount, direction, note ?? null, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export async function settleIou(id, logTransaction) {
  const database = await getDb();
  if (logTransaction) {
    const iou = await database.getFirstAsync(`SELECT * FROM ious WHERE id = ?`, [id]);
    if (iou) {
      await database.runAsync(
        `INSERT INTO transactions (type, amount, category, note, status, created_at)
         VALUES ('expense', ?, 'Other', ?, 'confirmed', ?)`,
        [iou.amount, `IOU settled: ${iou.person_name}`, new Date().toISOString()]
      );
    }
  }
  await database.runAsync(`UPDATE ious SET settled = 1 WHERE id = ?`, [id]);
}

export async function deleteIou(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM ious WHERE id = ?`, [id]);
}
