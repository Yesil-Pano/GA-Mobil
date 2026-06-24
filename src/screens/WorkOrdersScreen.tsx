// GA-Mobil/src/screens/WorkOrdersScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function WorkOrdersScreen() {
  const [activeTab, setActiveTab] = useState('is_emri'); // 'is_emri' | 'bolgesel'

  return (
    <View style={styles.container}>
      {/* ÜST ARAMA VE FİLTRE BAR'I */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton}><Ionicons name="list" size={24} color="#fff" /></TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}><Ionicons name="grid-outline" size={24} color="#fff" /></TouchableOpacity>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94A3B8" style={{ paddingLeft: 10 }} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="İş Emri Ara" 
            placeholderTextColor="#94A3B8"
          />
        </View>
        
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="funnel" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* İKİLİ TAB MENÜSÜ */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'is_emri' && styles.activeTab]} onPress={() => setActiveTab('is_emri')}>
          <Ionicons name="clipboard-outline" size={16} color={activeTab === 'is_emri' ? '#38BDF8' : '#94A3B8'} />
          <Text style={[styles.tabText, activeTab === 'is_emri' && styles.activeTabText]}>İş Emri Listesi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'bolgesel' && styles.activeTab]} onPress={() => setActiveTab('bolgesel')}>
          <Ionicons name="map-outline" size={16} color={activeTab === 'bolgesel' ? '#38BDF8' : '#94A3B8'} />
          <Text style={[styles.tabText, activeTab === 'bolgesel' && styles.activeTabText]}>Bölgesel İş Emri Listesi</Text>
        </TouchableOpacity>
      </View>

      {/* FORM TİPİ SEÇİCİ */}
      <View style={styles.dropdownContainer}>
        <Text style={styles.dropdownText}>Trugo - Yeşil Pano İş Formu</Text>
        <Ionicons name="chevron-down" size={20} color="#64748B" />
      </View>

      {/* İŞ EMRİ KARTLARI (KAYDIRILABİLİR ALAN) */}
      <ScrollView style={{ flex: 1, padding: 10 }}>
        
        {/* KART 1: KAPALI GÖRÜNÜM (Görsel 094739 gibi) */}
        <View style={styles.cardCollapsed}>
          <View style={styles.cardBorderLeft} />
          <Text style={styles.cardTitle} numberOfLines={1}>#1 - Adres: Bahçelievler Hızır Reis Cd. Mura...</Text>
          <Ionicons name="alert-circle-outline" size={24} color="#38BDF8" />
        </View>

        {/* KART 2: AÇIK DETAYLI GÖRÜNÜM (Görsel 094750 gibi) */}
        <View style={styles.cardExpanded}>
          <View style={styles.cardBorderLeftExpanded} />
          <View style={{ padding: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.expandedTitle}>#2 -</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={{ backgroundColor: '#F59E0B', padding: 8, borderRadius: 8 }}><Ionicons name="map-outline" size={20} color="#fff" /></TouchableOpacity>
                <TouchableOpacity style={{ backgroundColor: '#0EA5E9', padding: 8, borderRadius: 8 }}><Ionicons name="location-outline" size={20} color="#fff" /></TouchableOpacity>
              </View>
            </View>

            <Text style={styles.pointName}>Nokta Adı: Ankara Merkez İstasyon</Text>
            
            <View style={styles.detailsList}>
              <Text style={styles.detailText}>Başlangıç Tarihi: 2026-06-01T09:00</Text>
              <Text style={styles.detailText}>Bitiş Tarihi: 2026-06-30T18:00</Text>
              <Text style={styles.detailText}>Açıklama: </Text>
              <Text style={styles.detailText}>İş Tipi: Bakım</Text>
              <Text style={styles.detailText}>İş Tamamlama Tipi: Atanmış</Text>
              <Text style={styles.detailText}>İş Kategorisi: AG Bakım</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.detailText}>İş Öncelik Tipi: Orta</Text>
                <TouchableOpacity style={{ backgroundColor: '#64748B', padding: 8, borderRadius: 8 }}><Ionicons name="image-outline" size={20} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          </View>

          {/* İPTAL VE TAMAMLA BUTONLARI */}
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: '#E2E8F0' }}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#1E293B' }]}>
              <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 16 }}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#4ADE80' }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Tamamla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#0EA5E9', flex: 0.3 }]}>
              <Ionicons name="alert" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { flexDirection: 'row', backgroundColor: '#1A233A', padding: 10, alignItems: 'center' },
  iconButton: { padding: 5, marginRight: 5 },
  searchContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', marginHorizontal: 10 },
  searchInput: { flex: 1, color: '#fff', padding: 8 },
  filterButton: { backgroundColor: '#38BDF8', padding: 8, borderRadius: 8 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#1A233A' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderBottomWidth: 3, borderColor: 'transparent' },
  activeTab: { borderColor: '#38BDF8' },
  tabText: { color: '#94A3B8', fontWeight: 'bold', marginLeft: 8, fontSize: 13 },
  activeTabText: { color: '#38BDF8' },
  dropdownContainer: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, margin: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 },
  dropdownText: { color: '#475569', fontWeight: 'bold' },
  
  cardCollapsed: { flexDirection: 'row', backgroundColor: '#F8FAFC', marginVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', alignItems: 'center', paddingRight: 15 },
  cardBorderLeft: { width: 8, height: '100%', backgroundColor: '#84CC16' },
  cardTitle: { flex: 1, padding: 15, color: '#334155', fontWeight: '600' },
  
  cardExpanded: { backgroundColor: '#F8FAFC', marginVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  cardBorderLeftExpanded: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, backgroundColor: '#84CC16' },
  expandedTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  pointName: { fontSize: 16, fontWeight: 'bold', color: '#0369A1', marginTop: 10, marginBottom: 15 },
  detailsList: { gap: 8 },
  detailText: { fontSize: 14, color: '#334155', fontWeight: '600' },
  actionButton: { flex: 1, padding: 15, justifyContent: 'center', alignItems: 'center' }
});