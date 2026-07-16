import React, { useState, useEffect } from 'react';
import { StatusBar, TouchableOpacity, View, Text, Image, ActivityIndicator, AppState } from 'react-native';
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
import NotificationPanel from './src/components/NotificationPanel';
import { chatApi } from './src/services/api';

// ─── Arka plan konum görevi — import yalnızca TaskManager'a kaydettirmek için ─
import './src/tasks/locationTask';
import { LOCATION_TASK_NAME, pushLocationToBackend } from './src/tasks/locationTask';
import { resolveUserLocation } from './src/utils/location';

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

// ── Konum: pil dostu aralıklar (web "Güncelle" ile anlık çeker, mobil push tabanlı) ──
const LOCATION_INTERVAL_MS = 10 * 60 * 1000; // 10 dakika
const LOCATION_DISTANCE_M = 100;              // 100 metre hareket
const LOCATION_BOOTSTRAP_DELAY_MS = 6_000;      // Harita/WebView ile çakışmayı önle

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
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
      const loc = await resolveUserLocation({ preferCached: true, gpsTimeoutMs: 4_000 });
      if (loc) {
        await pushLocationToBackend(loc.latitude, loc.longitude);
      }
    } catch (err) {
      console.warn('[App] Anlık konum gönderilemedi:', err);
    }
  };

  // ── Ön plan timer — yalnızca arka plan görevi yoksa (Expo Go vb.) ─────────────
  const startForegroundTimer = async () => {
    if (foregroundTimerRef.current) return;

    let backgroundRunning = false;
    try {
      backgroundRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
      // sessiz geç
    }
    if (backgroundRunning) return;

    foregroundTimerRef.current = setInterval(sendCurrentLocation, LOCATION_INTERVAL_MS);
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
          accuracy: Location.Accuracy.Low,
          timeInterval: LOCATION_INTERVAL_MS,
          distanceInterval: LOCATION_DISTANCE_M,
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

  // Kimlik doğrulandığında konum takibini gecikmeli başlat (ilk açılışta Harita çökmesini önler)
  useEffect(() => {
    if (authState !== 'authenticated') {
      stopForegroundTimer();
      return;
    }

    const timer = setTimeout(() => {
      sendCurrentLocation();
      startForegroundTimer();
      startBackgroundLocation();
    }, LOCATION_BOOTSTRAP_DELAY_MS);

    return () => clearTimeout(timer);
  }, [authState]);

  // Sohbet okunmamış sayacı
  useEffect(() => {
    if (authState !== 'authenticated') {
      setChatUnread(0);
      return;
    }

    let cancelled = false;
    const refreshUnread = async () => {
      try {
        const { data } = await chatApi.unreadCount();
        if (!cancelled) setChatUnread(data?.count ?? 0);
      } catch {
        /* sessiz */
      }
    };

    refreshUnread();
    const interval = setInterval(refreshUnread, 45_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authState]);

  // Uygulama ön plana gelince tek seferlik konum gönder (düşük pil maliyeti)
  useEffect(() => {
    if (authState !== 'authenticated') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        sendCurrentLocation();
      }
    });

    return () => subscription.remove();
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
                <TouchableOpacity
                  style={{ marginRight: 18 }}
                  onPress={() => setNotificationsOpen(true)}
                  accessibilityLabel="Bildirimleri aç"
                >
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
          <Tab.Screen
            name="Sohbet"
            component={ChatScreen}
            options={{
              tabBarBadge: chatUnread > 0 ? chatUnread : undefined,
              tabBarBadgeStyle: {
                backgroundColor: '#EF4444',
                color: '#fff',
                fontSize: 10,
                minWidth: 16,
                height: 16,
                lineHeight: 14,
              },
            }}
            listeners={{
              focus: () => {
                chatApi.unreadCount()
                  .then(({ data }) => setChatUnread(data?.count ?? 0))
                  .catch(() => undefined);
              },
            }}
          />

          {/* ── Profil (needs onLogout prop) ─── */}
          <Tab.Screen name="Profil">
            {() => <ProfileScreen onLogout={handleLogout} />}
          </Tab.Screen>
        </Tab.Navigator>
      )}
      <NotificationPanel visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
