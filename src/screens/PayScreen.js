import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Linking, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildUpiUri, isValidUpiId } from '../utils/upi';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { useAppReturnListener } from '../hooks/useAppReturnListener';
import ConfirmPaymentSheet from '../components/ConfirmPaymentSheet';
import { spacing, fontSize, radius, rs } from '../utils/layout';

export default function PayScreen({ route, navigation }) {
  const params = route.params || {};
  const { createPendingPayment, confirmPayment, discardPayment, pending } = useWallet();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [upiId, setUpiId]         = useState(params.upiId || '');
  const [payeeName, setPayeeName] = useState(params.payeeName || '');
  const [amount, setAmount]       = useState(params.amount ? String(params.amount) : '');
  const [note, setNote]           = useState(params.note || '');
  const [sheetVisible, setSheet]  = useState(false);
  const [activeTx, setActiveTx]   = useState(null);

  const handleAppReturn = useCallback(async () => {
    if (pending.length > 0) { setActiveTx(pending[0]); setSheet(true); }
  }, [pending]);

  const { armWatch } = useAppReturnListener(handleAppReturn);

  const handlePay = async () => {
    if (!isValidUpiId(upiId)) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID, e.g. name@bank');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Enter an amount', 'Please enter how much you want to pay.');
      return;
    }

    await createPendingPayment({ amount: Number(amount), payeeName, upiId, note });
    if (global.setInPaymentFlow) global.setInPaymentFlow(true);
    armWatch();

    const uri = buildUpiUri({ payeeAddress: upiId, payeeName, amount, note });

    // On iOS, Linking.canOpenURL('upi://') always returns false unless the
    // scheme is whitelisted AND a matching app is installed. Even with
    // whitelisting, Expo Go sandboxes this. So we attempt openURL directly
    // and catch the error — this is the correct approach for UPI on iOS.
    try {
      await Linking.openURL(uri);
    } catch {
      // upi:// failed — try app-specific deep links used on iOS
      const iosSchemes = [
        `gpay://upi/pay?${uri.split('?')[1]}`,
        `phonepe://pay?${uri.split('?')[1]}`,
        `paytmmp://pay?${uri.split('?')[1]}`,
      ];

      let opened = false;
      for (const scheme of iosSchemes) {
        try {
          const canOpen = await Linking.canOpenURL(scheme);
          if (canOpen) {
            await Linking.openURL(scheme);
            opened = true;
            break;
          }
        } catch { /* try next */ }
      }

      if (!opened) {
        if (global.setInPaymentFlow) global.setInPaymentFlow(false);
        Alert.alert(
          'No UPI app found',
          'Install GPay, PhonePe, or Paytm from the App Store to make UPI payments. Your payment has been saved as pending.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const handleConfirm = async (id, category) => {
    await confirmPayment(id, category);
    if (global.setInPaymentFlow) global.setInPaymentFlow(false);
    setSheet(false); setActiveTx(null);
    navigation.navigate('Tabs', { screen: 'Home' });
  };

  const handleDiscard = async (id) => {
    await discardPayment(id);
    if (global.setInPaymentFlow) global.setInPaymentFlow(false);
    setSheet(false); setActiveTx(null);
  };

  const s = makeStyles(colors, insets);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={rs(90)}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.label}>Pay to (UPI ID)</Text>
        <TextInput
          style={s.input}
          value={upiId}
          onChangeText={setUpiId}
          placeholder="name@bank"
          placeholderTextColor={colors.textHint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />

        <Text style={s.label}>Payee name (optional)</Text>
        <TextInput
          style={s.input}
          value={payeeName}
          onChangeText={setPayeeName}
          placeholder="e.g. Ramesh Kirana Store"
          placeholderTextColor={colors.textHint}
          returnKeyType="next"
        />

        <Text style={s.label}>Amount (₹)</Text>
        <TextInput
          style={[s.input, s.amountInput]}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textHint}
          keyboardType="decimal-pad"
          returnKeyType="next"
        />

        <Text style={s.label}>Note (optional)</Text>
        <TextInput
          style={s.input}
          value={note}
          onChangeText={setNote}
          placeholder="What's this for?"
          placeholderTextColor={colors.textHint}
          returnKeyType="done"
        />

        <TouchableOpacity style={s.payButton} onPress={handlePay} activeOpacity={0.8}>
          <Text style={s.payButtonText}>Pay ₹{amount || '0'}</Text>
        </TouchableOpacity>

        <Text style={s.hint}>
          You'll be redirected to your UPI app to complete the payment, then asked to confirm it here.
        </Text>
      </ScrollView>

      <ConfirmPaymentSheet
        visible={sheetVisible}
        transaction={activeTx}
        onConfirm={handleConfirm}
        onDiscard={handleDiscard}
      />
    </KeyboardAvoidingView>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    scroll:        {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.lg),
    },
    label:         { fontSize: fontSize.sm, fontWeight: '600', color: c.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs },
    input:         {
      borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      fontSize: fontSize.base, color: c.text, backgroundColor: c.card,
      minHeight: rs(50),
    },
    amountInput:   { fontSize: rs(24), fontWeight: '700', minHeight: rs(56) },
    payButton:     {
      backgroundColor: c.accent, borderRadius: radius.lg,
      paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xxl,
      minHeight: rs(54),
    },
    payButtonText: { color: c.accentText, fontSize: fontSize.lg, fontWeight: '700' },
    hint:          { fontSize: fontSize.xs, color: c.textHint, textAlign: 'center', marginTop: spacing.md, lineHeight: fontSize.xs * 1.6 },
  });
}
