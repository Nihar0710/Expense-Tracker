import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Share, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { buildUpiUri, isValidUpiId } from '../utils/upi';
import { spacing, fontSize, radius, rs } from '../utils/layout';

export default function ReceiveScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [upiId, setUpiId]     = useState('');
  const [name, setName]       = useState('');
  const [amount, setAmount]   = useState('');
  const [note, setNote]       = useState('');
  const [generated, setGenerated] = useState(false);
  const [qrValue, setQrValue] = useState('');

  const generate = () => {
    if (!isValidUpiId(upiId)) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID, e.g. name@bank');
      return;
    }
    const uri = buildUpiUri({
      payeeAddress: upiId,
      payeeName: name,
      amount: amount || undefined,
      note: note || undefined,
    });
    setQrValue(uri);
    setGenerated(true);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Pay me via UPI:\nID: ${upiId}${name ? `\nName: ${name}` : ''}${amount ? `\nAmount: ₹${amount}` : ''}${note ? `\nNote: ${note}` : ''}\n\nLink: ${qrValue}`,
      });
    } catch (_) {}
  };

  const s = makeStyles(colors, insets);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {generated ? (
          <View style={s.qrSection}>
            <Text style={s.qrTitle}>Scan to pay {name || upiId}</Text>
            {amount ? <Text style={s.qrAmount}>₹{amount}</Text> : null}
            <View style={s.qrBox}>
              <QRCode
                value={qrValue}
                size={rs(220)}
                color={colors.text}
                backgroundColor={colors.card}
              />
            </View>
            <Text style={s.qrUpiId}>{upiId}</Text>
            <View style={s.actionRow}>
              <TouchableOpacity style={[s.btn, s.secondaryBtn]} onPress={() => setGenerated(false)}>
                <Ionicons name="pencil-outline" size={rs(16)} color={colors.accent} />
                <Text style={[s.btnText, { color: colors.accent }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.primaryBtn]} onPress={handleShare}>
                <Ionicons name="share-outline" size={rs(16)} color={colors.accentText} />
                <Text style={[s.btnText, { color: colors.accentText }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <Text style={s.sectionTitle}>Generate Payment QR</Text>
            <Text style={s.label}>Your UPI ID *</Text>
            <TextInput
              style={s.input}
              value={upiId}
              onChangeText={setUpiId}
              placeholder="yourname@bank"
              placeholderTextColor={colors.textHint}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={s.label}>Your name (optional)</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Nihar"
              placeholderTextColor={colors.textHint}
            />
            <Text style={s.label}>Amount ₹ (optional)</Text>
            <TextInput
              style={s.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="Leave blank to let payer choose"
              placeholderTextColor={colors.textHint}
              keyboardType="decimal-pad"
            />
            <Text style={s.label}>Note (optional)</Text>
            <TextInput
              style={s.input}
              value={note}
              onChangeText={setNote}
              placeholder="What's this for?"
              placeholderTextColor={colors.textHint}
            />
            <TouchableOpacity style={s.generateBtn} onPress={generate}>
              <Ionicons name="qr-code-outline" size={rs(18)} color={colors.accentText} />
              <Text style={s.generateBtnText}>Generate QR Code</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    scroll:       { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.lg) },
    sectionTitle: { fontSize: fontSize.xl, fontWeight: '700', color: c.text, marginBottom: spacing.xl },
    label:        { fontSize: fontSize.sm, fontWeight: '600', color: c.textMuted, marginBottom: spacing.xs, marginTop: spacing.md },
    input:        {
      borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      fontSize: fontSize.base, color: c.text, backgroundColor: c.card, minHeight: rs(50),
    },
    generateBtn:  {
      backgroundColor: c.accent, borderRadius: radius.lg, paddingVertical: spacing.lg,
      alignItems: 'center', marginTop: spacing.xxl, flexDirection: 'row',
      justifyContent: 'center', gap: spacing.sm, minHeight: rs(54),
    },
    generateBtnText: { color: c.accentText, fontSize: fontSize.lg, fontWeight: '700' },
    // QR section
    qrSection:    { alignItems: 'center', paddingTop: spacing.lg },
    qrTitle:      { fontSize: fontSize.lg, fontWeight: '700', color: c.text, marginBottom: spacing.sm },
    qrAmount:     { fontSize: rs(32), fontWeight: '700', color: c.accent, marginBottom: spacing.md },
    qrBox:        {
      backgroundColor: c.card, padding: spacing.xl,
      borderRadius: radius.xl, marginVertical: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    qrUpiId:      { fontSize: fontSize.md, color: c.textFaint, marginBottom: spacing.xl },
    actionRow:    { flexDirection: 'row', gap: spacing.md, width: '100%' },
    btn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.lg, minHeight: rs(50) },
    primaryBtn:   { backgroundColor: c.accent },
    secondaryBtn: { backgroundColor: c.cardAlt },
    btnText:      { fontWeight: '600', fontSize: fontSize.base },
  });
}
