import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { usersApi } from '../services/api';
import type { UserProfile } from '../types';

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color="#94A3B8" />
      </View>
      <View style={styles.infoTexts}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
interface ProfileScreenProps {
  onLogout: () => void;
}

export default function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.getProfile();
      setProfile(data);
    } catch (err: any) {
      // Fallback: show data cached at login time
      const name = await SecureStore.getItemAsync('user_name');
      if (name) {
        setProfile({ fullName: name, email: '—', companyName: '—' });
      }
    } finally {
      setLoading(false);
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Profil yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* ── Avatar ──────────────────────────────────── */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.fullName}>{profile?.fullName ?? '—'}</Text>
        <Text style={styles.company}>{profile?.companyName ?? '—'}</Text>
      </View>

      {/* ── Contact info ──────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Hesap Bilgileri</Text>
        <InfoRow label="Ad Soyad"    value={profile?.fullName ?? '—'}    icon="person-outline" />
        <InfoRow label="E-Posta"     value={profile?.email ?? '—'}       icon="mail-outline" />
        <InfoRow label="Şirket"      value={profile?.companyName ?? '—'} icon="business-outline" />
      </View>

      {/* ── App settings ────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Uygulama</Text>

        <TouchableOpacity style={styles.settingRow} onPress={fetchProfile}>
          <Ionicons name="refresh-outline" size={18} color="#94A3B8" style={styles.settingIcon} />
          <Text style={styles.settingText}>Profili Yenile</Text>
          <Ionicons name="chevron-forward" size={16} color="#334155" />
        </TouchableOpacity>

        <View style={styles.settingRow}>
          <Ionicons name="language-outline" size={18} color="#94A3B8" style={styles.settingIcon} />
          <Text style={styles.settingText}>Uygulama Dili</Text>
          <Text style={styles.settingValue}>Türkçe</Text>
        </View>

        <View style={styles.settingRow}>
          <Ionicons name="information-circle-outline" size={18} color="#94A3B8" style={styles.settingIcon} />
          <Text style={styles.settingText}>Versiyon</Text>
          <Text style={styles.settingValue}>1.0.0</Text>
        </View>
      </View>

      {/* ── Logout ────────────────────────────────────── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="power-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  loadingText: { color: '#94A3B8', fontSize: 14, marginTop: 12 },

  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#F97316' + '44',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  fullName: { color: '#F1F5F9', fontSize: 20, fontWeight: '700' },
  company: { color: '#94A3B8', fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  infoIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoTexts: { flex: 1 },
  infoLabel: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  infoValue: { color: '#E2E8F0', fontSize: 14, fontWeight: '500', marginTop: 2 },

  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#334155' },
  settingIcon: { marginRight: 12 },
  settingText: { flex: 1, color: '#E2E8F0', fontSize: 14 },
  settingValue: { color: '#64748B', fontSize: 13 },

  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EF444418',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 14,
    padding: 15,
    marginTop: 6,
  },
  logoutText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
});
