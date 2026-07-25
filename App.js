import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HomeScreen from './src/screens/HomeScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { COLORS, FONT_SIZES } from './src/constants/theme';
import { Text } from 'react-native';
import { requestSmsPermissions, startSmsListener, stopSmsListener } from './src/utils/smsReader';


const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export default function App() {
  useEffect(() => {
    // Request SMS permissions then start the real-time listener.
    // stopSmsListener is called on unmount to unregister the broadcast receiver.
    let started = false;

    requestSmsPermissions().then((granted) => {
      if (granted) {
        startSmsListener();
        started = true;
      } else {
        console.warn('[App] SMS permissions not granted — background listener inactive.');
      }
    });

    return () => {
      if (started) stopSmsListener();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" backgroundColor={COLORS.background} />
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: styles.tabBar,
              tabBarActiveTintColor: COLORS.primary,
              tabBarInactiveTintColor: COLORS.textMuted,
              tabBarLabelStyle: styles.tabLabel,
              tabBarHideOnKeyboard: true,
            }}
          >
            <Tab.Screen
              name="Home"
              component={HomeScreen}
              options={{
                tabBarLabel: 'Home',
                tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
              }}
            />
            <Tab.Screen
              name="Insights"
              component={InsightsScreen}
              options={{
                tabBarLabel: 'Insights',
                tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
              }}
            />
            <Tab.Screen
              name="Budget"
              component={BudgetScreen}
              options={{
                tabBarLabel: 'Budget',
                tabBarIcon: ({ focused }) => <TabIcon emoji="💰" focused={focused} />,
              }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                tabBarLabel: 'Settings',
                tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
});
