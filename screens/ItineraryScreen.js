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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

const ItineraryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { itineraryData } = route.params;

  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [tripName, setTripName] = useState('My Amazing Road Trip');
  const [notes, setNotes] = useState('');
  
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
      // Simulate API call to generate detailed itinerary
      // In real implementation, this would call your backend
      const generatedItinerary = {
        id: itineraryData.trip_id,
        name: tripName,
        notes: notes,
        departure: itineraryData.recommended_departure_iso,
        arrival: new Date(new Date(itineraryData.recommended_departure_iso).getTime() + 
                (itineraryData.route_summary.total_duration_min * 60 * 1000)).toISOString(),
        totalDistance: itineraryData.route_summary.total_distance_km,
        totalDuration: itineraryData.route_summary.total_duration_min,
        stops: generateStops(),
        timeline: generateTimeline(),
        mapRegion: calculateMapRegion(),
        polylineCoordinates: generateSamplePolyline(), // In real app, use actual route coordinates
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
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]).start();

    } catch (error) {
      console.error('Error generating itinerary:', error);
      Alert.alert('Error', 'Failed to generate itinerary');
    } finally {
      setLoading(false);
    }
  };

  const generateStops = () => {
    const stops = [];
    
    // Add source
    stops.push({
      id: 'source',
      type: 'source',
      name: 'Starting Point',
      time: itineraryData.recommended_departure_iso,
      duration: 0,
      coordinates: { latitude: 12.97, longitude: 77.59 }, // Sample coordinates
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

    // Add destination
    stops.push({
      id: 'destination',
      type: 'destination',
      name: 'Destination',
      time: new Date(new Date(itineraryData.recommended_departure_iso).getTime() + 
            (itineraryData.route_summary.total_duration_min * 60 * 1000)).toISOString(),
      duration: 0,
      coordinates: { latitude: 13.08, longitude: 80.27 }, // Sample coordinates
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
      case 'meal': return `${stop.duration} min stop • ${stop.details.detour_minutes} min detour`;
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
    // Sample polyline coordinates - in real app, use actual route from OSRM
    return [
      { latitude: 12.97, longitude: 77.59 },
      { latitude: 12.98, longitude: 77.60 },
      { latitude: 13.00, longitude: 77.65 },
      { latitude: 13.05, longitude: 77.70 },
      { latitude: 13.08, longitude: 80.27 },
    ];
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
        message: `I planned an amazing road trip with Routivity! 🚗\n\n${generateShareText()}`,
        url: 'https://routivity.app', // Your app URL
      };
      
      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const generateShareText = () => {
    if (!itinerary) return '';
    
    return `📍 Trip: ${tripName}
🚗 Distance: ${itinerary.totalDistance.toFixed(1)} km
⏱️ Duration: ${Math.round(itinerary.totalDuration)} min
🍽️ Meal Stops: ${itinerary.timeline.filter(item => item.type === 'meal').length}

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
// Replace the MapPreview component in ItineraryScreen.js with this:
const RouteVisualization = () => (
  <Animated.View 
    style={[
      styles.mapContainer,
      { 
        opacity: fadeAnim,
        transform: [
          { translateY: slideAnim },
          { scale: scaleAnim }
        ]
      }
    ]}
  >
    <Text style={styles.sectionTitle}>Route Visualization</Text>
    
    {/* Custom Route Visualization without maps */}
    <View style={styles.routeVisualization}>
      <View style={styles.routeLine}>
        {/* Source Point */}
        <View style={[styles.routePoint, styles.routePointSource]}>
          <Icon name="play-arrow" size={16} color="#fff" />
        </View>
        
        {/* Meal Stops */}
        {itinerary.stops.filter(stop => stop.type === 'meal').map((stop, index) => (
          <View key={stop.id} style={styles.routeStopContainer}>
            <View style={styles.routeConnector} />
            <View style={[styles.routePoint, styles.routePointMeal]}>
              <Icon name="restaurant" size={12} color="#fff" />
            </View>
            <Text style={styles.routeStopName} numberOfLines={1}>
              {stop.name}
            </Text>
          </View>
        ))}
        
        {/* Destination Point */}
        <View style={styles.routeStopContainer}>
          <View style={styles.routeConnector} />
          <View style={[styles.routePoint, styles.routePointDestination]}>
            <Icon name="flag" size={16} color="#fff" />
          </View>
        </View>
      </View>
      
      {/* Route Stats */}
      <View style={styles.routeStats}>
        <View style={styles.routeStat}>
          <Text style={styles.routeStatValue}>{itinerary.stops.length - 2}</Text>
          <Text style={styles.routeStatLabel}>Stops</Text>
        </View>
        <View style={styles.routeStat}>
          <Text style={styles.routeStatValue}>
            {Math.round(itinerary.totalDistance)}
          </Text>
          <Text style={styles.routeStatLabel}>KM</Text>
        </View>
        <View style={styles.routeStat}>
          <Text style={styles.routeStatValue}>
            {Math.round(itinerary.totalDuration)}
          </Text>
          <Text style={styles.routeStatLabel}>Min</Text>
        </View>
      </View>
    </View>
  </Animated.View>
);

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
            <Text style={styles.progressText}>Planned • Ready to Go!</Text>
          </View>
        </Animated.View>

        {/* Map Preview */}
        <RouteVisualization />

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
  map: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapView: {
    flex: 1,
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