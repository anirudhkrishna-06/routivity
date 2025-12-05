import React, { useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const LeafletMap = ({ 
  routeCoordinates = [], 
  source, 
  destination, 
  stops = [], 
  height = 200,
  interactive = false 
}) => {
  const webViewRef = useRef(null);

  // Generate HTML for Leaflet map
  const generateMapHTML = () => {
    const allCoordinates = [
      source,
      ...stops.map(stop => stop.coordinates || stop),
      destination
    ].filter(Boolean);

    // Calculate center if coordinates exist
    const center = allCoordinates.length > 0 
      ? allCoordinates.reduce((acc, coord, index) => ({
          lat: acc.lat + (coord.latitude || coord.lat),
          lng: acc.lng + (coord.longitude || coord.lng),
        }), { lat: 0, lng: 0 })
      : { lat: 20.5937, lng: 78.9629 }; // Default to India center

    if (allCoordinates.length > 0) {
      center.lat /= allCoordinates.length;
      center.lng /= allCoordinates.length;
    }

    const coordinates = routeCoordinates.length > 0 ? routeCoordinates : allCoordinates;
    
    // Create HTML for Leaflet map
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossorigin=""/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossorigin=""></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { width: 100%; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map').setView([${center.lat}, ${center.lng}], ${allCoordinates.length > 1 ? 8 : 5});
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
          }).addTo(map);

          // Add route line if coordinates exist
          ${coordinates.length > 1 ? `
          const routeCoordinates = ${JSON.stringify(
            coordinates.map(coord => [coord.latitude || coord.lat, coord.longitude || coord.lng])
          )};
          L.polyline(routeCoordinates, {
            color: '#007AFF',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 5'
          }).addTo(map);` : ''}

          // Add source marker
          ${source ? `
          L.marker([${source.lat}, ${source.lng}], {
            icon: L.divIcon({
              html: '<div style="background: #4CAF50; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">Start</div>',
              iconSize: [60, 20],
              className: 'custom-marker'
            })
          }).addTo(map);` : ''}

          // Add destination marker
          ${destination ? `
          L.marker([${destination.lat}, ${destination.lng}], {
            icon: L.divIcon({
              html: '<div style="background: #FF5722; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">End</div>',
              iconSize: [60, 20],
              className: 'custom-marker'
            })
          }).addTo(map);` : ''}

          // Add stop markers
          ${stops.filter(s => s.coordinates && s.type !== 'source' && s.type !== 'destination').length > 0 ? `
          const stops = ${JSON.stringify(
            stops
              .filter(s => s.coordinates && s.type !== 'source' && s.type !== 'destination')
              .map(stop => ({
                lat: stop.coordinates.latitude,
                lng: stop.coordinates.longitude,
                name: stop.name || 'Stop',
                type: stop.type
              }))
          )};
          
          stops.forEach((stop, index) => {
            const iconColor = stop.type === 'meal' ? '#FF9800' : '#9C27B0';
            L.marker([stop.lat, stop.lng], {
              icon: L.divIcon({
                html: \`<div style="background: \${iconColor}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">\${index + 1}</div>\`,
                iconSize: [24, 24],
                className: 'stop-marker'
              })
            }).addTo(map);
          });` : ''}

          // Fit bounds to show all markers
          ${allCoordinates.length > 0 ? `
          const bounds = L.latLngBounds(${JSON.stringify(
            allCoordinates.map(coord => [coord.latitude || coord.lat, coord.longitude || coord.lng])
          )});
          map.fitBounds(bounds, { padding: [50, 50] });` : ''}

          // Disable interaction if needed
          ${!interactive ? `
          map.dragging.disable();
          map.touchZoom.disable();
          map.doubleClickZoom.disable();
          map.scrollWheelZoom.disable();
          map.boxZoom.disable();
          map.keyboard.disable();` : ''}
        </script>
      </body>
      </html>
    `;
  };

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML() }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
});

export default LeafletMap;