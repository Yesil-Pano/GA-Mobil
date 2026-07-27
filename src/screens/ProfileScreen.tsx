import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { usersApi } from '../services/api';
import type { UserProfile } from '../types';
import { useTheme } from '../theme/ThemeContext';

function InfoRow({
  label,
  value,
  icon,
  colors,
  fs,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: ReturnType<typeof useTheme>['colors'];
  fs: (n: number) => number;
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.infoIconWrap, { backgroundColor: colors.border }]}>
        <Ionicons name={icon} size={16} color={colors.muted} />
      </View>
      <View style={styles.infoTexts}>
        <Text style={[styles.infoLabel, { color: colors.faint, fontSize: fs(11) }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.textSecondary, fontSize: fs(14) }]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

interface ProfileScreenProps {
  onLogout: () => void;
}

export default function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const { colors, mode, toggleMode, fs, isDark } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [localPdfUri, setLocalPdfUri] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.getProfile();
      setProfile(data);
      if (data.companyName) {
        await SecureStore.setItemAsync('user_company', data.companyName);
      }
      if (data.tenantId) {
        await SecureStore.setItemAsync('user_tenant_id', data.tenantId);
      }
    } catch {
      const name = await SecureStore.getItemAsync('user_name');
      if (name) {
        setProfile({ fullName: name, email: '—', companyName: '—' });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const downloadAuthPdf = async (): Promise<string | null> => {
    const { data } = await usersApi.getAuthorizationDocument();
    const base64 = arrayBufferToBase64(data);
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) throw new Error('Dosya dizini yok');
    const path = `${dir}yetki-belgesi-${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return path;
  };

  const handleViewAuthDoc = async () => {
    if (!profile?.hasAuthorizationDocument) {
      Alert.alert('Yetki Belgesi', 'Yüklenmiş yetki belgesi bulunamadı.');
      return;
    }
    setAuthBusy(true);
    try {
      const path = await downloadAuthPdf();
      if (!path) return;
      setLocalPdfUri(path);
      setPdfModalVisible(true);
      if (Platform.OS === 'android' && typeof FileSystem.getContentUriAsync === 'function') {
        const contentUri = await FileSystem.getContentUriAsync(path);
        await Linking.openURL(contentUri);
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(path, {
            mimeType: 'application/pdf',
            dialogTitle: 'Yetki Belgesi',
            UTI: 'com.adobe.pdf',
          });
        }
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.message || err?.message || 'Yetki belgesi açılamadı.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleShareAuthDoc = async () => {
    if (!profile?.hasAuthorizationDocument) {
      Alert.alert('Yetki Belgesi', 'Yüklenmiş yetki belgesi bulunamadı.');
      return;
    }
    setAuthBusy(true);
    try {
      const path = localPdfUri ?? (await downloadAuthPdf());
      if (!path) return;
      setLocalPdfUri(path);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Paylaşım', 'Bu cihazda paylaşım desteklenmiyor.');
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: 'application/pdf',
        dialogTitle: 'Yetki Belgesi Paylaş',
        UTI: 'com.adobe.pdf',
      });
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.message || err?.message || 'Paylaşılamadı.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Çıkış', 'Çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('user_token');
          await SecureStore.deleteItemAsync('user_id');
          await SecureStore.deleteItemAsync('user_name');
          await SecureStore.deleteItemAsync('user_company');
          await SecureStore.deleteItemAsync('user_tenant_id');
          await SecureStore.deleteItemAsync('remember_me');
          onLogout();
        },
      },
    ]);
  };

  const initials = profile?.fullName
    ? profile.fullName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : 'GA';

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.orange} />
        <Text style={{ color: colors.muted, fontSize: fs(14), marginTop: 12 }}>Profil yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: colors.orange, borderColor: colors.orange + '44' }]}>
          <Text style={[styles.avatarText, { fontSize: fs(32) }]}>{initials}</Text>
        </View>
        <Text style={[styles.fullName, { color: colors.text, fontSize: fs(20) }]}>{profile?.fullName ?? '—'}</Text>
        <Text style={{ color: colors.muted, fontSize: fs(13), marginTop: 4 }}>{profile?.companyName ?? '—'}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.faint, fontSize: fs(11) }]}>Hesap Bilgileri</Text>
        <InfoRow label="Ad Soyad" value={profile?.fullName ?? '—'} icon="person-outline" colors={colors} fs={fs} />
        <InfoRow label="E-Posta" value={profile?.email ?? '—'} icon="mail-outline" colors={colors} fs={fs} />
        <InfoRow label="Şirket" value={profile?.companyName ?? '—'} icon="business-outline" colors={colors} fs={fs} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.faint, fontSize: fs(11) }]}>Yetki Belgesi</Text>
        {profile?.hasAuthorizationDocument ? (
          <>
            <Text style={{ color: colors.textSecondary, fontSize: fs(13), marginBottom: 12 }} numberOfLines={2}>
              📄 {profile.authorizationDocumentFileName || 'yetki-belgesi.pdf'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.authBtn, { backgroundColor: colors.info, opacity: authBusy ? 0.6 : 1 }]}
                onPress={handleViewAuthDoc}
                disabled={authBusy}
              >
                <Ionicons name="eye-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs(13) }}>
                  {authBusy ? '…' : 'Tam Ekran'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authBtn, { backgroundColor: colors.orange, opacity: authBusy ? 0.6 : 1 }]}
                onPress={handleShareAuthDoc}
                disabled={authBusy}
              >
                <Ionicons name="share-social-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs(13) }}>Paylaş</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: fs(13) }}>
            Henüz yetki belgesi yüklenmemiş. Web panelinden Admin yükleyebilir.
          </Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.faint, fontSize: fs(11) }]}>Uygulama</Text>

        <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.border }]} onPress={fetchProfile}>
          <Ionicons name="refresh-outline" size={18} color={colors.muted} style={styles.settingIcon} />
          <Text style={[styles.settingText, { color: colors.textSecondary, fontSize: fs(14) }]}>Profili Yenile</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.border }]} onPress={toggleMode}>
          <Ionicons
            name={isDark ? 'moon-outline' : 'sunny-outline'}
            size={18}
            color={colors.muted}
            style={styles.settingIcon}
          />
          <Text style={[styles.settingText, { color: colors.textSecondary, fontSize: fs(14) }]}>Tema</Text>
          <Text style={{ color: colors.faint, fontSize: fs(13) }}>{mode === 'dark' ? 'Dark (Lacivert)' : 'Light'}</Text>
        </TouchableOpacity>

        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <Ionicons name="text-outline" size={18} color={colors.muted} style={styles.settingIcon} />
          <Text style={[styles.settingText, { color: colors.textSecondary, fontSize: fs(14) }]}>Yazı Boyutu</Text>
          <Text style={{ color: colors.faint, fontSize: fs(13) }}>+2</Text>
        </View>

        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.muted} style={styles.settingIcon} />
          <Text style={[styles.settingText, { color: colors.textSecondary, fontSize: fs(14) }]}>Versiyon</Text>
          <Text style={{ color: colors.faint, fontSize: fs(13) }}>1.0.0</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: colors.danger + '18', borderColor: colors.danger }]}
        onPress={handleLogout}
      >
        <Ionicons name="power-outline" size={20} color={colors.danger} />
        <Text style={{ color: colors.danger, fontSize: fs(16), fontWeight: '700' }}>Çıkış Yap</Text>
      </TouchableOpacity>

      <Modal visible={pdfModalVisible} animationType="slide" onRequestClose={() => setPdfModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'ios' ? 54 : 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
            <Text style={{ color: colors.text, fontSize: fs(16), fontWeight: '700' }}>Yetki Belgesi</Text>
            <TouchableOpacity onPress={() => setPdfModalVisible(false)}>
              <Ionicons name="close" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 14 }}>
            <Text style={{ color: colors.muted, fontSize: fs(14), textAlign: 'center' }}>
              PDF sistem görüntüleyicide açıldı. Paylaşmak için aşağıdaki butonu kullanın.
            </Text>
            <TouchableOpacity
              style={[styles.authBtn, { backgroundColor: colors.orange, alignSelf: 'center', paddingHorizontal: 24 }]}
              onPress={handleShareAuthDoc}
            >
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs(14) }}>Paylaş (WhatsApp vb.)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authBtn, { backgroundColor: colors.header, alignSelf: 'center', paddingHorizontal: 24 }]}
              onPress={handleViewAuthDoc}
            >
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs(14) }}>Tekrar Aç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const bitmap = (a << 16) | (b << 8) | c;
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i + 1 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += i + 2 < bytes.length ? chars.charAt(bitmap & 63) : '=';
  }
  return result;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
  },
  avatarText: { color: '#fff', fontWeight: '800' },
  fullName: { fontWeight: '700' },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  sectionTitle: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  infoIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoTexts: { flex: 1 },
  infoLabel: { fontWeight: '600' },
  infoValue: { fontWeight: '500', marginTop: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1 },
  settingIcon: { marginRight: 12 },
  settingText: { flex: 1 },
  authBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    marginTop: 6,
  },
});
