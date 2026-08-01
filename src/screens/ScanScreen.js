import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseUpiUri } from '../utils/upi';

export default function ScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permissionText}>We need camera access to scan UPI QR codes.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    const parsed = parseUpiUri(data);
    if (!parsed || !parsed.payeeAddress) {
      // Not a valid UPI QR — let them try again after a short delay.
      setTimeout(() => setScanned(false), 1500);
      return;
    }

    navigation.navigate('Pay', {
      upiId: parsed.payeeAddress,
      payeeName: parsed.payeeName,
      amount: parsed.amount,
      note: parsed.note,
    });
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>Point your camera at a UPI QR code</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionText: { textAlign: 'center', fontSize: 15, color: '#374151', marginBottom: 16 },
  permissionButton: { backgroundColor: '#111827', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  permissionButtonText: { color: '#fff', fontWeight: '600' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: { color: '#fff', marginTop: 20, fontSize: 14 },
});
