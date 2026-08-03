import React, { useState, useEffect } from 'react';
import { StatusBar, TouchableOpacity, View, Text, Image, ActivityIndicator, AppState, DeviceEventEmitter } from 'react-native';
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
import { ThemeProvider, useTheme, fs } from './src/theme/ThemeContext';
import { AUTH_SESSION_EXPIRED } from './src/utils/authSession';

// ─── Arka plan konum görevi — import yalnızca TaskManager'a kaydettirmek için ─
import './src/tasks/locationTask';
import { LOCATION_TASK_NAME, pushLocationToBackend } from './src/tasks/locationTask';
import { resolveUserLocation } from './src/utils/location';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotificationsAsync,
  unregisterPushToken,
  addNotificationResponseListener,
} from './src/utils/pushNotifications';
import { workOrdersApi, authApi, notificationsApi } from './src/services/api';
import type { WorkOrder } from './src/types';
import { ensureBackgroundLocationPermission } from './src/utils/locationPermissions';
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  hasStoredSession,
  shouldRefreshAccessToken,
  tryRefreshSession,
} from './src/utils/sessionTokens';
import { filterWorkOrdersForUser, getCurrentUserId } from './src/utils/workOrders';
import { filterMobileVisibleWorkOrders } from './src/utils/workOrderSchedule';

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

function AppShell() {
  const { colors, isDark } = useTheme();
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const foregroundTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const pushTokenRef = React.useRef<string | null>(null);
  const navigationRef = React.useRef<any>(null);

  useEffect(() => { checkLoginStatus(); }, []);

  const checkLoginStatus = async () => {
    try {
      const hasSession = await hasStoredSession();
      if (!hasSession) {
        setAuthState('unauthenticated');
        return;
      }

      let token = await getAccessToken();
      if (!token) {
        const refreshed = await tryRefreshSession();
        if (!refreshed) {
          setAuthState('unauthenticated');
          return;
        }
      } else if (shouldRefreshAccessToken(token, 60 * 24)) {
        await tryRefreshSession();
      }

      await SecureStore.setItemAsync('remember_me', 'true');
      setAuthState('authenticated');
    } catch {
      setAuthState('unauthenticated');
    }
  };

  const navigateFromPush = async (data: Record<string, unknown>) => {
    const type = String(data.type ?? '');
    const workOrderId = data.workOrderId ? String(data.workOrderId) : null;

    if (type === 'ChatMessage' || type === 'DirectChatMessage') {
      const conversationId = data.conversationId ? String(data.conversationId) : undefined;
      const senderUserId = data.senderUserId ? String(data.senderUserId) : undefined;
      navigationRef.current?.navigate?.('Sohbet', { conversationId, senderUserId });
      return;
    }

    const isWorkOrderNotification =
      type === 'WorkOrderAssigned' ||
      type === 'WorkOrderCreated' ||
      type === 'WorkOrderPeriodic' ||
      type === 'WorkOrderStatusChanged';

    if (isWorkOrderNotification && workOrderId) {
      try {
        const [{ data: orders }, userId] = await Promise.all([
          workOrdersApi.getAll(),
          getCurrentUserId(),
        ]);
        const allMine = filterWorkOrdersForUser(orders, userId);
        let found = allMine.find((o: WorkOrder) => o.id === workOrderId);
        if (found?.isPeriodic && !found.parentWorkOrderId) {
          const activeChild = filterMobileVisibleWorkOrders(orders, userId).find(
            (o) => o.parentWorkOrderId === found!.id,
          );
          if (activeChild) found = activeChild;
        }
        if (!found) {
          found = filterMobileVisibleWorkOrders(orders, userId).find(
            (o: WorkOrder) => o.id === workOrderId,
          );
        }
        if (found) {
          navigationRef.current?.navigate?.('İş Emirleri', {
            screen: 'WorkOrderDetail',
            params: { workOrder: found },
          });
          return;
        }
      } catch (err) {
        console.warn('[App] Push deep link WO yüklenemedi:', err);
      }
      return;
    }

    if (isWorkOrderNotification) {
      navigationRef.current?.navigate?.('İş Emirleri');
    }
  };

  const refreshNotificationUnread = async () => {
    try {
      const { data } = await notificationsApi.getMine(5);
      setNotificationUnread(data.unread ?? 0);
    } catch {
      /* sessiz */
    }
  };

  const handleLoginSuccess = () => setAuthState('authenticated');

  const handleLogout = async () => {
    stopForegroundTimer();
    await stopBackgroundLocation();
    await unregisterPushToken(pushTokenRef.current);
    pushTokenRef.current = null;
    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        await authApi.logout({ refreshToken }).catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
    await clearSessionTokens();
    await SecureStore.deleteItemAsync('user_id');
    await SecureStore.deleteItemAsync('user_name');
    await SecureStore.deleteItemAsync('remember_me');
    setNotificationUnread(0);
    setAuthState('unauthenticated');
  };

  // DEMO_EXPIRED / TENANT_INACTIVE / 401 → API interceptor oturumu düşürür
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTH_SESSION_EXPIRED, () => {
      void handleLogout();
    });
    return () => sub.remove();
  }, []);

  // OS push: giriş sonrası token kaydı (hata uygulamayı düşürmez)
  useEffect(() => {
    if (authState !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!cancelled) pushTokenRef.current = token;
      } catch (err) {
        console.warn('[App] Push kaydı atlandı:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [authState]);

  // Bildirime tıklanınca ilgili ekrana git (soğuk başlangıç dahil)
  useEffect(() => {
    if (authState !== 'authenticated') return;

    const navigateFromPushHandler = async (data: Record<string, unknown>) => {
      await navigateFromPush(data);
    };

    const sub = addNotificationResponseListener((data) => {
      void navigateFromPushHandler(data);
    });

    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last?.notification?.request?.content?.data) {
          await navigateFromPushHandler(last.notification.request.content.data as Record<string, unknown>);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => sub.remove();
  }, [authState]);

  useEffect(() => {
    if (authState !== 'authenticated') return;
    void refreshNotificationUnread();
    const interval = setInterval(() => void refreshNotificationUnread(), 45_000);
    return () => clearInterval(interval);
  }, [authState]);

  // ── Konum gönder (arka plan görevinden bağımsız, her zaman çalışır) ────────── (arka plan görevinden bağımsız, her zaman çalışır) ──────────
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
      const bgGranted = await ensureBackgroundLocationPermission();
      if (!bgGranted) return;
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

  // Uygulama ön plana gelince konum gönder + sessiz token yenile
  useEffect(() => {
    if (authState !== 'authenticated') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        sendCurrentLocation();
        void (async () => {
          const token = await getAccessToken();
          if (token && shouldRefreshAccessToken(token, 15)) {
            await tryRefreshSession();
          }
        })();
        void refreshNotificationUnread();
      }
    });

    return () => subscription.remove();
  }, [authState]);

  // ── Splash / loading state ──────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.orange} />
        <Text style={{ color: colors.muted, marginTop: 12, fontSize: fs(14) }}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <NavigationContainer ref={navigationRef}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.header} />

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
            tabBarActiveTintColor:   colors.orange,
            tabBarInactiveTintColor: colors.tabInactive,
            tabBarStyle: {
              backgroundColor: colors.header,
              borderTopWidth: 0,
              paddingBottom: 5,
            },
            tabBarLabelStyle: { fontSize: fs(10) },
            // ── Header ────────────────────────────────────────────────────────
            headerStyle: { backgroundColor: colors.header, elevation: 0, shadowOpacity: 0 },
            headerTintColor: '#fff',
            headerTitle: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image
                  source={require('./assets/logo.png')}
                  style={{ width: 30, height: 30, marginRight: 10 }}
                  resizeMode="contain"
                />
                <Text style={{ color: '#fff', fontSize: fs(17), fontWeight: 'bold', letterSpacing: 0.8 }}>
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
                  {notificationUnread > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -3,
                        right: -3,
                        backgroundColor: colors.danger,
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                      }}
                    />
                  )}
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
      <NotificationPanel
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onUnreadChange={setNotificationUnread}
        onNavigate={(payload) => void navigateFromPush(payload)}
      />
    </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
