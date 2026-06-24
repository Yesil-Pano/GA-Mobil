// GA-Mobil/src/screens/MapScreen.tsx
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

export default function MapScreen() {
  // Varsayılan Ankara Konumu
  const initialRegion = {
    latitude: 39.92077,
    longitude: 32.85411,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        initialRegion={initialRegion}
        showsUserLocation={true}
      >
        <Marker coordinate={{ latitude: 39.92077, longitude: 32.85411 }} title="Ankara Merkez" pinColor="#38BDF8" />
      </MapView>

      {/* SOL ÜST ZOOM KONTROLLERİ */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.fabSmall}><Ionicons name="add" size={24} color="#334155" /></TouchableOpacity>
        <View style={styles.zoomLevel}><Text style={{ fontWeight: 'bold', color: '#334155' }}>15</Text></View>
        <TouchableOpacity style={styles.fabSmall}><Ionicons name="remove" size={24} color="#334155" /></TouchableOpacity>
      </View>

      {/* SAĞ ÜST KONTROLLER (İndir, Katman) */}
      <View style={styles.topRightControls}>
        <TouchableOpacity style={styles.fabSmall}><Ionicons name="download-outline" size={20} color="#334155" /></TouchableOpacity>
        <TouchableOpacity style={styles.fabSmall}><Ionicons name="analytics-outline" size={20} color="#334155" /></TouchableOpacity>
      </View>

      {/* SOL ALT KONTROLLER */}
      <View style={styles.bottomLeftControls}>
        <TouchableOpacity style={styles.fabMedium}><Ionicons name="layers" size={24} color="#334155" /></TouchableOpacity>
      </View>

      {/* SAĞ ALT KONTROLLER (Rota, Konum) */}
      <View style={styles.bottomRightControls}>
        <TouchableOpacity style={[styles.fabMedium, { backgroundColor: '#0EA5E9' }]}><Ionicons name="briefcase-outline" size={24} color="#fff" /></TouchableOpacity>
        <TouchableOpacity style={[styles.fabMedium, { backgroundColor: '#F59E0B' }]}><Ionicons name="navigate-outline" size={24} color="#fff" /></TouchableOpacity>
        <TouchableOpacity style={[styles.fabMedium, { backgroundColor: '#EF4444' }]}><Ionicons name="locate-outline" size={24} color="#fff" /></TouchableOpacity>
      </View>

      {/* EN ALT AKSİYON BUTONLARI (Konum & Ayak İzi) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomButtonRed}>
          <Ionicons name="paper-plane-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.bottomButtonText}>Konum</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomButtonNavy}>
          <Ionicons name="people-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.bottomButtonText}>Ayak İzi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  
  fabSmall: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 8, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, marginBottom: 10 },
  fabMedium: { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, marginBottom: 15 },
  zoomLevel: { width: 44, height: 44, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  
  zoomControls: { position: 'absolute', top: 20, left: 15, borderRadius: 8, overflow: 'hidden', elevation: 5 },
  topRightControls: { position: 'absolute', top: 20, right: 15 },
  bottomLeftControls: { position: 'absolute', bottom: 90, left: 15 },
  bottomRightControls: { position: 'absolute', bottom: 90, right: 15, alignItems: 'center' },
  
  bottomBar: { position: 'absolute', bottom: 20, left: 15, right: 15, flexDirection: 'row', gap: 10 },
  bottomButtonRed: { flex: 1, backgroundColor: '#EF4444', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  bottomButtonNavy: { flex: 1, backgroundColor: '#64748B', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  bottomButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});