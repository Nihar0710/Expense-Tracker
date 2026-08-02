import React from 'react';
import { StyleSheet } from 'react-native';
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
import ReceiveScreen      from '../screens/ReceiveScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import BudgetScreen       from '../screens/BudgetScreen';
import SettingsScreen     from '../screens/SettingsScreen';
import RecurringScreen    from '../screens/RecurringScreen';
import ReportScreen       from '../screens/ReportScreen';
import BillsScreen        from '../screens/BillsScreen';
import GoalsScreen        from '../screens/GoalsScreen';
import SplitScreen        from '../screens/SplitScreen';
import InsightsScreen     from '../screens/InsightsScreen';
import IouScreen          from '../screens/IouScreen';
import RecapScreen        from '../screens/RecapScreen';
import CashEntryScreen    from '../screens/CashEntryScreen';
import { PinSetupScreen } from '../screens/LockScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_CONTENT_HEIGHT = rs(56);
const TAB_PADDING_TOP    = rs(8);

function Tabs() {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  const bottomInset      = insets.bottom;
  const tabBarHeight     = TAB_CONTENT_HEIGHT + bottomInset;
  const tabBarPaddingBot = bottomInset + rs(4);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textHint,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor:  colors.border,
          borderTopWidth:  StyleSheet.hairlineWidth,
          height:          tabBarHeight,
          paddingBottom:   tabBarPaddingBot,
          paddingTop:      TAB_PADDING_TOP,
          paddingLeft:     insets.left,
          paddingRight:    insets.right,
        },
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

  const h = {
    headerStyle:      { backgroundColor: colors.card },
    headerTintColor:  colors.text,
    headerTitleStyle: { color: colors.text },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs"       component={Tabs}             options={{ headerShown: false }} />
        <Stack.Screen name="Scan"       component={ScanScreen}       options={{ title: 'Scan QR',              ...h }} />
        <Stack.Screen name="Pay"        component={PayScreen}        options={{ title: 'Pay',                  ...h }} />
        <Stack.Screen name="Receive"    component={ReceiveScreen}    options={{ title: 'Receive / Request',    ...h }} />
        <Stack.Screen name="CashEntry"  component={CashEntryScreen}  options={{ title: 'Log Cash Expense',     ...h }} />
        <Stack.Screen name="Recurring"  component={RecurringScreen}  options={{ title: 'Recurring Payments',   ...h }} />
        <Stack.Screen name="Report"     component={ReportScreen}     options={{ title: 'Monthly Report',       ...h }} />
        <Stack.Screen name="Bills"      component={BillsScreen}      options={{ title: 'Bill Reminders',       ...h }} />
        <Stack.Screen name="Goals"      component={GoalsScreen}      options={{ title: 'Savings Goals',        ...h }} />
        <Stack.Screen name="Split"      component={SplitScreen}      options={{ title: 'Split Expenses',       ...h }} />
        <Stack.Screen name="Insights"   component={InsightsScreen}   options={{ title: 'Insights',             ...h }} />
        <Stack.Screen name="Iou"        component={IouScreen}        options={{ title: 'IOU Tracker',          ...h }} />
        <Stack.Screen name="Recap"      component={RecapScreen}      options={{ title: 'Monthly Recap Card',   ...h }} />
        <Stack.Screen name="PinSetup"   component={PinSetupWrapper}  options={{ title: 'Security / PIN Lock',  ...h }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function PinSetupWrapper({ navigation }) {
  return <PinSetupScreen onDone={() => navigation.goBack()} onCancel={() => navigation.goBack()} />;
}
