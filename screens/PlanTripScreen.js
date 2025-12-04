// screens/PlanTripScreen.js
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';

const BACKEND_URL = 'http://10.180.18.12:8000';

const PlanTripScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  

  // Form state
  const [tripData, setTripData] = useState({
    source: { name: '', lat: null, lng: null },
    destination: { name: '', lat: null, lng: null },
    stops: [],
    preferredReachTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    mealPreferences: [],
    mealWindows: {
      breakfast: { start: '08:00', end: '10:00' },
      lunch: { start: '12:00', end: '14:00' },
      dinner: { start: '19:00', end: '21:00' },
      snacks:  { start: '16:00', end: '18:00' },
    },
    maxDetour: 30,
    mealDuration: 45,
  });

  // Available meal options
  const mealOptions = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const [currentStop, setCurrentStop] = useState('');

  // Free location autocomplete using OpenStreetMap Nominatim
  // Enhanced location search with multiple fallback services
  const searchLocation = async (query, type) => {
    if (query.length < 3) return [];
    
    try {
      // Try OpenStreetMap Nominatim first
      let data = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { timeout: 5000 }
      );
      
      if (data && data.length > 0) {
        return data.map(item => ({
          name: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          address: item.display_name,
          type: 'osm'
        }));
      }

      // Fallback to LocationIQ (free tier)
      data = await fetchWithTimeout(
        `https://us1.locationiq.com/v1/search.php?key=pk.YOUR_LOCATIONIQ_KEY&q=${encodeURIComponent(query)}&format=json&limit=5`,
        { timeout: 5000 }
      );
      
      if (data && data.length > 0) {
        return data.map(item => ({
          name: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          address: item.display_name,
          type: 'locationiq'
        }));
      }

      // Final fallback - Mock data for common Indian cities
      return getMockLocations(query);
      
    } catch (error) {
      console.error('Location search error:', error);
      // Return mock data as final fallback
      return getMockLocations(query);
    }
  };

  // Helper function for timeout handling
  const fetchWithTimeout = async (url, options = {}) => {
    const { timeout = 8000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Routivity-App/1.0',
          'Accept': 'application/json',
        }
      });
      
      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid content type, expected JSON');
      }

      return await response.json();
    } catch (error) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  };

  // Mock data for common Indian locations (fallback)
  const getMockLocations = (query) => {
    const commonLocations = {
      // Bangalore locations
      'bangalore': [
        {
          name: 'Bangalore, Karnataka, India',
          lat: 12.9716,
          lng: 77.5946,
          address: 'Bangalore, Karnataka, India',
          type: 'mock'
        }
      ],
      'bengaluru': [
        {
          name: 'Bengaluru, Karnataka, India',
          lat: 12.9716,
          lng: 77.5946,
          address: 'Bengaluru, Karnataka, India',
          type: 'mock'
        }
      ],
      'chennai': [
        {
          name: 'Chennai, Tamil Nadu, India',
          lat: 13.0827,
          lng: 80.2707,
          address: 'Chennai, Tamil Nadu, India',
          type: 'mock'
        }
      ],
      'mumbai': [
        {
          name: 'Mumbai, Maharashtra, India',
          lat: 19.0760,
          lng: 72.8777,
          address: 'Mumbai, Maharashtra, India',
          type: 'mock'
        }
      ],
      'delhi': [
        {
          name: 'New Delhi, Delhi, India',
          lat: 28.6139,
          lng: 77.2090,
          address: 'New Delhi, Delhi, India',
          type: 'mock'
        }
      ],
      'hyderabad': [
        {
          name: 'Hyderabad, Telangana, India',
          lat: 17.3850,
          lng: 78.4867,
          address: 'Hyderabad, Telangana, India',
          type: 'mock'
        }
      ],
      'pune': [
        {
          name: 'Pune, Maharashtra, India',
          lat: 18.5204,
          lng: 73.8567,
          address: 'Pune, Maharashtra, India',
          type: 'mock'
        }
      ],
      // Default fallbacks
      'default': [
        {
          name: `${query} (Sample Location 1)`,
          lat: 12.9716 + (Math.random() - 0.5) * 0.1,
          lng: 77.5946 + (Math.random() - 0.5) * 0.1,
          address: `Approximate location for ${query}`,
          type: 'mock'
        },
        {
          name: `${query} (Sample Location 2)`,
          lat: 12.9716 + (Math.random() - 0.5) * 0.1,
          lng: 77.5946 + (Math.random() - 0.5) * 0.1,
          address: `Alternative location for ${query}`,
          type: 'mock'
        }
      ]
    };

    const normalizedQuery = query.toLowerCase().trim();
    
    // Check for exact matches first
    if (commonLocations[normalizedQuery]) {
      return commonLocations[normalizedQuery];
    }

    // Check for partial matches
    for (const [key, locations] of Object.entries(commonLocations)) {
      if (normalizedQuery.includes(key) && key !== 'default') {
        return locations;
      }
    }

    // Return default mock data
    return commonLocations.default;
  };

  // Location search with debouncing
  const [sourceSuggestions, setSourceSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [stopSuggestions, setStopSuggestions] = useState([]);
  const [showSourceSuggestions, setShowSourceSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [showStopSuggestions, setShowStopSuggestions] = useState(false);

  const debouncedSearch = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  const handleSourceSearch = debouncedSearch(async (query) => {
    if (query.length >= 3) {
      const results = await searchLocation(query, 'source');
      setSourceSuggestions(results);
      setShowSourceSuggestions(true);
    } else {
      setShowSourceSuggestions(false);
    }
  }, 500);

  const handleDestinationSearch = debouncedSearch(async (query) => {
    if (query.length >= 3) {
      const results = await searchLocation(query, 'destination');
      setDestinationSuggestions(results);
      setShowDestinationSuggestions(true);
    } else {
      setShowDestinationSuggestions(false);
    }
  }, 500);

  const handleStopSearch = debouncedSearch(async (query) => {
    if (query.length >= 3) {
      const results = await searchLocation(query, 'stop');
      setStopSuggestions(results);
      setShowStopSuggestions(true);
    } else {
      setShowStopSuggestions(false);
    }
  }, 500);

  const selectLocation = (location, type) => {
    if (type === 'source') {
      setTripData(prev => ({
        ...prev,
        source: {
          name: location.name,
          lat: location.lat,
          lng: location.lng,
        },
      }));
      setShowSourceSuggestions(false);
    } else if (type === 'destination') {
      setTripData(prev => ({
        ...prev,
        destination: {
          name: location.name,
          lat: location.lat,
          lng: location.lng,
        },
      }));
      setShowDestinationSuggestions(false);
    } else if (type === 'stop') {
      setCurrentStop('');
      setTripData(prev => ({
        ...prev,
        stops: [...prev.stops, {
          name: location.name,
          lat: location.lat,
          lng: location.lng,
        }],
      }));
      setShowStopSuggestions(false);
    }
  };

  const removeStop = (index) => {
    setTripData(prev => ({
      ...prev,
      stops: prev.stops.filter((_, i) => i !== index),
    }));
  };

  const toggleMealPreference = (meal) => {
    setTripData(prev => ({
      ...prev,
      mealPreferences: prev.mealPreferences.includes(meal)
        ? prev.mealPreferences.filter(m => m !== meal)
        : [...prev.mealPreferences, meal],
    }));
  };

  const updateMealTime = (meal, field, time) => {
    setTripData(prev => ({
      ...prev,
      mealWindows: {
        ...prev.mealWindows,
        [meal]: {
          ...prev.mealWindows[meal],
          [field]: time,
        },
      },
    }));
  };

  const handleTimeChange = (event, selectedTime, meal, field) => {
    if (selectedTime) {
      const timeString = selectedTime.toTimeString().split(' ')[0].substring(0, 5);
      updateMealTime(meal, field, timeString);
    }
    setShowTimePicker(false);
  };

  const validateForm = () => {
    // Ensure user has typed something for both fields
    if (!tripData.source.name || !tripData.destination.name) {
      Alert.alert('Error', 'Please enter both source and destination locations');
      return false;
    }
    // Ensure coordinates are present (i.e., user picked from suggestions)
    if (
      tripData.source.lat == null ||
      tripData.source.lng == null ||
      tripData.destination.lat == null ||
      tripData.destination.lng == null
    ) {
      Alert.alert(
        'Location not set',
        'Please select both source and destination from the suggestions list so we can find exact coordinates.'
      );
      return false;
    }
    if (tripData.mealPreferences.length === 0) {
      Alert.alert('Error', 'Please select at least one meal preference');
      return false;
    }
    if (!tripData.preferredReachTime) {
      Alert.alert('Error', 'Please select preferred arrival time');
      return false;
    }
    return true;
  };

  const handlePlanTrip = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Please login to plan a trip');
        return;
      }

      // Prepare data for backend
      const requestData = {
        source: {
          lat: tripData.source.lat,
          lng: tripData.source.lng,
        },
        destination: {
          lat: tripData.destination.lat,
          lng: tripData.destination.lng,
        },
        stops: tripData.stops.map(stop => ({
          lat: stop.lat,
          lng: stop.lng,
        })),
        mealPreferences: tripData.mealPreferences,
        mealWindows: Object.keys(tripData.mealWindows)
          .filter(meal => tripData.mealPreferences.includes(meal))
          .reduce((acc, meal) => {
            acc[meal] = tripData.mealWindows[meal];
            return acc;
          }, {}),
        preferred_reach_time: tripData.preferredReachTime.toISOString(),
        veg_pref: 'any', // Will be overridden by user preferences from backend
        max_detour_minutes: tripData.maxDetour,
        meal_duration_min: tripData.mealDuration,
        user_id: user.uid,
      };

      console.log('Sending trip data:', requestData);

      const response = await fetch(`${BACKEND_URL}/trips/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      console.log('Trip created successfully:', result);

      // Save trip to Firebase
      const tripDoc = await addDoc(collection(db, 'trips'), {
        userId: user.uid,
        ...requestData,
        tripId: result.trip_id,
        status: 'planned',
        createdAt: serverTimestamp(),
        sourceName: tripData.source.name,
        destinationName: tripData.destination.name,
        stopNames: tripData.stops.map(stop => stop.name),
      });

      // Navigate to suggestions screen with the result
      // Note: route name must match the one registered in App.js ("Suggestions")
      navigation.navigate('Suggestions', {
        tripData: result,
        firebaseTripId: tripDoc.id,
      });

    } catch (error) {
      console.error('Error planning trip:', error);
      Alert.alert(
        'Error',
        'Failed to plan trip. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Helper to strip characters that some devices can't render (avoids tofu boxes)
  const sanitizeText = (text) => {
    if (!text) return '';
    return text.replace(/[^\x20-\x7E]/g, '');
  };

  const LocationInput = ({ 
  value, 
  onChangeText, 
  placeholder, 
  suggestions, 
  showSuggestions, 
  onSelectLocation, 
  type 
}) => {
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleTextChange = (text) => {
    const clean = sanitizeText(text);
    setLocalValue(clean);
    onChangeText(clean);
  };

  const handleSelect = (location) => {
    const cleanName = sanitizeText(location.name);
    setLocalValue(cleanName); // Update local state immediately
    onSelectLocation({ ...location, name: cleanName }, type);
  };

  return (
    <View style={styles.locationInputContainer}>
      <View style={styles.inputWithIcon}>
        <Icon name="location-on" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          value={localValue} // Use local state
          onChangeText={handleTextChange} // Use local handler
          placeholderTextColor="#999"
        />
      </View>
      
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((location, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => handleSelect(location)} // Use local handler
            >
              <Icon name="place" size={16} color="#007AFF" />
              <Text style={styles.suggestionText} numberOfLines={2}>
                {sanitizeText(location.name)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};
  const MealTimeSelector = ({ meal }) => {
    const window = tripData.mealWindows[meal] || {};
    return (
      <View style={styles.mealTimeContainer}>
        <Text style={styles.mealTimeLabel}>
          {meal.charAt(0).toUpperCase() + meal.slice(1)}
        </Text>
        <View style={styles.timeInputsContainer}>
          <View style={styles.timeInput}>
            <Text style={styles.timeLabel}>Start</Text>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker(meal + '-start')}
            >
              <Text style={styles.timeText}>{window.start || '--:--'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.timeInput}>
            <Text style={styles.timeLabel}>End</Text>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker(meal + '-end')}
            >
              <Text style={styles.timeText}>{window.end || '--:--'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Plan Your Journey</Text>
          <Text style={styles.subtitle}>Let's create your perfect road trip with amazing food stops!</Text>
        </View>

        {/* Route Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route Details</Text>
          
          <View style={styles.locationSection}>
            <LocationInput
              value={tripData.source.name}
              onChangeText={(text) => {
                handleSourceSearch(text);
              }}
              placeholder="Starting point..."
              suggestions={sourceSuggestions}
              showSuggestions={showSourceSuggestions}
              onSelectLocation={selectLocation}
              type="source"
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Icon name="arrow-downward" size={20} color="#007AFF" />
              <View style={styles.dividerLine} />
            </View>

            <LocationInput
              value={tripData.destination.name}
              onChangeText={(text) => {
                handleDestinationSearch(text);
              }}
              placeholder="Destination..."
              suggestions={destinationSuggestions}
              showSuggestions={showDestinationSuggestions}
              onSelectLocation={selectLocation}
              type="destination"
            />
          </View>

          {/* Stops */}
          <View style={styles.stopsSection}>
            <Text style={styles.stopsTitle}>Add Stopovers (Optional)</Text>
            <LocationInput
              value={currentStop}
              onChangeText={(text) => {
                setCurrentStop(text);
                handleStopSearch(text);
              }}
              placeholder="Add a stop along the way..."
              suggestions={stopSuggestions}
              showSuggestions={showStopSuggestions}
              onSelectLocation={selectLocation}
              type="stop"
            />
            
            {/* Added Stops */}
            {tripData.stops.map((stop, index) => (
              <View key={index} style={styles.addedStop}>
                <Text style={styles.addedStopText} numberOfLines={1}>
                  {index + 1}. {stop.name}
                </Text>
                <TouchableOpacity onPress={() => removeStop(index)}>
                  <Icon name="close" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Meal Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meal Preferences</Text>
          <Text style={styles.sectionSubtitle}>Select meals you'd like to have during your trip</Text>
          
          <View style={styles.mealOptionsContainer}>
            {mealOptions.map(meal => (
              <TouchableOpacity
                key={meal}
                style={[
                  styles.mealOption,
                  tripData.mealPreferences.includes(meal) && styles.mealOptionSelected,
                ]}
                onPress={() => toggleMealPreference(meal)}
              >
                <Text style={[
                  styles.mealOptionText,
                  tripData.mealPreferences.includes(meal) && styles.mealOptionTextSelected,
                ]}>
                  {meal.charAt(0).toUpperCase() + meal.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Meal Times */}
          {tripData.mealPreferences.length > 0 && (
            <View style={styles.mealTimesSection}>
              <Text style={styles.mealTimesTitle}>Preferred Meal Times</Text>
              {tripData.mealPreferences.map(meal => (
                <MealTimeSelector key={meal} meal={meal} />
              ))}
            </View>
          )}
        </View>

        {/* Trip Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Settings</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Arrival Time</Text>
            <TouchableOpacity 
              style={styles.timeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.timeText}>
                {tripData.preferredReachTime.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Max Detour (minutes)</Text>
            <View style={styles.sliderContainer}>
            <View style={styles.sliderControlRow}>
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() =>
                  setTripData(prev => ({
                    ...prev,
                    maxDetour: Math.max(5, prev.maxDetour - 5),
                  }))
                }
              >
                <Icon name="remove" size={18} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.sliderValue}>{tripData.maxDetour} min</Text>
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() =>
                  setTripData(prev => ({
                    ...prev,
                    maxDetour: Math.min(60, prev.maxDetour + 5),
                  }))
                }
              >
                <Icon name="add" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>
              <View style={styles.slider}>
                <View style={[styles.sliderTrack, { width: `${(tripData.maxDetour / 60) * 100}%` }]} />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>5</Text>
                <Text style={styles.sliderLabel}>60</Text>
              </View>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Meal Duration (minutes)</Text>
            <View style={styles.sliderContainer}>
            <View style={styles.sliderControlRow}>
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() =>
                  setTripData(prev => ({
                    ...prev,
                    mealDuration: Math.max(15, prev.mealDuration - 5),
                  }))
                }
              >
                <Icon name="remove" size={18} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.sliderValue}>{tripData.mealDuration} min</Text>
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() =>
                  setTripData(prev => ({
                    ...prev,
                    mealDuration: Math.min(60, prev.mealDuration + 5),
                  }))
                }
              >
                <Icon name="add" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>
              <View style={styles.slider}>
                <View style={[styles.sliderTrack, { width: `${((tripData.mealDuration - 15) / 45) * 100}%` }]} />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>15</Text>
                <Text style={styles.sliderLabel}>60</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.planButton,
            (!tripData.source.name || !tripData.destination.name || tripData.mealPreferences.length === 0) && 
            styles.planButtonDisabled,
          ]}
          onPress={handlePlanTrip}
          disabled={loading || !tripData.source.name || !tripData.destination.name || tripData.mealPreferences.length === 0}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.planButtonText}>Plan My Trip</Text>
              <Icon name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date/Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={tripData.preferredReachTime}
          mode="datetime"
          display="default"
          minimumDate={new Date()}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              setTripData(prev => ({ ...prev, preferredReachTime: date }));
            }
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="spinner"
          onChange={(event, time) => {
            const [meal, field] = showTimePicker.split('-');
            handleTimeChange(event, time, meal, field);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  locationSection: {
    marginBottom: 20,
  },
  locationInputContainer: {
    marginBottom: 8,
    position: 'relative',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  divider: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#e1e5e9',
    width: '80%',
  },
  stopsSection: {
    marginTop: 16,
  },
  stopsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  addedStop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  addedStopText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  mealOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  mealOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  mealOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  mealOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  mealOptionTextSelected: {
    color: '#fff',
  },
  mealTimesSection: {
    marginTop: 16,
  },
  mealTimesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  mealTimeContainer: {
    marginBottom: 16,
  },
  mealTimeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  timeInputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeInput: {
    flex: 0.48,
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  timeButton: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
  },
  timeText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  settingRow: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  sliderContainer: {
    marginTop: 8,
  },
  sliderControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  sliderButton: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  slider: {
    height: 4,
    backgroundColor: '#e1e5e9',
    borderRadius: 2,
    marginBottom: 4,
  },
  sliderTrack: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#666',
  },
  planButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 30,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  planButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
  },
  planButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default PlanTripScreen;