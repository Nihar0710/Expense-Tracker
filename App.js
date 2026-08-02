import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { WalletProvider, useWallet } from './src/context/WalletContext';
import AppNavigator from './src/navigation/AppNavigator';

// Lazy-load LockScreen only when needed — avoids crashing on SDK mismatch
// if expo-secure-store / expo-local-authentication native modules are unavailable
let LockScreen = null;
let hasPinSet = async () => false;
try {
  const lockModule = require('./src/screens/LockScreen');
  LockScreen = lockModule.default;
  hasPinSet  = lockModule.hasPinSet;
} catch (_) {
  // Lock screen unavailable (e.g. Expo Go with mismatched SDK) — skip locking
}

const LOCK_TIMEOUT_MS = 60 * 1000;

function AppContent() {
  const { ready } = useWallet();
  const { colors } = useTheme();

  const [locked, setLocked]           = useState(false);
  const [checkingPin, setCheckingPin] = useState(true);
  const bgTime         = useRef(null);
  const inPaymentFlow  = useRef(false);

  const checkPin = useCallback(async () => {
    try {
      const has = await hasPinSet();
      setLocked(has);
    } catch (_) {
      setLocked(false);
    } finally {
      setCheckingPin(false);
    }
  }, []);

  useEffect(() => { checkPin(); }, [checkPin]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState.match(/inactive|background/)) {
        bgTime.current = Date.now();
      } else if (nextState === 'active') {
        if (inPaymentFlow.current) return;
        if (bgTime.current && Date.now() - bgTime.current > LOCK_TIMEOUT_MS) {
          hasPinSet().then((has) => { if (has) setLocked(true); }).catch(() => {});
        }
        bgTime.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  // Expose flag so PayScreen can suppress re-lock during UPI flow
  global.setInPaymentFlow = (val) => { inPaymentFlow.current = val; };

  if (!ready || checkingPin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (locked && LockScreen) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <WalletProvider>
          <AppContent />
        </WalletProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
