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

} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useNavigation } from '@react-navigation/native';

import * as ImagePicker from 'expo-image-picker';

import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import type { WorkOrdersStackParamList, RootTabParamList } from '../types';

import { workOrdersApi, photosApi, getPhotoImageSource } from '../services/api';

import { extractApiErrorMessage, ensureAlertMessage } from '../utils/workOrders';

import {

  formatApiDateTime,

  durationMinutes,

} from '../utils/workOrderSchedule';

import {

  PHOTO_CATEGORY_ISG,

  PHOTO_CATEGORY_OPERASYON,

  PHOTO_LIMITS,

  normalizePhotoCategory,

  type PhotoCategory,

} from '../constants/photos';

import PhotoSection, { usePhotoBuckets } from '../components/PhotoSection';

import type { PhotoItem, SavedPhotoItem } from '../types';



type Props = NativeStackScreenProps<WorkOrdersStackParamList, 'WorkOrderDetail'>;



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



export default function WorkOrderDetailScreen({ route }: Props) {

  const navigation = useNavigation<NativeStackNavigationProp<WorkOrdersStackParamList>>();

  const { workOrder: order } = route.params;



  const [currentStatus, setCurrentStatus] = useState(order.status ?? 'Bekliyor');

  const [actionLoading, setActionLoading] = useState<'start' | 'complete' | 'cancel' | null>(null);

  const [uploadProgress, setUploadProgress] = useState('');

  const [sahaNote, setSahaNote] = useState(order.fieldNote ?? '');

  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const [savedPhotos, setSavedPhotos] = useState<SavedPhotoItem[]>([]);

  const [loadingAttachments, setLoadingAttachments] = useState(true);

  const [startedAt, setStartedAt] = useState<string | null>(order.startedAt ?? null);

  const [completedAt, setCompletedAt] = useState<string | null>(order.completedAt ?? null);

  const [cancelledAt, setCancelledAt] = useState<string | null>(order.cancelledAt ?? null);

  const isFinished = currentStatus === 'Tamamlandı' || currentStatus === 'İptal';

  const buckets = usePhotoBuckets(photos, savedPhotos);



  useEffect(() => {

    const parent = navigation.getParent();

    parent?.setOptions({ headerShown: false });

    return () => { parent?.setOptions({ headerShown: true }); };

  }, [navigation]);



  useEffect(() => {

    setSahaNote(order.fieldNote ?? '');

    setStartedAt(order.startedAt ?? null);

    setCompletedAt(order.completedAt ?? null);

    setCancelledAt(order.cancelledAt ?? null);

    loadSavedAttachments();

  }, [order.id, order.fieldNote, order.startedAt, order.completedAt, order.cancelledAt]);



  const loadSavedAttachments = async () => {

    setLoadingAttachments(true);

    try {

      const { data } = await photosApi.list('WorkOrder', order.id);

      const items = await Promise.all(

        data.map(async (p) => {

          const source = await getPhotoImageSource(p.id);

          return {

            id: p.id,

            fileName: p.fileName,

            uri: source.uri,

            headers: source.headers,

            category: normalizePhotoCategory(p.description),

          } satisfies SavedPhotoItem;

        }),

      );

      setSavedPhotos(items);

    } catch {

      setSavedPhotos([]);

    } finally {

      setLoadingAttachments(false);

    }

  };



  const countCategoryPhotos = (category: PhotoCategory) => {

    const pending = photos.filter((p) => p.category === category).length;

    const saved = savedPhotos.filter((p) => p.category === category).length;

    return pending + saved;

  };



  const pickPhotos = async (category: PhotoCategory) => {

    const limit = PHOTO_LIMITS[category];

    const currentCount = countCategoryPhotos(category);

    const remaining = Math.max(limit - currentCount, 0);

    if (remaining === 0) return;



    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {

      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri erişim izni gereklidir.');

      return;

    }



    const result = await ImagePicker.launchImageLibraryAsync({

      mediaTypes: ['images'],

      allowsMultipleSelection: true,

      quality: 0.7,

      selectionLimit: remaining,

      base64: true,

    });



    if (!result.canceled) {

      const newItems: PhotoItem[] = result.assets.map((a) => ({

        uri: a.uri,

        base64: a.base64 ?? '',

        fileName: a.fileName ?? `photo_${Date.now()}.jpg`,

        mimeType: a.mimeType ?? 'image/jpeg',

        category,

      }));

      setPhotos((prev) => {

        const other = prev.filter((p) => p.category !== category);

        const same = prev.filter((p) => p.category === category);

        return [...other, ...same, ...newItems].slice(0, other.length + limit);

      });

    }

  };



  const removePhoto = (category: PhotoCategory, uri: string) => {

    setPhotos((prev) => prev.filter((p) => !(p.category === category && p.uri === uri)));

  };



  const uploadPendingPhotos = async () => {

    if (photos.length === 0) return;

    for (let i = 0; i < photos.length; i++) {

      const p = photos[i];

      if (!p.base64?.trim()) {

        throw new Error('Seçilen fotoğraflardan biri okunamadı. Lütfen fotoğrafları yeniden ekleyin.');

      }

      setUploadProgress(`Fotoğraf yükleniyor ${i + 1}/${photos.length}...`);

      await photosApi.upload({

        base64Data: p.base64,

        fileName: p.fileName,

        contentType: p.mimeType,

        entityType: 'WorkOrder',

        entityId: order.id,

        description: p.category,

      });

    }

    setUploadProgress('');

  };



  const updateStatus = async (newStatus: string, loadingKey: 'start' | 'complete' | 'cancel') => {

    setActionLoading(loadingKey);

    try {

      if (loadingKey !== 'start') {

        await uploadPendingPhotos();

      }

      const res = await workOrdersApi.updateStatus(order.id, newStatus, sahaNote);

      setCurrentStatus(res.data.status ?? newStatus);

      if (res.data.startedAt !== undefined) setStartedAt(res.data.startedAt ?? null);

      if (res.data.completedAt !== undefined) setCompletedAt(res.data.completedAt ?? null);

      if (res.data.cancelledAt !== undefined) setCancelledAt(res.data.cancelledAt ?? null);



      if (newStatus === 'Tamamlandı' || newStatus === 'İptal') {

        Alert.alert('Başarılı', `İş emri "${newStatus}" olarak işaretlendi.`, [

          { text: 'Tamam', onPress: () => navigation.goBack() },

        ]);

      }

    } catch (err: any) {

      const msg = err.message && !err.response

        ? err.message

        : ensureAlertMessage(

            extractApiErrorMessage(err, 'İşlem gerçekleştirilemedi.'),

            'İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.',

          );

      Alert.alert('Hata', msg);

    } finally {

      setActionLoading(null);

      setUploadProgress('');

    }

  };



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



  const handleAction = (action: 'complete' | 'cancel') => {

    if (!sahaNote.trim()) {

      Alert.alert('Eksik Bilgi', 'Lütfen "Saha Notu" alanını doldurun.');

      return;

    }



    const isgCount = countCategoryPhotos(PHOTO_CATEGORY_ISG);

    const operasyonCount = countCategoryPhotos(PHOTO_CATEGORY_OPERASYON);

    if (isgCount === 0) {

      Alert.alert('Eksik Fotoğraf', 'Lütfen en az bir İSG fotoğrafı ekleyin.');

      return;

    }

    if (operasyonCount === 0) {

      Alert.alert('Eksik Fotoğraf', 'Lütfen en az bir Operasyoncu fotoğrafı ekleyin.');

      return;

    }



    const newStatus = action === 'complete' ? 'Tamamlandı' : 'İptal';

    const label = action === 'complete' ? 'Tamamla' : 'İptal Et';



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



  const handleShowOnMap = () => {

    const lat = order.position?.[0];

    const lng = order.position?.[1];

    if (!lat || !lng || (lat === 0 && lng === 0)) {

      Alert.alert('Konum Yok', 'Bu iş emrinde kayıtlı konum bilgisi bulunmuyor.');

      return;

    }

    const parentNav = navigation.getParent<NativeStackNavigationProp<RootTabParamList>>();

    parentNav?.navigate('Harita', {

      focusLatitude: lat,

      focusLongitude: lng,

      focusLabel: order.customerName || order.title || 'İş Emri',

    });

  };



  return (

    <View style={styles.container}>

      <View style={styles.header}>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>

          <Ionicons name="arrow-back" size={22} color="#fff" />

        </TouchableOpacity>

        <View style={styles.headerCenter}>

          <Text style={styles.headerTitle} numberOfLines={1}>

            {order.customerName || order.title || 'İş Emri Detayı'}

          </Text>

          <View style={[styles.statusBadge, { backgroundColor: statusColor(currentStatus) + '30', borderColor: statusColor(currentStatus) }]}>

            <Text style={[styles.statusText, { color: statusColor(currentStatus) }]}>{currentStatus}</Text>

          </View>

        </View>

      </View>



      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

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



        <View style={styles.section}>

          <Text style={styles.sectionTitle}>Temel Bilgiler</Text>

          <DetailRow icon="person-outline" label="Müşteri / Nokta Adı" value={order.customerName ?? order.title ?? '—'} />

          <DetailRow icon="location-outline" label="Adres" value={order.address ?? '—'} />



          <DetailRow icon="calendar-outline" label="Planlanan Başlangıç" value={formatApiDateTime(order.startDate)} />

          <DetailRow icon="calendar-outline" label="Planlanan Bitiş" value={formatApiDateTime(order.endDate)} />

          <DetailRow icon="play-outline" label="Gerçek Başlangıç" value={formatApiDateTime(startedAt)} />

          {currentStatus === 'İptal' || cancelledAt ? (

            <DetailRow icon="close-circle-outline" label="İptal Tarihi" value={formatApiDateTime(cancelledAt)} />

          ) : (

            <DetailRow icon="checkmark-circle-outline" label="Bitiş Tarihi" value={formatApiDateTime(completedAt)} />

          )}

          {durationMinutes(startedAt, completedAt) != null && (

            <DetailRow icon="timer-outline" label="Süre (dk)" value={String(durationMinutes(startedAt, completedAt))} />

          )}



          {order.position?.[0] !== 0 && order.position?.[0] != null && (

            <TouchableOpacity style={styles.mapBtn} onPress={handleShowOnMap}>

              <Ionicons name="map" size={20} color="#38BDF8" />

              <Text style={styles.mapBtnText}>Haritada Göster</Text>

            </TouchableOpacity>

          )}

        </View>



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

                <Text style={styles.descLabel}>Mühendis Açıklaması</Text>

                <Text style={styles.descText}>{order.mobileDescription}</Text>

              </View>

            )}

          </View>

        )}



        <View style={styles.section}>

          <Text style={styles.sectionTitle}>Personel</Text>

          <DetailRow icon="person-circle-outline" label="Açan Kullanıcı" value={order.openedByUserName ?? 'Atanmamış'} />

          <DetailRow icon="people-outline" label="Atanan Kişi" value={order.assignedToUserName ?? 'Atanmamış'} />

          <DetailRow icon="briefcase-outline" label="Operasyon Sorumlusu" value={order.operationUserName ?? 'Atanmamış'} />

        </View>



        <View style={styles.section}>

          <Text style={styles.sectionTitle}>

            Saha Notu{!isFinished && <Text style={styles.required}> *</Text>}

          </Text>

          {isFinished ? (

            <View style={styles.descBox}>

              <Text style={styles.descText}>{sahaNote.trim() || 'Saha notu girilmemiş.'}</Text>

              {!!order.fieldNoteAddedAt && <Text style={styles.noteMeta}>{order.fieldNoteAddedAt}</Text>}

            </View>

          ) : (

            <TextInput

              style={styles.noteInput}

              placeholder="Sahadan not ekleyin..."

              placeholderTextColor="#475569"

              multiline

              numberOfLines={4}

              textAlignVertical="top"

              value={sahaNote}

              onChangeText={setSahaNote}

            />

          )}

        </View>



        <View style={styles.section}>

          <Text style={styles.sectionTitle}>Saha Fotoğrafları</Text>

          <PhotoSection

            title="İSG"

            category={PHOTO_CATEGORY_ISG}

            pendingPhotos={buckets.isgPending}

            savedPhotos={buckets.isgSaved}

            isFinished={isFinished}

            loadingSaved={loadingAttachments}

            onPick={pickPhotos}

            onRemove={removePhoto}

            required

          />

          <PhotoSection

            title="Operasyoncu"

            category={PHOTO_CATEGORY_OPERASYON}

            pendingPhotos={buckets.operasyonPending}

            savedPhotos={buckets.operasyonSaved}

            isFinished={isFinished}

            loadingSaved={loadingAttachments}

            onPick={pickPhotos}

            onRemove={removePhoto}

            required

          />

        </View>



        {order.isPeriodic && (

          <View style={styles.section}>

            <Text style={styles.sectionTitle}>Periyodik Bilgi</Text>

            <DetailRow icon="repeat-outline" label="Tekrar Sıklığı" value={order.recurrenceInterval ?? '—'} />

            <DetailRow icon="calendar-outline" label="Sonraki Çalışma" value={order.nextExecutionDate ?? '—'} />

          </View>

        )}

      </ScrollView>



      {!isFinished && (

        <View style={styles.actionArea}>

          {!!uploadProgress && (

            <View style={styles.progressRow}>

              <ActivityIndicator size="small" color="#F97316" />

              <Text style={styles.progressText}>{uploadProgress}</Text>

            </View>

          )}



          {currentStatus === 'Bekliyor' && (

            <TouchableOpacity style={styles.startBtn} onPress={handleStart} disabled={actionLoading !== null}>

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

  noteMeta: { color: '#64748B', fontSize: 11, marginTop: 8 },

  actionArea: {

    borderTopWidth: 1, borderTopColor: '#334155',

    backgroundColor: '#1A233A',

    padding: 16,

  },

  progressRow: {

    flexDirection: 'row', alignItems: 'center', gap: 10,

    marginBottom: 12, paddingHorizontal: 4,

  },

  progressText: { color: '#F97316', fontSize: 13, fontWeight: '600' },

  startBtn: {

    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',

    gap: 12, paddingVertical: 18,

    backgroundColor: '#3B82F6', borderRadius: 14,

  },

  startBtnText: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },

  actionBar: { flexDirection: 'row', gap: 12 },

  actionBtn: {

    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',

    paddingVertical: 16, borderRadius: 12, gap: 8,

  },

  cancelBtn: { backgroundColor: '#EF444418', borderWidth: 1, borderColor: '#EF4444' },

  completeBtn: { backgroundColor: '#22C55E' },

  actionText: { fontSize: 16, fontWeight: '700' },

});


