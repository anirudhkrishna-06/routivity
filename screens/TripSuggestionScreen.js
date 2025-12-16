// screens/TripSuggestionsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import logger from '../utils/logger';

const { width } = Dimensions.get('window');

const TripSuggestionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { tripData, firebaseTripId } = route.params;

  const [selectedMeals, setSelectedMeals] = useState({});
  const [selectedAttractions, setSelectedAttractions] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  // Animation on mount
  useEffect(() => {
    console.log('TripSuggestionScreen tripData keys:', Object.keys(tripData));
    console.log('TripSuggestionScreen tourist_suggestions:', tripData?.tourist_suggestions?.length, tripData?.tourist_suggestions);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Initialize from existing data or auto-select
  useEffect(() => {
    logger.info('TripSuggestionsScreen mounted for trip', firebaseTripId || tripData?.trip_id);

    // Start with existing selections if available
    const initialSelections = { ...(tripData.selectedMeals || {}) };

    // Auto-select for any meal that doesn't have a selection yet
    Object.keys(tripData.meal_suggestions || {}).forEach(meal => {
      if (tripData.meal_suggestions[meal].length > 0 && !initialSelections[meal]) {
        initialSelections[meal] = tripData.meal_suggestions[meal][0].osm_id;
      }
    });

    setSelectedMeals(initialSelections);
  }, [tripData.meal_suggestions, tripData.selectedMeals, firebaseTripId]);

  const handleSelectMeal = (mealType, place) => {
    setSelectedMeals(prev => ({
      ...prev,
      [mealType]: place.osm_id,
    }));
  };

  const handleSelectAttraction = (place) => {
    setSelectedAttractions(prev => {
      const newSelections = { ...prev };
      if (newSelections[place.osm_id]) {
        delete newSelections[place.osm_id];
      } else {
        newSelections[place.osm_id] = place.osm_id;
      }
      return newSelections;
    });
  };

  const getPlaceImage = (place) => {
    // Generate placeholder image based on place type/name
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const color = colors[place.name.length % colors.length];
    return `https://via.placeholder.com/150/${color.replace('#', '')}/FFFFFF?text=${encodeURIComponent(place.name.charAt(0))}`;
  };

  const calculatePersonalizationScore = (place) => {
    return Math.min(5, Math.max(1, place.personalization_score || 3));
  };

  const getScoreColor = (score) => {
    if (score >= 4) return '#4CAF50';
    if (score >= 3) return '#FF9800';
    return '#F44336';
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMatchBadges = (place) => {
    const badges = [];

    if (place.match_reasons && place.match_reasons.length > 0) {
      place.match_reasons.forEach(reason => {
        if (reason.includes('Vegetarian')) badges.push({ text: 'Veg Friendly', color: '#4CAF50' });
        if (reason.includes('budget')) badges.push({ text: 'Budget', color: '#FF9800' });
        if (reason.includes('mood')) badges.push({ text: 'Mood Match', color: '#2196F3' });
        if (reason.includes('Accessibility')) badges.push({ text: 'Accessible', color: '#9C27B0' });
      });
    }

    // Add badges based on tags
    const tags = place.tags || {};
    if (tags['diet:vegetarian'] === 'yes') badges.push({ text: 'Veg Friendly', color: '#4CAF50' });
    if (tags['air_conditioning'] === 'yes') badges.push({ text: 'AC Available', color: '#03A9F4' });
    if (tags['cuisine']?.includes('indian')) badges.push({ text: 'Indian Cuisine', color: '#FF5722' });

    return badges.slice(0, 3); // Max 3 badges
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh - in real app, you might want to refetch suggestions
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleProceedToItinerary = async () => {
    // Proceed even if no meals are selected
    // if (Object.keys(selectedMeals).length === 0) { ... } - Removed blocking check

    setLoading(true);
    try {
      // Save selected meals to Firebase
      // Build detailed objects for each selected meal (needed for both Firebase and local nav)
      const selectedMealDetails = {};
      const selectedMealsMeta = {};
      const chosenStops = [];

      Object.keys(selectedMeals).forEach(mealType => {
        const osmId = selectedMeals[mealType];

        // Find the full place object from tripData suggestions
        const places = tripData.meal_suggestions?.[mealType] || [];
        // Handle both string and number ID comparison
        const place = places.find(p => String(p.osm_id) === String(osmId));

        if (place) {
          const lat = place.location?.lat ?? place.lat ?? place.coordinates?.latitude ?? place.coordinates?.lat ?? null;
          const lng = place.location?.lng ?? place.lng ?? place.coordinates?.longitude ?? place.coordinates?.lng ?? null;

          selectedMealDetails[mealType] = {
            osm_id: place.osm_id,
            name: place.name,
            lat,
            lng,
            tags: place.tags || {},
            detour_minutes: place.detour_minutes || place.tags?.detour_minutes || null,
            raw: place,
          };

          selectedMealsMeta[mealType] = {
            source: 'suggestions',
            selectedAt: new Date().toISOString(),
          };

          // Create a stop object to add to trip.stops (avoid duplicates by creating unique stops)
          if (lat != null && lng != null) {
            chosenStops.push({
              name: place.name,
              latitude: lat,
              longitude: lng,
              lat,
              lng,
              type: 'restaurant',
              osm_id: place.osm_id,
              details: place,
            });
          }
        }
      });

      // Process Selected Attractions
      const selectedAttractionDetails = {};
      const attractionStops = [];
      const attractionsList = tripData.tourist_suggestions || [];

      Object.keys(selectedAttractions).forEach(osmId => {
        const place = attractionsList.find(p => String(p.osm_id) === String(osmId));
        if (place) {
          const lat = place.location?.lat ?? place.lat;
          const lng = place.location?.lng ?? place.lng;

          selectedAttractionDetails[osmId] = {
            osm_id: place.osm_id,
            name: place.name,
            lat, lng,
            tags: place.tags || {},
            raw: place
          };

          if (lat != null && lng != null) {
            attractionStops.push({
              name: place.name,
              latitude: lat,
              longitude: lng,
              lat, lng,
              type: 'attraction',
              osm_id: place.osm_id,
              details: place
            });
          }
        }
      });

      // Combine all chosen stops
      chosenStops.push(...attractionStops);


      // Save selected meals to Firebase if ID exists
      if (firebaseTripId) {
        logger.info('Saving selectedMeals to trip', firebaseTripId, selectedMeals);

        const updatePayload = {
          selectedMeals: selectedMeals,
          selectedMealDetails,
          selectedMealsMeta,
          selectedAttractions: selectedAttractions, // Save attraction IDs
          selectedAttractionDetails,
          updatedAt: new Date(),
        };

        // Use arrayUnion to append chosen stops to existing trip.stops without overwriting
        if (chosenStops.length > 0) {
          // Firestore's arrayUnion must be used directly in updateDoc call
          // We convert to plain objects to be safe, though they already are
          const unionArgs = chosenStops.map(s => s);
          await updateDoc(doc(db, 'trips', firebaseTripId), {
            ...updatePayload,
            stops: arrayUnion(...unionArgs),
          });
        } else {
          await updateDoc(doc(db, 'trips', firebaseTripId), updatePayload);
        }
      }

      // Prepare itinerary data
      const itineraryData = {
        ...tripData,
        selectedMeals: selectedMeals,
        selectedAttractions: selectedAttractions,
        firebaseTripId: firebaseTripId,
        // Optimistically update local data for passing to next screen
        selectedMealDetails: selectedMealDetails,
        stops: [...(tripData.stops || []), ...chosenStops],
      };

      // Navigate to trip dashboard screen (pass tripId so dashboard can load the trip)
      // Prefer firebaseTripId from route params; fall back to itineraryData.firebaseTripId if available
      const targetTripId = firebaseTripId || itineraryData.firebaseTripId;
      if (targetTripId) {
        navigation.navigate('TripDashboard', { tripId: targetTripId, itineraryData });
      } else {
        // Fallback: navigate to itinerary as a safe default
        navigation.navigate('Itinerary', { itineraryData });
      }

    } catch (error) {
      logger.error('Error saving selections:', error);
      Alert.alert('Error', 'Failed to save your selections. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Open external maps app (or web) to view or navigate to a place
  const openInMaps = async (place, navigate = false) => {
    try {
      const lat = place.location?.lat ?? place.lat ?? place.coordinates?.latitude;
      const lng = place.location?.lng ?? place.lng ?? place.coordinates?.longitude;
      if (!lat || !lng) {
        Alert.alert('Location unavailable', 'This place does not have coordinates.');
        return;
      }

      const label = place.name ? encodeURIComponent(place.name) : 'Destination';
      const dest = `${lat},${lng}`;

      const originLat = tripData?.source?.lat;
      const originLng = tripData?.source?.lng;

      if (Platform.OS === 'ios') {
        if (navigate) {
          let url = `http://maps.apple.com/?daddr=${dest}&dirflg=d`;
          if (originLat && originLng) url += `&saddr=${originLat},${originLng}`;
          await Linking.openURL(url);
        } else {
          const url = `http://maps.apple.com/?q=${label}&ll=${dest}`;
          await Linking.openURL(url);
        }
      } else {
        if (navigate) {
          let url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
          if (originLat && originLng) url += `&origin=${originLat},${originLng}`;
          await Linking.openURL(url);
        } else {
          const geo = `geo:${dest}?q=${dest}(${label})`;
          const can = await Linking.canOpenURL(geo);
          if (can) await Linking.openURL(geo);
          else await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${dest}`);
        }
      }
    } catch (err) {
      console.warn('openInMaps failed', err);
      Alert.alert('Unable to open maps', 'Could not open the maps application.');
    }
  };

  // Return true if the place detour is close to the user's max detour setting
  const isNearDetourLimit = (place) => {
    try {
      const max = Number(tripData?.maxDetour ?? tripData?.max_detour_minutes ?? 0);
      if (!max || max <= 0) return false;
      const detour = Number(place?.detour_minutes ?? place?.tags?.detour_minutes ?? 0);
      if (!detour || detour <= 0) return false;

      // Consider 'near' when detour is >= 85% of max OR within 2 minutes of max
      if (detour >= 0.85 * max) return true;
      if ((max - detour) <= 2) return true;
      return false;
    } catch (e) {
      return false;
    }
  };

  const MealSuggestionCard = ({ mealType, places }) => {
    const selectedPlaceId = selectedMeals[mealType];

    return (
      <Animated.View
        style={[
          styles.mealSection,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.mealHeader}>
          <View style={styles.mealTitleContainer}>
            <Text style={styles.mealTitle}>{mealType.toUpperCase()}</Text>
            <Text style={styles.mealTime}>
              {tripData.route_summary && formatTime(
                places.find(p => p.osm_id === selectedPlaceId)?.eta_iso ||
                places[0]?.eta_iso ||
                new Date().toISOString()
              )}
            </Text>
          </View>
          <Text style={styles.mealSubtitle}>
            {places.length} suggestions - Choose your preferred spot
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.placesContainer}
        >
          {/* Small inner component to allow each card to manage expanded 'why' state */}
          {(() => {
            const PlaceCard = ({ place, selected, onPress }) => {
              const [showReasons, setShowReasons] = useState(false);
              return (
                <TouchableOpacity
                  key={place.osm_id}
                  style={[
                    styles.placeCard,
                    selected && styles.placeCardSelected,
                  ]}
                  onPress={onPress}
                >
                  {/* Selection Indicator */}
                  <View style={styles.selectionIndicator}>
                    {selected ? (
                      <View style={styles.selectedIndicator}>
                        <Icon name="check-circle" size={20} color="#4CAF50" />
                      </View>
                    ) : (
                      <View style={styles.unselectedIndicator} />
                    )}
                  </View>

                  {/* Place Image */}
                  <Image
                    source={{ uri: getPlaceImage(place) }}
                    style={styles.placeImage}
                    defaultSource={require('../assets/placeholder-image.png')}
                  />

                  {/* Place Details */}
                  <View style={styles.placeDetails}>
                    <Text style={styles.placeName} numberOfLines={2}>
                      {place.name}
                    </Text>

                    {/* Why recommended toggle */}
                    <TouchableOpacity
                      onPress={() => setShowReasons(prev => !prev)}
                      style={styles.whyButton}
                    >
                      <Text style={styles.whyText}>{showReasons ? 'Hide reasons' : 'Why recommended?'}</Text>
                    </TouchableOpacity>

                    {showReasons && place.match_reasons && place.match_reasons.length > 0 && (
                      <View style={styles.reasonsContainer}>
                        {place.match_reasons.map((r, i) => (
                          <Text key={i} style={styles.reasonText}>• {r}</Text>
                        ))}
                      </View>
                    )}

                    {/* Personalization Score */}
                    <View style={styles.scoreContainer}>
                      <View style={styles.scoreStars}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Icon
                            key={star}
                            name="star"
                            size={14}
                            color={star <= calculatePersonalizationScore(place) ? getScoreColor(calculatePersonalizationScore(place)) : '#E0E0E0'}
                          />
                        ))}
                      </View>
                      <Text style={styles.scoreText}>
                        {calculatePersonalizationScore(place).toFixed(1)}
                      </Text>
                    </View>

                    {/* Match Badges */}
                    <View style={styles.badgesContainer}>
                      {getMatchBadges(place).map((badge, idx) => (
                        <View key={idx} style={[styles.badge, { backgroundColor: badge.color }]}>
                          <Text style={styles.badgeText}>{badge.text}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Detour Info */}
                    <View style={styles.detourInfo}>
                      <Icon name="directions-car" size={14} color="#666" />
                      <Text style={styles.detourText}>
                        {place.detour_minutes} min detour
                      </Text>
                    </View>
                    {isNearDetourLimit(place) && (
                      <View style={{ marginTop: 6 }}>
                        <Text style={styles.nearLimitText}>Near limit — this detour is close to your maximum allowed detour</Text>
                      </View>
                    )}

                    {/* Additional Info */}
                    <View style={styles.additionalInfo}>
                      {place.tags?.cuisine && (
                        <Text style={styles.cuisineText} numberOfLines={1}>
                          {place.tags.cuisine}
                        </Text>
                      )}
                    </View>

                    {/* Map Actions */}
                    <View style={styles.mapActionsRow}>
                      <TouchableOpacity
                        style={styles.mapButton}
                        onPress={() => openInMaps(place, false)}
                      >
                        <Icon name="map" size={16} color="#007AFF" />
                        <Text style={styles.mapButtonText}>View on map</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.mapButton, styles.navigateButton]}
                        onPress={() => openInMaps(place, true)}
                      >
                        <Icon name="navigation" size={16} color="#fff" />
                        <Text style={[styles.mapButtonText, { color: '#fff' }]}>Navigate</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            };

            return places.map((place) => (
              <PlaceCard
                key={place.osm_id}
                place={place}
                selected={selectedPlaceId === place.osm_id}
                onPress={() => handleSelectMeal(mealType, place)}
              />
            ));
          })()}
        </ScrollView>

        {/* No selection warning */}
        {!selectedPlaceId && places.length > 0 && (
          <View style={styles.selectionWarning}>
            <Icon name="warning" size={16} color="#FF9800" />
            <Text style={styles.warningText}>Select an option for {mealType}</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const AttractionSuggestionCard = ({ places }) => {
    return (
      <Animated.View
        style={[
          styles.mealSection,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.mealHeader}>
          <View style={styles.mealTitleContainer}>
            <Text style={styles.mealTitle}>EXPLORE ALONG THE WAY</Text>
            <Text style={styles.mealTime}>
              {places.length} spots
            </Text>
          </View>
          <Text style={styles.mealSubtitle}>
            Top attractions near your route (Multi-select)
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.placesContainer}
        >
          {places.map((place) => {
            const isSelected = !!selectedAttractions[place.osm_id];

            // Inline PlaceCard specific for Attractions to allow multi-select visual
            return (
              <TouchableOpacity
                key={place.osm_id}
                style={[
                  styles.placeCard,
                  isSelected && styles.placeCardSelected,
                ]}
                onPress={() => handleSelectAttraction(place)}
              >
                <View style={styles.selectionIndicator}>
                  {isSelected ? (
                    <View style={styles.selectedIndicator}>
                      <Icon name="check-circle" size={20} color="#4CAF50" />
                    </View>
                  ) : (
                    <View style={styles.unselectedIndicator} />
                  )}
                </View>

                <Image
                  source={{ uri: getPlaceImage(place) }}
                  style={styles.placeImage}
                  defaultSource={require('../assets/placeholder-image.png')}
                />

                <View style={styles.placeDetails}>
                  <Text style={styles.placeName} numberOfLines={2}>
                    {place.name}
                  </Text>

                  <View style={styles.detourInfo}>
                    <Icon name="directions-car" size={14} color="#666" />
                    <Text style={styles.detourText}>
                      {place.detour_minutes} min detour
                    </Text>
                  </View>

                  <View style={styles.additionalInfo}>
                    {place.tags?.tourism && (
                      <Text style={styles.cuisineText}>{place.tags.tourism.toUpperCase()}</Text>
                    )}
                  </View>

                  <View style={styles.mapActionsRow}>
                    <TouchableOpacity
                      style={styles.mapButton}
                      onPress={() => openInMaps(place, false)}
                    >
                      <Icon name="map" size={16} color="#007AFF" />
                      <Text style={styles.mapButtonText}>Map</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    );
  };

  const TripSummary = () => (
    <Animated.View
      style={[
        styles.summaryCard,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <Text style={styles.summaryTitle}>Trip Summary</Text>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <View style={styles.summaryIconContainer}>
            <Icon name="access-time" size={20} color="#007AFF" />
          </View>
          <View>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>
              {Math.round(tripData.route_summary?.total_duration_min || 0)} min
            </Text>
          </View>
        </View>

        <View style={styles.summaryItem}>
          <View style={styles.summaryIconContainer}>
            <Icon name="directions" size={20} color="#007AFF" />
          </View>
          <View>
            <Text style={styles.summaryLabel}>Distance</Text>
            <Text style={styles.summaryValue}>
              {tripData.route_summary?.total_distance_km?.toFixed(1) || 0} km
            </Text>
          </View>
        </View>

        <View style={styles.summaryItem}>
          <View style={styles.summaryIconContainer}>
            <Icon name="restaurant" size={20} color="#007AFF" />
          </View>
          <View>
            <Text style={styles.summaryLabel}>Meals</Text>
            <Text style={styles.summaryValue}>
              {Object.keys(tripData.meal_suggestions).length} Stops
            </Text>
          </View>
        </View>

        <View style={styles.summaryItem}>
          <View style={styles.summaryIconContainer}>
            <Icon name="schedule" size={20} color="#007AFF" />
          </View>
          <View>
            <Text style={styles.summaryLabel}>Start</Text>
            <Text style={styles.summaryValue}>
              {formatTime(tripData.recommended_departure_iso)}
            </Text>
          </View>
        </View>
      </View>

      {/* Personalization Indicator */}
      {tripData.personalization_used && (
        <View style={styles.personalizationBadge}>
          <Icon name="psychology" size={16} color="#fff" />
          <Text style={styles.personalizationText}>Personalized for You</Text>
        </View>
      )}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      >
        {/* Trip Summary */}
        <TripSummary />

        {/* Tourist/Attraction Suggestions */}
        {tripData.tourist_suggestions && tripData.tourist_suggestions.length > 0 && (
          <AttractionSuggestionCard
            places={tripData.tourist_suggestions}
          />
        )}

        {/* Meal Suggestions */}
        {Object.keys(tripData.meal_suggestions).map(mealType => (
          <MealSuggestionCard
            key={mealType}
            mealType={mealType}
            places={tripData.meal_suggestions[mealType]}
          />
        ))}

        {/* Empty State */}
        {Object.keys(tripData.meal_suggestions).length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="search-off" size={64} color="#E0E0E0" />
            <Text style={styles.emptyStateTitle}>No Suggestions Found</Text>
            <Text style={styles.emptyStateText}>
              We couldn't find suitable meal stops for your route.
              Try increasing the detour time or adjusting your preferences.
            </Text>
          </View>
        )}

        {/* Spacer for button */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Fixed Action Button */}
      <Animated.View
        style={[
          styles.actionButtonContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.actionButton,
          ]}
          onPress={handleProceedToItinerary}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.actionButtonText}>
                {Object.keys(selectedMeals).length > 0
                  ? `View Itinerary (${Object.keys(selectedMeals).length} selected)`
                  : 'Skip & View Itinerary'}
              </Text>
              <Icon name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  scrollView: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#F7F9FC',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFF2F5',
  },
  summaryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  personalizationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  personalizationText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  mealSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  mealHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  mealTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.3,
  },
  mealTime: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '700',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mealSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  placesContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  placeCard: {
    width: 280,
    marginRight: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  placeCardSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
    backgroundColor: '#F8FBFF',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  selectedIndicator: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 2,
    elevation: 2,
  },
  unselectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  placeImage: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  placeDetails: {
    padding: 16,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    lineHeight: 22,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
    alignSelf: 'flex-start',
    padding: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  scoreStars: {
    flexDirection: 'row',
    marginRight: 6,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detourInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detourText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 6,
    fontWeight: '500',
  },
  nearLimitText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
    marginBottom: 8,
  },
  additionalInfo: {
    marginBottom: 12,
  },
  cuisineText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  mapActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  mapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F5F7F9',
  },
  navigateButton: {
    backgroundColor: '#34C759', // Green for go
  },
  mapButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 6,
  },
  whyButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  whyText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  reasonsContainer: {
    marginTop: 4,
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
  },
  reasonText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
    lineHeight: 16,
  },
  selectionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  warningText: {
    color: '#F57C00',
    marginLeft: 8,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  spacer: {
    height: 120, // Space for bottom button
  },
  actionButtonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    elevation: 10,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 24, // Pill shape
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  actionButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});


export default TripSuggestionsScreen;