import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { buildCategoryList, getCategoryMeta } from '../constants/categories';
import ConfirmPaymentSheet from '../components/ConfirmPaymentSheet';
import { exportTransactionsCSV } from '../utils/csvExport';
import { spacing, fontSize, radius, useTabBarHeight, rs } from '../utils/layout';
import { showImageSourcePicker } from '../utils/imagePicker';

export default function TransactionsScreen({ route }) {
  const { searchTx, confirmPayment, discardPayment, addManual, customCategories, allTags } = useWallet();
  const { colors } = useTheme();
  const insets    = useSafeAreaInsets();
  const bottomPad = useTabBarHeight();

  const allCategories = buildCategoryList(customCategories);

  const [search, setSearch]                 = useState('');
  const [statusFilter, setStatusFilter]     = useState(route?.params?.filterStatus || 'all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tagFilter, setTagFilter]           = useState(null);
  const [methodFilter, setMethodFilter]     = useState('all');
  const [results, setResults]               = useState([]);
  const [addModalVisible, setAddModal]      = useState(false);
  const [sheetTx, setSheetTx]               = useState(null);
  const debounceRef = useRef(null);

  const runSearch = useCallback(
    async (q, status, category, tagId, paymentMethod) => {
      const rows = await searchTx({ search: q, status, category, tagId, paymentMethod });
      setResults(rows);
    },
    [searchTx]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(search, statusFilter, categoryFilter, tagFilter, methodFilter);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, statusFilter, categoryFilter, tagFilter, methodFilter, runSearch]);

  const handleExport = async () => {
    if (results.length === 0) { Alert.alert('Nothing to export', 'No transactions match the current filters.'); return; }
    try { await exportTransactionsCSV(results); }
    catch (e) { Alert.alert('Export failed', e.message); }
  };

  const s = makeStyles(colors, insets);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Transactions</Text>
        <View style={s.headerIcons}>
          <TouchableOpacity onPress={handleExport} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="share-outline" size={rs(22)} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAddModal(true)} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="add-circle" size={rs(26)} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search" size={rs(15)} color={colors.textHint} style={{ marginRight: spacing.sm }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search payee, note, UPI ID…"
          placeholderTextColor={colors.textHint}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={rs(16)} color={colors.textHint} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips — status + payment method + category + tags */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={s.filterScroll} contentContainerStyle={s.filterContent}
      >
        {['all', 'pending', 'confirmed'].map((f) => (
          <TouchableOpacity key={f} style={[s.chip, statusFilter === f && s.chipActive]} onPress={() => setStatusFilter(f)}>
            <Text style={[s.chipText, statusFilter === f && s.chipTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
        <View style={s.chipDivider} />
        {[{ v: 'all', label: 'All' }, { v: 'upi', label: '📲 UPI' }, { v: 'cash', label: '💵 Cash' }].map(({ v, label }) => (
          <TouchableOpacity key={v} style={[s.chip, methodFilter === v && s.chipActive]} onPress={() => setMethodFilter(v)}>
            <Text style={[s.chipText, methodFilter === v && s.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
        <View style={s.chipDivider} />
        {['all', ...allCategories.map((c) => c.name)].map((cat) => (
          <TouchableOpacity key={cat} style={[s.chip, categoryFilter === cat && s.chipActive]} onPress={() => setCategoryFilter(cat)}>
            <Text style={[s.chipText, categoryFilter === cat && s.chipTextActive]}>{cat === 'all' ? 'All categories' : cat}</Text>
          </TouchableOpacity>
        ))}
        {allTags.length > 0 && <View style={s.chipDivider} />}
        {allTags.map((tag) => (
          <TouchableOpacity key={`tag-${tag.id}`} style={[s.chip, tagFilter === tag.id && s.chipTagActive]} onPress={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}>
            <Text style={[s.chipText, tagFilter === tag.id && s.chipTextActive]}>#{tag.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => (
          <TransactionCard
            item={item}
            colors={colors}
            customCategories={customCategories}
            onPress={() => item.status === 'pending' && setSheetTx(item)}
          />
        )}
        ListEmptyComponent={<Text style={s.emptyText}>Nothing here yet.</Text>}
      />

      <ConfirmPaymentSheet
        visible={!!sheetTx}
        transaction={sheetTx}
        onConfirm={async (id, cat, receiptUri) => {
          await confirmPayment(id, cat, receiptUri);
          setSheetTx(null);
          runSearch(search, statusFilter, categoryFilter, tagFilter, methodFilter);
        }}
        onDiscard={async (id) => {
          await discardPayment(id);
          setSheetTx(null);
          runSearch(search, statusFilter, categoryFilter, tagFilter, methodFilter);
        }}
      />

      <AddTransactionModal
        visible={addModalVisible}
        colors={colors}
        insets={insets}
        allCategories={allCategories}
        onClose={() => setAddModal(false)}
        onSave={async (data) => {
          await addManual(data);
          setAddModal(false);
          runSearch(search, statusFilter, categoryFilter, tagFilter, methodFilter);
        }}
      />
    </View>
  );
}

// ─── Transaction card ─────────────────────────────────────────────────────────

function TransactionCard({ item, colors, customCategories, onPress }) {
  const meta = getCategoryMeta(item.category, customCategories);
  const isExpense = item.type === 'expense';
  return (
    <TouchableOpacity
      style={[cardStyle.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={item.status === 'pending' ? 0.7 : 1}
      disabled={item.status !== 'pending'}
    >
      <View style={[cardStyle.iconCircle, { backgroundColor: meta.color + '22' }]}>
        <Ionicons name={meta.icon} size={rs(17)} color={meta.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[cardStyle.title, { color: colors.text }]} numberOfLines={1}>
          {item.payee_name || item.note || item.category}
        </Text>
        <Text style={[cardStyle.sub, { color: colors.textFaint }]} numberOfLines={1}>
          {new Date(item.created_at).toLocaleString()}
          {item.status === 'pending' ? ' · Tap to confirm' : ''}
        </Text>
      </View>
      {item.receipt_uri ? (
        <Image source={{ uri: item.receipt_uri }} style={cardStyle.receiptThumb} />
      ) : null}
      <Text style={[cardStyle.amount, { color: isExpense ? colors.danger : colors.success }]}>
        {isExpense ? '-' : '+'}₹{Number(item.amount).toFixed(2)}
      </Text>
    </TouchableOpacity>
  );
}

const cardStyle = StyleSheet.create({
  card:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: StyleSheet.hairlineWidth },
  iconCircle:   { width: rs(40), height: rs(40), borderRadius: rs(20), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:        { fontSize: fontSize.md, fontWeight: '600' },
  sub:          { fontSize: fontSize.xs, marginTop: 2 },
  amount:       { fontSize: fontSize.md, fontWeight: '700', flexShrink: 0 },
  receiptThumb: { width: rs(32), height: rs(32), borderRadius: rs(4), flexShrink: 0 },
});

// ─── Add transaction modal ────────────────────────────────────────────────────

function AddTransactionModal({ visible, colors, insets, allCategories, onClose, onSave }) {
  const { addCustomCategory } = useWallet();
  const [type, setType]               = useState('expense');
  const [amount, setAmount]           = useState('');
  const [category, setCategory]       = useState('Other');
  const [customLabel, setCustomLabel] = useState('');
  const [note, setNote]               = useState('');
  const [tagsInput, setTagsInput]     = useState('');
  const [receiptUri, setReceiptUri]   = useState(null);
  const s = modalStyles(colors, insets);

  const reset = () => {
    setType('expense'); setAmount(''); setCategory('Other');
    setCustomLabel(''); setNote(''); setTagsInput(''); setReceiptUri(null);
  };

  const isOther = category === 'Other';

  const handlePickReceipt = async () => {
    showImageSourcePicker((uri) => {
      if (uri) setReceiptUri(uri);
    });
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return;
    if (isOther && !customLabel.trim()) { Alert.alert('Category required', 'Please describe the "Other" category.'); return; }
    const finalCategory = isOther ? customLabel.trim() : category;
    if (isOther && customLabel.trim()) await addCustomCategory(customLabel.trim());
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    onSave({ type, amount: Number(amount), category: finalCategory, note, receiptUri, tags });
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.title}>Add transaction</Text>

            <View style={s.typeRow}>
              {['expense', 'income'].map((t) => (
                <TouchableOpacity key={t} style={[s.typeChip, type === t && s.typeChipActive]} onPress={() => setType(t)}>
                  <Text style={[s.typeText, type === t && s.typeTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={s.input} placeholder="Amount" placeholderTextColor={colors.textHint} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
            <TextInput style={s.input} placeholder="Note (optional)" placeholderTextColor={colors.textHint} value={note} onChangeText={setNote} />
            <TextInput style={s.input} placeholder="Tags (comma-separated, e.g. work, travel)" placeholderTextColor={colors.textHint} value={tagsInput} onChangeText={setTagsInput} autoCapitalize="none" />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.sm }}>
              {allCategories.map((c) => (
                <TouchableOpacity key={c.name} style={[s.chip, category === c.name && { backgroundColor: c.color }]}
                  onPress={() => { setCategory(c.name); setCustomLabel(''); }}>
                  <Text style={[s.chipText, category === c.name && { color: '#fff' }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {isOther && (
              <TextInput
                style={[s.input, s.customInput, !customLabel.trim() && s.customInputError]}
                placeholder="Name this category — it'll be saved for later"
                placeholderTextColor={colors.textHint}
                value={customLabel}
                onChangeText={setCustomLabel}
                returnKeyType="done"
              />
            )}

            {/* Receipt */}
            <TouchableOpacity style={s.receiptBtn} onPress={handlePickReceipt}>
              <Ionicons name={receiptUri ? 'image' : 'camera-outline'} size={rs(15)} color={colors.accent} />
              <Text style={s.receiptBtnText}>{receiptUri ? 'Change receipt' : 'Attach receipt (optional)'}</Text>
            </TouchableOpacity>
            {receiptUri && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <Image source={{ uri: receiptUri }} style={{ width: rs(48), height: rs(48), borderRadius: radius.sm }} />
                <TouchableOpacity onPress={() => setReceiptUri(null)}>
                  <Ionicons name="close-circle" size={rs(18)} color={colors.danger} />
                </TouchableOpacity>
              </View>
            )}

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

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c, insets) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right },
    header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    title:          { fontSize: fontSize.xl, fontWeight: '700', color: c.text },
    headerIcons:    { flexDirection: 'row', gap: spacing.sm },
    iconBtn:        { padding: spacing.xs },
    searchRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: radius.md, paddingHorizontal: spacing.md, marginHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, minHeight: rs(44) },
    searchInput:    { flex: 1, paddingVertical: spacing.sm, fontSize: fontSize.md, color: c.text },
    filterScroll:   { flexGrow: 0, marginTop: spacing.sm },
    filterContent:  { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm, flexDirection: 'row' },
    chip:           { paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 1, borderRadius: radius.full, backgroundColor: c.cardAlt },
    chipActive:     { backgroundColor: c.accent },
    chipTagActive:  { backgroundColor: c.accent + 'CC' },
    chipText:       { fontSize: fontSize.sm, color: c.textMuted, fontWeight: '500' },
    chipTextActive: { color: c.accentText },
    chipDivider:    { width: 1, backgroundColor: c.border, marginHorizontal: spacing.xs, alignSelf: 'stretch' },
    emptyText:      { textAlign: 'center', color: c.textHint, marginTop: spacing.xxl * 2 },
  });
}

function modalStyles(c, insets) {
  return StyleSheet.create({
    overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:            { backgroundColor: c.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, paddingBottom: Math.max(spacing.xxl, (insets?.bottom ?? 0) + spacing.lg) },
    handle:           { width: rs(40), height: rs(4), borderRadius: rs(2), backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg },
    title:            { fontSize: fontSize.lg, fontWeight: '700', color: c.text, marginBottom: spacing.lg },
    typeRow:          { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    typeChip:         { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: c.cardAlt, alignItems: 'center' },
    typeChipActive:   { backgroundColor: c.accent },
    typeText:         { fontWeight: '600', color: c.textMuted, fontSize: fontSize.md },
    typeTextActive:   { color: c.accentText },
    input:            { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSize.base, marginBottom: spacing.sm, color: c.text, minHeight: rs(48) },
    chip:             { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: c.cardAlt, marginRight: spacing.sm },
    chipText:         { fontSize: fontSize.sm, color: c.textMuted, fontWeight: '500' },
    customInput:      { borderColor: c.accent, borderWidth: 1.5, marginTop: spacing.xs },
    customInputError: { borderColor: c.danger },
    receiptBtn:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.sm },
    receiptBtnText:   { fontSize: fontSize.sm, color: c.accent, fontWeight: '500' },
    btnRow:           { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    btn:              { flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', minHeight: rs(50) },
    cancelBtn:        { backgroundColor: c.cardAlt },
    saveBtn:          { backgroundColor: c.accent },
    cancelText:       { color: c.textMuted, fontWeight: '600', fontSize: fontSize.base },
    saveText:         { color: c.accentText, fontWeight: '600', fontSize: fontSize.base },
  });
}
