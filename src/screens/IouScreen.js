import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { getIous, addIou, settleIou, deleteIou } from '../db/database';
import { spacing, fontSize, radius, rs } from '../utils/layout';

export default function IouScreen() {
  const { colors } = useTheme();
  const { refresh } = useWallet();
  const insets = useSafeAreaInsets();
  const [ious, setIous] = useState([]);
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => setIous(await getIous()), []);
  useEffect(() => { load(); }, [load]);

  // Group by person
  const grouped = {};
  for (const iou of ious) {
    if (!grouped[iou.person_name]) grouped[iou.person_name] = [];
    grouped[iou.person_name].push(iou);
  }

  const persons = Object.entries(grouped).map(([name, items]) => {
    const net = items.reduce((sum, i) => {
      if (i.settled) return sum;
      return i.direction === 'owed_to_me' ? sum + i.amount : sum - i.amount;
    }, 0);
    return { name, items, net };
  });

  const handleSettle = (iou) => {
    Alert.alert(
      'Mark as settled',
      iou.direction === 'owed_to_me'
        ? `${iou.person_name} paid you ₹${iou.amount}. Log as income?`
        : `You paid ₹${iou.amount} to ${iou.person_name}. Log as expense?`,
      [
        { text: 'Settle only', onPress: async () => { await settleIou(iou.id, false); await load(); await refresh(); } },
        { text: 'Settle + log', onPress: async () => { await settleIou(iou.id, true); await load(); await refresh(); } },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDelete = (id) => {
    Alert.alert('Delete IOU', 'Remove this record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteIou(id); await load(); } },
    ]);
  };

  const s = makeStyles(colors, insets);

  return (
    <View style={s.container}>
      <FlatList
        data={persons}
        keyExtractor={(item) => item.name}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: rs(100) + insets.bottom }}
        renderItem={({ item: person }) => (
          <View style={s.personCard}>
            <View style={s.personHeader}>
              <Text style={s.personName}>{person.name}</Text>
              <Text style={[s.personNet, { color: person.net > 0 ? colors.success : person.net < 0 ? colors.danger : colors.textHint }]}>
                {person.net > 0 ? `owes you ₹${person.net.toFixed(0)}` : person.net < 0 ? `you owe ₹${Math.abs(person.net).toFixed(0)}` : 'settled'}
              </Text>
            </View>
            {person.items.map((iou) => (
              <View key={iou.id} style={[s.iouRow, iou.settled && s.iouSettled]}>
                <Ionicons
                  name={iou.direction === 'owed_to_me' ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={rs(18)}
                  color={iou.settled ? colors.textHint : iou.direction === 'owed_to_me' ? colors.success : colors.danger}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[s.iouAmt, { color: iou.settled ? colors.textHint : colors.text }]}>
                    ₹{iou.amount.toFixed(2)}
                    {iou.settled ? ' · Settled' : ''}
                  </Text>
                  {iou.note ? <Text style={s.iouNote}>{iou.note}</Text> : null}
                  <Text style={s.iouDate}>{new Date(iou.created_at).toLocaleDateString()}</Text>
                </View>
                {!iou.settled && (
                  <TouchableOpacity onPress={() => handleSettle(iou)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="checkmark-circle-outline" size={rs(20)} color={colors.success} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDelete(iou.id)} style={{ marginLeft: spacing.sm }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={rs(18)} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="handshake-outline" size={rs(48)} color={colors.textHint} />
            <Text style={s.emptyText}>No IOUs yet.</Text>
            <Text style={s.emptySub}>Track money you lent or borrowed.</Text>
          </View>
        }
      />

      <TouchableOpacity style={[s.fab, { bottom: insets.bottom + spacing.lg }]} onPress={() => setModal(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={rs(28)} color={colors.accentText} />
      </TouchableOpacity>

      <AddIouModal
        visible={modal}
        colors={colors}
        insets={insets}
        onClose={() => setModal(false)}
        onSave={async (data) => {
          await addIou(data);
          await load();
          setModal(false);
        }}
      />
    </View>
  );
}

function AddIouModal({ visible, colors, insets, onClose, onSave }) {
  const [person, setPerson]       = useState('');
  const [amount, setAmount]       = useState('');
  const [direction, setDirection] = useState('owed_to_me');
  const [note, setNote]           = useState('');
  const s = modalStyles(colors, insets);

  const reset = () => { setPerson(''); setAmount(''); setDirection('owed_to_me'); setNote(''); };

  const handleSave = () => {
    if (!person.trim()) { Alert.alert('Name required'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount'); return; }
    onSave({ personName: person.trim(), amount: amt, direction, note: note.trim() || null });
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.title}>Add IOU</Text>

            <View style={s.dirRow}>
              {[
                { value: 'owed_to_me', label: 'They owe me', icon: 'arrow-down-circle' },
                { value: 'i_owe', label: 'I owe them', icon: 'arrow-up-circle' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.dirChip, direction === opt.value && s.dirChipActive]}
                  onPress={() => setDirection(opt.value)}
                >
                  <Ionicons name={opt.icon} size={rs(16)} color={direction === opt.value ? colors.accentText : colors.textMuted} />
                  <Text style={[s.dirText, direction === opt.value && s.dirTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={s.input} placeholder="Person's name" placeholderTextColor={colors.textHint} value={person} onChangeText={setPerson} />
            <TextInput style={s.input} placeholder="Amount ₹" placeholderTextColor={colors.textHint} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
            <TextInput style={s.input} placeholder="Note (optional)" placeholderTextColor={colors.textHint} value={note} onChangeText={setNote} />

            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={() => { reset(); onClose(); }}>
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
    container:    { flex: 1, backgroundColor: c.bg, paddingTop: insets.top },
    personCard:   { backgroundColor: c.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    personHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    personName:   { fontSize: fontSize.md, fontWeight: '700', color: c.text },
    personNet:    { fontSize: fontSize.sm, fontWeight: '600' },
    iouRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    iouSettled:   { opacity: 0.5 },
    iouAmt:       { fontSize: fontSize.md, fontWeight: '600' },
    iouNote:      { fontSize: fontSize.xs, color: c.textFaint, marginTop: 2 },
    iouDate:      { fontSize: fontSize.xs, color: c.textHint, marginTop: 1 },
    empty:        { alignItems: 'center', marginTop: rs(80) },
    emptyText:    { fontSize: fontSize.base, color: c.textHint, marginTop: spacing.lg, fontWeight: '600' },
    emptySub:     { fontSize: fontSize.sm, color: c.textHint, marginTop: spacing.xs },
    fab:          { position: 'absolute', right: spacing.xl, width: rs(56), height: rs(56), borderRadius: rs(28), backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: rs(8), shadowOffset: { width: 0, height: rs(4) } },
  });
}

function modalStyles(c, insets) {
  return StyleSheet.create({
    overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:         { backgroundColor: c.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, paddingBottom: Math.max(spacing.xxl, (insets?.bottom ?? 0) + spacing.lg) },
    handle:        { width: rs(40), height: rs(4), borderRadius: rs(2), backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
    title:         { fontSize: fontSize.lg, fontWeight: '700', color: c.text, marginBottom: spacing.lg },
    dirRow:        { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    dirChip:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: c.cardAlt },
    dirChipActive: { backgroundColor: c.accent },
    dirText:       { fontSize: fontSize.sm, fontWeight: '600', color: c.textMuted },
    dirTextActive: { color: c.accentText },
    input:         { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSize.base, color: c.text, marginBottom: spacing.sm, minHeight: rs(48) },
    btnRow:        { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    btn:           { flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', minHeight: rs(50) },
    cancelBtn:     { backgroundColor: c.cardAlt },
    saveBtn:       { backgroundColor: c.accent },
    cancelText:    { color: c.textMuted, fontWeight: '600', fontSize: fontSize.base },
    saveText:      { color: c.accentText, fontWeight: '600', fontSize: fontSize.base },
  });
}
