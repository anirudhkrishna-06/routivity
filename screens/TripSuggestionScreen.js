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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

const { width } = Dimensions.get('window');

const TripSuggestionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { tripData, firebaseTripId } = route.params;

  const [selectedMeals, setSelectedMeals] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  // Animation on mount
  useEffect(() => {
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

  // Auto-select top suggestion for each meal if none selected
  useEffect(() => {
    const autoSelections = {};
    Object.keys(tripData.meal_suggestions).forEach(meal => {
      if (tripData.meal_suggestions[meal].length > 0 && !selectedMeals[meal]) {
        autoSelections[meal] = tripData.meal_suggestions[meal][0].osm_id;
      }
    });
    setSelectedMeals(prev => ({ ...prev, ...autoSelections }));
  }, [tripData.meal_suggestions]);

  const handleSelectMeal = (mealType, place) => {
    setSelectedMeals(prev => ({
      ...prev,
      [mealType]: place.osm_id,
    }));
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
        if (reason.includes('Vegetarian')) badges.push({ text: '🌱 Veg', color: '#4CAF50' });
        if (reason.includes('budget')) badges.push({ text: '💰 Budget', color: '#FF9800' });
        if (reason.includes('mood')) badges.push({ text: '😊 Mood Match', color: '#2196F3' });
        if (reason.includes('Accessibility')) badges.push({ text: '♿ Accessible', color: '#9C27B0' });
      });
    }

    // Add badges based on tags
    const tags = place.tags || {};
    if (tags['diet:vegetarian'] === 'yes') badges.push({ text: '🌱 Veg', color: '#4CAF50' });
    if (tags['air_conditioning'] === 'yes') badges.push({ text: '❄️ AC', color: '#03A9F4' });
    if (tags['cuisine']?.includes('indian')) badges.push({ text: '🇮🇳 Indian', color: '#FF5722' });

    return badges.slice(0, 3); // Max 3 badges
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh - in real app, you might want to refetch suggestions
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleProceedToItinerary = async () => {
    if (Object.keys(selectedMeals).length === 0) {
      Alert.alert('Selection Required', 'Please select at least one meal option to proceed.');
      return;
    }

    setLoading(true);
    try {
      // Save selected meals to Firebase
      if (firebaseTripId) {
        await updateDoc(doc(db, 'trips', firebaseTripId), {
          selectedMeals: selectedMeals,
          updatedAt: new Date(),
        });
      }

      // Prepare itinerary data
      const itineraryData = {
        ...tripData,
        selectedMeals: selectedMeals,
        firebaseTripId: firebaseTripId,
      };

      // Navigate to itinerary screen
      navigation.navigate('Itinerary', { itineraryData });

    } catch (error) {
      console.error('Error saving selections:', error);
      Alert.alert('Error', 'Failed to save your selections. Please try again.');
    } finally {
      setLoading(false);
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
            {places.length} suggestions • Choose your preferred spot
          </Text>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.placesContainer}
        >
          {places.map((place, index) => (
            <TouchableOpacity
              key={place.osm_id}
              style={[
                styles.placeCard,
                selectedPlaceId === place.osm_id && styles.placeCardSelected,
              ]}
              onPress={() => handleSelectMeal(mealType, place)}
            >
              {/* Selection Indicator */}
              <View style={styles.selectionIndicator}>
                {selectedPlaceId === place.osm_id ? (
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

                {/* Additional Info */}
                <View style={styles.additionalInfo}>
                  {place.tags?.cuisine && (
                    <Text style={styles.cuisineText} numberOfLines={1}>
                      {place.tags.cuisine}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
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
          <Icon name="access-time" size={20} color="#007AFF" />
          <Text style={styles.summaryLabel}>Total Duration</Text>
          <Text style={styles.summaryValue}>
            {Math.round(tripData.route_summary?.total_duration_min || 0)} min
          </Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Icon name="directions" size={20} color="#007AFF" />
          <Text style={styles.summaryLabel}>Distance</Text>
          <Text style={styles.summaryValue}>
            {tripData.route_summary?.total_distance_km?.toFixed(1) || 0} km
          </Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Icon name="restaurant" size={20} color="#007AFF" />
          <Text style={styles.summaryLabel}>Meal Stops</Text>
          <Text style={styles.summaryValue}>
            {Object.keys(tripData.meal_suggestions).length}
          </Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Icon name="schedule" size={20} color="#007AFF" />
          <Text style={styles.summaryLabel}>Departure</Text>
          <Text style={styles.summaryValue}>
            {formatTime(tripData.recommended_departure_iso)}
          </Text>
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
            Object.keys(selectedMeals).length === 0 && styles.actionButtonDisabled,
          ]}
          onPress={handleProceedToItinerary}
          disabled={loading || Object.keys(selectedMeals).length === 0}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.actionButtonText}>
                View Itinerary ({Object.keys(selectedMeals).length} selected)
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
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
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
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  personalizationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  personalizationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  mealSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  mealHeader: {
    padding: 16,
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
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  mealTime: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  mealSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  placesContainer: {
    padding: 16,
  },
  placeCard: {
    width: 280,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  placeCardSelected: {
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  selectedIndicator: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
  },
  unselectedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  placeImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  placeDetails: {
    padding: 12,
  },
  placeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    lineHeight: 20,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreStars: {
    flexDirection: 'row',
    marginRight: 6,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  detourInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detourText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  additionalInfo: {
    marginTop: 4,
  },
  cuisineText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
  selectionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFE0B2',
  },
  warningText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginHorizontal: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  spacer: {
    height: 100,
  },
  actionButtonContainer: {
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
  actionButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
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