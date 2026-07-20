import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi } from '../services/api';

export interface AppNotification {
  id: string;
  text: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

function formatTime(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function mapIcon(type: string): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  if (type === 'WorkOrderAssigned') return { icon: 'person-add-outline', color: '#F97316' };
  if (type === 'WorkOrderStatusChanged') return { icon: 'reload-circle-outline', color: '#3B82F6' };
  if (type === 'WorkOrderPeriodic') return { icon: 'repeat-outline', color: '#22C55E' };
  return { icon: 'notifications-outline', color: '#64748B' };
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationPanel({ visible, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await notificationsApi.getMine(20);
      const items = (data.items || []).map((n) => {
        const meta = mapIcon(n.type);
        return {
          id: n.id,
          text: n.title ? `${n.title}: ${n.message}` : n.message,
          time: formatTime(n.createdAt),
          icon: meta.icon,
          color: meta.color,
        };
      });

      setNotifications(
        items.length > 0
          ? items
          : [
              {
                id: 'empty',
                text: 'Size atanmış yeni bildirim yok.',
                time: '—',
                icon: 'notifications-off-outline',
                color: '#64748B',
              },
            ]
      );
    } catch {
      setNotifications([
        {
          id: 'error',
          text: 'Bildirimler yüklenemedi. Lütfen bağlantınızı kontrol edin.',
          time: 'Hata',
          icon: 'alert-circle-outline',
          color: '#EF4444',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadNotifications();
  }, [visible, loadNotifications]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.panel} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="notifications" size={20} color="#F97316" />
              <Text style={styles.title}>Bildirimler</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#F97316" />
              <Text style={styles.loadingText}>Bildirimler yükleniyor...</Text>
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {notifications.map((item) => (
                <View key={item.id} style={styles.item}>
                  <View style={[styles.itemIcon, { backgroundColor: item.color + '22' }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemText}>{item.text}</Text>
                    <Text style={styles.itemTime}>{item.time}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 12,
  },
  panel: {
    width: 320,
    maxHeight: 420,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#1A233A',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#F1F5F9', fontSize: 16, fontWeight: '700' },
  loadingBox: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  loadingText: { color: '#94A3B8', fontSize: 13 },
  list: { maxHeight: 340 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1 },
  itemText: { color: '#E2E8F0', fontSize: 13, lineHeight: 18 },
  itemTime: { color: '#64748B', fontSize: 11, marginTop: 4, fontWeight: '600' },
});
