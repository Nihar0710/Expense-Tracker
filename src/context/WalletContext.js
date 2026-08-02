import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  initDatabase,
  getAllTransactions,
  getPendingTransactions,
  getMonthSummary,
  getCategoryBreakdown,
  insertPendingTransaction,
  confirmTransaction,
  confirmTransactionWithReceipt,
  discardTransaction,
  addManualTransaction,
  searchTransactions,
  getFavorites,
  markFavoriteUsed,
  deleteFavorite,
  updateFavoriteNote,
  getFavoriteByUpiId,
  getRecurringRules,
  addRecurringRule,
  toggleRecurringRule,
  deleteRecurringRule,
  processRecurringTransactions,
  getCustomCategories,
  addCustomCategory as dbAddCustomCategory,
  deleteCustomCategory as dbDeleteCustomCategory,
  getAllTags,
  setTransactionTags,
  computeNoSpendStreaks,
  computeSpendingPatterns,
} from '../db/database';
import { pickCustomCategoryColor } from '../constants/categories';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [ready, setReady]                 = useState(false);
  const [transactions, setTx]             = useState([]);
  const [pending, setPending]             = useState([]);
  const [summary, setSummary]             = useState({ income: 0, expense: 0 });
  const [breakdown, setBreakdown]         = useState([]);
  const [favorites, setFavorites]         = useState([]);
  const [recurring, setRecurring]         = useState([]);
  const [customCategories, setCustomCats] = useState([]);
  const [allTags, setAllTags]             = useState([]);
  // Computed on refresh — no extra DB call needed
  const [streaks, setStreaks]             = useState({ current: 0, longest: 0 });
  const [patterns, setPatterns]           = useState(null);

  // ── Core refresh ────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const [tx, pend, sum, brk, favs, rec, customCats, tags] = await Promise.all([
      getAllTransactions(),
      getPendingTransactions(),
      getMonthSummary(),
      getCategoryBreakdown(),
      getFavorites(),
      getRecurringRules(),
      getCustomCategories(),
      getAllTags(),
    ]);
    setTx(tx);
    setPending(pend);
    setSummary(sum);
    setBreakdown(brk);
    setFavorites(favs);
    setRecurring(rec);
    setCustomCats(customCats);
    setAllTags(tags);
    // Derive streak and pattern data from loaded transactions
    setStreaks(computeNoSpendStreaks(tx));
    setPatterns(computeSpendingPatterns(tx));
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
      if (upiId) await markFavoriteUsed(upiId, payeeName);
      await refresh();
      return id;
    },
    [refresh]
  );

  const confirmPayment = useCallback(
    async (id, category, receiptUri) => {
      if (receiptUri) await confirmTransactionWithReceipt(id, category, receiptUri);
      else await confirmTransaction(id, category);
      await refresh();
    },
    [refresh]
  );

  const discardPayment = useCallback(
    async (id) => { await discardTransaction(id); await refresh(); },
    [refresh]
  );

  const addManual = useCallback(
    async (data) => { await addManualTransaction(data); await refresh(); },
    [refresh]
  );

  const searchTx = useCallback(
    async (opts) => searchTransactions(opts),
    []
  );

  const saveTxTags = useCallback(
    async (txId, tagNames) => {
      await setTransactionTags(txId, tagNames);
      setAllTags(await getAllTags());
    },
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

  const updatePayeeNote = useCallback(async (upiId, note) => {
    await updateFavoriteNote(upiId, note);
    setFavorites(await getFavorites());
  }, []);

  const getPayeeNote = useCallback(async (upiId) => {
    const fav = await getFavoriteByUpiId(upiId);
    return fav?.notes ?? null;
  }, []);

  // ── Custom categories ─────────────────────────────────────────────────────
  const addCustomCategory = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const latest = await getCustomCategories();
    const exists = latest.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) { setCustomCats(latest); return; }
    const color = pickCustomCategoryColor(latest);
    await dbAddCustomCategory({ name: trimmed, color });
    setCustomCats(await getCustomCategories());
  }, []);

  const removeCustomCategory = useCallback(async (id) => {
    await dbDeleteCustomCategory(id);
    setCustomCats((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ── Recurring ─────────────────────────────────────────────────────────────
  const addRecurring = useCallback(async (rule) => {
    await addRecurringRule(rule);
    setRecurring(await getRecurringRules());
  }, []);

  const toggleRecurring = useCallback(async (id, active) => {
    await toggleRecurringRule(id, active);
    setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, active: active ? 1 : 0 } : r)));
  }, []);

  const removeRecurring = useCallback(async (id) => {
    await deleteRecurringRule(id);
    setRecurring((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ready,
        transactions, pending, summary, breakdown,
        favorites, recurring, customCategories, allTags,
        streaks, patterns,
        refresh,
        // transactions
        createPendingPayment, confirmPayment, discardPayment, addManual, searchTx,
        // tags
        saveTxTags,
        // favorites / payee notes
        removeFavorite, updatePayeeNote, getPayeeNote,
        // custom categories
        addCustomCategory, removeCustomCategory,
        // recurring
        addRecurring, toggleRecurring, removeRecurring,
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
