import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { buildCategoryList } from '../constants/categories';
import { spacing, fontSize, radius, rs } from '../utils/layout';

export default function CashEntryScreen({ navigation }) {
  const { addManual, customCategories } = useWallet();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const allCategories = buildCategoryList(customCategories);

  const [amount, setAmount]       = useState('');
  const [category, setCategory]   = useState('Other');
  const [note, setNote]           = useState('');

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { Alert.alert('Enter an amount', 'Please enter how much you spent.'); return; }
    await addManual({
      type: 'expense',
      amount: amt,
      category,
      note: note.trim() || null,
      paymentMethod: 'cash',
    });
    Alert.alert('Logged!', `₹${amt.toFixed(2)} cash expense saved.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const s = makeStyles(colors, insets);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={rs(90)}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.iconWrap}>
          <Ionicons name="cash" size={rs(40)} color={colors.success} />
          <Text style={s.heading}>Log cash expense</Text>
          <Text style={s.sub}>Confirmed immediately — no UPI round-trip</Text>
        </View>

        <Text style={s.label}>Amount (₹)</Text>
        <TextInput
          style={[s.input, s.amountInput]}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textHint}
          keyboardType="decimal-pad"
          autoFocus
        />

        <Text style={s.label}>Note (optional)</Text>
        <TextInput
          style={s.input}
          value={note}
          onChangeText={setNote}
          placeholder="What did you spend on?"
          placeholderTextColor={colors.textHint}
          returnKeyType="done"
        />

        <Text style={s.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xl }}>
          {allCategories.map((c) => (
            <TouchableOpacity
              key={c.name}
              style={[s.chip, category === c.name && { backgroundColor: c.color }]}
              onPress={() => setCategory(c.name)}
            >
              <Text style={[s.chipText, category === c.name && { color: '#fff' }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle" size={rs(20)} color={colors.accentText} />
          <Text style={s.saveBtnText}>Save cash expense</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    scroll:       { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.lg) },
    iconWrap:     { alignItems: 'center', marginBottom: spacing.xl },
    heading:      { fontSize: fontSize.xl, fontWeight: '700', color: c.text, marginTop: spacing.sm },
    sub:          { fontSize: fontSize.sm, color: c.textFaint, marginTop: spacing.xs },
    label:        { fontSize: fontSize.sm, fontWeight: '600', color: c.textMuted, marginBottom: spacing.xs, marginTop: spacing.md },
    input:        { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSize.base, color: c.text, backgroundColor: c.card, minHeight: rs(50) },
    amountInput:  { fontSize: rs(28), fontWeight: '700', minHeight: rs(60) },
    chip:         { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: c.cardAlt, marginRight: spacing.sm },
    chipText:     { fontSize: fontSize.sm, color: c.textMuted, fontWeight: '500' },
    saveBtn:      { backgroundColor: c.success, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, minHeight: rs(54) },
    saveBtnText:  { color: '#fff', fontSize: fontSize.lg, fontWeight: '700' },
  });
}
