import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import type { SavedPhotoItem } from '../types';
import { getPhotoImageSource } from '../services/api';
import { isOpeningAttachment, isVideoContentType } from '../constants/photos';

type Props = {
  items: SavedPhotoItem[];
  loading?: boolean;
};

async function resolvePlayableUri(item: SavedPhotoItem): Promise<string> {
  if (!item.isVideo) return item.uri;
  const safeName = item.fileName.replace(/[^\w.-]+/g, '_');
  const dest = `${FileSystem.cacheDirectory ?? ''}wo-open-${item.id}-${safeName}`;
  if (!FileSystem.cacheDirectory) return item.uri;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest;
  const downloaded = await FileSystem.downloadAsync(item.uri, dest, {
    headers: item.headers,
  });
  return downloaded.uri;
}

export default function OpeningAttachmentsSection({ items, loading }: Props) {
  const [viewerItem, setViewerItem] = useState<SavedPhotoItem | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  const openViewer = async (item: SavedPhotoItem) => {
    setViewerItem(item);
    setViewerLoading(true);
    setViewerUri(null);
    try {
      const uri = await resolvePlayableUri(item);
      setViewerUri(uri);
    } catch {
      setViewerUri(null);
    } finally {
      setViewerLoading(false);
    }
  };

  const closeViewer = () => {
    setViewerItem(null);
    setViewerUri(null);
    setViewerLoading(false);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Açılış Ekleri</Text>
      {loading ? (
        <ActivityIndicator color="#059669" />
      ) : items.length === 0 ? (
        <Text style={styles.emptyText}>Açılış eki yok.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {items.map((item) => (
            <TouchableOpacity key={item.id} style={styles.card} onPress={() => openViewer(item)}>
              {item.isVideo ? (
                <View style={styles.videoThumb}>
                  <Ionicons name="play-circle" size={36} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: item.uri, headers: item.headers }} style={styles.thumb} resizeMode="cover" />
              )}
              <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={viewerItem != null} animationType="slide" onRequestClose={closeViewer}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>{viewerItem?.fileName ?? ''}</Text>
            <TouchableOpacity onPress={closeViewer}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          {viewerLoading ? (
            <ActivityIndicator color="#fff" size="large" style={styles.modalLoader} />
          ) : viewerItem && viewerUri ? (
            viewerItem.isVideo ? (
              <WebView
                originWhitelist={['*']}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                source={{
                  html: `<!DOCTYPE html><html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><video controls autoplay playsinline style="max-width:100%;max-height:100vh" src="${viewerUri}"></video></body></html>`,
                }}
                style={styles.webview}
              />
            ) : (
              <Image source={{ uri: viewerUri, headers: viewerItem.headers }} style={styles.fullImage} resizeMode="contain" />
            )
          ) : (
            <Text style={styles.emptyText}>Medya açılamadı.</Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

export async function mapOpeningAttachmentsFromApi(
  rows: Array<{ id: string; fileName: string; description?: string | null; contentType?: string }>,
): Promise<SavedPhotoItem[]> {
  const openingRows = rows.filter((p) => isOpeningAttachment(p.description));
  return Promise.all(
    openingRows.map(async (p) => {
      const source = await getPhotoImageSource(p.id);
      const contentType = p.contentType ?? '';
      return {
        id: p.id,
        fileName: p.fileName,
        uri: source.uri,
        headers: source.headers,
        category: null,
        contentType,
        isVideo: isVideoContentType(contentType),
      } satisfies SavedPhotoItem;
    }),
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  emptyText: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
  row: { gap: 10, paddingVertical: 4 },
  card: { width: 120 },
  thumb: { width: 120, height: 90, borderRadius: 10, backgroundColor: '#E2E8F0' },
  videoThumb: {
    width: 120,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { fontSize: 10, color: '#64748B', marginTop: 4, fontWeight: '600' },
  modalRoot: { flex: 1, backgroundColor: '#000' },
  modalHeader: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
  },
  modalTitle: { color: '#fff', fontWeight: '700', flex: 1, marginRight: 12 },
  modalLoader: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#000' },
  fullImage: { flex: 1, width: '100%' },
});
