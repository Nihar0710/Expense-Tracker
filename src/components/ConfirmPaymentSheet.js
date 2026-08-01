import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CATEGORIES } from '../constants/categories';

/**
 * Shown right after the user returns from a UPI app (GPay/PhonePe/etc).
 * We can't know for certain the payment succeeded, so we ask.
 */
export default function ConfirmPaymentSheet({ visible, transaction, onConfirm, onDiscard }) {
  const [category, setCategory] = useState('Other');

  // Reset category picker whenever a new transaction is shown
  useEffect(() => {
    setCategory('Other');
  }, [transaction?.id]);

  if (!transaction) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Did this payment go through?</Text>
          <Text style={styles.amount}>₹{Number(transaction.amount).toFixed(2)}</Text>
          <Text style={styles.payee}>
            to {transaction.payee_name || transaction.upi_id || 'UPI payee'}
          </Text>

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.name}
                style={[
                  styles.chip,
                  category === c.name && { backgroundColor: c.color },
                ]}
                onPress={() => setCategory(c.name)}
              >
                <Text
                  style={[
                    styles.chipText,
                    category === c.name && styles.chipTextActive,
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.discardButton]}
              onPress={() => onDiscard(transaction.id)}
            >
              <Text style={styles.discardText}>No, discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={() => onConfirm(transaction.id, category)}
            >
              <Text style={styles.confirmText}>Yes, track it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  title: { fontSize: 16, fontWeight: '600', color: '#111827', textAlign: 'center' },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginTop: 8,
  },
  payee: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  chipRow: { marginBottom: 24 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  discardButton: { backgroundColor: '#F3F4F6' },
  confirmButton: { backgroundColor: '#111827' },
  discardText: { color: '#374151', fontWeight: '600' },
  confirmText: { color: '#fff', fontWeight: '600' },
});
