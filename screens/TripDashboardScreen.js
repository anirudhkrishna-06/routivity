import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getWeatherData } from '../utils/api/weatherApi';
import { getRoutePolyline } from '../utils/api/mapboxApi';
import logger from '../utils/logger';
import TripSummary from './components/TripSummary';
import WeatherWidget from './components/WeatherWidget';
import AlertWidget from './components/AlertWidget';
import ActionButtons from './components/ActionButtons';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';



const { width, height } = Dimensions.get('window');

const TripDashboardScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const auth = getAuth();

  const { tripId } = route.params;
  
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [mapRegion, setMapRegion] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Fetch trip data
  useEffect(() => {
    if (!tripId) {
      Alert.alert('Error', 'No trip ID provided');
      navigation.goBack();
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'trips', tripId),
      (docSnap) => {
        logger.info('Trip snapshot update received for', tripId);
        if (docSnap.exists()) {
          const tripData = { id: docSnap.id, ...docSnap.data() };
          logger.debug('Trip data:', tripData);
          setTrip(tripData);
          
          // Initialize map region
          if (tripData.mapRegion) {
            setMapRegion({
              latitude: tripData.mapRegion.latitude,
              longitude: tripData.mapRegion.longitude,
              latitudeDelta: tripData.mapRegion.latitudeDelta || 0.5,
              longitudeDelta: tripData.mapRegion.longitudeDelta || 0.5,
            });
          } else if (tripData.stops && tripData.stops.length > 0) {
            // Calculate map region from stops
            const lats = tripData.stops.map(stop => 
              stop.coordinates?.latitude || stop.latitude
            ).filter(lat => lat);
            const lngs = tripData.stops.map(stop => 
              stop.coordinates?.longitude || stop.longitude
            ).filter(lng => lng);
            
            if (lats.length > 0 && lngs.length > 0) {
              const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
              const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
              
              setMapRegion({
                latitude: avgLat,
                longitude: avgLng,
                latitudeDelta: 1.5,
                longitudeDelta: 1.5,
              });
            }
          }
          
          // Fetch weather for destination
          fetchWeather(tripData);
          
          // Generate route coordinates
          generateRouteCoordinates(tripData);
          
          // Generate mock alerts for now
          generateMockAlerts(tripData);
        } else {
          Alert.alert('Error', 'Trip not found');
          navigation.goBack();
        }
        setLoading(false);
      },
      (error) => {
        logger.error('Error fetching trip snapshot for ' + tripId + ':', error);
        Alert.alert('Error', 'Failed to load trip data');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tripId]);

  // Refresh on focus
  useFocusEffect(
    React.useCallback(() => {
      setRefreshing(false);
    }, [])
  );

  const fetchWeather = async (tripData) => {
    if (!tripData.destination?.lat || !tripData.destination?.lng) return;
    
    setWeatherLoading(true);
    try {
      logger.info('fetchWeather: calling getWeatherData for trip', tripData.id || tripId);
      const weatherData = await getWeatherData(
        tripData.destination.lat,
        tripData.destination.lng
      );
      setWeather(weatherData);
    } catch (error) {
      logger.error('Error fetching weather for trip ' + (tripData.id || tripId) + ':', error);
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleCopyTripId = async () => {
  try {
    await Clipboard.setStringAsync(tripId);
    Alert.alert('Copied!', 'Trip ID copied to clipboard');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
  }
};

  const generateRouteCoordinates = async (tripData) => {
    // If the trip already contains a polyline (e.g., computed by OSRM during creation), prefer it.
    if (tripData.polylineCoordinates && tripData.polylineCoordinates.length > 0) {
      logger.info('Using trip.polylineCoordinates as route for', tripData.id || tripId);
      // Normalize possible key names (latitude/longitude or lat/lng)
      const normalized = tripData.polylineCoordinates.map(c => ({ latitude: c.latitude || c.lat || c[0], longitude: c.longitude || c.lng || c[1] })).map(p => ({ latitude: p.latitude, longitude: p.longitude }));
      // Convert to the {latitude, longitude} objects expected by other parts of the app
      setRouteCoordinates(normalized.map(c => ({ latitude: c.latitude, longitude: c.longitude })));
      return;
    }

    if (!tripData.stops || tripData.stops.length < 2) {
      // No stops and no polyline -> nothing to generate
      return;
    }

    try {
      logger.info('generateRouteCoordinates: generating for trip', tripData.id || tripId);
      const coordinates = tripData.stops
        .filter(stop => stop.coordinates)
        .map(stop => ({
          latitude: stop.coordinates.latitude,
          longitude: stop.coordinates.longitude,
        }));

      if (coordinates.length >= 2) {
        // Try to get polyline from Mapbox
        const polyline = await getRoutePolyline(coordinates);
        if (polyline) {
          logger.info('Mapbox polyline generated for trip', tripData.id || tripId);
          setRouteCoordinates(polyline);
        } else {
          // Fallback to straight lines between stops
          logger.warn('Mapbox polyline not available, using straight-line coords');
          setRouteCoordinates(coordinates);
        }
      }
    } catch (error) {
      logger.error('Error generating route for trip ' + (tripData.id || tripId) + ':', error);
      // Fallback to available coordinates
      if (tripData.polylineCoordinates) {
        logger.info('Falling back to trip.polylineCoordinates');
        setRouteCoordinates(tripData.polylineCoordinates);
      }
    }
  };

  const generateMockAlerts = (tripData) => {
    // TODO: Replace with actual alert generation logic
    const mockAlerts = [];
    
    // Check if trip is starting soon
    if (tripData.itinerary?.departure) {
      const departureTime = new Date(tripData.itinerary.departure);
      const now = new Date();
      const hoursUntilDeparture = (departureTime - now) / (1000 * 60 * 60);
      
      if (hoursUntilDeparture > 0 && hoursUntilDeparture < 24) {
        mockAlerts.push({
          id: 'departure-soon',
          type: 'reminder',
          title: 'Trip Starts Soon',
          message: `Your trip starts in ${Math.ceil(hoursUntilDeparture)} hours`,
          severity: 'info',
          time: now.toISOString(),
        });
      }
    }
    
    setAlerts(mockAlerts);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Force re-fetch weather
    if (trip) {
      await fetchWeather(trip);
    }
    setRefreshing(false);
  };

  const handleUpdateTripStatus = async (newStatus) => {
    if (!trip) return;
    
    try {
      await updateDoc(doc(db, 'trips', tripId), {
        status: newStatus,
        updatedAt: new Date(),
      });
      Alert.alert('Success', `Trip status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating trip status:', error);
      Alert.alert('Error', 'Failed to update trip status');
    }
  };

  const handleManageMembers = () => {
    navigation.navigate('ManageMembers', { tripId });
  };

  const handleViewExpenses = () => {
    navigation.navigate('BillTracker', { tripId });
  };

  const handleFindServices = () => {
    navigation.navigate('ServiceFinder', { tripId });
  };

  const handleViewAlerts = () => {
    navigation.navigate('AlertCenter', { tripId });
  };

  

  // RouteVisualization: renders a Leaflet map inside a WebView similar to ItineraryScreen
  // Accepts optional mapHeightOverride to control preview or full size usage
  const RouteVisualization = ({ mapHeightOverride }) => {
    if (!trip) return null;

    // Build stops array from multiple possible fields and normalize shapes.
    const rawStops = trip.stops || trip.itinerary?.stops || trip.stop_list || [];
    const stopsForMap = (Array.isArray(rawStops) ? rawStops : []).map(s => {
      // Normalize coordinates from various possible shapes
      const lat = (s && (s.coordinates?.latitude || s.latitude || s.lat || (s.geometry && s.geometry.coordinates && s.geometry.coordinates[1]) || (s.location && s.location.lat)));
      const lng = (s && (s.coordinates?.longitude || s.longitude || s.lng || (s.geometry && s.geometry.coordinates && s.geometry.coordinates[0]) || (s.location && s.location.lng)));
      // Determine type: prefer explicit type, or infer restaurant/meal from tags
      const tags = s?.details?.tags || s?.tags || {};
      let type = s?.type || null;
      if (!type) {
        if (tags.amenity === 'restaurant' || tags.cuisine || s?.category === 'restaurant' || (s?.name && /restau/i.test(s.name))) type = 'restaurant';
        else if (tags.meal || s?.isMeal || /meal|food|restaurant/i.test(s?.name || '')) type = 'meal';
        else type = 'stop';
      }
      const name = s?.name || s?.title || s?.display_name || (tags && (tags.name || tags.cuisine)) || 'Stop';
      return { lat: lat, lng: lng, type, name, details: s?.details || s };
    }).filter(s => s && s.lat != null && s.lng != null);

    // Build coords from routeCoordinates (already computed) or from trip.polylineCoordinates
    let coords = (routeCoordinates && routeCoordinates.length > 0)
      ? routeCoordinates.map(c => ({ lat: c.latitude, lng: c.longitude }))
      : ((trip.polylineCoordinates && trip.polylineCoordinates.length > 0)
         ? trip.polylineCoordinates.map(c => ({ lat: c.lat || c.latitude, lng: c.lng || c.longitude }))
         : []);

    // If no coords but stops exist, use stops as the polyline fallback
    if ((coords.length === 0 || coords.every(c => !c.lat || !c.lng)) && stopsForMap.length > 0) {
      coords = stopsForMap.map(s => ({ lat: s.lat, lng: s.lng }));
    }

    // If still no coords, we can't render a meaningful map — show a placeholder
    if (!coords || coords.length === 0) {
      return (
        <View style={{ height: mapHeightOverride || 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f8f8' }}>
          <Ionicons name="map-outline" size={48} color="#ccc" />
          <Text style={{ marginTop: 8, color: '#999' }}>No route data available</Text>
        </View>
      );
    }

    // Compute center region: prefer trip.mapRegion if present, otherwise compute from coords
    const region = (trip.mapRegion && trip.mapRegion.latitude && trip.mapRegion.longitude)
      ? { latitude: trip.mapRegion.latitude, longitude: trip.mapRegion.longitude }
      : (() => {
        const lats = coords.map(c => c.lat).filter(Boolean);
        const lngs = coords.map(c => c.lng).filter(Boolean);
        const avgLat = (Math.max(...lats) + Math.min(...lats)) / 2;
        const avgLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
        return { latitude: avgLat || 0, longitude: avgLng || 0 };
      })();

    

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }</style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const center = ${JSON.stringify(region)};
          const coords = ${JSON.stringify(coords)};
          const stops = ${JSON.stringify(stopsForMap)};
          const totalDistanceKM = ${JSON.stringify(trip.totalDistance || 0)};
          const totalDurationMin = ${JSON.stringify(trip.totalDuration || 0)};
          const departureISO = ${JSON.stringify(trip.itinerary?.departure || null)};

          function toRad(x){return x*Math.PI/180;}
          function haversine(a,b){
            const R=6371; // km
            const dLat=toRad(b[0]-a[0]);
            const dLon=toRad(b[1]-a[1]);
            const lat1=toRad(a[0]);
            const lat2=toRad(b[0]);
            const sinDLat=Math.sin(dLat/2), sinDLon=Math.sin(dLon/2);
            const aa = sinDLat*sinDLat + Math.cos(lat1)*Math.cos(lat2)*sinDLon*sinDLon;
            const c=2*Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
            return R*c;
          }

          const map = L.map('map').setView([center.latitude, center.longitude], 7);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

          if (coords.length > 0) {
            const latlngs = coords.map(c => [c.lat, c.lng]);
            const poly = L.polyline(latlngs, { color: '#007AFF', weight: 4, lineCap: 'round' }).addTo(map);

            // compute cumulative distances along the polyline
            const segDistances = [];
            let totalSegDistance = 0;
            for (let i = 1; i < latlngs.length; i++){
              const d = haversine(latlngs[i-1], latlngs[i]);
              segDistances.push(d);
              totalSegDistance += d;
            }

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

            // compute ETA helper
            function computeETAForPoint(pt){
              if (!totalSegDistance || totalSegDistance <= 0 || !totalDurationMin) return null;
              // find nearest index along latlngs
              let closestIndex = 0; let closestDist = Infinity;
              for (let i = 0; i < latlngs.length; i++){
                const d = haversine(latlngs[i], pt);
                if (d < closestDist){ closestDist = d; closestIndex = i; }
              }
              // sum distances up to closestIndex
              let sum = 0; for (let i = 0; i < closestIndex; i++) sum += segDistances[i] || 0;
              const etaMinutes = (totalDurationMin && totalSegDistance>0) ? ( (sum/totalSegDistance) * totalDurationMin ) : null;
              let startTime = departureISO ? new Date(departureISO) : new Date();
              if (etaMinutes == null) return null;
              const eta = new Date(startTime.getTime() + Math.round(etaMinutes) * 60000);
              return eta.toLocaleString();
            }

            const startETA = departureISO ? new Date(departureISO).toLocaleString() : null;
            const endETA = (function(){ if (!totalSegDistance || totalSegDistance<=0 || !totalDurationMin) return null; let st = departureISO ? new Date(departureISO) : new Date(); const eta = new Date(st.getTime() + Math.round(totalDurationMin)*60000); return eta.toLocaleString(); })();
            L.marker(start, { icon: startIcon }).addTo(map).bindPopup('<strong>Start</strong>' + (startETA ? '<div style="margin-top:6px;font-size:13px;color:#333"><strong>ETA:</strong> ' + startETA + '</div>' : ''));
            L.marker(end, { icon: endIcon }).addTo(map).bindPopup('<strong>Destination</strong>' + (endETA ? '<div style="margin-top:6px;font-size:13px;color:#333"><strong>ETA:</strong> ' + endETA + '</div>' : ''));

            stops.forEach((s, idx) => {
              const latlng = [s.lat, s.lng];
              // skip if effectively the same as start/end (within 50m)
              if (haversine(latlng, start) < 0.05 || haversine(latlng, end) < 0.05) return;

              let icon = (s.type === 'restaurant' || s.type === 'meal') ? makeMealIcon('🍽️', '#FF9800') : makePinIcon('', '#FF9800');

              const marker = L.marker(latlng, { icon }).addTo(map);

              const details = s.details || {};
              const tags = (details.tags) ? details.tags : {};
              const imgUrl = (tags.photo || tags.image) ? (tags.photo || tags.image) : ('https://via.placeholder.com/240x140.png?text=' + encodeURIComponent(s.name));
              const opening = tags.opening_hours || tags['opening_hours'] || 'N/A';
              const rating = tags.rating || details.rating || 'N/A';
              const detour = details.detour_minutes || tags.detour_minutes || '';
              const reasons = details.match_reasons || [];

              // compute ETA for this stop
              const etaStr = computeETAForPoint([s.lat, s.lng]);

              var popupHtml = '';
              popupHtml += '<div style="max-width:260px;font-family:Arial,Helvetica,sans-serif">';
              popupHtml += '<div style="display:flex;align-items:center;margin-bottom:8px">';
              popupHtml += '<img src="' + imgUrl + '" style="width:80px;height:60px;object-fit:cover;border-radius:6px;margin-right:8px" />';
              popupHtml += '<div style="flex:1">';
              popupHtml += '<div style="font-weight:700;color:#1a1a1a;margin-bottom:4px">' + s.name + '</div>';
              popupHtml += '<div style="font-size:12px;color:#666">' + (tags.cuisine || '') + '</div>';
              popupHtml += '</div></div>';
              if (etaStr) popupHtml += '<div style="font-size:13px;color:#333;margin-bottom:6px"><strong>ETA:</strong> ' + etaStr + '</div>';
              popupHtml += '<div style="font-size:13px;color:#333;margin-bottom:6px"><strong>Opening:</strong> ' + opening + '</div>';
              popupHtml += '<div style="font-size:13px;color:#333;margin-bottom:6px"><strong>Rating:</strong> ' + rating + (detour ? ' | <strong>Detour:</strong> ' + detour + ' min' : '') + '</div>';
              if (reasons.length > 0) {
                popupHtml += '<div style="margin-top:6px"><strong>Why recommended:</strong><ul style="padding-left:16px;margin:6px 0">';
                for (var i = 0; i < reasons.length; i++) {
                  popupHtml += '<li style="font-size:12px;color:#444">' + reasons[i] + '</li>';
                }
                popupHtml += '</ul></div>';
              }
              popupHtml += '</div>';

              marker.bindPopup(popupHtml);

              // Post message back to React Native when clicked (interactive)
              marker.on('click', function() {
                const message = { type: 'marker_click', index: idx, stop: s, eta: etaStr };
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify(message));
                }
              });
            });

            map.fitBounds(coords.map(c => [c.lat, c.lng]), { padding: [20, 20] });

            // Send debug info back to React Native so we can verify what data the WebView received
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                const initMsg = { type: 'init', totalStops: stops.length, stops: stops.slice(0, 20), coordsCount: coords.length };
                window.ReactNativeWebView.postMessage(JSON.stringify(initMsg));
              }
            } catch (e) {
              // ignore
            }
          }
        </script>
      </body>
    </html>`;

    const mapHeight = mapHeightOverride || 200;

    const handleWebViewMessage = (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        // Log basic init messages from the WebView for debugging
        if (data && data.type === 'init') {
          logger.info('WebView init: totalStops=' + data.totalStops + ' coordsCount=' + data.coordsCount);
          logger.debug('WebView init sample stops:', data.stops || []);
          return;
        }
        if (data && data.type === 'marker_click') {
          const stop = data.stop || {};
          const eta = data.eta || 'N/A';
          const title = stop.name || 'Stop';
          const msgParts = [];
          if (eta) msgParts.push('ETA: ' + eta);
          if (stop.details && stop.details.tags && stop.details.tags.cuisine) msgParts.push('Cuisine: ' + stop.details.tags.cuisine);
          if (stop.details && stop.details.rating) msgParts.push('Rating: ' + stop.details.rating);
          Alert.alert(title, msgParts.join('\n'));
        }
      } catch (err) {
        logger.error('Failed to handle webview message', err);
      }
    };

    return (
      <View style={{ width: '100%', height: mapHeight, backgroundColor: 'transparent' }}>
        <WebView
          style={{ height: '100%', width: '100%' }}
          originWhitelist={["*"]}
          source={{ html }}
          scrollEnabled={false}
          onMessage={handleWebViewMessage}
        />
      </View>
    );
  };
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="sad-outline" size={64} color="#ccc" />
        <Text style={styles.errorText}>Trip not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {trip.tripName || 'Trip Dashboard'}
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {trip.status?.charAt(0).toUpperCase() + trip.status?.slice(1) || 'Planned'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Ionicons 
            name="refresh" 
            size={22} 
            color={refreshing ? '#ccc' : '#007AFF'} 
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleCopyTripId}
        >
          <Ionicons name="share" size={22} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Ionicons 
            name="compass" 
            size={20} 
            color={activeTab === 'dashboard' ? '#007AFF' : '#666'} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'dashboard' && styles.activeTabText
          ]}>
            Dashboard
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'map' && styles.activeTab]}
          onPress={() => setActiveTab('map')}
        >
          <Ionicons 
            name="map" 
            size={20} 
            color={activeTab === 'map' ? '#007AFF' : '#666'} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'map' && styles.activeTabText
          ]}>
            Map
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'details' && styles.activeTab]}
          onPress={() => setActiveTab('details')}
        >
          <Ionicons 
            name="document-text" 
            size={20} 
            color={activeTab === 'details' ? '#007AFF' : '#666'} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'details' && styles.activeTabText
          ]}>
            Details
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'dashboard' && (
          <>
            {/* Map Preview */}
              {mapRegion && (
              <View style={styles.mapContainer}>
                <RouteVisualization />

                <TouchableOpacity
                  style={styles.fullMapButton}
                  onPress={() => setActiveTab('map')}
                >
                  <Text style={styles.fullMapButtonText}>View Full Map</Text>
                  <Ionicons name="expand" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Trip Summary */}
            <TripSummary trip={trip} />

            {/* Weather Widget */}
            <WeatherWidget 
              weather={weather} 
              loading={weatherLoading}
              destination={trip.destinationName}
            />

            {/* Alerts Widget */}
            {alerts.length > 0 && (
              <AlertWidget alerts={alerts} onViewAll={handleViewAlerts} />
            )}

            {/* Quick Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="time-outline" size={24} color="#007AFF" />
                <Text style={styles.statValue}>
                  {trip.totalDuration ? 
                    `${Math.round(trip.totalDuration / 60)}h ${Math.round(trip.totalDuration % 60)}m` : 
                    'N/A'
                  }
                </Text>
                <Text style={styles.statLabel}>Total Duration</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="speedometer-outline" size={24} color="#4CAF50" />
                <Text style={styles.statValue}>
                  {trip.totalDistance ? `${trip.totalDistance.toFixed(1)} km` : 'N/A'}
                </Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="people-outline" size={24} color="#FF5722" />
                <Text style={styles.statValue}>
                  {trip.members?.length || 1}
                </Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
            </View>
          </>
        )}

        {activeTab === 'map' && (
          <View style={styles.fullMapContainer}>
            <Text style={styles.sectionTitle}>Route Map</Text>
            {trip.source || trip.destination ? (
              <RouteVisualization mapHeightOverride={height * 0.6} />
            ) : (
              <View style={styles.noMapContainer}>
                <Ionicons name="map-outline" size={64} color="#ccc" />
                <Text style={styles.noMapText}>No map data available</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'details' && (
          <View style={styles.detailsContainer}>
            <Text style={styles.sectionTitle}>Trip Details</Text>
            
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>
                  {trip.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                </Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Last Updated</Text>
                <Text style={styles.detailValue}>
                  {trip.updatedAt?.toDate?.().toLocaleDateString() || 'N/A'}
                </Text>
              </View>
            </View>
            
            {trip.itinerary?.departure && (
              <View style={styles.detailRow}>
                <Ionicons name="airplane-outline" size={20} color="#666" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Departure</Text>
                  <Text style={styles.detailValue}>
                    {new Date(trip.itinerary.departure).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
            
            {trip.itinerary?.arrival && (
              <View style={styles.detailRow}>
                <Ionicons name="flag-outline" size={20} color="#666" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Arrival</Text>
                  <Text style={styles.detailValue}>
                    {new Date(trip.itinerary.arrival).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
            
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={20} color="#666" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.detailValue}>
                  {trip.notes || 'No notes added'}
                </Text>
              </View>
            </View>
            
            {trip.mealPreferences && trip.mealPreferences.length > 0 && (
              <View style={styles.mealPreferences}>
                <Text style={styles.mealPrefTitle}>Meal Preferences</Text>
                <View style={styles.mealTags}>
                  {trip.mealPreferences.map((pref, index) => (
                    <View key={index} style={styles.mealTag}>
                      <Text style={styles.mealTagText}>{pref}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons (Fixed at bottom) */}
      <ActionButtons
        onManageMembers={handleManageMembers}
        onViewExpenses={handleViewExpenses}
        onFindServices={handleFindServices}
        onViewAlerts={handleViewAlerts}
        tripStatus={trip.status}
        onUpdateStatus={handleUpdateTripStatus}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
  },
  refreshButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
  },
  scrollView: {
    flex: 1,
  },
  mapContainer: {
    height: 200,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
  fullMapButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  fullMapButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 4,
  },
  startMarker: {
    backgroundColor: 'white',
    padding: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  destinationMarker: {
    backgroundColor: 'white',
    padding: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  stopMarker: {
    backgroundColor: 'white',
    padding: 3,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  largeStartMarker: {
    backgroundColor: 'white',
    padding: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  largeDestinationMarker: {
    backgroundColor: 'white',
    padding: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  fullMapContainer: {
    flex: 1,
    margin: 16,
  },
  fullMap: {
    height: height * 0.6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  noMapContainer: {
    height: height * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  noMapText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  detailsContainer: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  mealPreferences: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  mealPrefTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  mealTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mealTag: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  mealTagText: {
    fontSize: 14,
    color: '#2E7D32',
  },
});

export default TripDashboardScreen;