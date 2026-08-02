import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { getCategoryMeta } from '../constants/categories';
import FavoritesRow from '../components/FavoritesRow';
import { spacing, fontSize, radius, useTabBarHeight, rs, ms } from '../utils/layout';
export default function HomeScreen({ navigation }) {
  const { transactions, pending, summary, favorites, customCategories, streaks } = useWallet();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useTabBarHeight();
  const balance = (summary.income || 0) - (summary.expense || 0);
  const s = makeStyles(colors, insets);

  return (
    <View style={s.container}>
      <FlatList
        data={transactions.slice(0, 15)}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        renderItem={({ item }) => <TransactionRow item={item} colors={colors} customCategories={customCategories} />}
        ListEmptyComponent={
          <Text style={s.emptyText}>No transactions yet — pay or add one to get started.</Text>
        }
        ListHeaderComponent={
          <View style={s.header}>
            {/* Balance card */}
            <View style={s.balanceCard}>
              <Text style={s.balanceLabel}>This month's balance</Text>
              <Text style={s.balanceValue}>₹{balance.toFixed(2)}</Text>
              <View style={s.balanceRow}>
                <View>
                  <Text style={s.balanceSubLabel}>Income</Text>
                  <Text style={[s.balanceSubValue, { color: colors.success }]}>
                    ₹{(summary.income || 0).toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={s.balanceSubLabel}>Expense</Text>
                  <Text style={[s.balanceSubValue, { color: colors.danger }]}>
                    ₹{(summary.expense || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action buttons */}
            <View style={s.actionsRow}>
              <TouchableOpacity style={s.actionButton} onPress={() => navigation.navigate('Scan')} activeOpacity={0.8}>
                <Ionicons name="qr-code" size={rs(20)} color={colors.accentText} />
                <Text style={s.actionText}>Scan & Pay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionButton, s.secondaryAction]} onPress={() => navigation.navigate('Pay', {})} activeOpacity={0.8}>
                <Ionicons name="send" size={rs(18)} color={colors.accent} />
                <Text style={[s.actionText, { color: colors.accent }]}>Pay UPI ID</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionButton, s.secondaryAction]} onPress={() => navigation.navigate('Receive')} activeOpacity={0.8}>
                <Ionicons name="qr-code-outline" size={rs(18)} color={colors.accent} />
                <Text style={[s.actionText, { color: colors.accent }]}>Receive</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionButton, s.secondaryAction]} onPress={() => navigation.navigate('CashEntry')} activeOpacity={0.8}>
                <Ionicons name="cash-outline" size={rs(18)} color={colors.accent} />
                <Text style={[s.actionText, { color: colors.accent }]}>Cash</Text>
              </TouchableOpacity>
            </View>

            {/* No-spend streak badge */}
            {streaks.current > 0 && (
              <View style={s.streakBadge}>
                <Text style={s.streakEmoji}>🔥</Text>
                <Text style={s.streakText}>
                  {streaks.current} day no-spend streak!{streaks.longest > streaks.current ? ` Best: ${streaks.longest}d` : ''}
                </Text>
              </View>
            )}

            {/* Pending banner */}
            {pending.length > 0 && (
              <TouchableOpacity
                style={s.pendingBanner}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Transactions', { filterStatus: 'pending' })}
              >
                <Ionicons name="alert-circle" size={rs(18)} color={colors.warningIcon} />
                <Text style={s.pendingText}>
                  {pending.length} payment{pending.length > 1 ? 's' : ''} waiting for confirmation
                </Text>
              </TouchableOpacity>
            )}

            {/* Quick-pay favorites */}
            <FavoritesRow
              favorites={favorites}
              onPress={(fav) =>
                navigation.navigate('Pay', { upiId: fav.upi_id, payeeName: fav.name })
              }
            />

            <Text style={s.sectionTitle}>Recent transactions</Text>
          </View>
        }
      />
    </View>
  );
}

function TransactionRow({ item, colors, customCategories }) {
  const s = makeStyles(colors, {});
  const meta = getCategoryMeta(item.category, customCategories);
  const isExpense = item.type === 'expense';
  return (
    <View style={s.row}>
      <View style={[s.iconCircle, { backgroundColor: meta.color + '22' }]}>
        <Ionicons name={meta.icon} size={rs(17)} color={meta.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {item.payee_name || item.note || item.category}
        </Text>
        <Text style={s.rowSubtitle} numberOfLines={1}>
          {item.category} · {new Date(item.created_at).toLocaleDateString()}
          {item.status === 'pending' ? ' · Pending' : ''}
        </Text>
      </View>
      <Text style={[s.rowAmount, { color: isExpense ? colors.danger : colors.success }]}>
        {isExpense ? '-' : '+'}₹{Number(item.amount).toFixed(2)}
      </Text>
    </View>
  );
}

function makeStyles(c, insets = {}) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      paddingTop: insets.top ?? 0,
      paddingLeft: insets.left ?? 0,
      paddingRight: insets.right ?? 0,
    },
    header:          { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    balanceCard:     {
      backgroundColor: c.accent,
      borderRadius: radius.xl,
      padding: spacing.xl,
    },
    balanceLabel:    { color: c.accentText + 'AA', fontSize: fontSize.sm },
    balanceValue:    { color: c.accentText, fontSize: ms(34), fontWeight: '700', marginTop: spacing.xs },
    balanceRow:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl },
    balanceSubLabel: { color: c.accentText + 'AA', fontSize: fontSize.xs },
    balanceSubValue: { fontSize: fontSize.lg, fontWeight: '600', marginTop: spacing.xs },
    actionsRow:      { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    actionButton:    {
      flex: 1,
      backgroundColor: c.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: rs(48),
    },
    secondaryAction: { backgroundColor: c.cardAlt },
    actionText:      { color: c.accentText, fontWeight: '600', fontSize: fontSize.md },
    pendingBanner:   {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: c.warningBg,
      padding: spacing.md,
      borderRadius: radius.md,
      marginTop: spacing.lg,
    },
    pendingText:     { color: c.warningText, fontWeight: '500', fontSize: fontSize.sm, flex: 1 },
    sectionTitle:    { fontSize: fontSize.md, fontWeight: '700', color: c.text, marginTop: spacing.xl, marginBottom: spacing.sm },
    row:             {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    iconCircle:      { width: rs(40), height: rs(40), borderRadius: rs(20), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    rowTitle:        { fontSize: fontSize.md, fontWeight: '600', color: c.text },
    rowSubtitle:     { fontSize: fontSize.xs, color: c.textFaint, marginTop: 2 },
    rowAmount:       { fontSize: fontSize.md, fontWeight: '700', flexShrink: 0 },
    streakBadge:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.warningBg, padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.md },
    streakEmoji:     { fontSize: fontSize.lg },
    streakText:      { fontSize: fontSize.sm, fontWeight: '600', color: c.warningText, flex: 1 },
    emptyText:       { textAlign: 'center', color: c.textHint, marginTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  });
}
