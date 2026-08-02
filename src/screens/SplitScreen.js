import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  getSplitGroups, createSplitGroup, deleteSplitGroup,
  getGroupMembers, addGroupMember, deleteGroupMember,
  getGroupExpenses, addSplitExpense, getExpenseShares,
  settleShare, getGroupBalances,
} from '../db/database';
import { spacing, fontSize, radius, rs } from '../utils/layout';

export default function SplitScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const s = makeStyles(colors, insets);

  const loadGroups = useCallback(async () => {
    setGroups(await getSplitGroups());
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await createSplitGroup(newGroupName.trim());
    setNewGroupName('');
    await loadGroups();
  };

  const handleDeleteGroup = (id) => {
    Alert.alert('Delete group', 'All members and expenses in this group will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteSplitGroup(id);
        await loadGroups();
      }},
    ]);
  };

  if (selectedGroup) {
    return (
      <GroupDetailScreen
        group={selectedGroup}
        colors={colors}
        insets={insets}
        onBack={() => setSelectedGroup(null)}
      />
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={groups}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.xxl }}
        ListHeaderComponent={
          <View style={s.createRow}>
            <TextInput
              style={s.createInput}
              placeholder="New group name…"
              placeholderTextColor={colors.textHint}
              value={newGroupName}
              onChangeText={setNewGroupName}
              returnKeyType="done"
              onSubmitEditing={handleCreateGroup}
            />
            <TouchableOpacity style={s.createBtn} onPress={handleCreateGroup}>
              <Ionicons name="add" size={rs(22)} color={colors.accentText} />
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.groupCard} onPress={() => setSelectedGroup(item)} activeOpacity={0.75}>
            <View style={s.groupIcon}>
              <Ionicons name="people-outline" size={rs(22)} color={colors.accent} />
            </View>
            <Text style={s.groupName} numberOfLines={1}>{item.name}</Text>
            <TouchableOpacity onPress={() => handleDeleteGroup(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={rs(18)} color={colors.danger} />
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={rs(16)} color={colors.textHint} style={{ marginLeft: spacing.xs }} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="people-outline" size={rs(48)} color={colors.textHint} />
            <Text style={s.emptyText}>No groups yet.</Text>
            <Text style={s.emptySub}>Create one above to start splitting expenses.</Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Group detail ─────────────────────────────────────────────────────────────

function GroupDetailScreen({ group, colors, insets, onBack }) {
  const [members, setMembers]     = useState([]);
  const [expenses, setExpenses]   = useState([]);
  const [balances, setBalances]   = useState([]);
  const [newMember, setNewMember] = useState('');
  const [expenseModal, setExpenseModal] = useState(false);
  const [sharesModal, setSharesModal]   = useState(null); // holds expense
  const s = makeStyles(colors, insets);

  const reload = useCallback(async () => {
    const [m, e, b] = await Promise.all([
      getGroupMembers(group.id),
      getGroupExpenses(group.id),
      getGroupBalances(group.id),
    ]);
    setMembers(m); setExpenses(e); setBalances(b);
  }, [group.id]);

  useEffect(() => { reload(); }, [reload]);

  const handleAddMember = async () => {
    if (!newMember.trim()) return;
    await addGroupMember(group.id, newMember.trim());
    setNewMember('');
    await reload();
  };

  const handleDeleteMember = (id) => {
    Alert.alert('Remove member', 'Remove this member from the group?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteGroupMember(id); await reload(); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
      >
        {/* Back button */}
        <TouchableOpacity style={s.backRow} onPress={onBack}>
          <Ionicons name="arrow-back" size={rs(20)} color={colors.accent} />
          <Text style={s.backText}>Back to groups</Text>
        </TouchableOpacity>

        <Text style={s.detailTitle}>{group.name}</Text>

        {/* Members */}
        <Text style={s.sectionLabel}>Members</Text>
        <View style={s.memberRow}>
          <TextInput
            style={s.memberInput}
            placeholder="Add member name…"
            placeholderTextColor={colors.textHint}
            value={newMember}
            onChangeText={setNewMember}
            returnKeyType="done"
            onSubmitEditing={handleAddMember}
          />
          <TouchableOpacity style={s.memberAddBtn} onPress={handleAddMember}>
            <Ionicons name="add" size={rs(20)} color={colors.accentText} />
          </TouchableOpacity>
        </View>
        {members.map((m) => (
          <View key={m.id} style={s.memberChipRow}>
            <View style={[s.memberChip, { backgroundColor: colors.cardAlt }]}>
              <Text style={s.memberChipText}>{m.name}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDeleteMember(m.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={rs(18)} color={colors.textHint} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Balances */}
        {balances.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Balances</Text>
            {balances.map((b) => (
              <View key={b.id} style={s.balanceRow}>
                <Text style={s.balanceName}>{b.name}</Text>
                <Text style={[s.balanceAmt, { color: b.net >= 0 ? colors.success : colors.danger }]}>
                  {b.net >= 0 ? '+' : ''}₹{Math.abs(b.net).toFixed(2)}
                  {b.net > 0 ? ' is owed' : b.net < 0 ? ' owes' : ' settled'}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Expenses */}
        <View style={s.expensesHeader}>
          <Text style={s.sectionLabel}>Expenses</Text>
          {members.length >= 2 && (
            <TouchableOpacity onPress={() => setExpenseModal(true)} style={s.addExpBtn}>
              <Ionicons name="add" size={rs(16)} color={colors.accent} />
              <Text style={s.addExpText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        {expenses.map((exp) => (
          <TouchableOpacity key={exp.id} style={s.expenseCard} onPress={() => setSharesModal(exp)} activeOpacity={0.75}>
            <View style={{ flex: 1 }}>
              <Text style={s.expDesc} numberOfLines={1}>{exp.description}</Text>
              <Text style={s.expSub}>Paid by {exp.paid_by_name} · {new Date(exp.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={s.expAmt}>₹{Number(exp.amount).toFixed(2)}</Text>
            <Ionicons name="chevron-forward" size={rs(14)} color={colors.textHint} />
          </TouchableOpacity>
        ))}
        {expenses.length === 0 && members.length >= 2 && (
          <Text style={[s.emptySub, { paddingTop: spacing.sm }]}>No expenses yet. Tap Add above.</Text>
        )}
        {members.length < 2 && (
          <Text style={[s.emptySub, { paddingTop: spacing.sm }]}>Add at least 2 members to start logging expenses.</Text>
        )}
      </ScrollView>

      {/* Add expense modal */}
      {expenseModal && (
        <AddExpenseModal
          visible={expenseModal}
          members={members}
          colors={colors}
          insets={insets}
          onClose={() => setExpenseModal(false)}
          onSave={async (data) => {
            await addSplitExpense({ groupId: group.id, ...data });
            await reload();
            setExpenseModal(false);
          }}
        />
      )}

      {/* Shares modal */}
      {sharesModal && (
        <SharesModal
          expense={sharesModal}
          colors={colors}
          insets={insets}
          onClose={() => { setSharesModal(null); reload(); }}
        />
      )}
    </View>
  );
}

// ─── Add expense modal ────────────────────────────────────────────────────────

function AddExpenseModal({ visible, members, colors, insets, onClose, onSave }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount]           = useState('');
  const [paidBy, setPaidBy]           = useState(members[0]?.id ?? null);
  const [splitType, setSplitType]     = useState('equal'); // 'equal' | 'custom'
  const [customShares, setCustomShares] = useState({});
  const s = modalStyles(colors, insets);

  useEffect(() => {
    setPaidBy(members[0]?.id ?? null);
    const init = {};
    members.forEach((m) => { init[m.id] = ''; });
    setCustomShares(init);
  }, [members]);

  const handleSave = () => {
    if (!description.trim()) { Alert.alert('Description required'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount'); return; }
    let shares;
    if (splitType === 'equal') {
      const each = amt / members.length;
      shares = members.map((m) => ({ memberId: m.id, amount: parseFloat(each.toFixed(2)) }));
    } else {
      shares = members.map((m) => ({ memberId: m.id, amount: Number(customShares[m.id] || 0) }));
      const total = shares.reduce((s, x) => s + x.amount, 0);
      if (Math.abs(total - amt) > 0.01) { Alert.alert('Shares don\'t add up', `Total shares ₹${total.toFixed(2)} ≠ ₹${amt.toFixed(2)}`); return; }
    }
    onSave({ description: description.trim(), amount: amt, paidByMemberId: paidBy, shares });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.title}>Add Expense</Text>
            <TextInput style={s.input} placeholder="Description" placeholderTextColor={colors.textHint} value={description} onChangeText={setDescription} />
            <TextInput style={s.input} placeholder="Total amount ₹" placeholderTextColor={colors.textHint} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

            <Text style={s.fieldLabel}>Paid by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {members.map((m) => (
                <TouchableOpacity key={m.id} style={[s.chip, paidBy === m.id && s.chipActive]} onPress={() => setPaidBy(m.id)}>
                  <Text style={[s.chipText, paidBy === m.id && s.chipTextActive]}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>Split</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {['equal', 'custom'].map((t) => (
                <TouchableOpacity key={t} style={[s.chip, splitType === t && s.chipActive]} onPress={() => setSplitType(t)}>
                  <Text style={[s.chipText, splitType === t && s.chipTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {splitType === 'custom' && members.map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
                <Text style={{ color: colors.text, flex: 1, fontSize: fontSize.md }}>{m.name}</Text>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="₹0"
                  placeholderTextColor={colors.textHint}
                  keyboardType="decimal-pad"
                  value={customShares[m.id]}
                  onChangeText={(v) => setCustomShares((prev) => ({ ...prev, [m.id]: v }))}
                />
              </View>
            ))}

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

// ─── Shares modal ─────────────────────────────────────────────────────────────

function SharesModal({ expense, colors, insets, onClose }) {
  const [shares, setShares] = useState([]);
  const s = modalStyles(colors, insets);

  useEffect(() => {
    getExpenseShares(expense.id).then(setShares);
  }, [expense.id]);

  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{expense.description}</Text>
          <Text style={{ color: colors.textFaint, marginBottom: spacing.lg }}>
            ₹{Number(expense.amount).toFixed(2)} · Paid by {expense.paid_by_name}
          </Text>
          {shares.map((share) => (
            <View key={share.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.md }}>{share.member_name}</Text>
              <Text style={{ color: colors.textFaint, fontSize: fontSize.md }}>₹{Number(share.share_amount).toFixed(2)}</Text>
              <TouchableOpacity
                onPress={async () => {
                  await settleShare(share.id, !share.settled);
                  setShares(await getExpenseShares(expense.id));
                }}
                style={{ marginLeft: spacing.md }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={share.settled ? 'checkmark-circle' : 'ellipse-outline'}
                  size={rs(22)}
                  color={share.settled ? colors.success : colors.textHint}
                />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[s.btn, s.saveBtn, { marginTop: spacing.lg }]} onPress={onClose}>
            <Text style={s.saveText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c, insets) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: c.bg, paddingTop: insets.top },
    createRow:      { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, marginTop: spacing.sm },
    createInput:    { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: fontSize.base, color: c.text, backgroundColor: c.card, minHeight: rs(48) },
    createBtn:      { width: rs(48), height: rs(48), borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    groupCard:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    groupIcon:      { width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' },
    groupName:      { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: c.text },
    empty:          { alignItems: 'center', marginTop: rs(80) },
    emptyText:      { fontSize: fontSize.base, color: c.textHint, marginTop: spacing.lg, fontWeight: '600' },
    emptySub:       { fontSize: fontSize.sm, color: c.textHint, marginTop: spacing.xs, textAlign: 'center' },
    // detail
    backRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
    backText:       { fontSize: fontSize.md, color: c.accent, fontWeight: '600' },
    detailTitle:    { fontSize: fontSize.xl, fontWeight: '700', color: c.text, marginBottom: spacing.lg },
    sectionLabel:   { fontSize: fontSize.xs, fontWeight: '700', color: c.textHint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.md },
    memberRow:      { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    memberInput:    { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: fontSize.base, color: c.text, backgroundColor: c.card, minHeight: rs(44) },
    memberAddBtn:   { width: rs(44), height: rs(44), borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    memberChipRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
    memberChip:     { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full },
    memberChipText: { fontSize: fontSize.sm, color: c.text, fontWeight: '500' },
    balanceRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    balanceName:    { fontSize: fontSize.md, color: c.text },
    balanceAmt:     { fontSize: fontSize.md, fontWeight: '700' },
    expensesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
    addExpBtn:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    addExpText:     { fontSize: fontSize.sm, color: c.accent, fontWeight: '600' },
    expenseCard:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    expDesc:        { fontSize: fontSize.md, fontWeight: '600', color: c.text },
    expSub:         { fontSize: fontSize.xs, color: c.textFaint, marginTop: 2 },
    expAmt:         { fontSize: fontSize.md, fontWeight: '700', color: c.text },
  });
}

function modalStyles(c, insets) {
  return StyleSheet.create({
    overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:          { backgroundColor: c.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, paddingBottom: Math.max(spacing.xxl, (insets?.bottom ?? 0) + spacing.lg), maxHeight: '90%' },
    handle:         { width: rs(40), height: rs(4), borderRadius: rs(2), backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
    title:          { fontSize: fontSize.lg, fontWeight: '700', color: c.text, marginBottom: spacing.sm },
    fieldLabel:     { fontSize: fontSize.sm, fontWeight: '600', color: c.textMuted, marginBottom: spacing.sm },
    input:          { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSize.base, color: c.text, marginBottom: spacing.sm, minHeight: rs(48) },
    chip:           { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: c.cardAlt, marginRight: spacing.sm },
    chipActive:     { backgroundColor: c.accent },
    chipText:       { fontSize: fontSize.sm, color: c.textMuted, fontWeight: '500' },
    chipTextActive: { color: c.accentText },
    btnRow:         { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    btn:            { flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', minHeight: rs(50) },
    cancelBtn:      { backgroundColor: c.cardAlt },
    saveBtn:        { backgroundColor: c.accent },
    cancelText:     { color: c.textMuted, fontWeight: '600', fontSize: fontSize.base },
    saveText:       { color: c.accentText, fontWeight: '600', fontSize: fontSize.base },
  });
}
