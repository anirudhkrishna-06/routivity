// screens/ItineraryScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  Share,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

const ItineraryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { itineraryData } = route.params;

  const [itinerary, setItinerary] = useState(null);
  const [requestDoc, setRequestDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [tripName, setTripName] = useState('My Amazing Road Trip');
  const [notes, setNotes] = useState('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailSelected, setDetailSelected] = useState(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Generate detailed itinerary
  useEffect(() => {
    generateItinerary();
  }, []);

  const generateItinerary = async () => {
    try {
      // Fetch original trip request from Firestore (contains source/destination/stops coordinates)
      let fetchedRequest = null;
      if (itineraryData.firebaseTripId) {
        try {
          const tripRef = doc(db, 'trips', itineraryData.firebaseTripId);
          const snap = await getDoc(tripRef);
          if (snap.exists()) {
            fetchedRequest = snap.data();
            setRequestDoc(fetchedRequest);
          }
        } catch (err) {
          console.warn('Could not fetch trip request doc:', err);
        }
      }

      // Build stops/timeline/polyline immediately using fetchedRequest (if any)
      const buildStopsFromData = () => {
        const stopsArr = [];
        const sourceCoord = (fetchedRequest && fetchedRequest.source) || itineraryData.source || null;
        stopsArr.push({
          id: 'source', type: 'source', name: 'Starting Point',
          time: itineraryData.recommended_departure_iso, duration: 0,
          coordinates: { latitude: sourceCoord?.lat ?? 12.97, longitude: sourceCoord?.lng ?? 77.59 }
        });

        Object.keys(itineraryData.selectedMeals || {}).forEach(mealType => {
          const placeId = itineraryData.selectedMeals[mealType];
          const mealData = itineraryData.meal_suggestions[mealType]?.find(p => p.osm_id === placeId);
          if (mealData) {
            stopsArr.push({
              id: `${mealType}-${placeId}`,
              type: 'meal', mealType,
              name: mealData.name,
              time: mealData.eta_iso,
              duration: itineraryData.meal_duration_min || 45,
              coordinates: { latitude: mealData.location.lat, longitude: mealData.location.lng },
              details: mealData,
            });
          }
        });

        const destCoord = (fetchedRequest && fetchedRequest.destination) || itineraryData.destination || null;
        stopsArr.push({
          id: 'destination', type: 'destination', name: 'Destination',
          time: new Date(new Date(itineraryData.recommended_departure_iso).getTime() + 
                (itineraryData.route_summary.total_duration_min * 60 * 1000)).toISOString(),
          duration: 0,
          coordinates: { latitude: destCoord?.lat ?? 13.08, longitude: destCoord?.lng ?? 80.27 }
        });

        return stopsArr.sort((a, b) => new Date(a.time) - new Date(b.time));
      };

      const stopsLocal = buildStopsFromData();

      // Try to get exact OSRM route (shortest driving route) including stops in sequence
      let polylineLocal = null;
      try {
        // Build coords string: lon,lat;lon,lat;...
        const coordPts = stopsLocal.map(s => `${s.coordinates.longitude},${s.coordinates.latitude}`).join(';');
        const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${coordPts}` +
          `?overview=full&geometries=geojson&steps=false`;

        // basic fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(osrmUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const json = await resp.json();
          if (json && json.routes && json.routes[0] && json.routes[0].geometry && json.routes[0].geometry.coordinates) {
            // geometry.coordinates is [[lon, lat], ...]
            polylineLocal = json.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
          }
        }
      } catch (e) {
        console.warn('OSRM route fetch failed, falling back to straight-line polyline', e);
      }

      if (!polylineLocal) {
        // Fallback: straight line through the stops
        polylineLocal = stopsLocal.map(s => ({ lat: s.coordinates.latitude, lng: s.coordinates.longitude }));
      }

      const mapRegionLocal = (() => {
        const lats = stopsLocal.map(s => s.coordinates.latitude);
        const lngs = stopsLocal.map(s => s.coordinates.longitude);
        return {
          latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
          longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
          latitudeDelta: (Math.max(...lats) - Math.min(...lats)) * 1.5 || 0.1,
          longitudeDelta: (Math.max(...lngs) - Math.min(...lngs)) * 1.5 || 0.1,
        };
      })();

      const generatedItinerary = {
        id: itineraryData.trip_id,
        name: tripName,
        notes: notes,
        departure: itineraryData.recommended_departure_iso,
        arrival: new Date(new Date(itineraryData.recommended_departure_iso).getTime() + 
                (itineraryData.route_summary.total_duration_min * 60 * 1000)).toISOString(),
        totalDistance: itineraryData.route_summary.total_distance_km,
        totalDuration: itineraryData.route_summary.total_duration_min,
        stops: stopsLocal,
        timeline: (() => {
          const t = [];
          stopsLocal.forEach((stop, index) => {
            t.push({
              id: `stop-${index}`,
              time: stop.time,
              title: getStopTitle(stop),
              subtitle: getStopSubtitle(stop),
              type: stop.type,
              icon: getStopIcon(stop.type),
              duration: stop.duration,
              isActive: index === 0,
              isCompleted: false,
            });

            if (index < stopsLocal.length - 1) {
              const nextStop = stopsLocal[index + 1];
              const travelTime = Math.round((new Date(nextStop.time) - new Date(stop.time)) / (1000 * 60) - stop.duration);
              if (travelTime > 0) {
                t.push({
                  id: `travel-${index}`,
                  time: new Date(new Date(stop.time).getTime() + (stop.duration * 60 * 1000)).toISOString(),
                  title: `Travel to ${getStopTitle(nextStop)}`,
                  subtitle: `${travelTime} minutes drive`,
                  type: 'travel',
                  icon: 'directions-car',
                  duration: travelTime,
                  isActive: false,
                  isCompleted: false,
                });
              }
            }
          });
          return t;
        })(),
        mapRegion: mapRegionLocal,
        polylineCoordinates: polylineLocal,
        status: 'planned',
        createdAt: new Date().toISOString(),
      };

      setItinerary(generatedItinerary);
      
      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        // progressAnim drives width style (not supported by native driver)
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
      ]).start();

    } catch (error) {
      console.error('Error generating itinerary:', error);
      Alert.alert('Error', 'Failed to generate itinerary');
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data && data.type === 'showDetails' && data.name) {
        // find stop by name
        const stop = (itinerary && itinerary.stops || []).find(s => s.name === data.name);
        if (stop) {
          setDetailSelected(stop);
          setDetailModalVisible(true);
        }
      }
    } catch (e) {
      console.warn('Invalid message from WebView', e);
    }
  };

  const generateStops = () => {
    const stops = [];
    
    // Use requestDoc source coordinates when available
    const sourceCoord = requestDoc?.source || itineraryData.source || null;
    stops.push({
      id: 'source',
      type: 'source',
      name: 'Starting Point',
      time: itineraryData.recommended_departure_iso,
      duration: 0,
      coordinates: { latitude: sourceCoord?.lat ?? 12.97, longitude: sourceCoord?.lng ?? 77.59 },
    });

    // Add meal stops
    Object.keys(itineraryData.selectedMeals).forEach(mealType => {
      const placeId = itineraryData.selectedMeals[mealType];
      const mealData = itineraryData.meal_suggestions[mealType].find(p => p.osm_id === placeId);
      
      if (mealData) {
        stops.push({
          id: `${mealType}-${placeId}`,
          type: 'meal',
          mealType: mealType,
          name: mealData.name,
          time: mealData.eta_iso,
          duration: itineraryData.meal_duration_min || 45,
          coordinates: {
            latitude: mealData.location.lat,
            longitude: mealData.location.lng,
          },
          details: mealData,
        });
      }
    });

    // Add destination - prefer requestDoc destination coordinates
    const destCoord = requestDoc?.destination || itineraryData.destination || null;
    stops.push({
      id: 'destination',
      type: 'destination',
      name: 'Destination',
      time: new Date(new Date(itineraryData.recommended_departure_iso).getTime() + 
            (itineraryData.route_summary.total_duration_min * 60 * 1000)).toISOString(),
      duration: 0,
      coordinates: { latitude: destCoord?.lat ?? 13.08, longitude: destCoord?.lng ?? 80.27 },
    });

    return stops.sort((a, b) => new Date(a.time) - new Date(b.time));
  };

  const generateTimeline = () => {
    const stops = generateStops();
    const timeline = [];
    
    stops.forEach((stop, index) => {
      timeline.push({
        id: `stop-${index}`,
        time: stop.time,
        title: getStopTitle(stop),
        subtitle: getStopSubtitle(stop),
        type: stop.type,
        icon: getStopIcon(stop.type),
        duration: stop.duration,
        isActive: index === 0,
        isCompleted: false,
      });

      // Add travel time between stops (except last stop)
      if (index < stops.length - 1) {
        const nextStop = stops[index + 1];
        const travelTime = Math.round((new Date(nextStop.time) - new Date(stop.time)) / (1000 * 60) - stop.duration);
        
        if (travelTime > 0) {
          timeline.push({
            id: `travel-${index}`,
            time: new Date(new Date(stop.time).getTime() + (stop.duration * 60 * 1000)).toISOString(),
            title: `Travel to ${getStopTitle(nextStop)}`,
            subtitle: `${travelTime} minutes drive`,
            type: 'travel',
            icon: 'directions-car',
            duration: travelTime,
            isActive: false,
            isCompleted: false,
          });
        }
      }
    });

    return timeline;
  };

  const getStopTitle = (stop) => {
    switch (stop.type) {
      case 'source': return 'Start Journey';
      case 'destination': return 'Arrive at Destination';
      case 'meal': return `${stop.mealType.charAt(0).toUpperCase() + stop.mealType.slice(1)} at ${stop.name}`;
      default: return stop.name;
    }
  };

  const getStopSubtitle = (stop) => {
    switch (stop.type) {
      case 'meal': return `${stop.duration} min stop - ${stop.details.detour_minutes} min detour`;
      case 'travel': return `${stop.duration} min drive`;
      default: return '';
    }
  };

  const getStopIcon = (type) => {
    switch (type) {
      case 'source': return 'play-arrow';
      case 'destination': return 'flag';
      case 'meal': return 'restaurant';
      case 'travel': return 'directions-car';
      default: return 'place';
    }
  };

  const calculateMapRegion = () => {
    // Calculate region that fits all stops
    const stops = generateStops();
    const lats = stops.map(s => s.coordinates.latitude);
    const lngs = stops.map(s => s.coordinates.longitude);
    
    return {
      latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
      longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
      latitudeDelta: (Math.max(...lats) - Math.min(...lats)) * 1.5,
      longitudeDelta: (Math.max(...lngs) - Math.min(...lngs)) * 1.5,
    };
  };

  const generateSamplePolyline = () => {
    const stops = generateStops();
    // Fallback simple straight-line polyline through stops
    return stops.map(s => ({ lat: s.coordinates.latitude, lng: s.coordinates.longitude }));
  };

  const generatePolylineFromStops = () => {
    // Prefer route geometry from itineraryData.route_summary.geometry if present
    try {
      const geom = itineraryData?.route_summary?.geometry;
      if (geom && Array.isArray(geom) && geom.length > 0) {
        // Assume geometry is [[lng, lat], [lng, lat], ...]
        const pts = geom.map(p => ({ lat: p[1], lng: p[0] }));
        return pts;
      }
    } catch (e) {
      // ignore and fallback
    }

    // Fallback: build polyline from stops coordinates
    const stops = generateStops();
    return stops.map(s => ({ lat: s.coordinates.latitude, lng: s.coordinates.longitude }));
  };

  const handleSaveTrip = async () => {
    setSaving(true);
    try {
      if (itineraryData.firebaseTripId) {
        await updateDoc(doc(db, 'trips', itineraryData.firebaseTripId), {
          itinerary: itinerary,
          status: 'saved',
          tripName: tripName,
          notes: notes,
          savedAt: new Date(),
          members: [auth.currentUser.uid]
        });

        Alert.alert('Success', 'Trip saved to My Trips!', [
          { text: 'OK', onPress: () => navigation.navigate('MyTrips') }
        ]);
      }
    } catch (error) {
      console.error('Error saving trip:', error);
      Alert.alert('Error', 'Failed to save trip');
    } finally {
      setSaving(false);
    }
  };

  const handleStartTrip = async () => {
    Alert.alert(
      'Start Trip',
      'Are you ready to begin your journey?',
      [
        { text: 'Not Yet', style: 'cancel' },
        { 
          text: 'Start Trip', 
          onPress: async () => {
            try {
              if (itineraryData.firebaseTripId) {
                await updateDoc(doc(db, 'trips', itineraryData.firebaseTripId), {
                  status: 'active',
                  startedAt: new Date(),
                });
                
                // Navigate to active trip screen
                navigation.navigate('ActiveTrip', { 
                  tripId: itineraryData.firebaseTripId,
                  itinerary: itinerary 
                });
              }
            } catch (error) {
              console.error('Error starting trip:', error);
              Alert.alert('Error', 'Failed to start trip');
            }
          }
        }
      ]
    );
  };

  const handleShareTrip = async () => {
    try {
      const shareContent = {
        title: `Check out my trip: ${tripName}`,
        message: `I planned an amazing road trip with Routivity!\n\n${generateShareText()}`,
        url: 'https://routivity.app', // Your app URL
      };
      
      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const generateShareText = () => {
    if (!itinerary) return '';
    
    return `Trip: ${tripName}
Distance: ${itinerary.totalDistance.toFixed(1)} km
Duration: ${Math.round(itinerary.totalDuration)} min
Meal Stops: ${itinerary.timeline.filter(item => item.type === 'meal').length}

Planned with Routivity - Your AI Road Trip Companion!`;
  };

  const TimelineItem = ({ item, index, totalItems }) => {
    const isFirst = index === 0;
    const isLast = index === totalItems - 1;
    
    return (
      <Animated.View 
        style={[
          styles.timelineItem,
          { 
            opacity: fadeAnim,
            transform: [
              { translateX: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        <View style={styles.timelineLeft}>
          <View style={[
            styles.timelineIconContainer,
            item.type === 'source' && styles.timelineIconSource,
            item.type === 'destination' && styles.timelineIconDestination,
            item.type === 'meal' && styles.timelineIconMeal,
            item.type === 'travel' && styles.timelineIconTravel,
          ]}>
            <Icon 
              name={item.icon} 
              size={16} 
              color="#fff" 
            />
          </View>
          
          {!isLast && (
            <View style={styles.timelineConnector} />
          )}
        </View>

        <View style={styles.timelineContent}>
          <Text style={styles.timelineTime}>
            {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.timelineTitle}>{item.title}</Text>
          {item.subtitle && (
            <Text style={styles.timelineSubtitle}>{item.subtitle}</Text>
          )}
          
          {item.type === 'meal' && item.details && (
            <View style={styles.mealDetails}>
              <View style={styles.mealBadges}>
                {item.details.match_reasons?.slice(0, 2).map((reason, idx) => (
                  <View key={idx} style={styles.mealBadge}>
                    <Text style={styles.mealBadgeText}>{reason}</Text>
                  </View>
                ))}
              </View>
              {item.details.tags?.cuisine && (
                <Text style={styles.cuisineText}>{item.details.tags.cuisine}</Text>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };
const RouteVisualization = () => {
  if (!itinerary?.mapRegion || !Array.isArray(itinerary.polylineCoordinates)) {
    return null;
  }

  const region = {
    latitude: itinerary.mapRegion.latitude,
    longitude: itinerary.mapRegion.longitude,
  };

  const coords = itinerary.polylineCoordinates.map((pt) => ({ lat: pt.lat, lng: pt.lng }));
  const stopsForMap = (itinerary.stops || []).map(s => ({ lat: s.coordinates.latitude, lng: s.coordinates.longitude, type: s.type, name: s.name, details: s.details || null }));

  const html = `
    <!DOCTYPE html>
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
          const center = ${JSON.stringify(region)};
          const coords = ${JSON.stringify(coords)};
          const stops = ${JSON.stringify(stopsForMap)};

          const map = L.map('map').setView([center.latitude, center.longitude], 7);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
          }).addTo(map);

          if (coords.length > 0) {
            const latlngs = coords.map(c => [c.lat, c.lng]);
            L.polyline(latlngs, { color: '#007AFF', weight: 4, lineCap: 'round' }).addTo(map);
            const start = latlngs[0];
            const end = latlngs[latlngs.length - 1];

            // prettier start/end pin icons using divIcon with shadow and tail
            function makePinIcon(label, color) {
              const html = '' +
                '<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto">' +
                  '<div style="width:40px;height:40px;border-radius:20px;background:' + color + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;box-shadow:0 6px 12px rgba(0,0,0,0.25);border:2px solid rgba(255,255,255,0.85)">' + label + '</div>' +
                  '<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid ' + color + ';margin-top:-6px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.18))"></div>' +
                '</div>';
              return L.divIcon({ html: html, className: 'custom-pin', iconSize: [40, 52], iconAnchor: [20, 52], popupAnchor: [0, -44] });
            }

            const startIcon = makePinIcon('S', '#0D47A1');
            const endIcon = makePinIcon('D', '#B71C1C');
            L.marker(start, { icon: startIcon }).addTo(map).bindPopup('<strong>Start</strong>');
            L.marker(end, { icon: endIcon }).addTo(map).bindPopup('<strong>Destination</strong>');

            // meal/stop pin with emoji and gradient
            function makeMealIcon(emoji, bgColor) {
              const html = '' +
                '<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto">' +
                  '<div style="width:44px;height:44px;border-radius:22px;background:linear-gradient(180deg,' + bgColor + ',#c86a00);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;box-shadow:0 8px 16px rgba(0,0,0,0.22);border:2px solid rgba(255,255,255,0.9)">' + emoji + '</div>' +
                  '<div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:14px solid ' + bgColor + ';margin-top:-7px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.18))"></div>' +
                '</div>';
              return L.divIcon({ html: html, className: 'custom-meal-pin', iconSize: [44, 58], iconAnchor: [22, 58], popupAnchor: [0, -50] });
            }

            stops.forEach(s => {
              const latlng = [s.lat, s.lng];
              if ((latlng[0] === start[0] && latlng[1] === start[1]) || (latlng[0] === end[0] && latlng[1] === end[1])) return;

              let icon = null;
              if (s.type === 'meal') {
                icon = makeMealIcon('🍽️', '#FF9800');
              } else {
                icon = makePinIcon('', '#FF9800');
              }

              const marker = L.marker(latlng, { icon }).addTo(map);

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
    </html>
  `;

  const mapHeight = Math.round(height * 0.75);

  return (
    <Animated.View
      style={[
        { width: '100%', height: mapHeight, backgroundColor: 'transparent' },
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <View style={[styles.mapWrapper, { height: mapHeight, borderRadius: 0 }]}> 
        <WebView
          style={[styles.map, { height: '100%' }]}
          originWhitelist={['*']}
          source={{ html }}
          scrollEnabled={false}
          onMessage={handleWebViewMessage}
        />
      </View>
    </Animated.View>
  );
};

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Icon name="map" size={64} color="#007AFF" />
        </Animated.View>
        <Text style={styles.loadingText}>Creating your perfect itinerary...</Text>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Map (full width, 75% height) */}
        <RouteVisualization />

        {/* Header */}
        <Animated.View 
          style={[
            styles.header,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {editMode ? (
            <TextInput
              style={styles.tripNameInput}
              value={tripName}
              onChangeText={setTripName}
              placeholder="Enter trip name..."
            />
          ) : (
            <Text style={styles.tripName}>{tripName}</Text>
          )}
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setEditMode(!editMode)}
            >
              <Icon name={editMode ? "check" : "edit"} size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowShareModal(true)}
            >
              <Icon name="share" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Trip Summary */}
        <Animated.View 
          style={[
            styles.summaryCard,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Icon name="access-time" size={24} color="#007AFF" />
              <Text style={styles.summaryValue}>
                {Math.round(itinerary.totalDuration)} min
              </Text>
              <Text style={styles.summaryLabel}>Total Time</Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Icon name="directions" size={24} color="#007AFF" />
              <Text style={styles.summaryValue}>
                {itinerary.totalDistance.toFixed(1)} km
              </Text>
              <Text style={styles.summaryLabel}>Distance</Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Icon name="restaurant" size={24} color="#007AFF" />
              <Text style={styles.summaryValue}>
                {itinerary.timeline.filter(item => item.type === 'meal').length}
              </Text>
              <Text style={styles.summaryLabel}>Meal Stops</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Trip Progress</Text>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill,
                  { 
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }) 
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>Planned - Ready to Go!</Text>
          </View>
        </Animated.View>

  {/* Map Preview removed (moved above) */}

        {/* Timeline */}
        <Animated.View 
          style={[
            styles.timelineContainer,
            { opacity: fadeAnim }
          ]}
        >
          <Text style={styles.sectionTitle}>Your Journey Timeline</Text>
          {itinerary.timeline.map((item, index) => (
            <TimelineItem
              key={item.id}
              item={item}
              index={index}
              totalItems={itinerary.timeline.length}
            />
          ))}
        </Animated.View>

        {/* Notes Section */}
        {editMode && (
          <Animated.View 
            style={[
              styles.notesContainer,
              { opacity: fadeAnim }
            ]}
          >
            <Text style={styles.sectionTitle}>Trip Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about your trip..."
              multiline
              numberOfLines={4}
            />
          </Animated.View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Fixed Action Buttons */}
      <Animated.View 
        style={[
          styles.actionContainer,
          { opacity: fadeAnim }
        ]}
      >
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.saveButton]}
            onPress={handleSaveTrip}
            disabled={saving}
          >
            <Icon name="bookmark" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>
              {saving ? 'Saving...' : 'Save Trip'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartTrip}
          >
            <Icon name="play-arrow" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Start Trip</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share Your Trip</Text>
            <Text style={styles.modalText}>
              Share your amazing road trip plan with friends and family!
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowShareModal(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleShareTrip}
              >
                <Text style={styles.modalButtonTextPrimary}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Details Modal for map markers */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{detailSelected?.name || 'Place Details'}</Text>
            <View style={{flexDirection:'row', marginBottom:12}}>
              <Image source={{ uri: (detailSelected?.details?.tags?.photo || detailSelected?.details?.tags?.image || 'https://via.placeholder.com/240x140.png?text=No+Image') }} style={{width:120,height:80,borderRadius:6,marginRight:12}} />
              <View style={{flex:1}}>
                <Text style={{fontSize:14,fontWeight:'600',color:'#333'}}>{detailSelected?.details?.tags?.cuisine || ''}</Text>
                <Text style={{fontSize:13,color:'#666',marginTop:6}}>Opening: {detailSelected?.details?.tags?.opening_hours || detailSelected?.details?.tags?.opening || 'N/A'}</Text>
                <Text style={{fontSize:13,color:'#666',marginTop:6}}>Rating: {detailSelected?.details?.tags?.rating || detailSelected?.details?.rating || 'N/A'}</Text>
              </View>
            </View>
            {detailSelected?.details?.match_reasons && (
              <View style={{marginBottom:8}}>
                <Text style={{fontWeight:'700',marginBottom:6}}>Why recommended</Text>
                {detailSelected.details.match_reasons.map((r, i) => (
                  <Text key={i} style={{fontSize:13,color:'#444'}}>• {r}</Text>
                ))}
              </View>
            )}
            <View style={{flexDirection:'row',justifyContent:'flex-end',marginTop:12}}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonSecondary]} onPress={() => setDetailModalVisible(false)}>
                <Text style={styles.modalButtonTextSecondary}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tripName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
  },
  tripNameInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    paddingVertical: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 8,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  mapContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  mapWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    height: 200,
    width: '100%',
  },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerSource: {
    backgroundColor: '#4CAF50',
  },
  markerDestination: {
    backgroundColor: '#FF5722',
  },
  markerMeal: {
    backgroundColor: '#FF9800',
  },
  timelineContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 40,
    marginRight: 16,
  },
  timelineIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineIconSource: {
    backgroundColor: '#4CAF50',
  },
  timelineIconDestination: {
    backgroundColor: '#FF5722',
  },
  timelineIconMeal: {
    backgroundColor: '#FF9800',
  },
  timelineIconTravel: {
    backgroundColor: '#2196F3',
  },
  timelineConnector: {
    flex: 1,
    width: 2,
    backgroundColor: '#e0e0e0',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 8,
  },
  timelineTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  timelineSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  mealDetails: {
    marginTop: 8,
  },
  mealBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mealBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  mealBadgeText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '500',
  },
  cuisineText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  notesContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  spacer: {
    height: 120,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButton: {
    backgroundColor: '#666',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
  },
  modalButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalButtonTextSecondary: {
    color: '#666',
    fontWeight: 'bold',
  },

  // Add these styles to replace the map-related styles
routeVisualization: {
  backgroundColor: '#f8f9fa',
  borderRadius: 12,
  padding: 20,
  alignItems: 'center',
},
routeLine: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 20,
  flexWrap: 'wrap',
},
routePoint: {
  width: 32,
  height: 32,
  borderRadius: 16,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 3,
},
routePointSource: {
  backgroundColor: '#4CAF50',
},
routePointMeal: {
  backgroundColor: '#FF9800',
  width: 24,
  height: 24,
},
routePointDestination: {
  backgroundColor: '#FF5722',
},
routeStopContainer: {
  alignItems: 'center',
  marginHorizontal: 8,
},
routeConnector: {
  width: 40,
  height: 2,
  backgroundColor: '#007AFF',
  marginVertical: 8,
},
routeStopName: {
  fontSize: 10,
  color: '#666',
  marginTop: 4,
  maxWidth: 80,
  textAlign: 'center',
},
routeStats: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  width: '100%',
  borderTopWidth: 1,
  borderTopColor: '#e0e0e0',
  paddingTop: 16,
},
routeStat: {
  alignItems: 'center',
},
routeStatValue: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#007AFF',
},
routeStatLabel: {
  fontSize: 12,
  color: '#666',
  marginTop: 2,
},
});

export default ItineraryScreen;