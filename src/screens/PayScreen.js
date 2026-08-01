import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import { buildUpiUri, isValidUpiId } from '../utils/upi';
import { useWallet } from '../context/WalletContext';
import { useAppReturnListener } from '../hooks/useAppReturnListener';
import ConfirmPaymentSheet from '../components/ConfirmPaymentSheet';

export default function PayScreen({ route, navigation }) {
  const params = route.params || {};
  const { createPendingPayment, confirmPayment, discardPayment, pending } = useWallet();

  const [upiId, setUpiId] = useState(params.upiId || '');
  const [payeeName, setPayeeName] = useState(params.payeeName || '');
  const [amount, setAmount] = useState(params.amount ? String(params.amount) : '');
  const [note, setNote] = useState(params.note || '');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState(null);

  const handleAppReturn = useCallback(async () => {
    // Grab the most recent pending transaction and ask for confirmation.
    if (pending.length > 0) {
      setActiveTransaction(pending[0]);
      setSheetVisible(true);
    }
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

    // Log it as pending BEFORE we hand off, so we never lose track of it
    // even if the app-return detection fails.
    await createPendingPayment({ amount: Number(amount), payeeName, upiId, note });

    const uri = buildUpiUri({ payeeAddress: upiId, payeeName, amount, note });
    armWatch();

    const canOpen = await Linking.canOpenURL(uri);
    if (!canOpen) {
      Alert.alert(
        'No UPI app found',
        'Install GPay, PhonePe, Paytm, or another UPI app to complete this payment. The payment has been saved as pending — you can confirm or discard it from Transactions.'
      );
      return;
    }
    Linking.openURL(uri);
  };

  const handleConfirm = async (id, category) => {
    await confirmPayment(id, category);
    setSheetVisible(false);
    setActiveTransaction(null);
    navigation.navigate('Tabs', { screen: 'Home' });
  };

  const handleDiscard = async (id) => {
    await discardPayment(id);
    setSheetVisible(false);
    setActiveTransaction(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.label}>Pay to (UPI ID)</Text>
      <TextInput
        style={styles.input}
        value={upiId}
        onChangeText={setUpiId}
        placeholder="name@bank"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Payee name (optional)</Text>
      <TextInput
        style={styles.input}
        value={payeeName}
        onChangeText={setPayeeName}
        placeholder="e.g. Ramesh Kirana Store"
      />

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={[styles.input, styles.amountInput]}
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Note (optional)</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="What's this for?" />

      <TouchableOpacity style={styles.payButton} onPress={handlePay}>
        <Text style={styles.payButtonText}>Pay ₹{amount || '0'}</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        You'll be redirected to your UPI app to complete the payment, then asked to confirm it here.
      </Text>

      <ConfirmPaymentSheet
        visible={sheetVisible}
        transaction={activeTransaction}
        onConfirm={handleConfirm}
        onDiscard={handleDiscard}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  amountInput: { fontSize: 24, fontWeight: '700' },
  payButton: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 14, lineHeight: 18 },
});
