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
} from 'react-native';
// react-native-maps Expo Go'da native olarak bulunmaz — development build gerektirir.
// try-catch ile güvenli şekilde yükleniyor; yoksa placeholder gösterilir.
let MapView: any = null;
let Marker: any = null;
let PROVIDER_DEFAULT: any = undefined;
try {
  const maps = require('react-native-maps');
  MapView = maps.default ?? maps.MapView ?? null;
  Marker = maps.Marker ?? null;
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
} catch {
  // Expo Go'da native modül yok — MapView null kalır
}
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { workOrdersApi, teamsApi } from '../services/api';
import type { WorkOrder, TeamMember } from '../types';

// ─── Default region: Ankara ───────────────────────────────────────────────────
const DEFAULT_REGION = {
  latitude: 39.92077,
  longitude: 32.85411,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// ─── Layer toggle ─────────────────────────────────────────────────────────────
type Layer = 'workorders' | 'teams' | 'both';

export default function MapScreen() {
  const mapRef = useRef<InstanceType<typeof MapView>>(null);
  const [layer, setLayer] = useState<Layer>('both');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [teams, setTeams] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    loadMapData();
    requestLocation();
  }, []);

  const loadMapData = async () => {
    setLoading(true);
    try {
      const [woRes, teamsRes] = await Promise.allSettled([
        workOrdersApi.getAll(),
        teamsApi.getAll(),
      ]);
      if (woRes.status === 'fulfilled') setWorkOrders(woRes.value.data);
      if (teamsRes.status === 'fulfilled') setTeams(teamsRes.value.data);
    } catch {
      Alert.alert('Hata', 'Harita verisi yüklenemedi.');
    } finally {
      setLoading(false);
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
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 600);
    } else {
      Alert.alert('Konum', 'Konumunuz henüz alınamadı.');
    }
  };

  const goToAnkara = () => {
    mapRef.current?.animateToRegion(DEFAULT_REGION, 600);
  };

  // Only show markers matching active layer
  const showWorkOrders = layer === 'workorders' || layer === 'both';
  const showTeams      = layer === 'teams'      || layer === 'both';

  // Work orders that have valid position
  const mappedOrders = workOrders.filter(
    (o) => Array.isArray(o.position) && o.position[0] !== 0 && o.position[1] !== 0,
  );

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
          <Text style={styles.loadingText}>Harita verisi yükleniyor...</Text>
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
        {/* ── Work Order markers ─── */}
        {showWorkOrders &&
          mappedOrders.map((order) => (
            <Marker
              key={order.id}
              coordinate={{ latitude: order.position[0], longitude: order.position[1] }}
              title={order.customerName || order.title || 'İş Emri'}
              description={`${order.status} · ${order.type}`}
              pinColor="#F97316"
            />
          ))}

        {/* ── Team markers ─── */}
        {showTeams &&
          teams.map((member) => (
            <Marker
              key={member.id}
              coordinate={{ latitude: member.position[0], longitude: member.position[1] }}
              title={member.name}
              description={`${member.project} · ${member.plate}`}
              pinColor="#38BDF8"
            />
          ))}
      </MapView>

      {/* ── Layer toggle ──────────────────────────── */}
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

      {/* ── Legend ────────────────────────────────── */}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#F97316' }]} />
          <Text style={styles.legendText}>İş Emri ({mappedOrders.length})</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
          <Text style={styles.legendText}>Personel ({teams.length})</Text>
        </View>
      </View>

      {/* ── FABs ──────────────────────────────────── */}
      <View style={styles.fabColumn}>
        <TouchableOpacity style={styles.fab} onPress={goToUserLocation}>
          <Ionicons name="locate-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, { backgroundColor: '#334155' }]} onPress={goToAnkara}>
          <Ionicons name="home-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, { backgroundColor: '#334155' }]} onPress={loadMapData}>
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
});
