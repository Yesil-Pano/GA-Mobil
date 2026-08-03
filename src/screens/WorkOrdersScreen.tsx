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
import { useTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/ThemeContext';

type NavProp = NativeStackNavigationProp<WorkOrdersStackParamList, 'WorkOrdersList'>;

import { displayWorkOrderStatus } from '../utils/workOrderSchedule';

const STATUS_ORDER: Record<string, number> = {
  'Bekliyor': 0,
  'Devam Ediyor': 1,
  'Tamamlandı': 2,
  'İptal': 3,
};

function sortOrders(list: WorkOrder[]) {
  return [...list].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1);
    if (statusDiff !== 0) return statusDiff;
    return (b.startDate ?? '').localeCompare(a.startDate ?? '');
  });
}

const STATUS_COLORS: Record<string, string> = {
  'Bekliyor': '#F59E0B',
  'Devam Ediyor': '#3B82F6',
  'Tamamlandı': '#22C55E',
  'İptal': '#EF4444',
  'İptal Edildi': '#EF4444',
};

function statusColor(status: string): string {
  return STATUS_COLORS[displayWorkOrderStatus(status)] ?? '#64748B';
}

interface CardProps {
  order: WorkOrder;
  index: number;
  onPress: () => void;
  colors: AppColors;
  fs: (n: number) => number;
}

function WorkOrderCard({ order, index, onPress, colors, fs }: CardProps) {
  const badgeColor = statusColor(order.status);
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.cardAccent, { backgroundColor: badgeColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardIndex, { color: colors.muted, fontSize: fs(12) }]}>#{index + 1}</Text>
          <View style={[styles.badge, { backgroundColor: badgeColor + '28', borderColor: badgeColor }]}>
            <Text style={{ color: badgeColor, fontSize: fs(11), fontWeight: '700' }}>{displayWorkOrderStatus(order.status)}</Text>
          </View>
        </View>

        <Text style={{ color: colors.textSecondary, fontSize: fs(15), fontWeight: '700', marginBottom: 6 }} numberOfLines={1}>
          {order.customerName || order.title || 'İsimsiz İş Emri'}
        </Text>

        <View style={styles.cardRow}>
          <Ionicons name="construct-outline" size={13} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: fs(12), flex: 1 }}>{order.type ?? '-'} · {order.category ?? '-'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: fs(12), flex: 1 }}>Öncelik: {order.priority ?? 'Orta'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="calendar-outline" size={13} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: fs(12), flex: 1 }}>{order.startDate ?? '-'} → {order.endDate ?? '-'}</Text>
        </View>
        {!!order.address && (
          <View style={styles.cardRow}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: fs(12), flex: 1 }} numberOfLines={1}>{order.address}</Text>
          </View>
        )}
        {!!order.description?.trim() && (
          <View style={styles.cardRow}>
            <Ionicons name="document-text-outline" size={13} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: fs(12), flex: 1 }} numberOfLines={2}>
              <Text style={{ fontWeight: '700', color: colors.textSecondary }}>Genel Açıklama: </Text>
              {order.description.trim()}
            </Text>
          </View>
        )}
        {!!order.mobileDescription?.trim() && (
          <View style={styles.cardRow}>
            <Ionicons name="create-outline" size={13} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: fs(12), flex: 1 }} numberOfLines={2}>
              <Text style={{ fontWeight: '700', color: colors.textSecondary }}>Mühendis Açıklaması: </Text>
              {order.mobileDescription.trim()}
            </Text>
          </View>
        )}

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <Text style={{ color: colors.muted, fontSize: fs(12) }}>
            <Text style={{ fontWeight: '700' }}>Atanan: </Text>
            {order.assignedToUserName ?? 'Atanmamış'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.orange} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function WorkOrdersScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors, fs } = useTheme();
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
          o.type?.toLowerCase().includes(lower) ||
          o.description?.toLowerCase().includes(lower) ||
          o.mobileDescription?.toLowerCase().includes(lower),
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
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.orange} />
        <Text style={{ marginTop: 12, color: colors.muted, fontSize: fs(14) }}>İş emirleri yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={{ flex: 1, color: colors.text, fontSize: fs(14), paddingVertical: 10 }}
          placeholder="İş emri, müşteri veya adres ara..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {statusFilters.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.chip,
              { borderColor: colors.border, backgroundColor: colors.surface },
              activeFilter === s && { backgroundColor: statusColor(s), borderColor: statusColor(s) },
            ]}
            onPress={() => handleFilterToggle(s)}
          >
            <Text
              style={[
                { color: colors.muted, fontSize: fs(12), fontWeight: '600' },
                activeFilter === s && { color: '#fff' },
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.countRow}>
        <Text style={{ color: colors.faint, fontSize: fs(12) }}>{filtered.length} iş emri</Text>
        <TouchableOpacity onPress={() => fetchOrders(true)}>
          <Ionicons name="refresh-outline" size={18} color={colors.orange} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <WorkOrderCard
            order={item}
            index={index}
            colors={colors}
            fs={fs}
            onPress={() => navigation.navigate('WorkOrderDetail', { workOrder: item })}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.orange}
            colors={[colors.orange]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={48} color={colors.border} />
            <Text style={{ color: colors.faint, fontSize: fs(16), fontWeight: '600', marginTop: 14 }}>
              {search || activeFilter
                ? 'Arama kriterlerine uygun iş emri yok'
                : 'Size atanmış iş emri bulunmuyor'}
            </Text>
            {!search && !activeFilter && (
              <Text style={{ color: colors.border, fontSize: fs(13), marginTop: 6 }}>
                Yöneticinizden size iş emri atanmasını isteyebilirsiniz.
              </Text>
            )}
            {!!search && (
              <Text style={{ color: colors.border, fontSize: fs(13), marginTop: 6 }}>"{search}" araması için sonuç yok</Text>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchIcon: { marginRight: 8 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  listContent: { paddingHorizontal: 14, paddingBottom: 20 },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: 13 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardIndex: { fontWeight: '700' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3, gap: 5 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  empty: { alignItems: 'center', paddingTop: 60 },
});
