import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen e-posta ve şifre alanlarını doldurunuz.');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.login({ email: email.trim(), password });
      const { token, userId, username, fullName } = response.data;

      await SecureStore.setItemAsync('user_token', token ?? '');
      if (userId) await SecureStore.setItemAsync('user_id', String(userId));
      if (username) await SecureStore.setItemAsync('user_username', String(username));
      if (fullName) await SecureStore.setItemAsync('user_name', String(fullName));
      await SecureStore.setItemAsync('remember_me', rememberMe ? 'true' : 'false');

      onLoginSuccess();
    } catch (error: any) {
      console.error('[Login] Hata:', JSON.stringify({
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        code: error.code,
      }, null, 2));

      let msg: string;
      if (!error.response) {
        msg = `Sunucuya bağlanılamadı.\n\n${error.message ?? 'Ağ hatası'}`;
      } else {
        msg =
          error.response.data?.message ??
          error.response.data?.Message ??
          `Sunucu hatası (HTTP ${error.response.status})`;
      }
      Alert.alert('Giriş Başarısız', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {/* ── Logo ─────────────────────────────────── */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoTitle}>GÖREV ADAMI</Text>
              <Text style={styles.logoSubtitle}>YEŞİL AYAK İZİ MOBİL OPERASYONU</Text>
            </View>

            {/* ── Form ─────────────────────────────────── */}
            <View style={styles.form}>
              <Text style={styles.label}>E-Posta / Kullanıcı Adı</Text>
              <TextInput
                style={styles.input}
                placeholder="ornek@sirket.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              <Text style={styles.label}>Şifre</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.helperRow}>
                <View style={styles.rememberRow}>
                  <Switch
                    value={rememberMe}
                    onValueChange={setRememberMe}
                    trackColor={{ false: '#334155', true: '#F97316' }}
                    thumbColor="#fff"
                    style={styles.switch}
                  />
                  <Text style={styles.rememberText}>Beni Hatırla</Text>
                </View>
                <TouchableOpacity>
                  <Text style={styles.forgotText}>Şifremi Unuttum</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1A233A" />
                ) : (
                  <Text style={styles.buttonText}>SİSTEME BAĞLAN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B132B' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1A233A',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoImage: { width: 90, height: 90, marginBottom: 14 },
  logoTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  logoSubtitle: { fontSize: 9, fontWeight: 'bold', color: '#F97316', marginTop: 3, letterSpacing: 2 },
  form: { width: '100%' },
  label: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 13,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 16,
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeButton: { position: 'absolute', right: 12, top: 12 },
  eyeText: { fontSize: 18 },
  helperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  rememberRow: { flexDirection: 'row', alignItems: 'center' },
  switch: { marginRight: 8, transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
  rememberText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  forgotText: { fontSize: 12, color: '#F97316', fontWeight: '700' },
  button: {
    width: '100%',
    backgroundColor: '#F97316',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#1A233A', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
});
