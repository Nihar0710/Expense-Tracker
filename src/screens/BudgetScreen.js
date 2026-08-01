import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-gifted-charts';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { getBudgets, setBudget as saveBudgetToDB } from '../db/database';
import { buildCategoryList, getCategoryMeta } from '../constants/categories';
import { spacing, fontSize, radius, useTabBarHeight, rs } from '../utils/layout';

export default function BudgetScreen() {
  const { breakdown, customCategories } = useWallet();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useTabBarHeight();
  const [budgets, setBudgets]                 = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editValue, setEditValue]             = useState('');

  const loadBudgets = useCallback(async () => {
    const rows = await getBudgets();
    setBudgets(rows);
  }, []);

  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  const pieData = breakdown.map((row) => {
    const meta = getCategoryMeta(row.category, customCategories);
    return { value: row.total, color: meta.color, label: row.category };
  });

  const totalSpend = breakdown.reduce((sum, r) => sum + r.total, 0);
  const budgetFor  = (cat) => budgets.find((b) => b.category === cat)?.monthly_limit;

  // All categories that can have a budget (spending categories + any with an existing budget)
  const budgetCategories = [
    ...new Set([
      ...breakdown.map((r) => r.category),
      ...budgets.map((b) => b.category),
      ...buildCategoryList(customCategories).map((c) => c.name),
    ]),
  ];

  const handleSave = async () => {
    const val = Number(editValue);
    if (!editingCategory) return;
    if (!editValue.trim() || isNaN(val) || val <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid budget amount greater than 0.');
      return;
    }
    try {
      await saveBudgetToDB(editingCategory, val);
      await loadBudgets();
      setEditingCategory(null);
      setEditValue('');
    } catch (e) {
      Alert.alert('Error', 'Could not save budget. Please try again.');
    }
  };

  const handleCancel = () => {
    setEditingCategory(null);
    setEditValue('');
  };

  const s = makeStyles(colors, insets);

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: bottomPad,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Text style={s.title}>Spending this month</Text>

        {pieData.length > 0 ? (
          <View style={s.chartWrap}>
            <PieChart
              data={pieData}
              donut
              radius={rs(90)}
              innerRadius={rs(58)}
              centerLabelComponent={() => (
                <Text style={s.chartTotal}>₹{totalSpend.toFixed(0)}</Text>
              )}
            />
          </View>
        ) : (
          <Text style={s.emptyText}>No spending recorded yet this month.</Text>
        )}

        <Text style={s.sectionTitle}>Category budgets</Text>
        {budgetCategories.map((cat) => {
          const meta    = getCategoryMeta(cat, customCategories);
          const spent   = breakdown.find((r) => r.category === cat)?.total ?? 0;
          const limit   = budgetFor(cat);
          const pct     = limit ? Math.min(spent / limit, 1) : null;
          return (
            <TouchableOpacity
              key={cat}
              style={s.budgetRow}
              activeOpacity={0.75}
              onPress={() => {
                setEditingCategory(cat);
                setEditValue(limit ? String(limit) : '');
              }}
            >
              <View style={s.budgetHeader}>
                <Text style={s.budgetCategory}>{cat}</Text>
                <Text style={s.budgetAmount}>
                  {limit
                    ? `₹${spent.toFixed(0)} / ₹${limit.toFixed(0)}`
                    : spent > 0
                      ? `₹${spent.toFixed(0)} · tap to set budget`
                      : 'Tap to set budget'}
                </Text>
              </View>
              {pct !== null && (
                <View style={s.progressTrack}>
                  <View
                    style={[
                      s.progressFill,
                      { width: `${pct * 100}%`, backgroundColor: pct >= 1 ? colors.danger : meta.color },
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal
        visible={!!editingCategory}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCancel}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={s.modalOverlay}
            activeOpacity={1}
            onPress={handleCancel}
          >
            {/* Stop tap-through to the overlay dismissing when tapping inside the box */}
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={s.modalBox}>
                <Text style={s.modalTitle}>Monthly budget for {editingCategory}</Text>
                <TextInput
                  style={s.modalInput}
                  keyboardType="decimal-pad"
                  value={editValue}
                  onChangeText={setEditValue}
                  placeholder="e.g. 3000"
                  placeholderTextColor={colors.textHint}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
                <View style={s.btnRow}>
                  <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={handleCancel}>
                    <Text style={s.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, s.saveBtn]} onPress={handleSave}>
                    <Text style={s.saveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    container:      {
      flex: 1, backgroundColor: c.bg,
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    },
    title:          { fontSize: fontSize.xl, fontWeight: '700', color: c.text, marginTop: spacing.lg, marginBottom: spacing.md },
    chartWrap:      { alignItems: 'center', justifyContent: 'center', marginVertical: spacing.lg },
    chartTotal:     { fontSize: fontSize.lg, fontWeight: '700', color: c.text },
    emptyText:      { textAlign: 'center', color: c.textHint, marginVertical: spacing.xxl },
    sectionTitle:   { fontSize: fontSize.base, fontWeight: '700', color: c.text, marginTop: spacing.xl, marginBottom: spacing.md },
    budgetRow:      {
      backgroundColor: c.card, borderRadius: radius.lg,
      padding: spacing.md, marginBottom: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    budgetHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    budgetCategory: { fontSize: fontSize.md, fontWeight: '600', color: c.text },
    budgetAmount:   { fontSize: fontSize.sm, color: c.textFaint },
    progressTrack:  { height: rs(7), backgroundColor: c.cardAlt, borderRadius: radius.full, overflow: 'hidden' },
    progressFill:   { height: rs(7), borderRadius: radius.full },
    // modal
    modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    modalBox:       {
      backgroundColor: c.card, borderRadius: radius.xl,
      padding: spacing.xxl, width: '100%',
    },
    modalTitle:     { fontSize: fontSize.base, fontWeight: '700', color: c.text, marginBottom: spacing.md },
    modalInput:     {
      borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
      padding: spacing.md, fontSize: fontSize.base,
      marginBottom: spacing.lg, color: c.text, minHeight: rs(48),
    },
    btnRow:         { flexDirection: 'row', gap: spacing.md },
    btn:            { flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', minHeight: rs(50) },
    cancelBtn:      { backgroundColor: c.cardAlt },
    saveBtn:        { backgroundColor: c.accent },
    cancelText:     { color: c.textMuted, fontWeight: '600', fontSize: fontSize.base },
    saveText:       { color: c.accentText, fontWeight: '600', fontSize: fontSize.base },
  });
}
