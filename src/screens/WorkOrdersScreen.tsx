import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { workOrdersApi } from '../services/api';
import { extractApiErrorMessage, filterWorkOrdersForUser, getCurrentUserId, ensureAlertMessage } from '../utils/workOrders';
import type { WorkOrder, WorkOrdersStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<WorkOrdersStackParamList, 'WorkOrdersList'>;

// Aktif işler önde, tamamlanan/iptal en sonda
const STATUS_ORDER: Record<string, number> = {
  'Devam Ediyor': 0,
  'Bekliyor':     1,
  'Tamamlandı':   2,
  'İptal':        3,
};

function sortOrders(list: WorkOrder[]) {
  return [...list].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1);
    if (statusDiff !== 0) return statusDiff;
    // Aynı durumda en yeni (startDate) üstte
    return (b.startDate ?? '').localeCompare(a.startDate ?? '');
  });
}
const STATUS_COLORS: Record<string, string> = {
  'Bekliyor':    '#F59E0B',
  'Devam Ediyor': '#3B82F6',
  'Tamamlandı':  '#22C55E',
  'İptal':       '#EF4444',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#64748B';
}

// ─── Work order card ──────────────────────────────────────────────────────────
interface CardProps {
  order: WorkOrder;
  index: number;
  onPress: () => void;
}

function WorkOrderCard({ order, index, onPress }: CardProps) {
  const badgeColor = statusColor(order.status);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.cardAccent, { backgroundColor: badgeColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIndex}>#{index + 1}</Text>
          <View style={[styles.badge, { backgroundColor: badgeColor + '28', borderColor: badgeColor }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{order.status ?? 'Bekliyor'}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {order.customerName || order.title || 'İsimsiz İş Emri'}
        </Text>

        <View style={styles.cardRow}>
          <Ionicons name="construct-outline" size={13} color="#94A3B8" />
          <Text style={styles.cardMeta}>{order.type ?? '-'} · {order.category ?? '-'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="alert-circle-outline" size={13} color="#94A3B8" />
          <Text style={styles.cardMeta}>Öncelik: {order.priority ?? 'Orta'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="calendar-outline" size={13} color="#94A3B8" />
          <Text style={styles.cardMeta}>{order.startDate ?? '-'} → {order.endDate ?? '-'}</Text>
        </View>
        {!!order.address && (
          <View style={styles.cardRow}>
            <Ionicons name="location-outline" size={13} color="#94A3B8" />
            <Text style={styles.cardMeta} numberOfLines={1}>{order.address}</Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.assignedText}>
            <Text style={styles.assignedLabel}>Atanan: </Text>
            {order.assignedToUserName ?? 'Atanmamış'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#F97316" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WorkOrdersScreen() {
  const navigation = useNavigation<NavProp>();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [filtered, setFiltered] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [{ data }, userId] = await Promise.all([workOrdersApi.getAll(), getCurrentUserId()]);
      if (!userId) {
        if (!silent) {
          Alert.alert(
            'Oturum',
            'Kullanıcı bilgisi bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.',
          );
        }
        setOrders([]);
        setFiltered([]);
        return;
      }
      const mine = filterWorkOrdersForUser(data, userId);
      setOrders(mine);
      applyFilter(mine, search, activeFilter);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      if (!silent || !hasLoadedOnceRef.current) {
        Alert.alert(
          'Hata',
          ensureAlertMessage(
            extractApiErrorMessage(err, 'İş emirleri yüklenemedi.'),
            'İş emirleri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
          ),
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeFilter]);

  useEffect(() => { fetchOrders(); }, []);

  // Detay ekranından geri dönüldüğünde (İşe Başla, Tamamla, İptal) listeyi yenile
  useFocusEffect(
    useCallback(() => {
      fetchOrders(true);
    }, [fetchOrders]),
  );

  const applyFilter = (data: WorkOrder[], q: string, status: string | null) => {
    let result = data;
    if (q.trim()) {
      const lower = q.toLowerCase();
      result = result.filter(
        (o) =>
          o.customerName?.toLowerCase().includes(lower) ||
          o.title?.toLowerCase().includes(lower) ||
          o.address?.toLowerCase().includes(lower) ||
          o.type?.toLowerCase().includes(lower),
      );
    }
    if (status) {
      result = result.filter((o) => o.status === status);
    }
    setFiltered(sortOrders(result));
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    applyFilter(orders, text, activeFilter);
  };

  const handleFilterToggle = (status: string) => {
    const next = activeFilter === status ? null : status;
    setActiveFilter(next);
    applyFilter(orders, search, next);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders(true);
  };

  const statusFilters = ['Bekliyor', 'Devam Ediyor', 'Tamamlandı', 'İptal'];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>İş emirleri yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Search bar ─────────────────────────────── */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="İş emri, müşteri veya adres ara..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Status filter chips ─────────────────────── */}
      <View style={styles.filterRow}>
        {statusFilters.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.chip,
              activeFilter === s && { backgroundColor: statusColor(s), borderColor: statusColor(s) },
            ]}
            onPress={() => handleFilterToggle(s)}
          >
            <Text style={[styles.chipText, activeFilter === s && styles.chipTextActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Counter ────────────────────────────────── */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{filtered.length} iş emri</Text>
        <TouchableOpacity onPress={() => fetchOrders(true)}>
          <Ionicons name="refresh-outline" size={18} color="#F97316" />
        </TouchableOpacity>
      </View>

      {/* ── List ───────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <WorkOrderCard
            order={item}
            index={index}
            onPress={() => navigation.navigate('WorkOrderDetail', { workOrder: item })}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
            colors={['#F97316']}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>
              {search || activeFilter
                ? 'Arama kriterlerine uygun iş emri yok'
                : 'Size atanmış iş emri bulunmuyor'}
            </Text>
            {!search && !activeFilter && (
              <Text style={styles.emptySubText}>
                Yöneticinizden size iş emri atanmasını isteyebilirsiniz.
              </Text>
            )}
            {!!search && (
              <Text style={styles.emptySubText}>"{search}" araması için sonuç yok</Text>
            )}
          </View>
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  loadingText: { marginTop: 12, color: '#94A3B8', fontSize: 14 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 10 },

  filterRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
  },
  chipText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  countText: { color: '#64748B', fontSize: 12 },

  listContent: { paddingHorizontal: 14, paddingBottom: 20 },

  card: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: 13 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardIndex: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardTitle: { color: '#E2E8F0', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3, gap: 5 },
  cardMeta: { color: '#94A3B8', fontSize: 12, flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#334155' },
  assignedText: { color: '#94A3B8', fontSize: 12 },
  assignedLabel: { fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#475569', fontSize: 16, fontWeight: '600', marginTop: 14 },
  emptySubText: { color: '#334155', fontSize: 13, marginTop: 6 },
});
