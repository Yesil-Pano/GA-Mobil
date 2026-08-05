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

import type { WorkOrdersStackParamList, RootTabParamList, WorkOrder } from '../types';

import { workOrdersApi, photosApi, getPhotoImageSource } from '../services/api';

import { extractApiErrorMessage, ensureAlertMessage, filterWorkOrdersForUser, getCurrentUserId } from '../utils/workOrders';
import { parseWorkOrderCoords } from '../utils/workOrderCoords';
import { filterMobileVisibleWorkOrders } from '../utils/workOrderSchedule';

function resolveWorkOrderForDetail(orders: WorkOrder[], userId: string | null, targetId: string): WorkOrder | undefined {
  const allMine = filterWorkOrdersForUser(orders, userId);
  let found = allMine.find((o) => o.id === targetId);
  if (found?.isPeriodic && !found.parentWorkOrderId) {
    const activeChild = filterMobileVisibleWorkOrders(orders, userId).find(
      (o) => o.parentWorkOrderId === found!.id,
    );
    if (activeChild) found = activeChild;
  }
  return found ?? filterMobileVisibleWorkOrders(orders, userId).find((o) => o.id === targetId);
}

import {
  formatApiDateTime,
  durationMinutes,
  displayWorkOrderStatus,
  isWorkOrderFinished,
  canShowStartWorkOrder,
  shouldShowInProgressActions,
} from '../utils/workOrderSchedule';

import {

  PHOTO_CATEGORY_ISG,

  PHOTO_CATEGORY_OPERASYON,

  PHOTO_LIMITS,

  normalizePhotoCategory,

  type PhotoCategory,

} from '../constants/photos';

import PhotoSection, { usePhotoBuckets } from '../components/PhotoSection';
import OpeningAttachmentsSection, { mapOpeningAttachmentsFromApi } from '../components/OpeningAttachmentsSection';
import { isOpeningAttachment } from '../constants/photos';
import { isTeslaCompany } from '../utils/partners';
import { useTheme, fs } from '../theme/ThemeContext';
import * as SecureStore from 'expo-secure-store';

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

  const initialOrder = route.params.workOrder;
  const pendingId = route.params.workOrderId;

  const [order, setOrder] = useState(initialOrder);
  const [loadingOrder, setLoadingOrder] = useState(!initialOrder && !!pendingId);

  useEffect(() => {
    if (initialOrder || !pendingId) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ data }, userId] = await Promise.all([
          workOrdersApi.getAll(),
          getCurrentUserId(),
        ]);
        const found = resolveWorkOrderForDetail(data, userId, pendingId);
        if (!cancelled && found) setOrder(found);
      } catch (err) {
        console.warn('[WorkOrderDetail] Yüklenemedi:', err);
      } finally {
        if (!cancelled) setLoadingOrder(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialOrder, pendingId]);

  const [currentStatus, setCurrentStatus] = useState(
    displayWorkOrderStatus(initialOrder?.status),
  );

  const [actionLoading, setActionLoading] = useState<'start' | 'complete' | 'cancel' | null>(null);

  const [uploadProgress, setUploadProgress] = useState('');

  const [sahaNote, setSahaNote] = useState(initialOrder?.fieldNote ?? '');

  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const [savedPhotos, setSavedPhotos] = useState<SavedPhotoItem[]>([]);
  const [openingAttachments, setOpeningAttachments] = useState<SavedPhotoItem[]>([]);

  const [loadingAttachments, setLoadingAttachments] = useState(true);

  const [startedAt, setStartedAt] = useState<string | null>(initialOrder?.startedAt ?? null);

  const [completedAt, setCompletedAt] = useState<string | null>(initialOrder?.completedAt ?? null);

  const [cancelledAt, setCancelledAt] = useState<string | null>(initialOrder?.cancelledAt ?? null);
  const { colors } = useTheme();
  const [displayLang, setDisplayLang] = useState<'en' | 'tr'>('tr');
  const [isTesla, setIsTesla] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [titleEn, setTitleEn] = useState(initialOrder?.titleEn ?? null);
  const [descriptionEn, setDescriptionEn] = useState(initialOrder?.descriptionEn ?? null);
  const [mobileDescriptionEn, setMobileDescriptionEn] = useState(initialOrder?.mobileDescriptionEn ?? null);
  const [fieldNoteEn, setFieldNoteEn] = useState(initialOrder?.fieldNoteEn ?? null);

  useEffect(() => {
    if (!order) return;
    setCurrentStatus(displayWorkOrderStatus(order.status));
    setSahaNote(order.fieldNote ?? '');
    setStartedAt(order.startedAt ?? null);
    setCompletedAt(order.completedAt ?? null);
    setCancelledAt(order.cancelledAt ?? null);
    setTitleEn(order.titleEn ?? null);
    setDescriptionEn(order.descriptionEn ?? null);
    setMobileDescriptionEn(order.mobileDescriptionEn ?? null);
    setFieldNoteEn(order.fieldNoteEn ?? null);
  }, [order?.id]);

  const isFinished = isWorkOrderFinished(currentStatus);
  const showStartButton = order
    ? canShowStartWorkOrder({ status: currentStatus, startedAt, assignedToUserId: order.assignedToUserId })
    : false;
  const showProgressActions = order ? shouldShowInProgressActions({ status: currentStatus, startedAt }) : false;

  const buckets = usePhotoBuckets(photos, savedPhotos);


  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    (async () => {
      const company = await SecureStore.getItemAsync('user_company');
      const tesla = isTeslaCompany(company) || isTeslaCompany(order.customerName);
      if (!cancelled) {
        setIsTesla(tesla);
        setDisplayLang(tesla ? 'en' : 'tr');
      }
    })();
    return () => { cancelled = true; };
  }, [order?.id, order?.customerName]);

  const ensureTranslation = async () => {
    if (!order || titleEn?.trim()) return;
    setIsTranslating(true);
    try {
      const { data } = await workOrdersApi.translate(order.id);
      setTitleEn(data.titleEn ?? null);
      setDescriptionEn(data.descriptionEn ?? null);
      setMobileDescriptionEn(data.mobileDescriptionEn ?? null);
      setFieldNoteEn(data.fieldNoteEn ?? null);
    } catch (e) {
      Alert.alert('Çeviri', 'İngilizce çeviri alınamadı.');
    } finally {
      setIsTranslating(false);
    }
  };

  const showEn = isTesla && displayLang === 'en';
  const viewTitle = showEn && titleEn?.trim() ? titleEn : (order?.title ?? '');
  const viewDescription = showEn && descriptionEn?.trim() ? descriptionEn : (order?.description ?? '');
  const viewMobileDescription = showEn && mobileDescriptionEn?.trim() ? mobileDescriptionEn : (order?.mobileDescription ?? '');
  const viewFieldNote = showEn && fieldNoteEn?.trim() ? fieldNoteEn : (sahaNote.trim() || 'Saha notu girilmemiş.');


  useEffect(() => {
    if (!isTesla || displayLang !== 'en') return;
    void ensureTranslation();
  }, [isTesla, displayLang]);




  useEffect(() => {

    const parent = navigation.getParent();

    parent?.setOptions({ headerShown: false });

    return () => { parent?.setOptions({ headerShown: true }); };

  }, [navigation]);



  useEffect(() => {
    if (!order) return;
    setSahaNote(order.fieldNote ?? '');
    setStartedAt(order.startedAt ?? null);
    setCompletedAt(order.completedAt ?? null);
    setCancelledAt(order.cancelledAt ?? null);
    loadSavedAttachments();
  }, [order?.id, order?.fieldNote, order?.startedAt, order?.completedAt, order?.cancelledAt]);



  const loadSavedAttachments = async () => {
    if (!order) return;
    setLoadingAttachments(true);

    try {

      const { data } = await photosApi.list('WorkOrder', order.id);

      setOpeningAttachments(await mapOpeningAttachmentsFromApi(data));

      const fieldRows = data.filter((p) => !isOpeningAttachment(p.description));

      const items = await Promise.all(

        fieldRows.map(async (p) => {

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
      setOpeningAttachments([]);

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
    const coords = parseWorkOrderCoords(order);
    if (!coords) {
      Alert.alert('Konum Yok', 'Bu iş emrinde kayıtlı konum bilgisi bulunmuyor.');
      return;
    }

    const parentNav = navigation.getParent<NativeStackNavigationProp<RootTabParamList>>();

    parentNav?.navigate('Harita', {
      focusLatitude: coords.latitude,
      focusLongitude: coords.longitude,
      focusLabel: order.customerName || order.title || 'İş Emri',
    });
  };



  if (loadingOrder) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#64748B', textAlign: 'center' }}>İş emri bulunamadı.</Text>
      </View>
    );
  }



  return (

    <View style={[styles.container, { backgroundColor: colors.bg }]}>

      <View style={styles.header}>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>

          <Ionicons name="arrow-back" size={22} color="#fff" />

        </TouchableOpacity>

        <View style={styles.headerCenter}>

          <Text style={styles.headerTitle} numberOfLines={1}>

            {order.customerName || viewTitle || order.title || 'İş Emri Detayı'}

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



          {parseWorkOrderCoords(order) != null && (

            <TouchableOpacity style={styles.mapBtn} onPress={handleShowOnMap}>

              <Ionicons name="map" size={20} color="#38BDF8" />

              <Text style={styles.mapBtnText}>Haritada Göster</Text>

            </TouchableOpacity>

          )}

        </View>



        {isTesla && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 4 }}>
            <TouchableOpacity
              onPress={async () => {
                setDisplayLang('en');
                await ensureTranslation();
              }}
              style={{ padding: 6, borderRadius: 8, borderWidth: displayLang === 'en' ? 2 : 0, borderColor: '#3B82F6' }}
            >
              <Text style={{ fontSize: fs(20) }}>🇬🇧</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDisplayLang('tr')}
              style={{ padding: 6, borderRadius: 8, borderWidth: displayLang === 'tr' ? 2 : 0, borderColor: '#EF4444' }}
            >
              <Text style={{ fontSize: fs(20) }}>🇹🇷</Text>
            </TouchableOpacity>
            {isTranslating && <Text style={{ color: '#94A3B8', fontSize: fs(12) }}>Çevriliyor…</Text>}
          </View>
        )}

        {(viewDescription || viewMobileDescription || order.description || order.mobileDescription) && (

          <View style={styles.section}>

            <Text style={styles.sectionTitle}>Açıklama</Text>

            {!!(showEn ? viewDescription : order.description) && (

              <View style={styles.descBox}>

                <Text style={styles.descLabel}>Genel Açıklama</Text>

                <Text style={styles.descText}>{showEn ? viewDescription : order.description}</Text>

              </View>

            )}

            {!!(showEn ? viewMobileDescription : order.mobileDescription) && (

              <View style={[styles.descBox, { marginTop: 10 }]}>

                <Text style={styles.descLabel}>Mühendis Açıklaması</Text>

                <Text style={styles.descText}>{showEn ? viewMobileDescription : order.mobileDescription}</Text>

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

              <Text style={styles.descText}>{isFinished && showEn ? viewFieldNote : (sahaNote.trim() || 'Saha notu girilmemiş.')}</Text>

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



        <OpeningAttachmentsSection items={openingAttachments} loading={loadingAttachments} />



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



          {showStartButton && (

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



          {showProgressActions && (

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

  headerTitle: { color: '#F1F5F9', fontSize: 18, fontWeight: '700' },

  statusBadge: {

    alignSelf: 'flex-start',

    paddingHorizontal: 10, paddingVertical: 3,

    borderRadius: 8, borderWidth: 1,

  },

  statusText: { fontSize: 13, fontWeight: '700' },

  content: { padding: 16, paddingBottom: 30 },

  section: {

    backgroundColor: '#1E293B',

    borderRadius: 14, padding: 16,

    marginBottom: 12, borderWidth: 1, borderColor: '#334155',

  },

  sectionTitle: {

    color: '#94A3B8', fontSize: 13, fontWeight: '700',

    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,

  },

  required: { color: '#EF4444' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },

  pillText: { fontSize: 14, fontWeight: '600' },

  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },

  detailIcon: { marginTop: 2, marginRight: 10 },

  detailTexts: { flex: 1 },

  detailLabel: { color: '#64748B', fontSize: 13, fontWeight: '600', marginBottom: 2 },

  detailValue: { color: '#E2E8F0', fontSize: 16, fontWeight: '500' },


  mapBtn: {

    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',

    gap: 8, marginTop: 10, paddingVertical: 12,

    backgroundColor: '#38BDF815', borderRadius: 10,

    borderWidth: 1, borderColor: '#38BDF8',

  },

  mapBtnText: { color: '#38BDF8', fontSize: 16, fontWeight: '700' },

  descBox: { backgroundColor: '#0F172A', borderRadius: 10, padding: 12 },

  descLabel: { color: '#64748B', fontSize: 13, fontWeight: '700', marginBottom: 6 },

  descText: { color: '#CBD5E1', fontSize: 16, lineHeight: 20 },

  noteInput: {

    backgroundColor: '#0F172A', borderRadius: 10, padding: 12,

    color: '#E2E8F0', fontSize: 16, lineHeight: 20,

    minHeight: 100, borderWidth: 1, borderColor: '#334155',

  },

  noteMeta: { color: '#64748B', fontSize: 13, marginTop: 8 },

  actionArea: {

    borderTopWidth: 1, borderTopColor: '#334155',

    backgroundColor: '#1A233A',

    padding: 16,

  },

  progressRow: {

    flexDirection: 'row', alignItems: 'center', gap: 10,

    marginBottom: 12, paddingHorizontal: 4,

  },

  progressText: { color: '#F97316', fontSize: 15, fontWeight: '600' },

  startBtn: {

    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',

    gap: 12, paddingVertical: 18,

    backgroundColor: '#3B82F6', borderRadius: 14,

  },

  startBtnText: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },

  actionBar: { flexDirection: 'row', gap: 12 },

  actionBtn: {

    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',

    paddingVertical: 16, borderRadius: 12, gap: 8,

  },

  cancelBtn: { backgroundColor: '#EF444418', borderWidth: 1, borderColor: '#EF4444' },

  completeBtn: { backgroundColor: '#22C55E' },

  actionText: { fontSize: 18, fontWeight: '700' },

});


