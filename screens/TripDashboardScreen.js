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
import TripSummary from './components/TripSummary';
import WeatherWidget from './components/WeatherWidget';
import AlertWidget from './components/AlertWidget';
import ActionButtons from './components/ActionButtons';
import LeafletMap from './components/LeafletMap';
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
        if (docSnap.exists()) {
          const tripData = { id: docSnap.id, ...docSnap.data() };
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
        console.error('Error fetching trip:', error);
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
      const weatherData = await getWeatherData(
        tripData.destination.lat,
        tripData.destination.lng
      );
      setWeather(weatherData);
    } catch (error) {
      console.error('Error fetching weather:', error);
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
    if (!tripData.stops || tripData.stops.length < 2) {
      // Use polylineCoordinates if available
      if (tripData.polylineCoordinates) {
        setRouteCoordinates(tripData.polylineCoordinates);
      }
      return;
    }

    try {
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
          setRouteCoordinates(polyline);
        } else {
          // Fallback to straight lines between stops
          setRouteCoordinates(coordinates);
        }
      }
    } catch (error) {
      console.error('Error generating route:', error);
      // Fallback to available coordinates
      if (tripData.polylineCoordinates) {
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
                <LeafletMap
                  routeCoordinates={routeCoordinates}
                  source={trip.source}
                  destination={trip.destination}
                  stops={trip.stops || []}
                  height={200}
                  interactive={false}
                />
                
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
              <LeafletMap
                routeCoordinates={routeCoordinates}
                source={trip.source}
                destination={trip.destination}
                stops={trip.stops || []}
                height={height * 0.6}
                interactive={true}
              />
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