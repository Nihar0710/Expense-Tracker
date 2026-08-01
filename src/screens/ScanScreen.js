import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { parseUpiUri } from '../utils/upi';
import { rs, spacing, fontSize, radius } from '../utils/layout';

export default function ScanScreen({ navigation }) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]           = useState(false);
  const [scanning, setScanning]         = useState(false); // image processing indicator

  // ── Handle live camera scan ──────────────────────────────────────────────
  const handleScan = ({ data }) => {
    if (scanned || scanning) return;
    setScanned(true);
    navigateIfValid(data);
  };

  // ── Pick image from gallery and decode its QR ────────────────────────────
  const handlePickImage = async () => {
    if (scanning) return;

    // Ask for media-library permission via image picker
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Allow access to your photos to scan QR codes from images.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    setScanning(true);
    try {
      const uri      = result.assets[0].uri;
      const scanned  = await scanFromURLAsync(uri, ['qr']);

      if (!scanned || scanned.length === 0) {
        Alert.alert('No QR found', 'No QR code was detected in this image. Try a clearer photo.');
        return;
      }

      // Use the first QR code found in the image
      navigateIfValid(scanned[0].data);
    } catch (e) {
      Alert.alert('Scan failed', 'Could not read the image. Please try another photo.');
    } finally {
      setScanning(false);
    }
  };

  // ── Navigate if it's a valid UPI QR, else show error ────────────────────
  const navigateIfValid = (data) => {
    const parsed = parseUpiUri(data);
    if (!parsed || !parsed.payeeAddress) {
      Alert.alert(
        'Not a UPI QR',
        'This QR code doesn\'t contain a valid UPI payment link.',
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );
      return;
    }
    navigation.navigate('Pay', {
      upiId:     parsed.payeeAddress,
      payeeName: parsed.payeeName,
      amount:    parsed.amount,
      note:      parsed.note,
    });
  };

  // ── Permission not yet determined ────────────────────────────────────────
  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  // ── Camera permission denied — still allow image upload ──────────────────
  if (!permission.granted) {
    return (
      <SafeAreaView style={permStyles.center}>
        <Ionicons name="camera-off-outline" size={rs(52)} color="#fff" style={{ marginBottom: spacing.lg }} />
        <Text style={permStyles.title}>Camera access denied</Text>
        <Text style={permStyles.sub}>
          Grant camera permission to scan live, or pick a QR code image from your gallery.
        </Text>
        <TouchableOpacity style={permStyles.primaryBtn} onPress={requestPermission}>
          <Text style={permStyles.primaryBtnText}>Grant camera permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={permStyles.secondaryBtn} onPress={handlePickImage} disabled={scanning}>
          {scanning
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="image-outline" size={rs(18)} color="#fff" style={{ marginRight: spacing.sm }} />
                <Text style={permStyles.secondaryBtnText}>Upload QR image</Text>
              </>
          }
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Main scanner UI ──────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Full-screen live camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned || scanning ? undefined : handleScan}
      />

      {/* Dark vignette overlay with transparent scan window */}
      <View style={overlayStyles.root} pointerEvents="none">
        {/* Top dark area */}
        <View style={overlayStyles.topMask} />

        {/* Middle row: left mask | transparent window | right mask */}
        <View style={overlayStyles.middleRow}>
          <View style={overlayStyles.sideMask} />
          <View style={overlayStyles.window}>
            {/* Corner markers */}
            <View style={[overlayStyles.corner, overlayStyles.topLeft]} />
            <View style={[overlayStyles.corner, overlayStyles.topRight]} />
            <View style={[overlayStyles.corner, overlayStyles.bottomLeft]} />
            <View style={[overlayStyles.corner, overlayStyles.bottomRight]} />
          </View>
          <View style={overlayStyles.sideMask} />
        </View>

        {/* Bottom dark area */}
        <View style={overlayStyles.bottomMask} />
      </View>

      {/* Hint text below scan frame */}
      <View style={uiStyles.hintWrap} pointerEvents="none">
        {scanning
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={uiStyles.hint}>
              {scanned ? 'Reading QR…' : 'Point at a UPI QR code'}
            </Text>
        }
      </View>

      {/* Bottom toolbar — GPay-style "Upload QR" button */}
      <View style={uiStyles.toolbar}>
        <TouchableOpacity
          style={uiStyles.uploadBtn}
          onPress={handlePickImage}
          activeOpacity={0.8}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="image-outline" size={rs(20)} color="#fff" />
              <Text style={uiStyles.uploadText}>Upload QR image</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const WIN  = rs(240); // scan window size
const CORN = rs(20);  // corner bar length
const CW   = rs(3);   // corner bar thickness

const overlayStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  topMask:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  middleRow:  { flexDirection: 'row', height: WIN },
  sideMask:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  window:     { width: WIN, height: WIN },  // transparent
  bottomMask: { flex: 1.5, backgroundColor: 'rgba(0,0,0,0.55)' },

  // Corner brackets
  corner: { position: 'absolute', width: CORN, height: CORN },
  topLeft:     { top: 0,    left: 0,    borderTopWidth: CW,    borderLeftWidth: CW,    borderColor: '#fff', borderTopLeftRadius: rs(6) },
  topRight:    { top: 0,    right: 0,   borderTopWidth: CW,    borderRightWidth: CW,   borderColor: '#fff', borderTopRightRadius: rs(6) },
  bottomLeft:  { bottom: 0, left: 0,    borderBottomWidth: CW, borderLeftWidth: CW,    borderColor: '#fff', borderBottomLeftRadius: rs(6) },
  bottomRight: { bottom: 0, right: 0,   borderBottomWidth: CW, borderRightWidth: CW,   borderColor: '#fff', borderBottomRightRadius: rs(6) },
});

const uiStyles = StyleSheet.create({
  hintWrap: {
    position: 'absolute',
    left: 0, right: 0,
    // sits just below the scan window — top + WIN + some gap
    top: '50%',
    marginTop: WIN / 2 + rs(16),
    alignItems: 'center',
  },
  hint: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  toolbar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingBottom: rs(48),
    paddingTop: spacing.xl,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: rs(180),
    justifyContent: 'center',
    minHeight: rs(48),
  },
  uploadText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: '600',
  },
});

// Permission-denied screen styles (dark bg, white text — same camera aesthetic)
const permStyles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  title: {
    color: '#fff',
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: fontSize.md * 1.6,
    marginBottom: spacing.xxl,
  },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: radius.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    minHeight: rs(50),
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: fontSize.base,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    minHeight: rs(50),
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
});
