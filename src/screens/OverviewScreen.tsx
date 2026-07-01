import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { workOrdersApi } from '../services/api';
import type { WorkOrder } from '../types';

// ─── Stat card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}
function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OverviewScreen() {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('Şefim');

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const name = await SecureStore.getItemAsync('user_name');
      if (name) setUserName(name);
      const { data } = await workOrdersApi.getAll();
      setOrders(data);
    } catch {
      // silent fail — show cached data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders  = orders.filter((o) => o.startDate?.startsWith(today));
  const pending      = orders.filter((o) => o.status === 'Bekliyor');
  const inProgress   = orders.filter((o) => o.status === 'Devam Ediyor');
  const completed    = orders.filter((o) => o.status === 'Tamamlandı');
  const cancelled    = orders.filter((o) => o.status === 'İptal');

  // ── 5 most recent orders ────────────────────────────────────────────────────
  const recentOrders = [...orders]
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
    .slice(0, 5);

  const STATUS_COLORS: Record<string, string> = {
    'Bekliyor':     '#F59E0B',
    'Devam Ediyor': '#3B82F6',
    'Tamamlandı':   '#22C55E',
    'İptal':        '#EF4444',
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Genel bakış yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(true); }}
          tintColor="#F97316"
          colors={['#F97316']}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Welcome ─────────────────────────────────── */}
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.welcomeSub}>Merhaba,</Text>
          <Text style={styles.welcomeName}>{userName} 👋</Text>
        </View>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
          <Text style={styles.dateText}>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>
      </View>

      {/* ── Stat grid ────────────────────────────────── */}
      <View style={styles.statGrid}>
        <StatCard label="Bugünkü İşler"   value={todayOrders.length}  icon="today-outline"          color="#F97316" />
        <StatCard label="Bekliyor"         value={pending.length}      icon="time-outline"            color="#F59E0B" />
        <StatCard label="Devam Ediyor"     value={inProgress.length}   icon="reload-circle-outline"   color="#3B82F6" />
        <StatCard label="Tamamlandı"       value={completed.length}    icon="checkmark-circle-outline" color="#22C55E" />
        <StatCard label="İptal"            value={cancelled.length}    icon="close-circle-outline"    color="#EF4444" />
        <StatCard label="Toplam"           value={orders.length}       icon="layers-outline"          color="#A78BFA" />
      </View>

      {/* ── Quick action ─────────────────────────────── */}
      <TouchableOpacity
        style={styles.quickAction}
        onPress={() => navigation.navigate('İş Emirleri')}
      >
        <View style={styles.quickActionLeft}>
          <Ionicons name="clipboard-outline" size={22} color="#F97316" />
          <Text style={styles.quickActionText}>Tüm İş Emirlerine Git</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#F97316" />
      </TouchableOpacity>

      {/* ── Recent orders ────────────────────────────── */}
      {recentOrders.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Son İş Emirleri</Text>
          {recentOrders.map((order, i) => {
            const color = STATUS_COLORS[order.status] ?? '#64748B';
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.recentCard}
                onPress={() => navigation.navigate('İş Emirleri', { screen: 'WorkOrderDetail', params: { workOrder: order } })}
                activeOpacity={0.8}
              >
                <View style={[styles.recentAccent, { backgroundColor: color }]} />
                <View style={styles.recentBody}>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {order.customerName || order.title || 'İş Emri'}
                  </Text>
                  <Text style={styles.recentMeta}>{order.type} · {order.priority}</Text>
                </View>
                <View style={[styles.recentBadge, { backgroundColor: color + '22', borderColor: color }]}>
                  <Text style={[styles.recentBadgeText, { color }]}>{order.status}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  loadingText: { color: '#94A3B8', fontSize: 14, marginTop: 12 },

  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  welcomeSub: { color: '#64748B', fontSize: 13 },
  welcomeName: { color: '#F1F5F9', fontSize: 22, fontWeight: '800', marginTop: 2 },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dateText: { color: '#94A3B8', fontSize: 11 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { color: '#F1F5F9', fontSize: 26, fontWeight: '800' },
  statLabel: { color: '#64748B', fontSize: 11, fontWeight: '600', marginTop: 4, textAlign: 'center' },

  quickAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F97316' + '44',
  },
  quickActionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quickActionText: { color: '#F97316', fontSize: 15, fontWeight: '700' },

  recentSection: { marginBottom: 8 },
  sectionTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  recentAccent: { width: 4, alignSelf: 'stretch' },
  recentBody: { flex: 1, padding: 12 },
  recentTitle: { color: '#E2E8F0', fontSize: 14, fontWeight: '600' },
  recentMeta: { color: '#64748B', fontSize: 12, marginTop: 2 },
  recentBadge: {
    marginRight: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  recentBadgeText: { fontSize: 11, fontWeight: '700' },
});
