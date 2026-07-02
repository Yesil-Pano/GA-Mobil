import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
  FlatList,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WorkOrdersStackParamList, RootTabParamList } from '../types';
import { workOrdersApi } from '../services/api';

type Props = NativeStackScreenProps<WorkOrdersStackParamList, 'WorkOrderDetail'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  'Bekliyor':     '#F59E0B',
  'Devam Ediyor': '#3B82F6',
  'Tamamlandı':   '#22C55E',
  'İptal':        '#EF4444',
};
function statusColor(s: string) { return STATUS_COLORS[s] ?? '#64748B'; }

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color="#94A3B8" style={styles.detailIcon} />
      <View style={styles.detailTexts}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WorkOrderDetailScreen({ route }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<WorkOrdersStackParamList>>();
  const { workOrder: order } = route.params;

  const [currentStatus, setCurrentStatus] = useState(order.status ?? 'Bekliyor');
  const [actionLoading, setActionLoading] = useState<'start' | 'complete' | 'cancel' | null>(null);
  const [sahaNote, setSahaNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ headerShown: false });
    return () => { parent?.setOptions({ headerShown: true }); };
  }, [navigation]);

  const badgeColor = statusColor(currentStatus);

  // ── Fotoğraf seçici ──────────────────────────────────────────────────────────
  const pickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri erişim izni gereklidir.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...uris].slice(0, 10));
    }
  };

  const removePhoto = (uri: string) => setPhotos((prev) => prev.filter((p) => p !== uri));

  // ── Durum güncelleme ─────────────────────────────────────────────────────────
  const updateStatus = async (newStatus: string, loadingKey: 'start' | 'complete' | 'cancel') => {
    setActionLoading(loadingKey);
    try {
      await workOrdersApi.updateStatus(order.id, newStatus);
      setCurrentStatus(newStatus);
      if (newStatus === 'Tamamlandı' || newStatus === 'İptal') {
        Alert.alert('Başarılı', `İş emri "${newStatus}" olarak işaretlendi.`, [
          { text: 'Tamam', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Durum güncellenemedi.';
      Alert.alert('Hata', msg);
    } finally {
      setActionLoading(null);
    }
  };

  // ── İşi Başlat ───────────────────────────────────────────────────────────────
  const handleStart = () => {
    Alert.alert(
      'İşe Başla',
      'Bu iş emrini "Devam Ediyor" durumuna almak istiyor musunuz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Evet, Başla', onPress: () => updateStatus('Devam Ediyor', 'start') },
      ],
    );
  };

  // ── Tamamla / İptal ──────────────────────────────────────────────────────────
  const handleAction = (action: 'complete' | 'cancel') => {
    if (!sahaNote.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen "Saha Notu" alanını doldurun.');
      return;
    }
    if (photos.length === 0) {
      Alert.alert('Eksik Fotoğraf', 'Lütfen en az bir fotoğraf ekleyin.');
      return;
    }

    const newStatus = action === 'complete' ? 'Tamamlandı' : 'İptal';
    const label     = action === 'complete' ? 'Tamamla'   : 'İptal Et';

    Alert.alert(
      `${label} — Onay`,
      `İş emrini ${label.toLowerCase()}mek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: label,
          style: action === 'cancel' ? 'destructive' : 'default',
          onPress: () => updateStatus(newStatus, action),
        },
      ],
    );
  };

  // ── Konumu Göster — Harita sekmesine yönlendir ───────────────────────────────
  const handleShowOnMap = () => {
    const lat = order.position?.[0];
    const lng = order.position?.[1];
    if (!lat || !lng || (lat === 0 && lng === 0)) {
      Alert.alert('Konum Yok', 'Bu iş emrinde kayıtlı konum bilgisi bulunmuyor.');
      return;
    }
    const parentNav = navigation.getParent<NativeStackNavigationProp<RootTabParamList>>();
    parentNav?.navigate('Harita', {
      focusLatitude:  lat,
      focusLongitude: lng,
      focusLabel:     order.customerName || order.title || 'İş Emri',
    });
  };

  const isFinished = currentStatus === 'Tamamlandı' || currentStatus === 'İptal';

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {order.customerName || order.title || 'İş Emri Detayı'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: badgeColor + '30', borderColor: badgeColor }]}>
            <Text style={[styles.statusText, { color: badgeColor }]}>{currentStatus}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Öncelik + Tür ────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: '#F9731622' }]}>
              <Ionicons name="alert-circle-outline" size={13} color="#F97316" />
              <Text style={[styles.pillText, { color: '#F97316' }]}>{order.priority ?? 'Orta'}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: '#38BDF822' }]}>
              <Ionicons name="construct-outline" size={13} color="#38BDF8" />
              <Text style={[styles.pillText, { color: '#38BDF8' }]}>{order.type ?? '—'}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: '#A78BFA22' }]}>
              <Ionicons name="layers-outline" size={13} color="#A78BFA" />
              <Text style={[styles.pillText, { color: '#A78BFA' }]}>{order.category ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── Temel Bilgiler ───────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Temel Bilgiler</Text>
          <DetailRow icon="person-outline"   label="Müşteri / Nokta Adı" value={order.customerName ?? order.title ?? '—'} />
          <DetailRow icon="location-outline" label="Adres"               value={order.address ?? '—'} />
          <DetailRow icon="calendar-outline" label="Başlangıç Tarihi"    value={order.startDate ?? '—'} />
          <DetailRow icon="calendar-outline" label="Bitiş Tarihi"        value={order.endDate ?? '—'} />
          <DetailRow icon="calendar-outline" label="Planlanan Tarih"     value={order.plannedDate ?? '—'} />

          {/* Konumu Göster butonu */}
          {order.position?.[0] !== 0 && order.position?.[0] != null && (
            <TouchableOpacity style={styles.mapBtn} onPress={handleShowOnMap}>
              <Ionicons name="map" size={20} color="#38BDF8" />
              <Text style={styles.mapBtnText}>Haritada Göster</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Açıklama ─────────────────────────────── */}
        {(order.description || order.mobileDescription) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Açıklama</Text>
            {!!order.description && (
              <View style={styles.descBox}>
                <Text style={styles.descLabel}>Genel Açıklama</Text>
                <Text style={styles.descText}>{order.description}</Text>
              </View>
            )}
            {!!order.mobileDescription && (
              <View style={[styles.descBox, { marginTop: 10 }]}>
                <Text style={styles.descLabel}>Mobil Açıklama</Text>
                <Text style={styles.descText}>{order.mobileDescription}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Personel ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personel</Text>
          <DetailRow icon="person-circle-outline" label="Açan Kullanıcı"      value={order.openedByUserName ?? 'Atanmamış'} />
          <DetailRow icon="people-outline"        label="Atanan Kişi"         value={order.assignedToUserName ?? 'Atanmamış'} />
          <DetailRow icon="briefcase-outline"     label="Operasyon Sorumlusu" value={order.operationUserName ?? 'Atanmamış'} />
        </View>

        {/* ── Saha Notu (zorunlu) ───────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Saha Notu{!isFinished && <Text style={styles.required}> *</Text>}
          </Text>
          <TextInput
            style={[styles.noteInput, isFinished && styles.inputDisabled]}
            placeholder="Sahadan not ekleyin..."
            placeholderTextColor="#475569"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={sahaNote}
            onChangeText={setSahaNote}
            editable={!isFinished}
          />
        </View>

        {/* ── Fotoğraflar (en az 1 zorunlu) ───────── */}
        <View style={styles.section}>
          <View style={styles.photoHeader}>
            <Text style={styles.sectionTitle}>
              Fotoğraflar{!isFinished && <Text style={styles.required}> *</Text>}
            </Text>
            <Text style={styles.photoCount}>{photos.length}/10</Text>
          </View>

          {photos.length > 0 && (
            <FlatList
              data={photos}
              horizontal
              keyExtractor={(uri) => uri}
              showsHorizontalScrollIndicator={false}
              style={styles.photoList}
              renderItem={({ item }) => (
                <View style={styles.photoThumb}>
                  <Image source={{ uri: item }} style={styles.thumbImg} />
                  {!isFinished && (
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(item)}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          )}

          {!isFinished && (
            <TouchableOpacity
              style={[styles.addPhotoBtn, photos.length >= 10 && styles.addPhotoBtnDisabled]}
              onPress={pickPhotos}
              disabled={photos.length >= 10}
            >
              <Ionicons name="camera-outline" size={20} color={photos.length >= 10 ? '#475569' : '#F97316'} />
              <Text style={[styles.addPhotoText, photos.length >= 10 && { color: '#475569' }]}>
                {photos.length === 0 ? 'Fotoğraf Ekle' : 'Daha Fazla Ekle'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Periyodik ────────────────────────────── */}
        {order.isPeriodic && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Periyodik Bilgi</Text>
            <DetailRow icon="repeat-outline"   label="Tekrar Sıklığı"  value={order.recurrenceInterval ?? '—'} />
            <DetailRow icon="calendar-outline" label="Sonraki Çalışma" value={order.nextExecutionDate ?? '—'} />
          </View>
        )}
      </ScrollView>

      {/* ── Alt Aksiyon Alanı ──────────────────────── */}
      {!isFinished && (
        <View style={styles.actionArea}>

          {/* İşi Başlat — sadece Bekliyor durumunda */}
          {currentStatus === 'Bekliyor' && (
            <TouchableOpacity
              style={styles.startBtn}
              onPress={handleStart}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'start' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={28} color="#fff" />
                  <Text style={styles.startBtnText}>İşe Başla</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Tamamla + İptal — sadece Devam Ediyor durumunda */}
          {currentStatus === 'Devam Ediyor' && (
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => handleAction('cancel')}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'cancel' ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
                    <Text style={[styles.actionText, { color: '#EF4444' }]}>İptal Et</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.completeBtn]}
                onPress={() => handleAction('complete')}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'complete' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                    <Text style={[styles.actionText, { color: '#fff' }]}>Tamamla</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A233A',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#334155',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  headerCenter: { flex: 1, gap: 6 },
  headerTitle: { color: '#F1F5F9', fontSize: 16, fontWeight: '700' },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  content: { padding: 16, paddingBottom: 30 },

  section: {
    backgroundColor: '#1E293B',
    borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#334155',
  },
  sectionTitle: {
    color: '#94A3B8', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
  },
  required: { color: '#EF4444' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  pillText: { fontSize: 12, fontWeight: '600' },

  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  detailIcon: { marginTop: 2, marginRight: 10 },
  detailTexts: { flex: 1 },
  detailLabel: { color: '#64748B', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  detailValue: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },

  mapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 10, paddingVertical: 12,
    backgroundColor: '#38BDF815', borderRadius: 10,
    borderWidth: 1, borderColor: '#38BDF8',
  },
  mapBtnText: { color: '#38BDF8', fontSize: 14, fontWeight: '700' },

  descBox: { backgroundColor: '#0F172A', borderRadius: 10, padding: 12 },
  descLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  descText: { color: '#CBD5E1', fontSize: 14, lineHeight: 20 },

  noteInput: {
    backgroundColor: '#0F172A', borderRadius: 10, padding: 12,
    color: '#E2E8F0', fontSize: 14, lineHeight: 20,
    minHeight: 100, borderWidth: 1, borderColor: '#334155',
  },
  inputDisabled: { opacity: 0.5 },

  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  photoCount: { color: '#475569', fontSize: 12, fontWeight: '600' },
  photoList: { marginBottom: 12 },
  photoThumb: { position: 'relative', marginRight: 10 },
  thumbImg: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#0F172A' },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
  addPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#F97316', borderStyle: 'dashed',
  },
  addPhotoBtnDisabled: { borderColor: '#334155' },
  addPhotoText: { color: '#F97316', fontSize: 14, fontWeight: '600' },

  // ── Alt aksiyon alanı
  actionArea: {
    borderTopWidth: 1, borderTopColor: '#334155',
    backgroundColor: '#1A233A',
    padding: 16,
  },

  // İşe Başla — büyük, tam genişlik
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingVertical: 18,
    backgroundColor: '#3B82F6', borderRadius: 14,
  },
  startBtnText: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },

  // Tamamla + İptal
  actionBar: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 12, gap: 8,
  },
  cancelBtn: { backgroundColor: '#EF444418', borderWidth: 1, borderColor: '#EF4444' },
  completeBtn: { backgroundColor: '#22C55E' },
  actionText: { fontSize: 16, fontWeight: '700' },
});
