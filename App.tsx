import React, { useState, useEffect } from 'react';
import { StatusBar, TouchableOpacity, View, Text, Image, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

// ─── Screens ──────────────────────────────────────────────────────────────────
import LoginScreen from './src/screens/LoginScreen';
import WorkOrdersScreen from './src/screens/WorkOrdersScreen';
import WorkOrderDetailScreen from './src/screens/WorkOrderDetailScreen';
import MapScreen from './src/screens/MapScreen';
import OverviewScreen from './src/screens/OverviewScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// ─── Arka plan konum görevi — import yalnızca TaskManager'a kaydettirmek için ─
import './src/tasks/locationTask';
import { LOCATION_TASK_NAME, pushLocationToBackend } from './src/tasks/locationTask';

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
const FOREGROUND_INTERVAL = 5 * 60 * 1000; // 5 dakika (Expo Go fallback)

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const foregroundTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { checkLoginStatus(); }, []);

  const checkLoginStatus = async () => {
    try {
      const token      = await SecureStore.getItemAsync('user_token');
      const rememberMe = await SecureStore.getItemAsync('remember_me');
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
    stopForegroundTimer();
    await stopBackgroundLocation();
    await SecureStore.deleteItemAsync('user_token');
    await SecureStore.deleteItemAsync('user_id');
    await SecureStore.deleteItemAsync('user_name');
    await SecureStore.deleteItemAsync('remember_me');
    setAuthState('unauthenticated');
  };

  // ── Konum gönder (arka plan görevinden bağımsız, her zaman çalışır) ──────────
  const sendCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await pushLocationToBackend(loc.coords.latitude, loc.coords.longitude);
    } catch (err) {
      console.warn('[App] Anlık konum gönderilemedi:', err);
    }
  };

  // ── Ön plan timer — Expo Go'da arka plan görevi çalışmadığında devreye girer ─
  const startForegroundTimer = () => {
    if (foregroundTimerRef.current) return;
    foregroundTimerRef.current = setInterval(sendCurrentLocation, FOREGROUND_INTERVAL);
  };

  const stopForegroundTimer = () => {
    if (foregroundTimerRef.current) {
      clearInterval(foregroundTimerRef.current);
      foregroundTimerRef.current = null;
    }
  };

  // ── Arka plan görevi — sadece production APK'da tam çalışır ─────────────────
  const startBackgroundLocation = async () => {
    try {
      const { status: bg } = await Location.requestBackgroundPermissionsAsync();
      if (bg !== 'granted') return;
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!isRunning) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: FOREGROUND_INTERVAL,
          distanceInterval: 50,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Görev Adamı',
            notificationBody: 'Konum takibi aktif',
            notificationColor: '#F97316',
          },
        });
      }
    } catch {
      // Expo Go'da beklenen hata — sessiz geç
    }
  };

  const stopBackgroundLocation = async () => {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
      // sessiz geç
    }
  };

  // Kimlik doğrulandığında konum takibini başlat
  useEffect(() => {
    if (authState === 'authenticated') {
      sendCurrentLocation();        // Hemen bir kez gönder
      startForegroundTimer();       // Ön plan timer'ı başlat (Expo Go dahil)
      startBackgroundLocation();    // Arka plan görevi dene (APK'da çalışır)
    } else {
      stopForegroundTimer();
    }
  }, [authState]);

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
