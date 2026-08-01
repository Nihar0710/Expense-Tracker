import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  initDatabase,
  getAllTransactions,
  getPendingTransactions,
  getMonthSummary,
  getCategoryBreakdown,
  insertPendingTransaction,
  confirmTransaction,
  discardTransaction,
  addManualTransaction,
  searchTransactions,
  getFavorites,
  markFavoriteUsed,
  deleteFavorite,
  getRecurringRules,
  addRecurringRule,
  toggleRecurringRule,
  deleteRecurringRule,
  processRecurringTransactions,
  getCustomCategories,
  addCustomCategory as dbAddCustomCategory,
  deleteCustomCategory as dbDeleteCustomCategory,
} from '../db/database';
import { pickCustomCategoryColor } from '../constants/categories';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [ready, setReady]                   = useState(false);
  const [transactions, setTx]               = useState([]);
  const [pending, setPending]               = useState([]);
  const [summary, setSummary]               = useState({ income: 0, expense: 0 });
  const [breakdown, setBreakdown]           = useState([]);
  const [favorites, setFavorites]           = useState([]);
  const [recurring, setRecurring]           = useState([]);
  const [customCategories, setCustomCats]   = useState([]);

  // ── Core refresh ────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const [tx, pend, sum, brk, favs, rec, customCats] = await Promise.all([
      getAllTransactions(),
      getPendingTransactions(),
      getMonthSummary(),
      getCategoryBreakdown(),
      getFavorites(),
      getRecurringRules(),
      getCustomCategories(),
    ]);
    setTx(tx);
    setPending(pend);
    setSummary(sum);
    setBreakdown(brk);
    setFavorites(favs);
    setRecurring(rec);
    setCustomCats(customCats);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await processRecurringTransactions();
        await refresh();
      } catch (e) {
        console.error('DB init failed:', e);
      } finally {
        setReady(true);
      }
    })();
  }, [refresh]);

  // ── Transactions ─────────────────────────────────────────────────────────────
  const createPendingPayment = useCallback(
    async ({ amount, payeeName, upiId, note }) => {
      const id = await insertPendingTransaction({ amount, payeeName, upiId, note });
      // Auto-upsert favorite when a UPI payment is initiated
      if (upiId) await markFavoriteUsed(upiId, payeeName);
      await refresh();
      return id;
    },
    [refresh]
  );

  const confirmPayment = useCallback(
    async (id, category) => {
      await confirmTransaction(id, category);
      await refresh();
    },
    [refresh]
  );

  const discardPayment = useCallback(
    async (id) => {
      await discardTransaction(id);
      await refresh();
    },
    [refresh]
  );

  const addManual = useCallback(
    async (data) => {
      await addManualTransaction(data);
      await refresh();
    },
    [refresh]
  );

  /** Returns filtered rows from the DB (used by TransactionsScreen). */
  const searchTx = useCallback(
    async (opts) => searchTransactions(opts),
    []
  );

  // ── Favorites ─────────────────────────────────────────────────────────────
  const removeFavorite = useCallback(
    async (id) => {
      await deleteFavorite(id);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    },
    []
  );

  // ── Custom categories ─────────────────────────────────────────────────────
  const addCustomCategory = useCallback(
    async (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      // Always read the latest list from DB — avoids stale-closure issues
      // when multiple categories are added in the same session.
      const latest = await getCustomCategories();
      const exists = latest.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) {
        // Already exists — just refresh state so UI is up to date
        setCustomCats(latest);
        return;
      }
      const color = pickCustomCategoryColor(latest);
      await dbAddCustomCategory({ name: trimmed, color });
      const updated = await getCustomCategories();
      setCustomCats(updated);
    },
    [] // no dependency on stale state — reads DB directly every time
  );

  const removeCustomCategory = useCallback(
    async (id) => {
      await dbDeleteCustomCategory(id);
      setCustomCats((prev) => prev.filter((c) => c.id !== id));
    },
    []
  );

  // ── Recurring ─────────────────────────────────────────────────────────────
  const addRecurring = useCallback(
    async (rule) => {
      await addRecurringRule(rule);
      setRecurring(await getRecurringRules());
    },
    []
  );

  const toggleRecurring = useCallback(
    async (id, active) => {
      await toggleRecurringRule(id, active);
      setRecurring((prev) =>
        prev.map((r) => (r.id === id ? { ...r, active: active ? 1 : 0 } : r))
      );
    },
    []
  );

  const removeRecurring = useCallback(
    async (id) => {
      await deleteRecurringRule(id);
      setRecurring((prev) => prev.filter((r) => r.id !== id));
    },
    []
  );

  return (
    <WalletContext.Provider
      value={{
        ready,
        transactions,
        pending,
        summary,
        breakdown,
        favorites,
        recurring,
        customCategories,
        refresh,
        // transactions
        createPendingPayment,
        confirmPayment,
        discardPayment,
        addManual,
        searchTx,
        // favorites
        removeFavorite,
        // recurring
        addRecurring,
        toggleRecurring,
        removeRecurring,
        // custom categories
        addCustomCategory,
        removeCustomCategory,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside a WalletProvider');
  return ctx;
}
