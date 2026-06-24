// GA-Mobil/src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Image } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Eksik Bilgi", "Lütfen kullanıcı adı ve şifre alanlarını doldurunuz şefim.");
      return;
    }

    setLoading(true);
    try {
      // 🔐 GERÇEK API BAĞLANTISI: .NET projenizdeki IAuthService'i tetikler
      // Not: DTO'nuzdaki alan adlarına göre 'username' veya 'email' olarak burayı esnetebilirsiniz şefim.
      const response = await api.post('/auth/login', {
        username: username, 
        password: password
      });

      // API'den dönen kurumsal JWT token ve kullanıcı kimlik bilgilerini yakalıyoruz
      // Not: Sizin servisinizin dönmüş olduğu tam nesne yapısına göre (Örn: response.data.token veya response.data.user.id) burayı eşitleyebilirsiniz.
      const { token, userId, fullName } = response.data;

      // 🔒 Cihazın şifreli donanım hafızasına verileri mühürlüyoruz
      if (userId) await SecureStore.setItemAsync('user_id', String(userId));
      if (token) await SecureStore.setItemAsync('user_token', String(token));
      if (fullName) await SecureStore.setItemAsync('user_name', String(fullName));

      Alert.alert("Giriş Başarılı", `Hoş geldiniz, ${fullName || 'Şefim'}`);
      onLoginSuccess(); // Ana akışa geçişi tetikler
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.message || "Kullanıcı adı veya şifre hatalı!";
      Alert.alert("Giriş Başarısız", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        
        {/* KURUMSAL LOGO ALANI */}
        <div style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logoImage} 
            resizeMode="contain" 
          />
          <Text style={styles.logoTitle}>GÖREV ADAMI</Text>
          <Text style={styles.logoSubtitle}>YEŞİL PANO MOBİL OPERASYON</Text>
        </div>

        {/* PANEL GİRİŞ FORMU */}
        <View style={styles.form}>
          <Text style={styles.label}>Kullanıcı Adı / E-Posta</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Örn: yasin.bey" 
            placeholderTextColor="#94A3B8"
            value={username} 
            onChangeText={setUsername} 
            autoCapitalize="none" 
          />

          <Text style={styles.label}>Şifre</Text>
          <TextInput 
            style={styles.input} 
            placeholder="••••••••" 
            placeholderTextColor="#94A3B8" 
            secureTextEntry
            value={password} 
            onChangeText={setPassword} 
            autoCapitalize="none" 
          />

          {/* TEAMER TARZI STATİK YARDIMCI PANEL */}
          <View style={styles.helperRow}>
            <Text style={styles.rememberText}>⬜ Beni Hatırla</Text>
            <Text style={styles.forgotText}>Şifremi Unuttum</Text>
          </View>

          {/* AKSİYON BUTONU */}
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#1A233A" />
            ) : (
              <Text style={styles.buttonText}>SİSTEME BAĞLAN</Text>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B132B', justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', maxWidth: 400, backgroundColor: '#1A233A', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 10, borderWidth: 1, borderColor: '#334155' },
  logoContainer: { alignItems: 'center', marginBottom: 28 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#F97316', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoLetter: { fontSize: 32, fontWeight: 'bold', color: '#F97316', textAlign: 'center', lineHeight: 58 },
  logoTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  logoSubtitle: { fontSize: 9, fontWeight: 'bold', color: '#F97316', marginTop: 2, letterSpacing: 2 },
  form: { width: '100%' },
  label: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 6 },
  input: { width: '100%', backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12, color: '#FFFFFF', fontSize: 13, marginBottom: 16 },
  helperRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  rememberText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  forgotText: { fontSize: 11, color: '#F97316', fontWeight: '700' },
  button: { width: '100%', backgroundColor: '#F97316', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10, shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  buttonText: { color: '#1A233A', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  logoImage: { width: 90, height: 90, marginBottom: 15 },
});