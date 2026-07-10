import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PHOTO_CATEGORY_ISG,
  PHOTO_CATEGORY_OPERASYON,
  PHOTO_LIMITS,
  type PhotoCategory,
} from '../constants/photos';
import type { PhotoItem, SavedPhotoItem } from '../types';

interface PhotoSectionProps {
  title: string;
  category: PhotoCategory;
  pendingPhotos: PhotoItem[];
  savedPhotos: SavedPhotoItem[];
  isFinished: boolean;
  loadingSaved: boolean;
  onPick: (category: PhotoCategory) => void;
  onRemove: (category: PhotoCategory, uri: string) => void;
  required?: boolean;
}

export default function PhotoSection({
  title,
  category,
  pendingPhotos,
  savedPhotos,
  isFinished,
  loadingSaved,
  onPick,
  onRemove,
  required = false,
}: PhotoSectionProps) {
  const limit = PHOTO_LIMITS[category];
  const totalCount = pendingPhotos.length + savedPhotos.length;
  const atLimit = totalCount >= limit;

  const accentColor = category === PHOTO_CATEGORY_ISG ? '#22C55E' : '#3B82F6';

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.badge, { backgroundColor: accentColor + '22', borderColor: accentColor }]}>
            <Text style={[styles.badgeText, { color: accentColor }]}>{title}</Text>
          </View>
          {required && !isFinished && <Text style={styles.required}> *</Text>}
        </View>
        <Text style={styles.count}>{totalCount}/{limit}</Text>
      </View>

      {loadingSaved && isFinished && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#F97316" />
          <Text style={styles.loadingText}>Fotoğraflar yükleniyor...</Text>
        </View>
      )}

      {savedPhotos.length > 0 && (
        <FlatList
          data={savedPhotos}
          horizontal
          keyExtractor={(item) => `saved-${category}-${item.id}`}
          showsHorizontalScrollIndicator={false}
          style={styles.list}
          renderItem={({ item }) => (
            <View style={styles.thumb}>
              <Image source={{ uri: item.uri, headers: item.headers }} style={styles.image} />
            </View>
          )}
        />
      )}

      {!isFinished && pendingPhotos.length > 0 && (
        <FlatList
          data={pendingPhotos}
          horizontal
          keyExtractor={(item) => item.uri}
          showsHorizontalScrollIndicator={false}
          style={styles.list}
          renderItem={({ item }) => (
            <View style={styles.thumb}>
              <Image source={{ uri: item.uri }} style={styles.image} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(category, item.uri)}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {isFinished && !loadingSaved && savedPhotos.length === 0 && (
        <Text style={styles.emptyText}>Bu kategoride fotoğraf yok.</Text>
      )}

      {!isFinished && (
        <TouchableOpacity
          style={[styles.addBtn, atLimit && styles.addBtnDisabled]}
          onPress={() => onPick(category)}
          disabled={atLimit}
        >
          <Ionicons name="camera-outline" size={18} color={atLimit ? '#475569' : accentColor} />
          <Text style={[styles.addText, atLimit && { color: '#475569' }]}>
            {totalCount === 0 ? `${title} Fotoğrafı Ekle` : 'Daha Fazla Ekle'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function usePhotoBuckets(photos: PhotoItem[], savedPhotos: SavedPhotoItem[]) {
  return useMemo(() => ({
    isgPending: photos.filter((p) => p.category === PHOTO_CATEGORY_ISG),
    operasyonPending: photos.filter((p) => p.category === PHOTO_CATEGORY_OPERASYON),
    isgSaved: savedPhotos.filter((p) => p.category === PHOTO_CATEGORY_ISG),
    operasyonSaved: savedPhotos.filter((p) => p.category === PHOTO_CATEGORY_OPERASYON),
  }), [photos, savedPhotos]);
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  required: { color: '#EF4444', fontWeight: '700' },
  count: { color: '#475569', fontSize: 12, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  loadingText: { color: '#94A3B8', fontSize: 12 },
  list: { marginBottom: 10 },
  thumb: { position: 'relative', marginRight: 10 },
  image: { width: 84, height: 84, borderRadius: 10, backgroundColor: '#1E293B' },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
  emptyText: { color: '#64748B', fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#475569',
  },
  addBtnDisabled: { borderColor: '#334155' },
  addText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
});
