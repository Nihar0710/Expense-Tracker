import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { rs } from '../utils/layout';

import HomeScreen         from '../screens/HomeScreen';
import ScanScreen         from '../screens/ScanScreen';
import PayScreen          from '../screens/PayScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import BudgetScreen       from '../screens/BudgetScreen';
import SettingsScreen     from '../screens/SettingsScreen';
import RecurringScreen    from '../screens/RecurringScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab bar content height (above the system nav bar)
const TAB_CONTENT_HEIGHT = rs(56);
const TAB_PADDING_TOP    = rs(8);

function Tabs() {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();

  // Bottom inset = height of Android gesture bar / 3-button nav bar, or iOS home indicator.
  // We add this on top of our desired content height so the tab icons always sit above it.
  const bottomInset      = insets.bottom;
  const tabBarHeight     = TAB_CONTENT_HEIGHT + bottomInset;
  const tabBarPaddingBot = bottomInset + rs(4); // a bit of breathing room above the bar

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textHint,
        tabBarStyle: {
          backgroundColor:  colors.card,
          borderTopColor:   colors.border,
          borderTopWidth:   StyleSheet.hairlineWidth,
          height:           tabBarHeight,
          paddingBottom:    tabBarPaddingBot,
          paddingTop:       TAB_PADDING_TOP,
          // Disable React Navigation's own safe-area handling — we do it manually
          // so it works consistently on both gesture-nav and 3-button Android.
          paddingLeft:      insets.left,
          paddingRight:     insets.right,
        },
        // Tell React Navigation NOT to add its own extra bottom inset —
        // we've already baked it into paddingBottom above.
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home:         'home',
            Transactions: 'list',
            Budget:       'pie-chart',
            Settings:     'settings-sharp',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"         component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Budget"       component={BudgetScreen} />
      <Tab.Screen name="Settings"     component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors, scheme } = useTheme();

  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card:       colors.card,
      text:       colors.text,
      border:     colors.border,
    },
  };

  const headerStyle = {
    headerStyle:      { backgroundColor: colors.card },
    headerTintColor:  colors.text,
    headerTitleStyle: { color: colors.text },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs"      component={Tabs}            options={{ headerShown: false }} />
        <Stack.Screen name="Scan"      component={ScanScreen}      options={{ title: 'Scan QR', ...headerStyle }} />
        <Stack.Screen name="Pay"       component={PayScreen}       options={{ title: 'Pay',     ...headerStyle }} />
        <Stack.Screen name="Recurring" component={RecurringScreen} options={{ title: 'Recurring Payments', ...headerStyle }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
