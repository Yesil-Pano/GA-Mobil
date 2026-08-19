import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppColors } from '../theme/ThemeContext';

function buildPdfViewerHtml(isDark: boolean): string {
  const bg = isDark ? '#0F172A' : '#F1F5F9';
  const text = isDark ? '#94A3B8' : '#64748B';
  const err = isDark ? '#F87171' : '#DC2626';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: ${bg}; min-height: 100%; }
  #status { color: ${text}; text-align: center; padding: 48px 20px; font-family: -apple-system, system-ui, sans-serif; font-size: 14px; }
  #error { color: ${err}; display: none; padding: 48px 20px; text-align: center; font-family: -apple-system, system-ui, sans-serif; font-size: 14px; line-height: 1.5; }
  #pages { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 8px 24px; }
  canvas { max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); background: #fff; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>
</head>
<body>
<div id="status">Belge yükleniyor…</div>
<div id="pages"></div>
<div id="error"></div>
<script>
  function showError(msg) {
    document.getElementById('status').style.display = 'none';
    const errEl = document.getElementById('error');
    errEl.style.display = 'block';
    errEl.textContent = msg;
  }

  function renderPdf() {
    if (typeof pdfjsLib === 'undefined') {
      setTimeout(renderPdf, 40);
      return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const b64 = window.__PDF_B64__;
    if (!b64) {
      showError('Belge verisi alınamadı.');
      return;
    }
    try {
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      pdfjsLib.getDocument({ data: bytes }).promise.then(async (pdf) => {
        document.getElementById('status').style.display = 'none';
        const container = document.getElementById('pages');
        const baseWidth = Math.min(window.innerWidth - 16, 680);
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const unscaled = page.getViewport({ scale: 1 });
          const scale = baseWidth / unscaled.width;
          const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          container.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
      }).catch(() => {
        showError('PDF görüntülenemedi. İnternet bağlantınızı kontrol edin.');
      });
    } catch (e) {
      showError('PDF okunamadı.');
    }
  }

  renderPdf();
<\/script>
</body>
</html>`;
}

/** WebView içinde güvenle gösterilebilecek üst sınır (~6 MB PDF). */
export const MAX_INLINE_PDF_BASE64 = 8_000_000;

interface AuthorizationDocumentViewerProps {
  visible: boolean;
  fileName: string;
  pdfBase64: string | null;
  loading?: boolean;
  isDark: boolean;
  colors: AppColors;
  fs: (n: number) => number;
  onClose: () => void;
  onShare: () => void;
  shareBusy?: boolean;
}

export default function AuthorizationDocumentViewer({
  visible,
  fileName,
  pdfBase64,
  loading = false,
  isDark,
  colors,
  fs,
  onClose,
  onShare,
  shareBusy = false,
}: AuthorizationDocumentViewerProps) {
  const insets = useSafeAreaInsets();

  const htmlSource = useMemo(() => ({ html: buildPdfViewerHtml(isDark) }), [isDark]);

  const tooLarge = pdfBase64 != null && pdfBase64.length > MAX_INLINE_PDF_BASE64;

  const injectedBeforeLoad = useMemo(
    () => (pdfBase64 && !tooLarge ? `window.__PDF_B64__=${JSON.stringify(pdfBase64)};true;` : undefined),
    [pdfBase64, tooLarge],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs(16) }]} numberOfLines={1}>
              Yetki Belgesi
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted, fontSize: fs(12) }]} numberOfLines={1}>
              {fileName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="Kapat"
          >
            <Ionicons name="close" size={22} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.viewer}>
          {loading || !pdfBase64 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.orange} />
              <Text style={{ color: colors.muted, fontSize: fs(14), marginTop: 12 }}>Belge hazırlanıyor…</Text>
            </View>
          ) : tooLarge ? (
            <View style={styles.loadingWrap}>
              <Ionicons name="document-outline" size={40} color={colors.muted} />
              <Text style={{ color: colors.text, fontSize: fs(15), fontWeight: '600', marginTop: 14, textAlign: 'center' }}>
                Belge boyutu çok büyük
              </Text>
              <Text style={{ color: colors.muted, fontSize: fs(13), marginTop: 8, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 }}>
                Uygulama içinde önizleme yapılamıyor. Aşağıdaki Paylaş butonu ile WhatsApp veya dosya uygulamasında açabilirsiniz.
              </Text>
            </View>
          ) : (
            <WebView
              source={htmlSource}
              style={styles.webview}
              originWhitelist={['*']}
              scrollEnabled
              showsVerticalScrollIndicator
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
              renderLoading={() => (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={colors.orange} />
                </View>
              )}
            />
          )}
        </View>

        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.shareBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.bg,
                opacity: shareBusy ? 0.6 : 1,
              },
            ]}
            onPress={onShare}
            disabled={shareBusy || loading || !pdfBase64}
          >
            <Ionicons name="share-outline" size={18} color={colors.orange} />
            <Text style={{ color: colors.text, fontSize: fs(14), fontWeight: '600' }}>
              {shareBusy ? 'Hazırlanıyor…' : 'Paylaş'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontWeight: '700' },
  headerSubtitle: { marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: { flex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
});
