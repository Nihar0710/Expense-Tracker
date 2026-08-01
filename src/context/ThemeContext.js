import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import { getThemePref, setThemePref } from '../db/database';

// ─── Palettes ────────────────────────────────────────────────────────────────
const light = {
  bg:          '#F9FAFB',
  card:        '#FFFFFF',
  cardAlt:     '#F3F4F6',
  text:        '#111827',
  textMuted:   '#374151',
  textFaint:   '#6B7280',
  textHint:    '#9CA3AF',
  border:      '#E5E7EB',
  accent:      '#111827',
  accentText:  '#FFFFFF',
  success:     '#22C55E',
  danger:      '#EF4444',
  warningBg:   '#FEF3C7',
  warningText: '#92400E',
  warningIcon: '#B45309',
  statusBar:   'dark',
};

const dark = {
  bg:          '#0F172A',
  card:        '#1E293B',
  cardAlt:     '#334155',
  text:        '#F1F5F9',
  textMuted:   '#CBD5E1',
  textFaint:   '#94A3B8',
  textHint:    '#64748B',
  border:      '#334155',
  accent:      '#6366F1',
  accentText:  '#FFFFFF',
  success:     '#22C55E',
  danger:      '#EF4444',
  warningBg:   '#451A03',
  warningText: '#FEF3C7',
  warningIcon: '#F59E0B',
  statusBar:   'light',
};

// ─── Context ─────────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);

/** pref: 'system' | 'light' | 'dark' */
export function ThemeProvider({ children }) {
  const [pref, setPrefState] = useState('system'); // loaded from DB below
  const [systemScheme, setSystemScheme] = useState(
    Appearance.getColorScheme() ?? 'light'
  );

  // Load persisted preference from SQLite
  useEffect(() => {
    getThemePref().then((p) => setPrefState(p || 'system')).catch(() => {});
  }, []);

  // Track system appearance changes
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'light');
    });
    return () => sub.remove();
  }, []);

  const resolvedScheme =
    pref === 'system' ? systemScheme : pref;

  const colors = resolvedScheme === 'dark' ? dark : light;

  const setPref = async (newPref) => {
    setPrefState(newPref);
    await setThemePref(newPref).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ colors, pref, setPref, scheme: resolvedScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
