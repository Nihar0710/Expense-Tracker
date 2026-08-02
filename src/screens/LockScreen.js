import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, fontSize, radius, rs } from '../utils/layout';

// ── Safe-load native modules — won't crash if unavailable in Expo Go ──────────
let LocalAuth = null;
let SecureStore = null;
try { LocalAuth   = require('expo-local-authentication'); } catch (_) {}
try { SecureStore = require('expo-secure-store'); }         catch (_) {}

const PIN_KEY = 'app_pin_hash';

function hashPin(pin) {
  let hash = 5381;
  for (let i = 0; i < pin.length; i++) {
    hash = (hash * 33) ^ pin.charCodeAt(i);
  }
  return String(hash >>> 0);
}

export async function hasPinSet() {
  if (!SecureStore) return false;
  try {
    const stored = await SecureStore.getItemAsync(PIN_KEY);
    return !!stored;
  } catch (_) { return false; }
}

export async function verifyPin(pin) {
  if (!SecureStore) return true;
  try {
    const stored = await SecureStore.getItemAsync(PIN_KEY);
    if (!stored) return true;
    return stored === hashPin(pin);
  } catch (_) { return true; }
}

export async function savePin(pin) {
  if (!SecureStore) return;
  try { await SecureStore.setItemAsync(PIN_KEY, hashPin(pin)); } catch (_) {}
}

export async function clearPin() {
  if (!SecureStore) return;
  try { await SecureStore.deleteItemAsync(PIN_KEY); } catch (_) {}
}

// ─── Lock screen ──────────────────────────────────────────────────────────────

export default function LockScreen({ onUnlock }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [pin, setPin]                       = useState('');
  const [error, setError]                   = useState('');
  const [biometricAvailable, setBioAvail]   = useState(false);
  const s = makeStyles(colors, insets);

  const tryBiometric = useCallback(async () => {
    if (!LocalAuth) return;
    try {
      const supported = await LocalAuth.hasHardwareAsync();
      const enrolled  = await LocalAuth.isEnrolledAsync();
      if (!supported || !enrolled) return;
      const result = await LocalAuth.authenticateAsync({
        promptMessage: 'Unlock Expense Tracker',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) onUnlock();
    } catch (_) {}
  }, [onUnlock]);

  useEffect(() => {
    if (!LocalAuth) return;
    (async () => {
      try {
        const supported = await LocalAuth.hasHardwareAsync();
        const enrolled  = await LocalAuth.isEnrolledAsync();
        setBioAvail(supported && enrolled);
        if (supported && enrolled) tryBiometric();
      } catch (_) {}
    })();
  }, [tryBiometric]);

  const handlePinSubmit = async () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    const ok = await verifyPin(pin);
    if (ok) { setPin(''); setError(''); onUnlock(); }
    else { setError('Incorrect PIN. Try again.'); setPin(''); }
  };

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.inner}>
        <Ionicons name="lock-closed" size={rs(52)} color={colors.accent} style={{ marginBottom: spacing.xl }} />
        <Text style={s.title}>App Locked</Text>
        <Text style={s.sub}>
          Enter your PIN{biometricAvailable ? ' or use biometrics' : ''} to continue.
        </Text>

        <TextInput
          style={s.pinInput}
          value={pin}
          onChangeText={(v) => { setPin(v.replace(/\D/g, '')); setError(''); }}
          placeholder="Enter PIN"
          placeholderTextColor={colors.textHint}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handlePinSubmit}
        />
        {!!error && <Text style={s.error}>{error}</Text>}

        <TouchableOpacity style={s.unlockBtn} onPress={handlePinSubmit}>
          <Text style={s.unlockBtnText}>Unlock</Text>
        </TouchableOpacity>

        {biometricAvailable && (
          <TouchableOpacity style={s.bioBtn} onPress={tryBiometric}>
            <Ionicons name="finger-print-outline" size={rs(22)} color={colors.accent} />
            <Text style={s.bioBtnText}>Use biometrics</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── PIN setup screen ─────────────────────────────────────────────────────────

export function PinSetupScreen({ onDone, onCancel }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep]   = useState('enter');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState('');
  const s = makeStyles(colors, insets);

  const handleNext = async () => {
    if (step === 'enter') {
      if (first.length < 4) { setError('PIN must be at least 4 digits.'); return; }
      setStep('confirm'); setError('');
    } else {
      if (first !== second) { setError('PINs do not match. Try again.'); setSecond(''); return; }
      await savePin(first);
      Alert.alert('PIN saved', 'Your PIN has been set successfully.');
      onDone?.();
    }
  };

  const handleClearPin = () => {
    Alert.alert('Remove PIN', 'This will disable the app lock.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await clearPin(); onDone?.(); } },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.inner}>
        <Text style={s.title}>{step === 'enter' ? 'Set a PIN' : 'Confirm PIN'}</Text>
        <Text style={s.sub}>
          {step === 'enter' ? 'Choose a 4–6 digit PIN to lock your app.' : 'Enter the same PIN again to confirm.'}
        </Text>

        <TextInput
          style={s.pinInput}
          value={step === 'enter' ? first : second}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '');
            if (step === 'enter') setFirst(digits); else setSecond(digits);
            setError('');
          }}
          placeholder="Enter PIN"
          placeholderTextColor={colors.textHint}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleNext}
        />
        {!!error && <Text style={s.error}>{error}</Text>}

        <TouchableOpacity style={s.unlockBtn} onPress={handleNext}>
          <Text style={s.unlockBtnText}>{step === 'enter' ? 'Next' : 'Save PIN'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.bioBtn} onPress={onCancel ?? (() => {})}>
          <Text style={s.bioBtnText}>Cancel</Text>
        </TouchableOpacity>
        {step === 'enter' && SecureStore && (
          <TouchableOpacity style={s.bioBtn} onPress={handleClearPin}>
            <Text style={[s.bioBtnText, { color: colors.danger }]}>Remove PIN lock</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    container:     { flex: 1, paddingTop: insets.top },
    inner:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
    title:         { fontSize: fontSize.xxl, fontWeight: '700', color: c.text, marginBottom: spacing.sm, textAlign: 'center' },
    sub:           { fontSize: fontSize.md, color: c.textFaint, textAlign: 'center', marginBottom: spacing.xxl, lineHeight: fontSize.md * 1.5 },
    pinInput:      { borderWidth: 1.5, borderColor: c.border, borderRadius: radius.lg, paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg, fontSize: rs(28), fontWeight: '700', color: c.text, textAlign: 'center', letterSpacing: rs(8), width: '100%', marginBottom: spacing.md, backgroundColor: c.card },
    error:         { color: c.danger, fontSize: fontSize.sm, marginBottom: spacing.md },
    unlockBtn:     { backgroundColor: c.accent, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', width: '100%', marginBottom: spacing.md, minHeight: rs(54) },
    unlockBtnText: { color: c.accentText, fontWeight: '700', fontSize: fontSize.lg },
    bioBtn:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginTop: spacing.sm },
    bioBtnText:    { color: c.accent, fontWeight: '600', fontSize: fontSize.base },
  });
}
