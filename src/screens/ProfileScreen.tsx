// GA-Mobil/src/screens/ProfileScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  // Görseldeki stil şablonunu tekrar eden satırlar için component oluşturuyoruz
  const InfoRow = ({ label, value }: { label: string, value: string }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>PROFİL</Text>
      <View style={styles.divider} />

      <View style={styles.avatarContainer}>
        <Ionicons name="person-circle" size={120} color="#1A233A" />
      </View>

      <View style={styles.infoBox}>
        <InfoRow label="İsim" value="Utku" />
        <InfoRow label="Soyisim" value="Obuz Trugo" />
        <InfoRow label="Kullanıcı Adı" value="utkuobuz..." />
        <InfoRow label="Şirket Adı" value="YEŞİL PANO" />
        <InfoRow label="Proje Adı" value="Trugo Şarj İ..." />
        
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Proje Değiştir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <View style={styles.settingsBox}>
        <View style={styles.settingRow}>
          <Text style={styles.infoLabel}>Uygulama Dili</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.infoValue}>Türkçe</Text>
            <Ionicons name="caret-down" size={16} color="#64748B" style={{ marginLeft: 5 }} />
          </View>
        </View>
        
        <View style={styles.settingRow}>
          <Text style={styles.infoLabel}>Koyu Tema</Text>
          <Switch 
            value={isDarkTheme} 
            onValueChange={setIsDarkTheme}
            trackColor={{ false: '#CBD5E1', true: '#0EA5E9' }}
            thumbColor={'#fff'}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.infoLabel}>Metin Boyutu</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.infoValue}>Varsayılan</Text>
            <Ionicons name="caret-down" size={16} color="#64748B" style={{ marginLeft: 5 }} />
          </View>
        </View>

        <InfoRow label="Versiyon" value="3.28.2" />
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.actionButtonBlue}>
          <Text style={styles.actionButtonText}>Eğitimi tekrar görüntülemek için tıkla</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButtonBlue}>
          <Text style={styles.actionButtonText}>Kullanım kılavuzu indir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButtonOrange}>
          <Text style={styles.actionButtonText}>Gizlilik ve Veri Politikaları Belgeleri</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 20 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 20 },
  
  infoBox: { gap: 10, marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 8 },
  infoLabel: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
  infoValue: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
  
  primaryButton: { backgroundColor: '#0EA5E9', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  settingsBox: { gap: 10, marginBottom: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 8 },

  actionContainer: { gap: 10, paddingBottom: 40 },
  actionButtonBlue: { backgroundColor: '#0EA5E9', padding: 15, borderRadius: 8, alignItems: 'center' },
  actionButtonOrange: { backgroundColor: '#F59E0B', padding: 15, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});