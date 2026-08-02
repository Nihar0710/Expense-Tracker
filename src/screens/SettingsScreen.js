import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, fontSize, radius, useTabBarHeight, rs } from '../utils/layout';

// Safe-load — avoids crash if expo-secure-store native module unavailable
let hasPinSet = async () => false;
try { hasPinSet = require('./LockScreen').hasPinSet; } catch (_) {}

const THEME_OPTIONS = [
  { label: 'Follow system', value: 'system', icon: 'phone-portrait-outline' },
  { label: 'Light',         value: 'light',  icon: 'sunny-outline' },
  { label: 'Dark',          value: 'dark',   icon: 'moon-outline' },
];

export default function SettingsScreen({ navigation }) {
  const { colors, pref, setPref } = useTheme();
  const insets    = useSafeAreaInsets();
  const bottomPad = useTabBarHeight();
  const [pinSet, setPinSet] = useState(false);
  const s = makeStyles(colors, insets);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      setPinSet(await hasPinSet());
    });
    return unsubscribe;
  }, [navigation]);

  const SettingsRow = ({ icon, label, value, onPress, chevron = true, last = false }) => (
    <TouchableOpacity
      style={[s.row, !last && s.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={s.rowLeft}>
        <View style={[s.iconBox, { backgroundColor: colors.cardAlt }]}>
          <Ionicons name={icon} size={rs(18)} color={colors.textFaint} />
        </View>
        <Text style={s.rowLabel}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
        {chevron && <Ionicons name="chevron-forward" size={rs(16)} color={colors.textHint} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        <Text style={s.pageTitle}>Settings</Text>

        {/* ── Appearance ─────────────────────────────────── */}
        <Text style={s.sectionLabel}>Appearance</Text>
        <View style={s.card}>
          {THEME_OPTIONS.map((opt, idx) => {
            const active = pref === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[s.row, idx < THEME_OPTIONS.length - 1 && s.rowBorder]}
                onPress={() => setPref(opt.value)}
                activeOpacity={0.7}
              >
                <View style={s.rowLeft}>
                  <View style={[s.iconBox, { backgroundColor: active ? colors.accent + '22' : colors.cardAlt }]}>
                    <Ionicons name={opt.icon} size={rs(18)} color={active ? colors.accent : colors.textFaint} />
                  </View>
                  <Text style={[s.rowLabel, active && { color: colors.accent, fontWeight: '700' }]}>
                    {opt.label}
                  </Text>
                </View>
                {active
                  ? <Ionicons name="checkmark-circle" size={rs(20)} color={colors.accent} />
                  : <View style={s.uncheck} />
                }
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Security ───────────────────────────────────── */}
        <Text style={s.sectionLabel}>Security</Text>
        <View style={s.card}>
          <SettingsRow
            icon="lock-closed-outline"
            label="App Lock (PIN / Biometric)"
            value={pinSet ? 'On' : 'Off'}
            onPress={() => navigation.navigate('PinSetup')}
            last
          />
        </View>

        {/* ── Payments ───────────────────────────────────── */}
        <Text style={s.sectionLabel}>Payments</Text>
        <View style={s.card}>
          <SettingsRow icon="repeat" label="Recurring payments" onPress={() => navigation.navigate('Recurring')} />
          <SettingsRow icon="alarm-outline" label="Bill reminders" onPress={() => navigation.navigate('Bills')} last />
        </View>

        {/* ── Finance ────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Finance</Text>
        <View style={s.card}>
          <SettingsRow icon="trophy-outline" label="Savings goals" onPress={() => navigation.navigate('Goals')} />
          <SettingsRow icon="people-outline" label="Split expenses" onPress={() => navigation.navigate('Split')} />
          <SettingsRow icon="bar-chart-outline" label="Monthly report" onPress={() => navigation.navigate('Report')} last />
        </View>

        {/* ── About ──────────────────────────────────────── */}
        <Text style={s.sectionLabel}>About</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={[s.iconBox, { backgroundColor: colors.cardAlt }]}>
                <Ionicons name="information-circle-outline" size={rs(18)} color={colors.textFaint} />
              </View>
              <Text style={s.rowLabel}>Version</Text>
            </View>
            <Text style={s.rowValue}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingLeft: Math.max(spacing.lg, insets.left), paddingRight: Math.max(spacing.lg, insets.right) },
    pageTitle:    { fontSize: fontSize.xl, fontWeight: '700', color: c.text, marginTop: spacing.lg, marginBottom: spacing.xl },
    sectionLabel: { fontSize: fontSize.xs, fontWeight: '600', color: c.textHint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, marginLeft: spacing.xs },
    card:         { backgroundColor: c.card, borderRadius: radius.lg, marginBottom: spacing.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, overflow: 'hidden' },
    row:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: rs(54) },
    rowBorder:    { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowLeft:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
    iconBox:      { width: rs(34), height: rs(34), borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    rowLabel:     { fontSize: fontSize.base, color: c.text },
    rowValue:     { fontSize: fontSize.md, color: c.textFaint },
    uncheck:      { width: rs(20), height: rs(20), borderRadius: rs(10), borderWidth: 1.5, borderColor: c.border },
  });
}
