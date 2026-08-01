import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ScrollView, Switch, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { buildCategoryList, getCategoryMeta } from '../constants/categories';
import { spacing, fontSize, radius, rs } from '../utils/layout';

const FREQUENCIES = ['daily', 'weekly', 'monthly'];

export default function RecurringScreen() {
  const { recurring, addRecurring, toggleRecurring, removeRecurring, customCategories } = useWallet();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModal] = useState(false);
  const s = makeStyles(colors, insets);

  const handleDelete = (id) =>
    Alert.alert(
      'Delete rule',
      'This stops future automatic transactions. Past ones are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeRecurring(id) },
      ]
    );

  return (
    <View style={s.container}>
      <FlatList
        data={recurring}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: rs(100) + insets.bottom,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
        }}
        renderItem={({ item }) => {
          const meta = getCategoryMeta(item.category, customCategories);
          const isExpense = item.type === 'expense';
          return (
            <View style={s.card}>
              <View style={[s.iconCircle, { backgroundColor: meta.color + '22' }]}>
                <Ionicons name={meta.icon} size={rs(17)} color={meta.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardTitle} numberOfLines={1}>
                  {isExpense ? '-' : '+'}₹{Number(item.amount).toFixed(2)}
                  {item.note ? `  ·  ${item.note}` : ''}
                </Text>
                <Text style={s.cardSub}>
                  {item.category}  ·  {item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}
                </Text>
                <Text style={s.cardNext}>
                  Next: {new Date(item.next_run_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={s.cardActions}>
                <Switch
                  value={item.active === 1}
                  onValueChange={(val) => toggleRecurring(item.id, val)}
                  trackColor={{ true: colors.accent, false: colors.cardAlt }}
                  thumbColor={colors.accentText}
                  ios_backgroundColor={colors.cardAlt}
                />
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  style={s.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={rs(18)} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Ionicons name="repeat-outline" size={rs(48)} color={colors.textHint} />
            <Text style={s.emptyText}>No recurring rules yet.</Text>
            <Text style={s.emptySub}>Tap + to add one.</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + spacing.lg }]}
        onPress={() => setModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={rs(28)} color={colors.accentText} />
      </TouchableOpacity>

      <AddRuleModal
        visible={modalVisible}
        colors={colors}
        insets={insets}
        allCategories={buildCategoryList(customCategories)}
        onClose={() => setModal(false)}
        onSave={async (rule) => { await addRecurring(rule); setModal(false); }}
      />
    </View>
  );
}

function AddRuleModal({ visible, colors, insets, allCategories, onClose, onSave }) {
  const { addCustomCategory } = useWallet();
  const [type, setType]           = useState('expense');
  const [amount, setAmount]       = useState('');
  const [category, setCategory]   = useState('Other');
  const [customLabel, setCustomLabel] = useState('');
  const [note, setNote]           = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const s = modalStyles(colors, insets);
  const reset = () => { setType('expense'); setAmount(''); setCategory('Other'); setCustomLabel(''); setNote(''); setFrequency('monthly'); };

  const isOther = category === 'Other';

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return;
    if (isOther && !customLabel.trim()) {
      Alert.alert('Category required', 'Please describe the "Other" category.');
      return;
    }
    const finalCategory = isOther ? customLabel.trim() : category;
    if (isOther && customLabel.trim()) {
      await addCustomCategory(customLabel.trim());
    }
    onSave({ type, amount: Number(amount), category: finalCategory, note, frequency });
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>New recurring rule</Text>

            <View style={s.rowChips}>
              {['expense', 'income'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.chip, type === t && s.chipActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={[s.chipText, type === t && s.chipTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={s.input}
              placeholder="Amount"
              placeholderTextColor={colors.textHint}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              returnKeyType="next"
            />
            <TextInput
              style={s.input}
              placeholder="Note (optional)"
              placeholderTextColor={colors.textHint}
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
            />

            <Text style={s.fieldLabel}>Frequency</Text>
            <View style={s.rowChips}>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[s.chip, frequency === f && s.chipActive]}
                  onPress={() => setFrequency(f)}
                >
                  <Text style={[s.chipText, frequency === f && s.chipTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              {allCategories.map((c) => (
                <TouchableOpacity
                  key={c.name}
                  style={[s.chip, category === c.name && { backgroundColor: c.color }]}
                  onPress={() => { setCategory(c.name); setCustomLabel(''); }}
                >
                  <Text style={[s.chipText, category === c.name && { color: '#fff' }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {isOther && (
              <TextInput
                style={[s.input, s.customInput, !customLabel.trim() && s.customInputError]}
                placeholder="Describe this category (required)"
                placeholderTextColor={colors.textHint}
                value={customLabel}
                onChangeText={setCustomLabel}
                returnKeyType="done"
              />
            )}

            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={() => { reset(); onClose(); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.saveBtn]} onPress={handleSave}>
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: c.bg, paddingTop: insets.top },
    card:        {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      backgroundColor: c.card, padding: spacing.md,
      borderRadius: radius.lg, marginBottom: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    iconCircle:  { width: rs(40), height: rs(40), borderRadius: rs(20), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    cardTitle:   { fontSize: fontSize.md, fontWeight: '600', color: c.text },
    cardSub:     { fontSize: fontSize.xs, color: c.textFaint, marginTop: 2 },
    cardNext:    { fontSize: fontSize.xs - 1, color: c.textHint, marginTop: 2 },
    cardActions: { alignItems: 'center', gap: spacing.sm },
    deleteBtn:   { padding: spacing.xs },
    emptyWrap:   { alignItems: 'center', marginTop: rs(80) },
    emptyText:   { fontSize: fontSize.base, color: c.textHint, marginTop: spacing.lg, fontWeight: '600' },
    emptySub:    { fontSize: fontSize.sm, color: c.textHint, marginTop: spacing.xs },
    fab:         {
      position: 'absolute', right: spacing.xl,
      width: rs(56), height: rs(56), borderRadius: rs(28),
      backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: rs(8),
      shadowOffset: { width: 0, height: rs(4) },
      elevation: 8,
    },
  });
}

function modalStyles(c, insets) {
  return StyleSheet.create({
    overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:        {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      padding: spacing.xxl,
      paddingBottom: Math.max(spacing.xxl, (insets?.bottom ?? 0) + spacing.lg),
    },
    handle:       { width: rs(40), height: rs(4), borderRadius: rs(2), backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
    sheetTitle:   { fontSize: fontSize.lg, fontWeight: '700', color: c.text, marginBottom: spacing.lg },
    fieldLabel:   { fontSize: fontSize.sm, fontWeight: '600', color: c.textMuted, marginBottom: spacing.sm },
    rowChips:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    chip:           { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: c.cardAlt },
    chipActive:     { backgroundColor: c.accent },
    chipText:       { fontSize: fontSize.sm, color: c.textMuted, fontWeight: '500' },
    chipTextActive: { color: c.accentText },
    input:          {
      borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      fontSize: fontSize.base, color: c.text, marginBottom: spacing.md,
      minHeight: rs(50),
    },
    customInput:    { borderColor: c.accent, borderWidth: 1.5 },
    customInputError: { borderColor: c.danger },
    btnRow:       { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
    btn:          { flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', minHeight: rs(50) },
    cancelBtn:    { backgroundColor: c.cardAlt },
    saveBtn:      { backgroundColor: c.accent },
    cancelBtnText: { color: c.textMuted, fontWeight: '600', fontSize: fontSize.base },
    saveBtnText:  { color: c.accentText, fontWeight: '600', fontSize: fontSize.base },
  });
}
