import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WalletProvider, useWallet } from './src/context/WalletContext';
import AppNavigator from './src/navigation/AppNavigator';

// Renders a spinner until the SQLite DB is ready
function AppContent() {
  const { ready } = useWallet();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }
  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <AppContent />
      </WalletProvider>
    </SafeAreaProvider>
  );
}
