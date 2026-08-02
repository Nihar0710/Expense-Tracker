import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ScrollView, Alert, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { getBillReminders, addBillReminder, updateBillReminder, markBillPaid, deleteBillReminder } from '../db/database';
import { buildCategoryList } from '../constants/categories';
import { spacing, fontSize, radius, rs } from '../utils/layout';

// Safe-load expo-notifications — won't crash if native module unavailable
let Notifications = null;
try { Notifications = require('expo-notifications'); } catch (_) {}

async function scheduleBillNotification(bill) {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`bill-${bill.id}`).catch(() => {});
    const due = new Date(bill.due_date);
    const remind = new Date(due);
    remind.setDate(remind.getDate() - 2);
    if (remind > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `bill-${bill.id}`,
        content: {
          title: `Bill due soon: ${bill.name}`,
          body: `Due ${due.toLocaleDateString()}${bill.amount ? ` · ₹${bill.amount}` : ''}`,
          data: { billId: bill.id },
        },
        trigger: remind,
      });
    }
  } catch (_) {}
}

async function requestNotificationPermission() {
  if (!Notifications) return;
  try { await Notifications.requestPermissionsAsync(); } catch (_) {}
}

export default function BillsScreen() {
  const { colors } = useTheme();
  const { refresh, customCategories } = useWallet();
  const insets = useSafeAreaInsets();
  const [bills, setBills]     = useState([]);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState(null);
  const allCategories = buildCategoryList(customCategories);

  const load = useCallback(async () => {
    const rows = await getBillReminders();
    setBills(rows);
  }, []);

  useEffect(() => {
    load();
    requestNotificationPermission();
  }, [load]);

  const handleMarkPaid = (bill) => {
    Alert.alert(
      'Mark as paid',
      bill.amount
        ? `This will log a ₹${bill.amount} expense for "${bill.name}".`
        : `Mark "${bill.name}" as paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid', onPress: async () => {
            await markBillPaid(bill.id);
            await refresh();
            await load();
          },
        },
      ]
    );
  };

  const handleDelete = (id) => {
    Alert.alert('Delete bill', 'This reminder will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteBillReminder(id);
          if (Notifications) {
            Notifications.cancelScheduledNotificationAsync(`bill-${id}`).catch(() => {});
          }
          await load();
        },
      },
    ]);
  };

  const daysUntil = (dateStr) => {
    const due = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  };

  const s = makeStyles(colors, insets);

  return (
    <View style={s.container}>
      <FlatList
        data={bills}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: rs(100) + insets.bottom,
        }}
        renderItem={({ item }) => {
          const days = daysUntil(item.due_date);
          const urgent = days <= 3;
          return (
            <View style={[s.card, urgent && s.cardUrgent]}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{item.name}</Text>
                <Text style={s.cardSub}>
                  Due {new Date(item.due_date).toLocaleDateString()}
                  {item.amount ? ` · ₹${item.amount}` : ''}
                  {item.recurring ? ' · Recurring' : ''}
                </Text>
                <Text style={[s.daysText, { color: urgent ? colors.danger : colors.textHint }]}>
                  {days === 0
                    ? 'Due today'
                    : days < 0
                      ? `Overdue by ${Math.abs(days)}d`
                      : `${days} days left`}
                </Text>
              </View>
              <View style={s.actions}>
                <TouchableOpacity
                  onPress={() => { setEditing(item); setModal(true); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="pencil-outline" size={rs(18)} color={colors.textFaint} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleMarkPaid(item)} style={s.paidBtn}>
                  <Ionicons name="checkmark-circle-outline" size={rs(18)} color={colors.success} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={rs(18)} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="alarm-outline" size={rs(48)} color={colors.textHint} />
            <Text style={s.emptyText}>No bill reminders yet.</Text>
            <Text style={s.emptySub}>Tap + to add one.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + spacing.lg }]}
        onPress={() => { setEditing(null); setModal(true); }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={rs(28)} color={colors.accentText} />
      </TouchableOpacity>

      <BillModal
        visible={modal}
        editing={editing}
        colors={colors}
        insets={insets}
        allCategories={allCategories}
        onClose={() => { setModal(false); setEditing(null); }}
        onSave={async (data) => {
          if (editing) {
            await updateBillReminder(editing.id, data);
            await scheduleBillNotification({ ...data, id: editing.id });
          } else {
            const id = await addBillReminder(data);
            await scheduleBillNotification({ ...data, id });
          }
          await load();
          setModal(false);
          setEditing(null);
        }}
      />
    </View>
  );
}

function BillModal({ visible, editing, colors, insets, allCategories, onClose, onSave }) {
  const [name, setName]           = useState('');
  const [amount, setAmount]       = useState('');
  const [dueDate, setDueDate]     = useState('');
  const [category, setCategory]   = useState('Bills');
  const [recurring, setRecurring] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setAmount(editing.amount ? String(editing.amount) : '');
      setDueDate(editing.due_date ? editing.due_date.slice(0, 10) : '');
      setCategory(editing.category || 'Bills');
      setRecurring(!!editing.recurring);
    } else {
      setName(''); setAmount(''); setDueDate(''); setCategory('Bills'); setRecurring(false);
    }
  }, [editing, visible]);

  const s = modalStyles(colors, insets);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a bill name.'); return; }
    if (!dueDate.trim()) { Alert.alert('Due date required', 'Enter a due date (YYYY-MM-DD).'); return; }
    const date = new Date(dueDate);
    if (isNaN(date.getTime())) { Alert.alert('Invalid date', 'Use YYYY-MM-DD, e.g. 2025-08-15'); return; }
    onSave({
      name: name.trim(),
      amount: amount ? Number(amount) : null,
      dueDate: date.toISOString(),
      category,
      recurring,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.title}>{editing ? 'Edit Bill' : 'Add Bill Reminder'}</Text>
            <TextInput
              style={s.input} placeholder="Bill name (e.g. Electricity)"
              placeholderTextColor={colors.textHint} value={name} onChangeText={setName}
            />
            <TextInput
              style={s.input} placeholder="Amount ₹ (optional)"
              placeholderTextColor={colors.textHint} keyboardType="decimal-pad"
              value={amount} onChangeText={setAmount}
            />
            <TextInput
              style={s.input} placeholder="Due date (YYYY-MM-DD)"
              placeholderTextColor={colors.textHint} value={dueDate} onChangeText={setDueDate}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
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
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Recurring (monthly)</Text>
              <Switch
                value={recurring} onValueChange={setRecurring}
                trackColor={{ true: colors.accent, false: colors.cardAlt }}
              />
            </View>
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={onClose}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.saveBtn]} onPress={handleSave}>
                <Text style={s.saveText}>Save</Text>
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
    container:  { flex: 1, backgroundColor: c.bg, paddingTop: insets.top },
    card:       { backgroundColor: c.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, flexDirection: 'row', alignItems: 'center' },
    cardUrgent: { borderColor: c.danger },
    cardName:   { fontSize: fontSize.md, fontWeight: '600', color: c.text },
    cardSub:    { fontSize: fontSize.xs, color: c.textFaint, marginTop: 2 },
    daysText:   { fontSize: fontSize.xs, fontWeight: '600', marginTop: spacing.xs },
    actions:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: spacing.md },
    paidBtn:    { padding: spacing.xs },
    empty:      { alignItems: 'center', marginTop: rs(80) },
    emptyText:  { fontSize: fontSize.base, color: c.textHint, marginTop: spacing.lg, fontWeight: '600' },
    emptySub:   { fontSize: fontSize.sm, color: c.textHint, marginTop: spacing.xs },
    fab:        { position: 'absolute', right: spacing.xl, width: rs(56), height: rs(56), borderRadius: rs(28), backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: rs(8), shadowOffset: { width: 0, height: rs(4) } },
  });
}

function modalStyles(c, insets) {
  return StyleSheet.create({
    overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:       { backgroundColor: c.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, paddingBottom: Math.max(spacing.xxl, (insets?.bottom ?? 0) + spacing.lg) },
    handle:      { width: rs(40), height: rs(4), borderRadius: rs(2), backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
    title:       { fontSize: fontSize.lg, fontWeight: '700', color: c.text, marginBottom: spacing.lg },
    input:       { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSize.base, color: c.text, marginBottom: spacing.sm, minHeight: rs(48) },
    chip:        { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: c.cardAlt, marginRight: spacing.sm },
    chipText:    { fontSize: fontSize.sm, color: c.textMuted, fontWeight: '500' },
    switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
    switchLabel: { fontSize: fontSize.base, color: c.text },
    btnRow:      { flexDirection: 'row', gap: spacing.md },
    btn:         { flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', minHeight: rs(50) },
    cancelBtn:   { backgroundColor: c.cardAlt },
    saveBtn:     { backgroundColor: c.accent },
    cancelText:  { color: c.textMuted, fontWeight: '600', fontSize: fontSize.base },
    saveText:    { color: c.accentText, fontWeight: '600', fontSize: fontSize.base },
  });
}
