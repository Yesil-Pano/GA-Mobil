import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
};

export type OsmMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  color: string;
};

export type OsmMapViewRef = {
  animateToRegion: (region: MapRegion, durationMs?: number) => void;
};

type Props = {
  initialRegion: MapRegion;
  markers: OsmMarker[];
  userLocation?: { latitude: number; longitude: number } | null;
  onMarkerPress?: (markerId: string) => void;
  onMapReady?: () => void;
};

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #0F172A; }
    .leaflet-container { background: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .leaflet-popup-content-wrapper { border-radius: 10px; }
    .leaflet-popup-content { margin: 10px 12px; font-size: 13px; line-height: 1.35; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: false }).setView([39.92077, 32.85411], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    let userMarker = null;

    function deltaToZoom(latDelta) {
      return Math.max(3, Math.min(18, Math.round(Math.log2(360 / (latDelta || 0.12)))));
    }

    function setMarkers(markers) {
      markerLayer.clearLayers();
      (markers || []).forEach((m) => {
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:14px;height:14px;border-radius:50%;background:' + m.color +
            ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const marker = L.marker([m.latitude, m.longitude], { icon }).addTo(markerLayer);
        const popup = '<strong>' + escapeHtml(m.title) + '</strong>' +
          (m.description ? '<br/>' + escapeHtml(m.description) : '');
        marker.bindPopup(popup);
        marker.on('click', () => {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', id: m.id }));
        });
      });
    }

    function setUserLocation(loc) {
      if (!loc) {
        if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
        return;
      }
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,.25);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker([loc.latitude, loc.longitude], { icon, zIndexOffset: 1000 }).addTo(map);
    }

    function animateToRegion(region, durationMs) {
      const zoom = deltaToZoom(region.latitudeDelta);
      map.flyTo([region.latitude, region.longitude], zoom, { duration: (durationMs || 600) / 1000 });
    }

    function escapeHtml(text) {
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    window.__handleCommand = function(payload) {
      if (!payload || !payload.type) return;
      if (payload.type === 'setMarkers') setMarkers(payload.markers);
      if (payload.type === 'setUserLocation') setUserLocation(payload.location);
      if (payload.type === 'animateToRegion') animateToRegion(payload.region, payload.durationMs);
    };

    map.whenReady(() => {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
    });
  </script>
</body>
</html>`;

function OsmMapViewInner(
  { initialRegion, markers, userLocation, onMarkerPress, onMapReady }: Props,
  ref: React.Ref<OsmMapViewRef>,
) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<string[]>([]);

  const sendCommand = useCallback((payload: object) => {
    const script = `window.__handleCommand(${JSON.stringify(payload)}); true;`;
    if (!readyRef.current) {
      pendingRef.current.push(script);
      return;
    }
    webRef.current?.injectJavaScript(script);
  }, []);

  const flushPending = useCallback(() => {
    pendingRef.current.forEach((script) => webRef.current?.injectJavaScript(script));
    pendingRef.current = [];
  }, []);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, durationMs = 600) => {
      sendCommand({ type: 'animateToRegion', region, durationMs });
    },
  }));

  React.useEffect(() => {
    sendCommand({ type: 'setMarkers', markers });
  }, [markers, sendCommand]);

  React.useEffect(() => {
    sendCommand({ type: 'setUserLocation', location: userLocation ?? null });
  }, [userLocation, sendCommand]);

  React.useEffect(() => {
    sendCommand({ type: 'animateToRegion', region: initialRegion, durationMs: 0 });
  }, [initialRegion.latitude, initialRegion.longitude, sendCommand]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'mapReady') {
          readyRef.current = true;
          flushPending();
          sendCommand({ type: 'setMarkers', markers });
          sendCommand({ type: 'setUserLocation', location: userLocation ?? null });
          onMapReady?.();
          return;
        }
        if (data.type === 'markerPress' && data.id) {
          onMarkerPress?.(data.id);
        }
      } catch {
        // yoksay
      }
    },
    [flushPending, markers, onMapReady, onMarkerPress, sendCommand, userLocation],
  );

  const source = useMemo(() => ({ html: MAP_HTML }), []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        style={styles.webview}
        originWhitelist={['*']}
        source={source}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowsInlineMediaPlayback
        onMessage={handleMessage}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const OsmMapView = forwardRef<OsmMapViewRef, Props>(OsmMapViewInner);
export default OsmMapView;

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#0F172A' },
});
