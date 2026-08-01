import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { getCategoryMeta } from '../constants/categories';

export default function HomeScreen({ navigation }) {
  const { transactions, pending, summary } = useWallet();
  const balance = (summary.income || 0) - (summary.expense || 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>This month's balance</Text>
        <Text style={styles.balanceValue}>₹{balance.toFixed(2)}</Text>
        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.balanceSubLabel}>Income</Text>
            <Text style={[styles.balanceSubValue, { color: '#22C55E' }]}>
              ₹{(summary.income || 0).toFixed(2)}
            </Text>
          </View>
          <View>
            <Text style={styles.balanceSubLabel}>Expense</Text>
            <Text style={[styles.balanceSubValue, { color: '#EF4444' }]}>
              ₹{(summary.expense || 0).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Scan')}>
          <Ionicons name="qr-code" size={22} color="#fff" />
          <Text style={styles.actionText}>Scan & Pay</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={() => navigation.navigate('Pay', {})}
        >
          <Ionicons name="send" size={20} color="#111827" />
          <Text style={[styles.actionText, { color: '#111827' }]}>Pay UPI ID</Text>
        </TouchableOpacity>
      </View>

      {pending.length > 0 && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={() => navigation.navigate('Transactions', { filterStatus: 'pending' })}
        >
          <Ionicons name="alert-circle" size={18} color="#B45309" />
          <Text style={styles.pendingText}>
            {pending.length} payment{pending.length > 1 ? 's' : ''} waiting for confirmation
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Recent transactions</Text>
      <FlatList
        data={transactions.slice(0, 15)}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <TransactionRow item={item} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No transactions yet — pay or add one to get started.</Text>
        }
      />
    </SafeAreaView>
  );
}

function TransactionRow({ item }) {
  const meta = getCategoryMeta(item.category);
  const isExpense = item.type === 'expense';
  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: meta.color + '22' }]}>
        <Ionicons name={meta.icon} size={18} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{item.payee_name || item.note || item.category}</Text>
        <Text style={styles.rowSubtitle}>
          {item.category} · {new Date(item.created_at).toLocaleDateString()}
          {item.status === 'pending' ? ' · Pending' : ''}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color: isExpense ? '#EF4444' : '#22C55E' }]}>
        {isExpense ? '-' : '+'}₹{Number(item.amount).toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16 },
  balanceCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
  },
  balanceLabel: { color: '#9CA3AF', fontSize: 13 },
  balanceValue: { color: '#fff', fontSize: 34, fontWeight: '700', marginTop: 4 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  balanceSubLabel: { color: '#9CA3AF', fontSize: 12 },
  balanceSubValue: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryAction: { backgroundColor: '#F3F4F6' },
  actionText: { color: '#fff', fontWeight: '600' },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  pendingText: { color: '#92400E', fontWeight: '500', fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});
