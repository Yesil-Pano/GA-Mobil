// ─── MapScreen.tsx ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import OsmMapView, { type OsmMapViewRef, type OsmMarker } from '../components/OsmMapView';
import { workOrdersApi } from '../services/api';
import { extractApiErrorMessage, getCurrentUserId, ensureAlertMessage } from '../utils/workOrders';
import { filterMobileVisibleWorkOrders } from '../utils/workOrderSchedule';
import { parseWorkOrderCoords } from '../utils/workOrderCoords';
import { resolveUserLocation } from '../utils/location';
import type { WorkOrder, RootTabParamList } from '../types';
import { useTheme } from '../theme/ThemeContext';

const DEFAULT_REGION = {
  latitude: 39.92077,
  longitude: 32.85411,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

function openNavigation(lat: number, lng: number, label: string) {
  const encodedLabel = encodeURIComponent(label);
  const url = Platform.select({
    ios: `maps://?daddr=${lat},${lng}&q=${encodedLabel}`,
    android: `google.navigation:q=${lat},${lng}`,
  })!;
  const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  Linking.canOpenURL(url).then((supported) => {
    Linking.openURL(supported ? url : webFallback);
  });
}

function buildMarkerDescription(order: WorkOrder): string {
  const parts: string[] = [];
  if (order.status) parts.push(`Durum: ${order.status}`);
  if (order.type) parts.push(`Tür: ${order.type}`);
  if (order.priority) parts.push(`Öncelik: ${order.priority}`);
  if (order.address?.trim()) parts.push(order.address.trim());
  return parts.join(' · ') || 'Atanmış saha iş emri';
}

export default function MapScreen() {
  const { colors, fs } = useTheme();
  const route = useRoute<RouteProp<RootTabParamList, 'Harita'>>();
  const mapRef = useRef<OsmMapViewRef>(null);
  const markerIndexRef = useRef<Map<string, { lat: number; lng: number; label: string }>>(new Map());

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [res, userId] = await Promise.all([workOrdersApi.getAll(), getCurrentUserId()]);
      if (!userId) {
        setWorkOrders([]);
        return;
      }
      const mine = filterMobileVisibleWorkOrders(res.data, userId);
      setWorkOrders(mine);
      setLastRefreshed(new Date());
    } catch (err) {
      Alert.alert(
        'Hata',
        ensureAlertMessage(
          extractApiErrorMessage(err, 'İş emirleri haritaya yüklenemedi.'),
          'İş emirleri haritaya yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  useFocusEffect(
    useCallback(() => {
      loadWorkOrders();
    }, [loadWorkOrders]),
  );

  useEffect(() => {
    if (!mapReady) return;

    const timer = setTimeout(() => {
      requestLocation();
    }, 400);

    return () => clearTimeout(timer);
  }, [mapReady]);

  useEffect(() => {
    const params = route.params;
    if (params?.focusLatitude && params?.focusLongitude && mapReady) {
      mapRef.current?.animateToRegion(
        {
          latitude: params.focusLatitude,
          longitude: params.focusLongitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800,
      );
    }
  }, [route.params, mapReady]);

  const requestLocation = async () => {
    const loc = await resolveUserLocation();
    if (loc) setUserLocation(loc);
  };

  const goToUserLocation = async () => {
    setResolvingLocation(true);
    try {
      const loc = await resolveUserLocation();
      if (loc) {
        setUserLocation(loc);
        mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
        return;
      }
      if (userLocation) {
        mapRef.current?.animateToRegion(
          { ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          600,
        );
        Alert.alert(
          'Konum',
          'Yeni konum alınamadı. Son bilinen konum gösteriliyor.',
        );
        return;
      }
      Alert.alert(
        'Konum',
        'Konumunuz alınamadı. İnternet bağlantınızı kontrol edin veya açık alanda tekrar deneyin.',
      );
    } finally {
      setResolvingLocation(false);
    }
  };

  const goToAnkara = () => mapRef.current?.animateToRegion(DEFAULT_REGION, 600);

  const mappedOrders = useMemo(
    () =>
      workOrders
        .map((order) => ({ order, coords: parseWorkOrderCoords(order) }))
        .filter((entry): entry is { order: WorkOrder; coords: { latitude: number; longitude: number } } =>
          entry.coords != null,
        ),
    [workOrders],
  );

  const focusCoords = useMemo(() => {
    const params = route.params;
    if (params?.focusLatitude == null || params?.focusLongitude == null) return null;
    const lat = Number(params.focusLatitude);
    const lng = Number(params.focusLongitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
    return {
      latitude: lat,
      longitude: lng,
      label: params.focusLabel?.trim() || 'İş Emri',
    };
  }, [route.params]);

  const markers = useMemo(() => {
    const next: OsmMarker[] = [];
    const index = new Map<string, { lat: number; lng: number; label: string }>();
    const seen = new Set<string>();

    mappedOrders.forEach(({ order, coords }) => {
      const id = `wo-${order.id}`;
      const label = order.customerName || order.title || 'İş Emri';
      next.push({
        id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        title: label,
        description: buildMarkerDescription(order),
        color: '#F97316',
      });
      index.set(id, { lat: coords.latitude, lng: coords.longitude, label });
      seen.add(`${coords.latitude.toFixed(6)}:${coords.longitude.toFixed(6)}`);
    });

    if (focusCoords) {
      const focusKey = `${focusCoords.latitude.toFixed(6)}:${focusCoords.longitude.toFixed(6)}`;
      if (!seen.has(focusKey)) {
        const id = 'focus-work-order';
        next.push({
          id,
          latitude: focusCoords.latitude,
          longitude: focusCoords.longitude,
          title: focusCoords.label,
          description: 'Seçili iş emri konumu',
          color: '#F97316',
        });
        index.set(id, {
          lat: focusCoords.latitude,
          lng: focusCoords.longitude,
          label: focusCoords.label,
        });
      }
    }

    markerIndexRef.current = index;
    return next;
  }, [mappedOrders, focusCoords]);

  const handleNavigatePress = useCallback((markerId: string) => {
    const target = markerIndexRef.current.get(markerId);
    if (!target) return;
    openNavigation(target.lat, target.lng, target.label);
  }, []);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.bg + 'CC' }]}>
          <ActivityIndicator color={colors.orange} size="large" />
          <Text style={[styles.loadingText, { color: colors.muted, fontSize: fs(14) }]}>Yükleniyor...</Text>
        </View>
      )}

      <OsmMapView
        ref={mapRef}
        initialRegion={DEFAULT_REGION}
        markers={markers}
        userLocation={userLocation}
        onNavigatePress={handleNavigatePress}
        onMapReady={() => setMapReady(true)}
      />

      <View style={[styles.legend, { backgroundColor: colors.surface + 'EE', borderColor: colors.border }]}>
        <View style={styles.legendRow}>
          <View style={[styles.legendIcon, { backgroundColor: colors.header, borderColor: colors.orange }]}>
            <Ionicons name="flash" size={12} color={colors.orange} />
          </View>
          <Text style={[styles.legendText, { color: colors.textSecondary, fontSize: fs(12) }]}>
            İş Emri İstasyonları ({mappedOrders.length})
          </Text>
        </View>
        {lastRefreshed && (
          <Text style={[styles.refreshText, { color: colors.faint, fontSize: fs(10) }]}>
            {lastRefreshed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
        )}
      </View>

      <View style={styles.fabColumn}>
        <TouchableOpacity style={styles.fab} onPress={goToUserLocation} disabled={resolvingLocation}>
          {resolvingLocation ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="locate-outline" size={22} color="#fff" />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, { backgroundColor: '#334155' }]} onPress={goToAnkara}>
          <Ionicons name="home-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, { backgroundColor: '#334155' }]} onPress={loadWorkOrders}>
          <Ionicons name="refresh-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
    backgroundColor: '#0F172Acc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 14 },
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
  legendIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#1A233A',
    borderWidth: 1,
    borderColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
