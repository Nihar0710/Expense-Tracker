import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import {
  computeSpendingPatterns,
  getAvgMonthlyExpense,
  detectSubscriptions,
  getSavingsGoals,
  addSavingsGoal,
} from '../db/database';
import { spacing, fontSize, radius, rs } from '../utils/layout';

const MULTIPLIERS = [3, 6, 9, 12];

export default function InsightsScreen({ navigation }) {
  const { colors } = useTheme();
  const { transactions } = useWallet();
  const insets = useSafeAreaInsets();

  const [patterns, setPatterns]       = useState(null);
  const [avgMonthly, setAvgMonthly]   = useState(null);
  const [multiplier, setMultiplier]   = useState(6);
  const [subscriptions, setSubs]      = useState([]);
  const [goals, setGoals]             = useState([]);

  useEffect(() => {
    const p = computeSpendingPatterns(transactions);
    setPatterns(p);
  }, [transactions]);

  useEffect(() => {
    getAvgMonthlyExpense().then(setAvgMonthly);
    detectSubscriptions().then(setSubs);
    getSavingsGoals().then(setGoals);
  }, []);

  const emergencyTarget = avgMonthly ? avgMonthly * multiplier : null;
  const totalSubSpend = subscriptions.reduce((s, sub) => s + sub.monthlyEquivalent, 0);

  const s = makeStyles(colors, insets);

  const InsightCard = ({ icon, title, children, color }) => (
    <View style={[s.card, color && { borderLeftWidth: rs(3), borderLeftColor: color }]}>
      <View style={s.cardHeader}>
        <Ionicons name={icon} size={rs(18)} color={color || colors.accent} />
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* ── Spending patterns ── */}
        <Text style={s.sectionTitle}>Spending patterns</Text>
        {patterns ? (
          <InsightCard icon="analytics-outline" title="Your habits" color={colors.accent}>
            {patterns.weekendPct !== 0 && (
              <Text style={s.insightText}>
                {patterns.weekendPct > 0
                  ? `📅 You spend ${patterns.weekendPct}% more on weekends than weekdays.`
                  : `📅 You spend ${Math.abs(patterns.weekendPct)}% less on weekends.`}
              </Text>
            )}
            {patterns.impulseCategory && (
              <Text style={s.insightText}>
                🏷️ <Text style={{ fontWeight: '600' }}>{patterns.impulseCategory}</Text> is your most frequent category — {patterns.impulseCount} transactions.
              </Text>
            )}
            <Text style={s.insightText}>
              🕐 You spend most in the <Text style={{ fontWeight: '600' }}>{patterns.topHour}</Text>.
            </Text>
          </InsightCard>
        ) : (
          <Text style={s.noData}>Add more transactions to see patterns.</Text>
        )}

        {/* ── Subscription audit ── */}
        <Text style={s.sectionTitle}>Detected subscriptions</Text>
        {subscriptions.length > 0 ? (
          <>
            <InsightCard icon="repeat-outline" title={`${subscriptions.length} recurring charges · ₹${totalSubSpend.toFixed(0)}/mo total`} color={colors.warningIcon}>
              {subscriptions.map((sub) => (
                <View key={sub.name} style={s.subRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.subName} numberOfLines={1}>{sub.name}</Text>
                    <Text style={s.subFreq}>{sub.frequency} · {sub.occurrences} occurrences</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.subAmt}>₹{sub.monthlyEquivalent.toFixed(0)}/mo</Text>
                    {sub.priceChanged && (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>Price changed</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </InsightCard>
          </>
        ) : (
          <Text style={s.noData}>No recurring subscriptions detected yet.</Text>
        )}

        {/* ── Emergency fund ── */}
        <Text style={s.sectionTitle}>Emergency fund</Text>
        <InsightCard icon="shield-checkmark-outline" title="How much should you save?" color={colors.success}>
          <Text style={[s.insightText, { marginBottom: spacing.sm }]}>
            Based on your avg monthly spend of{' '}
            <Text style={{ fontWeight: '700' }}>₹{(avgMonthly ?? 0).toFixed(0)}</Text>
          </Text>
          <View style={s.multiplierRow}>
            {MULTIPLIERS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.mChip, multiplier === m && s.mChipActive]}
                onPress={() => setMultiplier(m)}
              >
                <Text style={[s.mChipText, multiplier === m && s.mChipTextActive]}>{m}mo</Text>
              </TouchableOpacity>
            ))}
          </View>
          {emergencyTarget != null && (
            <Text style={[s.bigNumber, { color: colors.success }]}>₹{emergencyTarget.toFixed(0)}</Text>
          )}
          {emergencyTarget != null && (
            <TouchableOpacity
              style={s.linkBtn}
              onPress={() => navigation.navigate('Goals')}
            >
              <Ionicons name="trophy-outline" size={rs(15)} color={colors.accent} />
              <Text style={s.linkBtnText}>Track in Savings Goals →</Text>
            </TouchableOpacity>
          )}
        </InsightCard>

      </ScrollView>
    </View>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: c.bg, paddingTop: insets.top },
    content:        { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
    sectionTitle:   { fontSize: fontSize.base, fontWeight: '700', color: c.text, marginTop: spacing.xl, marginBottom: spacing.sm },
    card:           { backgroundColor: c.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    cardTitle:      { fontSize: fontSize.md, fontWeight: '600', color: c.text, flex: 1 },
    insightText:    { fontSize: fontSize.sm, color: c.textMuted, lineHeight: fontSize.sm * 1.6, marginBottom: spacing.xs },
    noData:         { fontSize: fontSize.sm, color: c.textHint, textAlign: 'center', paddingVertical: spacing.lg },
    subRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    subName:        { fontSize: fontSize.md, fontWeight: '600', color: c.text },
    subFreq:        { fontSize: fontSize.xs, color: c.textFaint, marginTop: 2 },
    subAmt:         { fontSize: fontSize.md, fontWeight: '700', color: c.text },
    badge:          { backgroundColor: c.warningBg, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, marginTop: 2 },
    badgeText:      { fontSize: fontSize.xs - 1, color: c.warningText, fontWeight: '600' },
    multiplierRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    mChip:          { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: c.cardAlt },
    mChipActive:    { backgroundColor: c.success },
    mChipText:      { fontSize: fontSize.sm, color: c.textMuted, fontWeight: '500' },
    mChipTextActive:{ color: '#fff', fontWeight: '700' },
    bigNumber:      { fontSize: rs(36), fontWeight: '700', textAlign: 'center', marginVertical: spacing.md },
    linkBtn:        { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center', paddingTop: spacing.sm },
    linkBtnText:    { fontSize: fontSize.sm, color: c.accent, fontWeight: '600' },
  });
}
