import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildCategoryList } from '../constants/categories';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { spacing, fontSize, radius, rs } from '../utils/layout';

export default function ConfirmPaymentSheet({ visible, transaction, onConfirm, onDiscard }) {
  const { colors } = useTheme();
  const { customCategories, addCustomCategory } = useWallet();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState('Other');
  const [customLabel, setCustomLabel] = useState('');

  useEffect(() => { setCategory('Other'); setCustomLabel(''); }, [transaction?.id]);

  if (!transaction) return null;

  const isOther = category === 'Other';
  const allCategories = buildCategoryList(customCategories);

  const handleConfirm = async () => {
    if (isOther && !customLabel.trim()) {
      Alert.alert('Category required', 'Please describe the "Other" category before confirming.');
      return;
    }
    const finalCategory = isOther ? customLabel.trim() : category;
    // If it's a custom label, save it as a new category for future use
    if (isOther && customLabel.trim()) {
      await addCustomCategory(customLabel.trim());
    }
    onConfirm(transaction.id, finalCategory);
  };

  const s = makeStyles(colors, insets);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>Did this payment go through?</Text>
          <Text style={s.amount}>₹{Number(transaction.amount).toFixed(2)}</Text>
          <Text style={s.payee}>
            to {transaction.payee_name || transaction.upi_id || 'UPI payee'}
          </Text>

          <Text style={s.label}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.chipRow}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {allCategories.map((c) => (
              <TouchableOpacity
                key={c.name}
                style={[s.chip, category === c.name && { backgroundColor: c.color }]}
                onPress={() => { setCategory(c.name); setCustomLabel(''); }}
              >
                <Text style={[s.chipText, category === c.name && s.chipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {isOther && (
            <TextInput
              style={[s.customInput, !customLabel.trim() && s.customInputError]}
              placeholder="Name this category — it'll be saved for later"
              placeholderTextColor={colors.textHint}
              value={customLabel}
              onChangeText={setCustomLabel}
              autoFocus
              returnKeyType="done"
            />
          )}

          <View style={s.buttonRow}>
            <TouchableOpacity
              style={[s.button, s.discardButton]}
              onPress={() => onDiscard(transaction.id)}
              activeOpacity={0.75}
            >
              <Text style={s.discardText}>No, discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.button, s.confirmButton]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={s.confirmText}>Yes, track it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:         {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      padding: spacing.xxl,
      paddingBottom: Math.max(spacing.xxl, (insets?.bottom ?? 0) + spacing.lg),
    },
    handle:        { width: rs(40), height: rs(4), borderRadius: rs(2), backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
    title:         { fontSize: fontSize.lg, fontWeight: '600', color: c.text, textAlign: 'center' },
    amount:        { fontSize: rs(34), fontWeight: '700', color: c.text, textAlign: 'center', marginTop: spacing.sm },
    payee:         { fontSize: fontSize.md, color: c.textFaint, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl },
    label:         { fontSize: fontSize.sm, fontWeight: '600', color: c.textMuted, marginBottom: spacing.sm },
    chipRow:        { marginBottom: spacing.md },
    chip:           { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: c.cardAlt },
    chipText:       { fontSize: fontSize.sm, color: c.textMuted, fontWeight: '500' },
    chipTextActive: { color: '#fff' },
    customInput:    {
      borderWidth: 1.5, borderColor: c.accent, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      fontSize: fontSize.base, color: c.text, marginBottom: spacing.lg,
      minHeight: rs(48),
    },
    customInputError: { borderColor: c.danger },
    buttonRow:     { flexDirection: 'row', gap: spacing.md },
    button:        { flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', minHeight: rs(52) },
    discardButton: { backgroundColor: c.cardAlt },
    confirmButton: { backgroundColor: c.accent },
    discardText:   { color: c.textMuted, fontWeight: '600', fontSize: fontSize.base },
    confirmText:   { color: c.accentText, fontWeight: '600', fontSize: fontSize.base },
  });
}
