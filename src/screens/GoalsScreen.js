import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getSavingsGoals, addSavingsGoal, updateSavingsGoal, addFundsToGoal, deleteSavingsGoal } from '../db/database';
import { useWallet } from '../context/WalletContext';
import { spacing, fontSize, radius, rs } from '../utils/layout';

export default function GoalsScreen() {
  const { colors } = useTheme();
  const { refresh } = useWallet();
  const insets = useSafeAreaInsets();
  const [goals, setGoals]     = useState([]);
  const [modal, setModal]     = useState(false);
  const [fundsModal, setFundsModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [fundsAmount, setFundsAmount]   = useState('');

  const load = useCallback(async () => setGoals(await getSavingsGoals()), []);
  useEffect(() => { load(); }, [load]);

  const handleAddFunds = async () => {
    const amt = Number(fundsAmount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount', 'Enter a valid amount.'); return; }
    await addFundsToGoal(selectedGoal.id, amt);
    await refresh();
    await load();
    setFundsModal(false);
    setFundsAmount('');
  };

  const handleDelete = (id) => {
    Alert.alert('Delete goal', 'This will remove the goal and its progress.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSavingsGoal(id); await load(); } },
    ]);
  };

  const s = makeStyles(colors, insets);

  return (
    <View style={s.container}>
      <FlatList
        data={goals}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: rs(100) + insets.bottom }}
        renderItem={({ item }) => {
          const pct = item.target_amount > 0 ? Math.min(item.current_amount / item.target_amount, 1) : 0;
          const done = pct >= 1;
          return (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                <View style={s.cardActions}>
                  <TouchableOpacity onPress={() => { setEditing(item); setModal(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="pencil-outline" size={rs(17)} color={colors.textFaint} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={rs(17)} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={s.amtRow}>
                <Text style={s.saved}>₹{item.current_amount.toFixed(0)}</Text>
                <Text style={s.target}> / ₹{item.target_amount.toFixed(0)}</Text>
              </View>
              {item.target_date && (
                <Text style={s.dateText}>Target: {new Date(item.target_date).toLocaleDateString()}</Text>
              )}
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${pct * 100}%`, backgroundColor: done ? colors.success : colors.accent }]} />
              </View>
              <Text style={[s.pctText, { color: done ? colors.success : colors.textFaint }]}>
                {done ? '🎉 Goal reached!' : `${(pct * 100).toFixed(0)}% saved`}
              </Text>
              {!done && (
                <TouchableOpacity style={s.addFundsBtn} onPress={() => { setSelectedGoal(item); setFundsAmount(''); setFundsModal(true); }}>
                  <Ionicons name="add-circle-outline" size={rs(16)} color={colors.accentText} />
                  <Text style={s.addFundsBtnText}>Add Funds</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="trophy-outline" size={rs(48)} color={colors.textHint} />
            <Text style={s.emptyText}>No savings goals yet.</Text>
            <Text style={s.emptySub}>Tap + to create one.</Text>
          </View>
        }
      />

      <TouchableOpacity style={[s.fab, { bottom: insets.bottom + spacing.lg }]} onPress={() => { setEditing(null); setModal(true); }} activeOpacity={0.85}>
        <Ionicons name="add" size={rs(28)} color={colors.accentText} />
      </TouchableOpacity>

      {/* Add/Edit goal modal */}
      <GoalModal
        visible={modal}
        editing={editing}
        colors={colors}
        insets={insets}
        onClose={() => { setModal(false); setEditing(null); }}
        onSave={async (data) => {
          if (editing) await updateSavingsGoal(editing.id, data);
          else await addSavingsGoal(data);
          await load();
          setModal(false);
          setEditing(null);
        }}
      />

      {/* Add funds modal */}
      <Modal visible={fundsModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFundsModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setFundsModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[s.fundsBox, { backgroundColor: colors.card }]}>
                <Text style={[s.fundsTitle, { color: colors.text }]}>Add to "{selectedGoal?.name}"</Text>
                <TextInput
                  style={[s.fundsInput, { borderColor: colors.border, color: colors.text }]}
                  placeholder="Amount ₹"
                  placeholderTextColor={colors.textHint}
                  keyboardType="decimal-pad"
                  value={fundsAmount}
                  onChangeText={setFundsAmount}
                  autoFocus
                  onSubmitEditing={handleAddFunds}
                />
                <View style={s.fundsBtnRow}>
                  <TouchableOpacity style={[s.fundsBtn, { backgroundColor: colors.cardAlt }]} onPress={() => setFundsModal(false)}>
                    <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.fundsBtn, { backgroundColor: colors.accent }]} onPress={handleAddFunds}>
                    <Text style={{ color: colors.accentText, fontWeight: '600' }}>Add</Text>
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

function GoalModal({ visible, editing, colors, insets, onClose, onSave }) {
  const [name, setName]         = useState('');
  const [target, setTarget]     = useState('');
  const [date, setDate]         = useState('');

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setTarget(String(editing.target_amount));
      setDate(editing.target_date ? editing.target_date.slice(0, 10) : '');
    } else { setName(''); setTarget(''); setDate(''); }
  }, [editing, visible]);

  const s = modalStyles(colors, insets);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    const amt = Number(target);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount'); return; }
    const targetDate = date.trim() ? new Date(date).toISOString() : null;
    if (date.trim() && isNaN(new Date(date))) { Alert.alert('Invalid date', 'Use YYYY-MM-DD'); return; }
    onSave({ name: name.trim(), targetAmount: amt, targetDate });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.title}>{editing ? 'Edit Goal' : 'New Savings Goal'}</Text>
            <TextInput style={s.input} placeholder="Goal name (e.g. Vacation)" placeholderTextColor={colors.textHint} value={name} onChangeText={setName} />
            <TextInput style={s.input} placeholder="Target amount ₹" placeholderTextColor={colors.textHint} keyboardType="decimal-pad" value={target} onChangeText={setTarget} />
            <TextInput style={s.input} placeholder="Target date (YYYY-MM-DD, optional)" placeholderTextColor={colors.textHint} value={date} onChangeText={setDate} />
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={onClose}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.saveBtn]} onPress={handleSave}><Text style={s.saveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: c.bg, paddingTop: insets.top },
    card:           { backgroundColor: c.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    cardName:       { fontSize: fontSize.md, fontWeight: '700', color: c.text, flex: 1 },
    cardActions:    { flexDirection: 'row', gap: spacing.md },
    amtRow:         { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.xs },
    saved:          { fontSize: fontSize.xl, fontWeight: '700', color: c.text },
    target:         { fontSize: fontSize.md, color: c.textFaint },
    dateText:       { fontSize: fontSize.xs, color: c.textHint, marginBottom: spacing.sm },
    progressTrack:  { height: rs(8), backgroundColor: c.cardAlt, borderRadius: radius.full, overflow: 'hidden', marginBottom: spacing.xs },
    progressFill:   { height: rs(8), borderRadius: radius.full },
    pctText:        { fontSize: fontSize.xs, fontWeight: '600', marginBottom: spacing.md },
    addFundsBtn:    { backgroundColor: c.accent, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm, minHeight: rs(40) },
    addFundsBtnText:{ color: c.accentText, fontWeight: '600', fontSize: fontSize.sm },
    empty:          { alignItems: 'center', marginTop: rs(80) },
    emptyText:      { fontSize: fontSize.base, color: c.textHint, marginTop: spacing.lg, fontWeight: '600' },
    emptySub:       { fontSize: fontSize.sm, color: c.textHint, marginTop: spacing.xs },
    fab:            { position: 'absolute', right: spacing.xl, width: rs(56), height: rs(56), borderRadius: rs(28), backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: rs(8), shadowOffset: { width: 0, height: rs(4) } },
    // funds modal
    overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    fundsBox:       { borderRadius: radius.xl, padding: spacing.xxl, width: '100%' },
    fundsTitle:     { fontSize: fontSize.base, fontWeight: '700', marginBottom: spacing.md },
    fundsInput:     { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: rs(24), fontWeight: '700', marginBottom: spacing.lg, minHeight: rs(56) },
    fundsBtnRow:    { flexDirection: 'row', gap: spacing.md },
    fundsBtn:       { flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', minHeight: rs(50) },
  });
}

function modalStyles(c, insets) {
  return StyleSheet.create({
    overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:    { backgroundColor: c.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, paddingBottom: Math.max(spacing.xxl, (insets?.bottom ?? 0) + spacing.lg) },
    handle:   { width: rs(40), height: rs(4), borderRadius: rs(2), backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
    title:    { fontSize: fontSize.lg, fontWeight: '700', color: c.text, marginBottom: spacing.lg },
    input:    { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSize.base, color: c.text, marginBottom: spacing.sm, minHeight: rs(48) },
    btnRow:   { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    btn:      { flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', minHeight: rs(50) },
    cancelBtn:{ backgroundColor: c.cardAlt },
    saveBtn:  { backgroundColor: c.accent },
    cancelText:{ color: c.textMuted, fontWeight: '600', fontSize: fontSize.base },
    saveText: { color: c.accentText, fontWeight: '600', fontSize: fontSize.base },
  });
}
