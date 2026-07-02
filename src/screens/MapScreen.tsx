// ─── MapScreen.tsx ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
// react-native-maps Expo Go'da native olarak bulunmaz — development build gerektirir.
let MapView: any = null;
let Marker: any = null;
let PROVIDER_DEFAULT: any = undefined;
try {
  const maps = require('react-native-maps');
  MapView = maps.default ?? maps.MapView ?? null;
  Marker = maps.Marker ?? null;
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
} catch {
  // Expo Go'da native modül yok
}
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { workOrdersApi, locationApi } from '../services/api';
import type { WorkOrder, TeamMemberLocation, RootTabParamList } from '../types';

const DEFAULT_REGION = {
  latitude: 39.92077,
  longitude: 32.85411,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

type Layer = 'workorders' | 'teams' | 'both';

// Kaç saniyede bir canlı konumları yenile
const TEAM_REFRESH_INTERVAL = 30_000;

// Navigasyon için Google Maps / Apple Maps açar
function openNavigation(lat: number, lng: number, label: string) {
  const encodedLabel = encodeURIComponent(label);
  const url = Platform.select({
    ios:     `maps://?daddr=${lat},${lng}&q=${encodedLabel}`,
    android: `google.navigation:q=${lat},${lng}`,
  })!;
  const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  Linking.canOpenURL(url).then((supported) => {
    Linking.openURL(supported ? url : webFallback);
  });
}

export default function MapScreen() {
  const route = useRoute<RouteProp<RootTabParamList, 'Harita'>>();
  const mapRef = useRef<InstanceType<typeof MapView>>(null);
  const teamRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [layer, setLayer] = useState<Layer>('both');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [teamLocations, setTeamLocations] = useState<TeamMemberLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    loadWorkOrders();
    requestLocation();
    loadTeamLocations();

    // 30 saniyede bir canlı konumları yenile
    teamRefreshRef.current = setInterval(loadTeamLocations, TEAM_REFRESH_INTERVAL);
    return () => {
      if (teamRefreshRef.current) clearInterval(teamRefreshRef.current);
    };
  }, []);

  // WorkOrderDetail'den "Haritada Göster" ile gelen focus parametreleri
  useEffect(() => {
    const params = route.params;
    if (params?.focusLatitude && params?.focusLongitude && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude:       params.focusLatitude,
          longitude:      params.focusLongitude,
          latitudeDelta:  0.01,
          longitudeDelta: 0.01,
        },
        800,
      );
    }
  }, [route.params]);

  const loadWorkOrders = async () => {
    setLoading(true);
    try {
      const res = await workOrdersApi.getAll();
      setWorkOrders(res.data);
    } catch {
      // Sessiz geç — takım konumları görünmeye devam eder
    } finally {
      setLoading(false);
    }
  };

  const loadTeamLocations = async () => {
    try {
      const res = await locationApi.getTeamLocations();
      setTeamLocations(res.data);
      setLastRefreshed(new Date());
    } catch {
      // Ağ hatası sessiz geç
    }
  };

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
  };

  const goToUserLocation = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
    } else {
      Alert.alert('Konum', 'Konumunuz henüz alınamadı.');
    }
  };

  const goToAnkara = () => mapRef.current?.animateToRegion(DEFAULT_REGION, 600);

  const refreshAll = () => { loadWorkOrders(); loadTeamLocations(); };

  const showWorkOrders = layer === 'workorders' || layer === 'both';
  const showTeams      = layer === 'teams'      || layer === 'both';

  const mappedOrders = workOrders.filter(
    (o) => Array.isArray(o.position) && o.position[0] !== 0 && o.position[1] !== 0,
  );

  const activeTeamCount = teamLocations.length;

  // ── Expo Go fallback ────────────────────────────────────────────────────────
  if (!MapView) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }]}>
        <Ionicons name="map-outline" size={64} color="#334155" />
        <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '600', marginTop: 16 }}>
          Harita bu ortamda kullanılamıyor
        </Text>
        <Text style={{ color: '#475569', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
          Harita görünümü için geliştirme build'i (APK) gereklidir.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#F97316" size="large" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {/* ── İş Emri işaretleri ─────────────────── */}
        {showWorkOrders &&
          mappedOrders.map((order) => (
            <Marker
              key={`wo-${order.id}`}
              coordinate={{ latitude: order.position[0], longitude: order.position[1] }}
              pinColor="#F97316"
              title={order.customerName || order.title || 'İş Emri'}
              description="Yol Tarifi Al →"
              onCalloutPress={() =>
                openNavigation(
                  order.position[0],
                  order.position[1],
                  order.customerName || order.title || 'İş Emri',
                )
              }
            />
          ))}

        {/* ── Canlı takım konumları ───────────────── */}
        {showTeams &&
          teamLocations.map((member) => (
            <Marker
              key={`tm-${member.userId}`}
              coordinate={{ latitude: member.latitude, longitude: member.longitude }}
              pinColor="#38BDF8"
              title={member.fullName}
              description={
                member.updatedAt
                  ? `Son güncelleme: ${new Date(member.updatedAt).toLocaleTimeString('tr-TR')}`
                  : 'Konum zamanı bilinmiyor'
              }
            />
          ))}
      </MapView>

      {/* ── Katman seçici ─────────────────────────── */}
      <View style={styles.layerPanel}>
        {(['workorders', 'teams', 'both'] as Layer[]).map((l) => (
          <TouchableOpacity
            key={l}
            style={[styles.layerBtn, layer === l && styles.layerBtnActive]}
            onPress={() => setLayer(l)}
          >
            <Text style={[styles.layerBtnText, layer === l && styles.layerBtnTextActive]}>
              {l === 'workorders' ? 'İş Emirleri' : l === 'teams' ? 'Personel' : 'Tümü'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Lejant + son yenileme ──────────────────── */}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#F97316' }]} />
          <Text style={styles.legendText}>İş Emri ({mappedOrders.length})</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
          <Text style={styles.legendText}>Personel ({activeTeamCount})</Text>
        </View>
        {lastRefreshed && (
          <Text style={styles.refreshText}>
            {lastRefreshed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
        )}
      </View>

      {/* ── FAB grubu ─────────────────────────────── */}
      <View style={styles.fabColumn}>
        <TouchableOpacity style={styles.fab} onPress={goToUserLocation}>
          <Ionicons name="locate-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, { backgroundColor: '#334155' }]} onPress={goToAnkara}>
          <Ionicons name="home-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, { backgroundColor: '#334155' }]} onPress={refreshAll}>
          <Ionicons name="refresh-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
    backgroundColor: '#0F172Acc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 14 },

  layerPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 16,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: '#1E293Bee',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  layerBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  layerBtnActive: { backgroundColor: '#F97316' },
  layerBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  layerBtnTextActive: { color: '#fff' },

  legend: {
    position: 'absolute',
    bottom: 24,
    left: 14,
    backgroundColor: '#1E293Bee',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#E2E8F0', fontSize: 12 },
  refreshText: { color: '#475569', fontSize: 10, marginTop: 2 },

  fabColumn: {
    position: 'absolute',
    bottom: 24,
    right: 14,
    gap: 12,
    alignItems: 'center',
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  callout: { padding: 6, minWidth: 140, maxWidth: 200 },
  calloutTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  calloutSub: { fontSize: 11, color: '#475569' },
});
