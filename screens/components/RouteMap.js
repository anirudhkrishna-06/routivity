import React, { useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const RouteMap = ({ region, coords = [], stops = [], height = 300, interactive = true, onMessage = null }) => {
  const webViewRef = useRef(null);

  const generateHtml = () => {
    const center = region || { latitude: 20.5937, longitude: 78.9629 };
    const coordsJson = JSON.stringify((coords || []).map(c => ({ lat: c.lat ?? c.latitude, lng: c.lng ?? c.longitude })));
    const stopsJson = JSON.stringify((stops || []).map(s => ({ lat: s.lat ?? s.coordinates?.latitude ?? s.latitude, lng: s.lng ?? s.coordinates?.longitude ?? s.longitude, type: s.type, name: s.name, details: s.details || null })));

    return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <style>
          html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const center = ${JSON.stringify({ latitude: center.latitude, longitude: center.longitude })};
          const coords = ${coordsJson};
          const stops = ${stopsJson};

          const map = L.map('map').setView([center.latitude, center.longitude], 7);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
          }).addTo(map);

          if (coords.length > 0) {
            const latlngs = coords.map(c => [c.lat, c.lng]);
            L.polyline(latlngs, { color: '#007AFF', weight: 4, lineCap: 'round' }).addTo(map);
            const start = latlngs[0];
            const end = latlngs[latlngs.length - 1];

            function makePinIcon(label, color) {
              const html = '' +
                '<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto">' +
                  '<div style="width:40px;height:40px;border-radius:20px;background:' + color + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;box-shadow:0 6px 12px rgba(0,0,0,0.25);border:2px solid rgba(255,255,255,0.85)">' + label + '</div>' +
                  '<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid ' + color + ';margin-top:-6px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.18))"></div>' +
                '</div>';
              return L.divIcon({ html: html, className: 'custom-pin', iconSize: [40, 52], iconAnchor: [20, 52], popupAnchor: [0, -44] });
            }

            function makeMealIcon(emoji, bgColor) {
              const html = '' +
                '<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto">' +
                  '<div style="width:44px;height:44px;border-radius:22px;background:linear-gradient(180deg,' + bgColor + ',#c86a00);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;box-shadow:0 8px 16px rgba(0,0,0,0.22);border:2px solid rgba(255,255,255,0.9)">' + emoji + '</div>' +
                  '<div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:14px solid ' + bgColor + ';margin-top:-7px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.18))"></div>' +
                '</div>';
              return L.divIcon({ html: html, className: 'custom-meal-pin', iconSize: [44, 58], iconAnchor: [22, 58], popupAnchor: [0, -50] });
            }

            const startIcon = makePinIcon('S', '#0D47A1');
            const endIcon = makePinIcon('D', '#B71C1C');
            L.marker(start, { icon: startIcon }).addTo(map).bindPopup('<strong>Start</strong>');
            L.marker(end, { icon: endIcon }).addTo(map).bindPopup('<strong>Destination</strong>');

            stops.forEach(s => {
              const latlng = [s.lat, s.lng];
              if ((latlng[0] === start[0] && latlng[1] === start[1]) || (latlng[0] === end[0] && latlng[1] === end[1])) return;

              let icon = null;
              if (s.type === 'meal') {
                icon = makeMealIcon('🍽️', '#FF9800');
              } else {
                icon = makePinIcon('', '#FF9800');
              }

              const details = s.details || {};
              const tags = (details.tags) ? details.tags : {};
              const imgUrl = (tags.photo || tags.image) ? (tags.photo || tags.image) : ('https://via.placeholder.com/240x140.png?text=' + encodeURIComponent(s.name));
              const opening = tags.opening_hours || tags['opening_hours'] || 'N/A';
              const rating = tags.rating || details.rating || 'N/A';
              const detour = details.detour_minutes || tags.detour_minutes || '';
              const reasons = details.match_reasons || [];
              var popupHtml = '';
              popupHtml += '<div style="max-width:260px;font-family:Arial,Helvetica,sans-serif">';
              popupHtml += '<div style="display:flex;align-items:center;margin-bottom:8px">';
              popupHtml += '<img src="' + imgUrl + '" style="width:80px;height:60px;object-fit:cover;border-radius:6px;margin-right:8px" />';
              popupHtml += '<div style="flex:1">';
              popupHtml += '<div style="font-weight:700;color:#1a1a1a;margin-bottom:4px">' + s.name + '</div>';
              popupHtml += '<div style="font-size:12px;color:#666">' + (tags.cuisine || '') + '</div>';
              popupHtml += '</div></div>';
              popupHtml += '<div style="font-size:13px;color:#333;margin-bottom:6px"><strong>Opening:</strong> ' + opening + '</div>';
              popupHtml += '<div style="font-size:13px;color:#333;margin-bottom:6px"><strong>Rating:</strong> ' + rating + (detour ? ' | <strong>Detour:</strong> ' + detour + ' min' : '') + '</div>';
              if (reasons.length > 0) {
                popupHtml += '<div style="margin-top:6px"><strong>Why recommended:</strong><ul style="padding-left:16px;margin:6px 0">';
                for (var i = 0; i < reasons.length; i++) {
                  popupHtml += '<li style="font-size:12px;color:#444">' + reasons[i] + '</li>';
                }
                popupHtml += '</ul></div>';
              }
              var safeName = (s.name || '').replace(/"/g, '\\"').replace(/'/g, "\\'");
              popupHtml += '<div style="margin-top:8px;text-align:right">';
              popupHtml += '<button class="view-details" data-name="' + safeName + '" style="background:#007AFF;color:white;border-radius:6px;padding:6px 10px;border:none;cursor:pointer">View Details</button></div>';
              popupHtml += '</div>';

              const marker = L.marker(latlng, { icon }).addTo(map);
              marker.bindPopup(popupHtml);
            });

            map.fitBounds(coords.map(c => [c.lat, c.lng]), { padding: [20, 20] });

            document.addEventListener('click', function(e) {
              var el = e.target || e.srcElement;
              if (el && el.classList && el.classList.contains('view-details')) {
                var name = el.getAttribute('data-name');
                try {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'showDetails', name: name }));
                } catch (err) {
                  console.warn('postMessage failed', err);
                }
              }
            });
          }
        </script>
      </body>
    </html>`;
  };

  return (
    <View style={{ width: '100%', height: height }}>
      <WebView
        style={{ flex: 1 }}
        originWhitelist={["*"]}
        source={{ html: generateHtml() }}
        scrollEnabled={false}
        onMessage={onMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default RouteMap;
