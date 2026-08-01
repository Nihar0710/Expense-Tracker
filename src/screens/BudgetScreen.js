import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useWallet } from '../context/WalletContext';
import { getBudgets, setBudget } from '../db/database';
import { getCategoryMeta } from '../constants/categories';

export default function BudgetScreen() {
  const { breakdown } = useWallet();
  const [budgets, setBudgets] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editValue, setEditValue] = useState('');

  const loadBudgets = async () => setBudgets(await getBudgets());

  useEffect(() => {
    loadBudgets();
  }, []);

  const pieData = breakdown.map((row) => {
    const meta = getCategoryMeta(row.category);
    return { value: row.total, color: meta.color, label: row.category };
  });

  const totalSpend = breakdown.reduce((sum, r) => sum + r.total, 0);

  const budgetFor = (category) => budgets.find((b) => b.category === category)?.monthly_limit;

  const saveBudget = async () => {
    if (editingCategory && editValue) {
      await setBudget(editingCategory, Number(editValue));
      await loadBudgets();
    }
    setEditingCategory(null);
    setEditValue('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Spending this month</Text>

        {pieData.length > 0 ? (
          <View style={styles.chartWrap}>
            <PieChart
              data={pieData}
              donut
              radius={90}
              innerRadius={60}
              centerLabelComponent={() => (
                <Text style={styles.chartTotal}>₹{totalSpend.toFixed(0)}</Text>
              )}
            />
          </View>
        ) : (
          <Text style={styles.emptyText}>No spending recorded yet this month.</Text>
        )}

        <Text style={styles.sectionTitle}>Category budgets</Text>
        {breakdown.map((row) => {
          const meta = getCategoryMeta(row.category);
          const limit = budgetFor(row.category);
          const pct = limit ? Math.min(row.total / limit, 1) : null;

          return (
            <TouchableOpacity
              key={row.category}
              style={styles.budgetRow}
              onPress={() => {
                setEditingCategory(row.category);
                setEditValue(limit ? String(limit) : '');
              }}
            >
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetCategory}>{row.category}</Text>
                <Text style={styles.budgetAmount}>
                  ₹{row.total.toFixed(0)} {limit ? `/ ₹${limit.toFixed(0)}` : '· set budget'}
                </Text>
              </View>
              {pct !== null && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${pct * 100}%`, backgroundColor: pct >= 1 ? '#EF4444' : meta.color },
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={!!editingCategory} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Set monthly budget for {editingCategory}</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="decimal-pad"
              value={editValue}
              onChangeText={setEditValue}
              placeholder="e.g. 3000"
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditingCategory(null)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveBudget}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 12 },
  chartWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  chartTotal: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginVertical: 30 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 10 },
  budgetRow: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  budgetCategory: { fontSize: 14, fontWeight: '600', color: '#111827' },
  budgetAmount: { fontSize: 13, color: '#6B7280' },
  progressTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 16 },
  modalButtonRow: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#F3F4F6' },
  saveButton: { backgroundColor: '#111827' },
  cancelText: { color: '#374151', fontWeight: '600' },
  saveText: { color: '#fff', fontWeight: '600' },
});
