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
import { authApi, usersApi } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { colors, fs, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  React.useEffect(() => {
    (async () => {
      const reason = await SecureStore.getItemAsync('ga_logout_reason');
      if (reason) {
        await SecureStore.deleteItemAsync('ga_logout_reason');
        Alert.alert('Erişim Kapandı', reason);
      }
    })();
  }, []);

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
      // Multi-tenant: partner seçimi yok — JWT TenantId backend tarafından zorlanır.
      try {
        const { data: me } = await usersApi.getProfile();
        if (me.companyName) await SecureStore.setItemAsync('user_company', me.companyName);
        if (me.tenantId) await SecureStore.setItemAsync('user_tenant_id', String(me.tenantId));
        if (me.fullName) await SecureStore.setItemAsync('user_name', me.fullName);
      } catch {
        /* profil yoksa iş emri ekranında da devam edilir */
      }

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

  const bg = isDark ? '#0B132B' : colors.bg;
  const cardBg = isDark ? colors.header : colors.surface;
  const inputBg = isDark ? colors.surface : '#F8FAFC';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={[styles.logoTitle, { color: isDark ? '#fff' : colors.text, fontSize: fs(20) }]}>
                GÖREV ADAMI
              </Text>
              <Text style={[styles.logoSubtitle, { color: colors.orange, fontSize: fs(9) }]}>
                YEŞİL AYAK İZİ MOBİL OPERASYONU
              </Text>
            </View>

            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.muted, fontSize: fs(11) }]}>E-Posta / Kullanıcı Adı</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: colors.border, color: colors.text, fontSize: fs(14) }]}
                placeholder="ornek@sirket.com"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              <Text style={[styles.label, { color: colors.muted, fontSize: fs(11) }]}>Şifre</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput, { backgroundColor: inputBg, borderColor: colors.border, color: colors.text, fontSize: fs(14) }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Text style={{ fontSize: fs(18) }}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.helperRow}>
                <View style={styles.rememberRow}>
                  <Switch
                    value={rememberMe}
                    onValueChange={setRememberMe}
                    trackColor={{ false: colors.border, true: colors.orange }}
                    thumbColor="#fff"
                    style={styles.switch}
                  />
                  <Text style={{ fontSize: fs(12), color: colors.muted, fontWeight: '600' }}>Beni Hatırla</Text>
                </View>
                <TouchableOpacity>
                  <Text style={{ fontSize: fs(12), color: colors.orange, fontWeight: '700' }}>Şifremi Unuttum</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.orange }, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.header} />
                ) : (
                  <Text style={{ color: colors.header, fontSize: fs(14), fontWeight: '800', letterSpacing: 1.5 }}>
                    SİSTEME BAĞLAN
                  </Text>
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
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
  },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoImage: { width: 90, height: 90, marginBottom: 14 },
  logoTitle: { fontWeight: '900', letterSpacing: 1 },
  logoSubtitle: { fontWeight: 'bold', marginTop: 3, letterSpacing: 2 },
  form: { width: '100%' },
  label: { fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    marginBottom: 16,
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeButton: { position: 'absolute', right: 12, top: 12 },
  helperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  rememberRow: { flexDirection: 'row', alignItems: 'center' },
  switch: { marginRight: 8, transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
  button: {
    width: '100%',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.7 },
});
