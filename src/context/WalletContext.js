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
} from '../db/database';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [pending, setPending] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0 });
  const [breakdown, setBreakdown] = useState([]);

  const refresh = useCallback(async () => {
    const [tx, pend, sum, brk] = await Promise.all([
      getAllTransactions(),
      getPendingTransactions(),
      getMonthSummary(),
      getCategoryBreakdown(),
    ]);
    setTransactions(tx);
    setPending(pend);
    setSummary(sum);
    setBreakdown(brk);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await refresh();
      } catch (e) {
        console.error('DB init failed:', e);
      } finally {
        setReady(true);
      }
    })();
  }, [refresh]);

  const createPendingPayment = useCallback(
    async ({ amount, payeeName, upiId, note }) => {
      const id = await insertPendingTransaction({ amount, payeeName, upiId, note });
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

  return (
    <WalletContext.Provider
      value={{
        ready,
        transactions,
        pending,
        summary,
        breakdown,
        refresh,
        createPendingPayment,
        confirmPayment,
        discardPayment,
        addManual,
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
