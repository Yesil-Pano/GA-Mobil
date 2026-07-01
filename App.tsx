import React, { useState, useEffect } from 'react';
import { StatusBar, TouchableOpacity, View, Text, Image, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

// ─── Screens ──────────────────────────────────────────────────────────────────
import LoginScreen from './src/screens/LoginScreen';
import WorkOrdersScreen from './src/screens/WorkOrdersScreen';
import WorkOrderDetailScreen from './src/screens/WorkOrderDetailScreen';
import MapScreen from './src/screens/MapScreen';
import OverviewScreen from './src/screens/OverviewScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// ─── Types ────────────────────────────────────────────────────────────────────
import type { WorkOrdersStackParamList, RootTabParamList } from './src/types';

// ─── Navigators ───────────────────────────────────────────────────────────────
const Tab   = createBottomTabNavigator<RootTabParamList>();
const WOStack = createNativeStackNavigator<WorkOrdersStackParamList>();

/** İş Emirleri tab: list → detail stack */
function WorkOrdersNavigator() {
  return (
    <WOStack.Navigator screenOptions={{ headerShown: false }}>
      <WOStack.Screen name="WorkOrdersList"   component={WorkOrdersScreen} />
      <WOStack.Screen name="WorkOrderDetail"  component={WorkOrderDetailScreen} />
    </WOStack.Navigator>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => { checkLoginStatus(); }, []);

  const checkLoginStatus = async () => {
    try {
      const token      = await SecureStore.getItemAsync('user_token');
      const rememberMe = await SecureStore.getItemAsync('remember_me');

      // Auto-login only if user chose "remember me" and a token is stored
      if (token && rememberMe === 'true') {
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    } catch {
      setAuthState('unauthenticated');
    }
  };

  const handleLoginSuccess = () => setAuthState('authenticated');

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('user_token');
    await SecureStore.deleteItemAsync('user_id');
    await SecureStore.deleteItemAsync('user_name');
    await SecureStore.deleteItemAsync('remember_me');
    setAuthState('unauthenticated');
  };

  // ── Splash / loading state ──────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B132B', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 14 }}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#1A233A" />

      {authState === 'unauthenticated' ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Tab.Navigator
          screenOptions={({ route }) => ({
            // ── Icons ────────────────────────────────────────────────────────
            tabBarIcon: ({ focused, color, size }) => {
              const icons: Record<string, [string, string]> = {
                'İş Emirleri': ['clipboard',    'clipboard-outline'],
                'Harita':      ['map',          'map-outline'],
                'Genel Bakış': ['grid',         'grid-outline'],
                'Sohbet':      ['chatbubble',   'chatbubble-outline'],
                'Profil':      ['person',       'person-outline'],
              };
              const [activeIcon, inactiveIcon] = icons[route.name] ?? ['list', 'list-outline'];
              return (
                <Ionicons
                  name={(focused ? activeIcon : inactiveIcon) as any}
                  size={size}
                  color={color}
                />
              );
            },
            // ── Colours ──────────────────────────────────────────────────────
            tabBarActiveTintColor:   '#F97316',
            tabBarInactiveTintColor: '#94A3B8',
            tabBarStyle: {
              backgroundColor: '#1A233A',
              borderTopWidth: 0,
              paddingBottom: 5,
            },
            // ── Header ────────────────────────────────────────────────────────
            headerStyle: { backgroundColor: '#1A233A', elevation: 0, shadowOpacity: 0 },
            headerTintColor: '#fff',
            headerTitle: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image
                  source={require('./assets/logo.png')}
                  style={{ width: 30, height: 30, marginRight: 10 }}
                  resizeMode="contain"
                />
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.8 }}>
                  GÖREV ADAMI
                </Text>
              </View>
            ),
            headerRight: () => (
              <View style={{ flexDirection: 'row', marginRight: 14, alignItems: 'center' }}>
                <TouchableOpacity style={{ marginRight: 18 }}>
                  <Ionicons name="notifications-outline" size={23} color="#fff" />
                  <View
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -3,
                      backgroundColor: '#EF4444',
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                    }}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogout}>
                  <Ionicons name="power-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            ),
          })}
        >
          {/* ── İş Emirleri (nested stack: list + detail) ─── */}
          <Tab.Screen
            name="İş Emirleri"
            component={WorkOrdersNavigator}
            options={{ headerShown: true }}
          />

          {/* ── Harita ─── */}
          <Tab.Screen name="Harita" component={MapScreen} />

          {/* ── Genel Bakış ─── */}
          <Tab.Screen name="Genel Bakış" component={OverviewScreen} />

          {/* ── Sohbet ─── */}
          <Tab.Screen name="Sohbet" component={ChatScreen} />

          {/* ── Profil (needs onLogout prop) ─── */}
          <Tab.Screen name="Profil">
            {() => <ProfileScreen onLogout={handleLogout} />}
          </Tab.Screen>
        </Tab.Navigator>
      )}
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
