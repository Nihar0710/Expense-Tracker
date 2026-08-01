import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { CATEGORIES, getCategoryMeta } from '../constants/categories';
import ConfirmPaymentSheet from '../components/ConfirmPaymentSheet';

export default function TransactionsScreen({ route }) {
  const { transactions, confirmPayment, discardPayment, addManual } = useWallet();
  const [filter, setFilter] = useState(route?.params?.filterStatus || 'all');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [sheetTransaction, setSheetTransaction] = useState(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter((t) => t.status === filter);
  }, [transactions, filter]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add-circle" size={28} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {['all', 'pending', 'confirmed'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TransactionCard item={item} onPress={() => item.status === 'pending' && setSheetTransaction(item)} />
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Nothing here yet.</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      <ConfirmPaymentSheet
        visible={!!sheetTransaction}
        transaction={sheetTransaction}
        onConfirm={async (id, category) => {
          await confirmPayment(id, category);
          setSheetTransaction(null);
        }}
        onDiscard={async (id) => {
          await discardPayment(id);
          setSheetTransaction(null);
        }}
      />

      <AddTransactionModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={async (data) => {
          await addManual(data);
          setAddModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

function TransactionCard({ item, onPress }) {
  const meta = getCategoryMeta(item.category);
  const isExpense = item.type === 'expense';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={item.status !== 'pending'}>
      <View style={[styles.iconCircle, { backgroundColor: meta.color + '22' }]}>
        <Ionicons name={meta.icon} size={18} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{item.payee_name || item.note || item.category}</Text>
        <Text style={styles.cardSubtitle}>
          {new Date(item.created_at).toLocaleString()} {item.status === 'pending' ? '· Tap to confirm' : ''}
        </Text>
      </View>
      <Text style={[styles.cardAmount, { color: isExpense ? '#EF4444' : '#22C55E' }]}>
        {isExpense ? '-' : '+'}₹{Number(item.amount).toFixed(2)}
      </Text>
    </TouchableOpacity>
  );
}

function AddTransactionModal({ visible, onClose, onSave }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [note, setNote] = useState('');

  const reset = () => {
    setType('expense');
    setAmount('');
    setCategory('Other');
    setNote('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Add transaction</Text>

          <View style={styles.typeRow}>
            {['expense', 'income'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, type === t && styles.typeChipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.modalInput}
            placeholder="Amount"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Note (optional)"
            value={note}
            onChangeText={setNote}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.name}
                style={[styles.chip, category === c.name && { backgroundColor: c.color }]}
                onPress={() => setCategory(c.name)}
              >
                <Text style={[styles.chipText, category === c.name && { color: '#fff' }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                reset();
                onClose();
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={() => {
                if (!amount || Number(amount) <= 0) return;
                onSave({ type, amount: Number(amount), category, note });
                reset();
              }}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  filterRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#111827' },
  filterText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardAmount: { fontSize: 14, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  typeChipActive: { backgroundColor: '#111827' },
  typeText: { fontWeight: '600', color: '#374151' },
  typeTextActive: { color: '#fff' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8 },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  modalButtonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  cancelButton: { backgroundColor: '#F3F4F6' },
  saveButton: { backgroundColor: '#111827' },
  cancelText: { color: '#374151', fontWeight: '600' },
  saveText: { color: '#fff', fontWeight: '600' },
});
