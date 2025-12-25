// screens/PlanTripPlusScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import logger from '../utils/logger';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');
const SCREEN_COUNT = 6;

const PlanTripPlusScreen = () => {
  const navigation = useNavigation();
  
  // Current screen state
  const [currentScreen, setCurrentScreen] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Screen 1: Trip Basics
  const [tripName, setTripName] = useState('');
  const [tripNotes, setTripNotes] = useState('');
  const [startLocation, setStartLocation] = useState({
    place_id: '',
    lat: null,
    lng: null,
    address: '',
  });
  const [startDate, setStartDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tripType, setTripType] = useState('one_way');
  const [pace, setPace] = useState('balanced');
  const [transportMode, setTransportMode] = useState('car');
  
  // Screen 2: Meal & Rest Rules
  const [mealWindows, setMealWindows] = useState({
    breakfast: { start: '08:00', end: '09:30' },
    lunch: { start: '12:00', end: '14:00' },
    dinner: { start: '19:00', end: '21:00' },
  });
  const [mealDuration, setMealDuration] = useState(45);
  const [foodPref, setFoodPref] = useState('any');
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  const [middayRest, setMiddayRest] = useState(true);
  const [restDuration, setRestDuration] = useState(150); // 2.5 hours
  const [restWindow, setRestWindow] = useState('post_lunch');
  
  // Screen 3: Route Builder
  const [stops, setStops] = useState([
    {
      order: 1,
      place_id: '',
      name: '',
      lat: null,
      lng: null,
      nights: 1,
      arrival_pref: 'flexible',
      departure_pref: 'early',
    },
  ]);
  
  // Screen 4: Stay Preferences
  const [stayPrefs, setStayPrefs] = useState({});
  
  // Screen 5: Attraction Preferences
  const [attractionPrefs, setAttractionPrefs] = useState({});
  
  // Screen 6: Review data
  const [constraints, setConstraints] = useState({
    max_detour_minutes: 30,
    open_time_enforced: true,
    buffer_percentage: 15,
  });

  // Cuisine options
  const cuisineOptions = [
    'south_indian', 'north_indian', 'chinese', 'italian', 'local',
    'continental', 'street_food', 'vegetarian', 'seafood'
  ];

  // Accommodation types
  const accommodationTypes = ['home_stay', 'lodge', 'hotel'];
  
  // Star ratings
  const starRatings = ['budget', '3_star', '4_star', '5_star', 'no_preference'];
  
  // Environment options
  const environmentOptions = ['quiet', 'near_temple', 'city_center', 'near_nature'];
  
  // Attraction themes
  const themeOptions = ['religious', 'historical', 'unesco', 'scenic', 'cultural', 'adventure'];
  
  // Walking tolerance options
  const walkingOptions = ['low', 'medium', 'high'];

  // Calculate completion percentage
  const getCompletionPercentage = () => {
    return Math.round((currentScreen / SCREEN_COUNT) * 100);
  };

  // Handle next screen
  const handleNext = () => {
    if (currentScreen < SCREEN_COUNT) {
      // Validate current screen before proceeding
      if (validateCurrentScreen()) {
        setCurrentScreen(currentScreen + 1);
      }
    } else {
      // On last screen, submit the data
      handleSubmit();
    }
  };

  // Handle previous screen
  const handlePrevious = () => {
    if (currentScreen > 1) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  // Validate current screen data
  const validateCurrentScreen = () => {
    switch (currentScreen) {
      case 1:
        // if (!tripName.trim()) {
        //   Alert.alert('Error', 'Please enter a trip name');
        //   return false;
        // }
        // if (!startLocation.address) {
        //   Alert.alert('Error', 'Please select a start location');
        //   return false;
        // }
        return true;
      
      case 3:
        // if (stops.length === 0) {
        //   Alert.alert('Error', 'Please add at least one stop');
        //   return false;
        // }
        // for (const stop of stops) {
        //   if (!stop.name.trim()) {
        //     Alert.alert('Error', `Please select a location for stop ${stop.order}`);
        //     return false;
        //   }
        //   if (stop.nights < 1) {
        //     Alert.alert('Error', `Nights must be at least 1 for ${stop.name}`);
        //     return false;
        //   }
        // }
        return true;
      
      default:
        return true;
    }
  };

  // Handle adding a new stop
  const addStop = () => {
    const newStop = {
      order: stops.length + 1,
      place_id: '',
      name: '',
      lat: null,
      lng: null,
      nights: 1,
      arrival_pref: 'flexible',
      departure_pref: 'early',
    };
    setStops([...stops, newStop]);
  };

  // Handle stop update
  const updateStop = (index, field, value) => {
    const updatedStops = [...stops];
    updatedStops[index] = { ...updatedStops[index], [field]: value };
    setStops(updatedStops);
  };

  // Handle cuisine selection
  const toggleCuisine = (cuisine) => {
    if (selectedCuisines.includes(cuisine)) {
      setSelectedCuisines(selectedCuisines.filter(c => c !== cuisine));
    } else {
      setSelectedCuisines([...selectedCuisines, cuisine]);
    }
  };

  // Handle location selection (mock function - integrate with Google Places API)
  const handleLocationSelect = (location, isStartLocation = false) => {
    if (isStartLocation) {
      setStartLocation({
        place_id: 'mock_place_id',
        lat: 13.0827,
        lng: 80.2707,
        address: location,
      });
    }
  };

  // Handle time window change
  const updateMealWindow = (meal, field, value) => {
    setMealWindows({
      ...mealWindows,
      [meal]: {
        ...mealWindows[meal],
        [field]: value,
      },
    });
  };

  // Prepare final payload
  const preparePayload = () => {
    // Calculate route waypoints for polyline generation
    const waypoints = [];
    
    // Add start location
    if (startLocation.lat && startLocation.lng) {
      waypoints.push({
        lat: startLocation.lat,
        lng: startLocation.lng,
        name: startLocation.address
      });
    }
    
    // Add all stops
    stops.forEach((stop) => {
      if (stop.lat && stop.lng) {
        waypoints.push({
          lat: stop.lat,
          lng: stop.lng,
          name: stop.name,
          nights: stop.nights
        });
      }
    });
    
    // Add return to start if round trip
    if (tripType === 'round_trip' && startLocation.lat && startLocation.lng) {
      waypoints.push({
        lat: startLocation.lat,
        lng: startLocation.lng,
        name: startLocation.address,
        is_return: true
      });
    }
    
    // Convert meal windows to the format your backend expects
    const activeMealWindows = {};
    Object.entries(mealWindows).forEach(([meal, window]) => {
      activeMealWindows[meal] = window;
    });
    
    // Build user preferences object
    const userPreferences = {
      tripType: tripType,
      pace: pace,
      transportMode: transportMode,
      foodPreference: foodPref,
      cuisinePreferences: selectedCuisines,
      walkingTolerance: attractionPrefs[stops[0]?.name]?.walking_tolerance || 'medium',
      crowdAvoidance: Object.values(attractionPrefs).some(pref => pref?.avoid_crowds) || false,
      accommodationPreferences: stayPrefs,
      activityThemes: Object.values(attractionPrefs).reduce((themes, pref) => {
        if (pref?.themes) themes.push(...pref.themes);
        return themes;
      }, []),
      middayRestRequired: middayRest,
      restDuration: restDuration,
      mealDuration: mealDuration,
      familyFriendly: Object.values(stayPrefs).some(pref => pref?.family_friendly) || false,
      parkingRequired: Object.values(stayPrefs).some(pref => pref?.parking) || false
    };
    
    // Build trip stops data for backend
    const tripStops = stops.map((stop, index) => ({
      stop_id: index + 1,
      lat: stop.lat,
      lng: stop.lng,
      name: stop.name,
      place_id: stop.place_id,
      nights: stop.nights,
      arrival_preference: stop.arrival_pref,
      departure_preference: stop.departure_pref,
      stay_preferences: stayPrefs[stop.name] || {},
      attraction_preferences: attractionPrefs[stop.name] || {
        themes: [],
        max_places_per_half_day: 2,
        avoid_crowds: false,
        walking_tolerance: 'medium'
      }
    }));
    
    // Prepare the complete payload matching your backend schema
    const payload = {
      // Trip basics
      trip_metadata: {
        name: tripName,
        description: tripNotes,
        user_id: auth.currentUser?.uid,
        created_at: new Date().toISOString(),
        status: 'draft',
        trip_type: tripType,
        version: 'trip_plus_v1'
      },
      
      // Route information
      route: {
        start: {
          lat: startLocation.lat,
          lng: startLocation.lng,
          place_id: startLocation.place_id,
          address: startLocation.address,
          date: startDate.toISOString().split('T')[0],
          time: startTime.toTimeString().split(' ')[0].substring(0, 5),
          timestamp: new Date(
            `${startDate.toISOString().split('T')[0]}T${startTime.toTimeString().split(' ')[0]}`
          ).toISOString()
        },
        waypoints: waypoints,
        stops: tripStops,
        round_trip: tripType === 'round_trip',
        total_nights: stops.reduce((sum, stop) => sum + (stop.nights || 0), 0),
        transport_mode: transportMode
      },
      
      // Preferences and constraints
      preferences: {
        travel_style: {
          pace: pace,
          transport_mode: transportMode,
          max_detour_minutes: constraints.max_detour_minutes,
          open_time_enforced: constraints.open_time_enforced,
          buffer_percentage: constraints.buffer_percentage
        },
        
        meal_preferences: {
          meal_windows: activeMealWindows,
          meal_duration_min: mealDuration,
          food_preferences: {
            veg_pref: foodPref,
            cuisines: selectedCuisines
          }
        },
        
        accommodation_preferences: stayPrefs,
        
        activity_preferences: attractionPrefs,
        
        rest_preferences: {
          midday_rest: {
            required: middayRest,
            duration_min: restDuration,
            preferred_window: restWindow
          }
        },
        
        user_preferences: userPreferences
      },
      
      // Constraints for AI planner
      constraints: {
        scheduling: {
          max_places_per_half_day: Object.values(attractionPrefs).reduce((max, pref) => 
            Math.max(max, pref?.max_places_per_half_day || 2), 2
          ),
          avoid_crowds: Object.values(attractionPrefs).some(pref => pref?.avoid_crowds),
          walking_tolerance: Object.values(attractionPrefs).reduce((tolerance, pref) => 
            pref?.walking_tolerance || tolerance, 'medium'
          ),
          time_windows: {
            breakfast: mealWindows.breakfast,
            lunch: mealWindows.lunch,
            dinner: mealWindows.dinner
          }
        },
        
        routing: {
          transport_mode: transportMode,
          allow_detours: true,
          max_detour_minutes: constraints.max_detour_minutes,
          optimize_for: pace === 'fast' ? 'time' : pace === 'leisurely' ? 'scenic' : 'balanced'
        },
        
        accommodation: {
          types: Object.values(stayPrefs).reduce((types, pref) => {
            if (pref?.type) types.push(...pref.type);
            return types;
          }, []),
          family_friendly: Object.values(stayPrefs).some(pref => pref?.family_friendly),
          parking_required: Object.values(stayPrefs).some(pref => pref?.parking)
        }
      },
      
      // Additional metadata
      metadata: {
        app_version: '1.0.0',
        platform: Platform.OS,
        device_id: 'mobile',
        session_id: Date.now().toString()
      }
    };
    
    return payload;
  };

  // Enhanced handleSubmit function
  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Validate user authentication
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Please login to create a trip');
        navigation.navigate('Login');
        return;
      }
      
      // Validate required data
      if (!validateCurrentScreen()) {
        Alert.alert('Error', 'Please fill all required fields');
        return;
      }
      
      // Prepare the complete payload
      const requestData = preparePayload();
      
      // Add user ID to payload
      requestData.trip_metadata.user_id = user.uid;
      requestData.user_id = user.uid;
      
      console.log('Sending trip-plus data to backend:', JSON.stringify(requestData, null, 2));
      
      // Send to backend endpoint
      const response = await fetch(`${BACKEND_URL}/trip-plus/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Trip Plus created successfully:', result);
      
      // Generate polyline using our custom algorithm (not OSRM)
      let customPolyline = null;
      try {
        // Extract coordinates for polyline generation
        const coordinates = [];
        
        // Add start point
        if (startLocation.lat && startLocation.lng) {
          coordinates.push({
            latitude: startLocation.lat,
            longitude: startLocation.lng
          });
        }
        
        // Add all stops
        stops.forEach(stop => {
          if (stop.lat && stop.lng) {
            coordinates.push({
              latitude: stop.lat,
              longitude: stop.lng
            });
          }
        });
        
        // Add return point if round trip
        if (tripType === 'round_trip' && startLocation.lat && startLocation.lng) {
          coordinates.push({
            latitude: startLocation.lat,
            longitude: startLocation.lng
          });
        }
        
        // Generate optimized polyline using our algorithm
        if (coordinates.length >= 2) {
          customPolyline = await generateOptimizedPolyline(coordinates, {
            transportMode: transportMode,
            avoidHighways: pace === 'leisurely',
            optimizeFor: pace === 'fast' ? 'time' : 'scenic'
          });
          console.log('Custom polyline generated with', customPolyline?.length, 'points');
        }
      } catch (polylineError) {
        console.warn('Custom polyline generation failed:', polylineError);
        customPolyline = null;
      }
      
      // Prepare Firestore document
      const generatedTripId = result.trip_id || `trip_plus_${Date.now()}`;
      const firebasePayload = {
        // Trip metadata
        userId: user.uid,
        user_id: user.uid,
        tripId: generatedTripId,
        tripName: tripName || 'Trip Plus Plan',
        name: tripName || 'Trip Plus Plan',
        status: 'planned',
        createdAt: new Date().toISOString(),
        savedAt: null,
        
        // Source and destination
        source: {
          lat: startLocation.lat,
          lng: startLocation.lng,
        },
        sourceName: startLocation.address,
        
        // Route information
        stops: stops.map(stop => ({
          lat: stop.lat,
          lng: stop.lng,
          name: stop.name,
          nights: stop.nights,
          arrival_pref: stop.arrival_pref,
          departure_pref: stop.departure_pref
        })),
        stopNames: stops.map(stop => stop.name),
        totalNights: stops.reduce((sum, stop) => sum + (stop.nights || 0), 0),
        
        // Trip type and style
        trip_type: tripType,
        pace: pace,
        transport_mode: transportMode,
        
        // Backend result
        ...result,
        
        // Itinerary data
        itinerary: result.itinerary || result.itineraryData || {},
        timeline: result.timeline || [],
        
        // Map data
        mapRegion: result.mapRegion || null,
        polylineCoordinates: customPolyline || result.polylineCoordinates || result.polyline || [],
        polylineSource: customPolyline ? 'custom_algorithm' : (result.polylineCoordinates ? 'backend' : 'none'),
        
        // Distances and durations
        totalDistance: result.totalDistance || result.route_summary?.total_distance_km || 0,
        totalDuration: result.totalDuration || result.route_summary?.total_duration_min || 0,
        totalDays: Math.ceil(
          stops.reduce((sum, stop) => sum + (stop.nights || 0), 0) + 
          (tripType === 'round_trip' ? 1 : 0)
        ),
        
        // Preferences
        mealPreferences: ['breakfast', 'lunch', 'dinner'].filter(meal => 
          mealWindows[meal]?.start && mealWindows[meal]?.end
        ),
        mealWindows: mealWindows,
        meal_duration_min: mealDuration,
        
        // Constraints
        max_detour_minutes: constraints.max_detour_minutes,
        open_time_enforced: constraints.open_time_enforced,
        buffer_percentage: constraints.buffer_percentage,
        
        // User preferences
        veg_pref: foodPref,
        user_preferences: {
          foodPreference: foodPref,
          cuisines: selectedCuisines,
          pace: pace,
          transport: transportMode,
          middayRest: middayRest,
          walkingTolerance: Object.values(attractionPrefs).reduce((tolerance, pref) => 
            pref?.walking_tolerance || tolerance, 'medium'
          )
        },
        
        // Stay and attraction preferences
        stay_preferences: stayPrefs,
        attraction_preferences: attractionPrefs,
        
        // Collections
        members: [user.uid],
        notes: tripNotes || '',
        
        // Timestamps
        preferred_start_time: new Date(
          `${startDate.toISOString().split('T')[0]}T${startTime.toTimeString().split(' ')[0]}`
        ).toISOString(),
        
        // System fields
        version: 'trip_plus_v1',
        collection: 'trip_plus',
        updatedAt: new Date().toISOString()
      };
      
      // Save to Firestore trip_plus collection
      const tripPlusRef = collection(db, 'trip_plus');
      const docRef = await addDoc(tripPlusRef, firebasePayload);
      
      console.log('Trip Plus saved to Firestore with ID:', docRef.id);
      
      // Navigate to results screen
      navigation.navigate('TripPlusResults', {
        tripData: result,
        firebaseTripId: docRef.id,
        tripType: 'trip_plus',
        itinerary: result.itinerary || {},
        preferences: {
          mealWindows: mealWindows,
          stayPrefs: stayPrefs,
          attractionPrefs: attractionPrefs
        }
      });
      
    } catch (error) {
      console.error('Error creating Trip Plus:', error);
      
      // Try to save to Firestore even if backend fails
      try {
        const fallbackPayload = preparePayload();
        fallbackPayload.status = 'backend_failed';
        fallbackPayload.error = error.message;
        fallbackPayload.createdAt = new Date().toISOString();
        
        const tripPlusRef = collection(db, 'trip_plus');
        const docRef = await addDoc(tripPlusRef, fallbackPayload);
        
        Alert.alert(
          'Partial Success',
          'Trip saved locally. Backend processing failed. You can try again later.',
          [
            {
              text: 'View Trip',
              onPress: () => navigation.navigate('TripDetails', { tripId: docRef.id })
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
      } catch (firestoreError) {
        console.error('Failed to save to Firestore:', firestoreError);
        Alert.alert(
          'Error',
          'Failed to create trip. Please check your connection and try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function for custom polyline generation
  const generateOptimizedPolyline = async (coordinates, options = {}) => {
    // This is where your custom polyline algorithm will go
    // For now, return the coordinates as-is
    console.log('Generating polyline for', coordinates.length, 'points with options:', options);
    
    // Simulate API call or algorithm processing
    return new Promise((resolve) => {
      setTimeout(() => {
        // Return coordinates as polyline points
        resolve(coordinates.map(coord => ({
          latitude: coord.latitude,
          longitude: coord.longitude
        })));
      }, 100);
    });
  };

  // Render screen based on currentScreen
  const renderScreen = () => {
    switch (currentScreen) {
      case 1:
        return renderScreen1();
      case 2:
        return renderScreen2();
      case 3:
        return renderScreen3();
      case 4:
        return renderScreen4();
      case 5:
        return renderScreen5();
      case 6:
        return renderScreen6();
      default:
        return renderScreen1();
    }
  };

  // Screen 1: Trip Basics
  const renderScreen1 = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Trip Basics</Text>
      
      {/* Trip Identity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trip Identity</Text>
        <TextInput
          style={styles.input}
          placeholder="Trip Name *"
          value={tripName}
          onChangeText={setTripName}
          placeholderTextColor="#999"
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description / Notes (Optional)"
          value={tripNotes}
          onChangeText={setTripNotes}
          multiline
          numberOfLines={3}
          placeholderTextColor="#999"
        />
      </View>

      {/* Start & End */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Start Location</Text>
        <TouchableOpacity 
          style={styles.input}
          onPress={() => Alert.alert('Info', 'Google Places integration needed')}
        >
          <Text style={startLocation.address ? styles.inputText : styles.placeholder}>
            {startLocation.address || 'Search for location *'}
          </Text>
          <MaterialIcons name="place" size={20} color="#666" />
        </TouchableOpacity>
        
        <View style={styles.row}>
          <TouchableOpacity 
            style={[styles.input, styles.halfInput]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.inputText}>
              {startDate.toDateString()}
            </Text>
            <MaterialIcons name="calendar-today" size={20} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.input, styles.halfInput]}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.inputText}>
              {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <MaterialIcons name="access-time" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Trip Type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trip Type</Text>
        <View style={styles.radioGroup}>
          {['one_way', 'round_trip'].map((type) => (
            <TouchableOpacity
              key={type}
              style={styles.radioOption}
              onPress={() => setTripType(type)}
            >
              <View style={styles.radioCircle}>
                {tripType === type && <View style={styles.selectedRadio} />}
              </View>
              <Text style={styles.radioLabel}>
                {type === 'one_way' ? 'One-way' : 'Round trip'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Travel Style */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Travel Style</Text>
        
        <Text style={styles.subSectionTitle}>Pace</Text>
        <View style={styles.radioGroup}>
          {['leisurely', 'balanced', 'fast'].map((p) => (
            <TouchableOpacity
              key={p}
              style={styles.radioOption}
              onPress={() => setPace(p)}
            >
              <View style={styles.radioCircle}>
                {pace === p && <View style={styles.selectedRadio} />}
              </View>
              <Text style={styles.radioLabel}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.subSectionTitle}>Transport Mode</Text>
        <View style={styles.radioGroup}>
          {['car', 'cab', 'bike'].map((mode) => (
            <TouchableOpacity
              key={mode}
              style={styles.radioOption}
              onPress={() => setTransportMode(mode)}
            >
              <View style={styles.radioCircle}>
                {transportMode === mode && <View style={styles.selectedRadio} />}
              </View>
              <Text style={styles.radioLabel}>
                {mode === 'car' ? 'Self-drive car' : 
                 mode === 'cab' ? 'Cab' : 'Bike'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* DateTime Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setStartDate(selectedDate);
          }}
          minimumDate={new Date()}
        />
      )}
      
      {showTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) setStartTime(selectedTime);
          }}
        />
      )}
    </ScrollView>
  );

  // Screen 2: Meal & Rest Rules
  const renderScreen2 = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Meal & Rest Rules</Text>
      
      {/* Meal Windows */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meal Windows</Text>
        
        {['breakfast', 'lunch', 'dinner'].map((meal) => (
          <View key={meal} style={styles.timeWindowContainer}>
            <Text style={styles.mealLabel}>
              {meal.charAt(0).toUpperCase() + meal.slice(1)}
            </Text>
            <View style={styles.timeInputRow}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                value={mealWindows[meal].start}
                onChangeText={(text) => updateMealWindow(meal, 'start', text)}
                placeholder="HH:mm"
                placeholderTextColor="#999"
              />
              <Text style={styles.timeSeparator}>to</Text>
              <TextInput
                style={[styles.input, styles.timeInput]}
                value={mealWindows[meal].end}
                onChangeText={(text) => updateMealWindow(meal, 'end', text)}
                placeholder="HH:mm"
                placeholderTextColor="#999"
              />
            </View>
          </View>
        ))}
      </View>

      {/* Meal Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meal Preferences</Text>
        
        <Text style={styles.subSectionTitle}>Food Preference</Text>
        <View style={styles.radioGroup}>
          {['veg', 'non_veg', 'any'].map((pref) => (
            <TouchableOpacity
              key={pref}
              style={styles.radioOption}
              onPress={() => setFoodPref(pref)}
            >
              <View style={styles.radioCircle}>
                {foodPref === pref && <View style={styles.selectedRadio} />}
              </View>
              <Text style={styles.radioLabel}>
                {pref === 'veg' ? 'Vegetarian' : 
                 pref === 'non_veg' ? 'Non-vegetarian' : 'Any'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.subSectionTitle}>Cuisine Preference</Text>
        <View style={styles.chipContainer}>
          {cuisineOptions.map((cuisine) => (
            <TouchableOpacity
              key={cuisine}
              style={[
                styles.chip,
                selectedCuisines.includes(cuisine) && styles.chipSelected
              ]}
              onPress={() => toggleCuisine(cuisine)}
            >
              <Text style={[
                styles.chipText,
                selectedCuisines.includes(cuisine) && styles.chipTextSelected
              ]}>
                {cuisine.replace('_', ' ').toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.subSectionTitle}>Meal Duration: {mealDuration} min</Text>
        <Slider
          style={styles.slider}
          minimumValue={15}
          maximumValue={120}
          step={5}
          value={mealDuration}
          onValueChange={setMealDuration}
          minimumTrackTintColor="#4A90E2"
          maximumTrackTintColor="#E0E0E0"
          thumbTintColor="#4A90E2"
        />
      </View>

      {/* Rest Rules */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rest Rules</Text>
        
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Midday Rest Required?</Text>
          <TouchableOpacity
            style={[
              styles.toggle,
              middayRest ? styles.toggleOn : styles.toggleOff
            ]}
            onPress={() => setMiddayRest(!middayRest)}
          >
            <View style={[
              styles.toggleCircle,
              middayRest && styles.toggleCircleOn
            ]} />
          </TouchableOpacity>
        </View>

        {middayRest && (
          <>
            <Text style={styles.subSectionTitle}>
              Rest Duration: {Math.floor(restDuration / 60)}h {restDuration % 60}m
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={60}
              maximumValue={240}
              step={15}
              value={restDuration}
              onValueChange={setRestDuration}
              minimumTrackTintColor="#4A90E2"
              maximumTrackTintColor="#E0E0E0"
              thumbTintColor="#4A90E2"
            />

            <Text style={styles.subSectionTitle}>Preferred Window</Text>
            <View style={styles.radioGroup}>
              {['post_lunch', 'flexible'].map((window) => (
                <TouchableOpacity
                  key={window}
                  style={styles.radioOption}
                  onPress={() => setRestWindow(window)}
                >
                  <View style={styles.radioCircle}>
                    {restWindow === window && <View style={styles.selectedRadio} />}
                  </View>
                  <Text style={styles.radioLabel}>
                    {window === 'post_lunch' ? 'Post-lunch' : 'Flexible'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );

  // Screen 3: Route Builder
  const renderScreen3 = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Route & Stops Builder</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Stops {tripType === 'round_trip' ? '(Round Trip)' : '(One Way)'}
        </Text>
        
        {stops.map((stop, index) => (
          <View key={index} style={styles.stopCard}>
            <View style={styles.stopHeader}>
              <Text style={styles.stopNumber}>Stop {index + 1}</Text>
              {stops.length > 1 && (
                <TouchableOpacity
                  onPress={() => {
                    const updatedStops = stops.filter((_, i) => i !== index);
                    // Reorder stops
                    const reordered = updatedStops.map((s, i) => ({
                      ...s,
                      order: i + 1,
                    }));
                    setStops(reordered);
                  }}
                >
                  <MaterialIcons name="delete" size={24} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.input}
              onPress={() => Alert.alert('Info', 'Google Places integration needed')}
            >
              <Text style={stop.name ? styles.inputText : styles.placeholder}>
                {stop.name || `City / Location ${index + 1} *`}
              </Text>
              <MaterialIcons name="place" size={20} color="#666" />
            </TouchableOpacity>
            
            <View style={styles.row}>
              <View style={[styles.input, styles.halfInput]}>
                <Text style={styles.inputLabel}>Nights</Text>
                <View style={styles.counterContainer}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateStop(index, 'nights', Math.max(1, stop.nights - 1))}
                  >
                    <MaterialIcons name="remove" size={20} color="#4A90E2" />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{stop.nights}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateStop(index, 'nights', stop.nights + 1)}
                  >
                    <MaterialIcons name="add" size={20} color="#4A90E2" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={[styles.input, styles.halfInput]}>
                <Text style={styles.inputLabel}>Arrival</Text>
                <View style={styles.prefButtons}>
                  {['early', 'flexible', 'late'].map((pref) => (
                    <TouchableOpacity
                      key={pref}
                      style={[
                        styles.prefButton,
                        stop.arrival_pref === pref && styles.prefButtonSelected
                      ]}
                      onPress={() => updateStop(index, 'arrival_pref', pref)}
                    >
                      <Text style={[
                        styles.prefButtonText,
                        stop.arrival_pref === pref && styles.prefButtonTextSelected
                      ]}>
                        {pref.charAt(0).toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            
            <View style={styles.input}>
              <Text style={styles.inputLabel}>Departure</Text>
              <View style={styles.prefButtons}>
                {['early', 'relaxed'].map((pref) => (
                  <TouchableOpacity
                    key={pref}
                    style={[
                      styles.prefButton,
                      stop.departure_pref === pref && styles.prefButtonSelected
                    ]}
                    onPress={() => updateStop(index, 'departure_pref', pref)}
                  >
                    <Text style={[
                      styles.prefButtonText,
                      stop.departure_pref === pref && styles.prefButtonTextSelected
                    ]}>
                      {pref.charAt(0).toUpperCase() + pref.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ))}
        
        <TouchableOpacity style={styles.addButton} onPress={addStop}>
          <MaterialIcons name="add-circle" size={24} color="#4A90E2" />
          <Text style={styles.addButtonText}>Add Stop</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // Screen 4: Stay Preferences
  const renderScreen4 = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Stay Preferences</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accommodation Preferences per Stop</Text>
        
        {stops.map((stop, index) => (
          <View key={index} style={styles.stopCard}>
            <Text style={styles.stopName}>{stop.name || `Stop ${index + 1}`}</Text>
            
            <Text style={styles.inputLabel}>Accommodation Type</Text>
            <View style={styles.chipContainer}>
              {accommodationTypes.map((type) => {
                const currentTypes = stayPrefs[stop.name]?.type || [];
                const isSelected = currentTypes.includes(type);
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      isSelected && styles.chipSelected
                    ]}
                    onPress={() => {
                      const updatedPrefs = { ...stayPrefs };
                      if (!updatedPrefs[stop.name]) {
                        updatedPrefs[stop.name] = {
                          type: [],
                          star: 'no_preference',
                          family_friendly: false,
                          environment: [],
                          parking: false,
                        };
                      }
                      
                      if (isSelected) {
                        updatedPrefs[stop.name].type = currentTypes.filter(t => t !== type);
                      } else {
                        updatedPrefs[stop.name].type = [...currentTypes, type];
                      }
                      
                      setStayPrefs(updatedPrefs);
                    }}
                  >
                    <Text style={[
                      styles.chipText,
                      isSelected && styles.chipTextSelected
                    ]}>
                      {type.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <Text style={styles.inputLabel}>Star Rating</Text>
            <View style={styles.radioGroup}>
              {starRatings.map((star) => {
                const currentStar = stayPrefs[stop.name]?.star || 'no_preference';
                return (
                  <TouchableOpacity
                    key={star}
                    style={styles.radioOption}
                    onPress={() => {
                      const updatedPrefs = { ...stayPrefs };
                      if (!updatedPrefs[stop.name]) {
                        updatedPrefs[stop.name] = {
                          type: [],
                          star: star,
                          family_friendly: false,
                          environment: [],
                          parking: false,
                        };
                      } else {
                        updatedPrefs[stop.name].star = star;
                      }
                      setStayPrefs(updatedPrefs);
                    }}
                  >
                    <View style={styles.radioCircle}>
                      {currentStar === star && <View style={styles.selectedRadio} />}
                    </View>
                    <Text style={styles.radioLabel}>
                      {star === 'no_preference' ? 'No preference' : 
                       star === 'budget' ? 'Budget' : 
                       star.replace('_', '-').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <Text style={styles.inputLabel}>Environment</Text>
            <View style={styles.chipContainer}>
              {environmentOptions.map((env) => {
                const currentEnvs = stayPrefs[stop.name]?.environment || [];
                const isSelected = currentEnvs.includes(env);
                return (
                  <TouchableOpacity
                    key={env}
                    style={[
                      styles.chip,
                      isSelected && styles.chipSelected
                    ]}
                    onPress={() => {
                      const updatedPrefs = { ...stayPrefs };
                      if (!updatedPrefs[stop.name]) {
                        updatedPrefs[stop.name] = {
                          type: [],
                          star: 'no_preference',
                          family_friendly: false,
                          environment: [env],
                          parking: false,
                        };
                      } else {
                        if (isSelected) {
                          updatedPrefs[stop.name].environment = currentEnvs.filter(e => e !== env);
                        } else {
                          updatedPrefs[stop.name].environment = [...currentEnvs, env];
                        }
                      }
                      setStayPrefs(updatedPrefs);
                    }}
                  >
                    <Text style={[
                      styles.chipText,
                      isSelected && styles.chipTextSelected
                    ]}>
                      {env.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Family Friendly</Text>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  stayPrefs[stop.name]?.family_friendly ? styles.toggleOn : styles.toggleOff
                ]}
                onPress={() => {
                  const updatedPrefs = { ...stayPrefs };
                  if (!updatedPrefs[stop.name]) {
                    updatedPrefs[stop.name] = {
                      type: [],
                      star: 'no_preference',
                      family_friendly: true,
                      environment: [],
                      parking: false,
                    };
                  } else {
                    updatedPrefs[stop.name].family_friendly = !updatedPrefs[stop.name].family_friendly;
                  }
                  setStayPrefs(updatedPrefs);
                }}
              >
                <View style={[
                  styles.toggleCircle,
                  stayPrefs[stop.name]?.family_friendly && styles.toggleCircleOn
                ]} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Parking Required</Text>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  stayPrefs[stop.name]?.parking ? styles.toggleOn : styles.toggleOff
                ]}
                onPress={() => {
                  const updatedPrefs = { ...stayPrefs };
                  if (!updatedPrefs[stop.name]) {
                    updatedPrefs[stop.name] = {
                      type: [],
                      star: 'no_preference',
                      family_friendly: false,
                      environment: [],
                      parking: true,
                    };
                  } else {
                    updatedPrefs[stop.name].parking = !updatedPrefs[stop.name].parking;
                  }
                  setStayPrefs(updatedPrefs);
                }}
              >
                <View style={[
                  styles.toggleCircle,
                  stayPrefs[stop.name]?.parking && styles.toggleCircleOn
                ]} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  // Screen 5: Attraction Preferences
  const renderScreen5 = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Attraction Preferences</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences per Stop</Text>
        
        {stops.map((stop, index) => (
          <View key={index} style={styles.stopCard}>
            <Text style={styles.stopName}>{stop.name || `Stop ${index + 1}`}</Text>
            
            <Text style={styles.inputLabel}>Themes</Text>
            <View style={styles.chipContainer}>
              {themeOptions.map((theme) => {
                const currentThemes = attractionPrefs[stop.name]?.themes || [];
                const isSelected = currentThemes.includes(theme);
                return (
                  <TouchableOpacity
                    key={theme}
                    style={[
                      styles.chip,
                      isSelected && styles.chipSelected
                    ]}
                    onPress={() => {
                      const updatedPrefs = { ...attractionPrefs };
                      if (!updatedPrefs[stop.name]) {
                        updatedPrefs[stop.name] = {
                          themes: [theme],
                          max_places_per_half_day: 2,
                          avoid_crowds: false,
                          walking_tolerance: 'medium',
                        };
                      } else {
                        if (isSelected) {
                          updatedPrefs[stop.name].themes = currentThemes.filter(t => t !== theme);
                        } else {
                          updatedPrefs[stop.name].themes = [...currentThemes, theme];
                        }
                      }
                      setAttractionPrefs(updatedPrefs);
                    }}
                  >
                    <Text style={[
                      styles.chipText,
                      isSelected && styles.chipTextSelected
                    ]}>
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <Text style={styles.inputLabel}>
              Max places per half-day: {attractionPrefs[stop.name]?.max_places_per_half_day || 2}
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={3}
              step={1}
              value={attractionPrefs[stop.name]?.max_places_per_half_day || 2}
              onValueChange={(value) => {
                const updatedPrefs = { ...attractionPrefs };
                if (!updatedPrefs[stop.name]) {
                  updatedPrefs[stop.name] = {
                    themes: [],
                    max_places_per_half_day: value,
                    avoid_crowds: false,
                    walking_tolerance: 'medium',
                  };
                } else {
                  updatedPrefs[stop.name].max_places_per_half_day = value;
                }
                setAttractionPrefs(updatedPrefs);
              }}
              minimumTrackTintColor="#4A90E2"
              maximumTrackTintColor="#E0E0E0"
              thumbTintColor="#4A90E2"
            />
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Avoid Crowds</Text>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  attractionPrefs[stop.name]?.avoid_crowds ? styles.toggleOn : styles.toggleOff
                ]}
                onPress={() => {
                  const updatedPrefs = { ...attractionPrefs };
                  if (!updatedPrefs[stop.name]) {
                    updatedPrefs[stop.name] = {
                      themes: [],
                      max_places_per_half_day: 2,
                      avoid_crowds: true,
                      walking_tolerance: 'medium',
                    };
                  } else {
                    updatedPrefs[stop.name].avoid_crowds = !updatedPrefs[stop.name].avoid_crowds;
                  }
                  setAttractionPrefs(updatedPrefs);
                }}
              >
                <View style={[
                  styles.toggleCircle,
                  attractionPrefs[stop.name]?.avoid_crowds && styles.toggleCircleOn
                ]} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Walking Tolerance</Text>
            <View style={styles.radioGroup}>
              {walkingOptions.map((tolerance) => {
                const currentTolerance = attractionPrefs[stop.name]?.walking_tolerance || 'medium';
                return (
                  <TouchableOpacity
                    key={tolerance}
                    style={styles.radioOption}
                    onPress={() => {
                      const updatedPrefs = { ...attractionPrefs };
                      if (!updatedPrefs[stop.name]) {
                        updatedPrefs[stop.name] = {
                          themes: [],
                          max_places_per_half_day: 2,
                          avoid_crowds: false,
                          walking_tolerance: tolerance,
                        };
                      } else {
                        updatedPrefs[stop.name].walking_tolerance = tolerance;
                      }
                      setAttractionPrefs(updatedPrefs);
                    }}
                  >
                    <View style={styles.radioCircle}>
                      {currentTolerance === tolerance && <View style={styles.selectedRadio} />}
                    </View>
                    <Text style={styles.radioLabel}>
                      {tolerance.charAt(0).toUpperCase() + tolerance.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  // Screen 6: Review & Generate
  const renderScreen6 = () => {
    const payload = preparePayload();
    
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Review & Generate</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Summary</Text>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Trip Basics</Text>
            <Text style={styles.summaryText}>Name: {tripName}</Text>
            <Text style={styles.summaryText}>Start: {startLocation.address}</Text>
            <Text style={styles.summaryText}>Type: {tripType === 'one_way' ? 'One-way' : 'Round trip'}</Text>
            <Text style={styles.summaryText}>Pace: {pace}</Text>
            <Text style={styles.summaryText}>Transport: {transportMode}</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Route</Text>
            {stops.map((stop, index) => (
              <Text key={index} style={styles.summaryText}>
                {index + 1}. {stop.name || `Stop ${index + 1}`} - {stop.nights} night(s)
              </Text>
            ))}
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Meal Rules</Text>
            <Text style={styles.summaryText}>Breakfast: {mealWindows.breakfast.start} - {mealWindows.breakfast.end}</Text>
            <Text style={styles.summaryText}>Lunch: {mealWindows.lunch.start} - {mealWindows.lunch.end}</Text>
            <Text style={styles.summaryText}>Dinner: {mealWindows.dinner.start} - {mealWindows.dinner.end}</Text>
            <Text style={styles.summaryText}>Food: {foodPref}</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Stay Preferences</Text>
            {Object.keys(stayPrefs).map((stopName) => (
              <Text key={stopName} style={styles.summaryText}>
                {stopName}: {stayPrefs[stopName]?.type?.join(', ') || 'No preference'}
              </Text>
            ))}
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Attraction Preferences</Text>
            {Object.keys(attractionPrefs).map((stopName) => (
              <Text key={stopName} style={styles.summaryText}>
                {stopName}: {attractionPrefs[stopName]?.themes?.join(', ') || 'All themes'}
              </Text>
            ))}
          </View>
          
          <View style={styles.noteBox}>
            <MaterialIcons name="info" size={20} color="#4A90E2" />
            <Text style={styles.noteText}>
              Click "Generate Suggestions" to create your AI-powered itinerary
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  // Progress bar
  const ProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${getCompletionPercentage()}%` }
          ]} 
        />
      </View>
      <Text style={styles.progressText}>
        Step {currentScreen} of {SCREEN_COUNT} ({getCompletionPercentage()}%)
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Trip Plus</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Bar */}
      <ProgressBar />

      {/* Screen Content */}
      <View style={styles.content}>
        {renderScreen()}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.prevButton,
            currentScreen === 1 && styles.disabledButton
          ]}
          onPress={handlePrevious}
          disabled={currentScreen === 1}
        >
          <MaterialIcons name="arrow-back" size={20} color={currentScreen === 1 ? "#999" : "#333"} />
          <Text style={[
            styles.navButtonText,
            currentScreen === 1 && styles.disabledText
          ]}>
            Previous
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.nextButton,
            currentScreen === SCREEN_COUNT && styles.submitButton
          ]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Text style={styles.navButtonText}>
                {currentScreen === SCREEN_COUNT ? 'Generate Suggestions' : 'Next'}
              </Text>
              {currentScreen < SCREEN_COUNT && (
                <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',

  },
  backButton: {
    padding: 8,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
  },
  headerSpacer: {
    width: 40,
  },
  progressContainer: {
    backgroundColor: '#02214aff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e0a205ff',
  },
  progressText: {
    fontSize: 12,
    color: '#ffffffff',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  navigation: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 25,
    marginHorizontal: 4,
    backgroundColor: '#02214aff',
  },
  prevButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  nextButton: {
    backgroundColor: '#02214aff',

  },
  submitButton: {
    backgroundColor: '#02214aff',
  },
  disabledButton: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
    color: '#ffffffff',
  },
  disabledText: {
    color: '#999',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#02214aff',
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  inputText: {
    fontSize: 12,
    color: '#333',
  },
  placeholder: {
    fontSize: 12,
    color: '#999',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  radioGroup: {
    marginVertical: 4,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedRadio: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90E2',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 36,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipSelected: {
    backgroundColor: '#ffb701ff',
    borderColor: '#ffb701ff',
    color: '#000000ff',
  },
  chipText: {
    fontSize: 12,
    color: '#000000ff',
  },
  chipTextSelected: {
    color: '#000000ff',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 34,
    justifyContent: 'center',
    padding: 2,
  },
  toggleOn: {
    backgroundColor: '#02214aff',
  },
  toggleOff: {
    backgroundColor: '#E0E0E0',
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 32,
    backgroundColor: '#FFF',
  },
  toggleCircleOn: {
    transform: [{ translateX: 22 }],
  },
  timeWindowContainer: {
    marginBottom: 16,
  },
  mealLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    flex: 1,
    textAlign: 'center',
  },
  timeSeparator: {
    marginHorizontal: 12,
    fontSize: 16,
    color: '#666',
  },
  stopCard: {
    backgroundColor: '#FFF',
    borderRadius: 25,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stopNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  stopName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterButton: {
    width: 26,
    height: 26,
    borderRadius: 28,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 12,
  },
  prefButtons: {
    flexDirection: 'row',
  },
  prefButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 26,
    marginHorizontal: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  prefButtonSelected: {
    backgroundColor: '#02214aff',
    borderColor: '#02214aff',
  },
  prefButtonText: {
    fontSize: 14,
    color: '#666',
  },
  prefButtonTextSelected: {
    color: '#FFF',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#4A90E2',
    borderRadius: 28,
    padding: 12,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 16,
    color: '#4A90E2',
    marginLeft: 8,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    borderRadius: 28,
    padding: 12,
    marginTop: 16,
  },
  noteText: {
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 8,
    flex: 1,
  },
});

export default PlanTripPlusScreen;