// /screens/MyTripsScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  ImageBackground
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import logger from '../utils/logger';

// City image mapping - in production, you'd fetch these from your database or a service
// Replace the CITY_IMAGES object with this:
const TAMIL_CULTURE_IMAGES = [
  'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=800&auto=format&fit=crop', // Temple
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&auto=format&fit=crop', // Kolam
  'https://images.unsplash.com/photo-1587654780298-6f4d7db4e8c9?w=800&auto=format&fit=crop', // Bharatanatyam
  'https://images.unsplash.com/photo-1563201514-47a6c06d37c5?w=800&auto=format&fit=crop', // Traditional art
  'https://images.unsplash.com/photo-1601063458289-77247ba4852d?w=800&auto=format&fit=crop', // Tamil architecture
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&auto=format&fit=crop', // Pongal celebration
  'https://images.unsplash.com/photo-1611605698323-9f2d5c4c2d1e?w=800&auto=format&fit=crop', // Tamil cuisine
  'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&auto=format&fit=crop', // Cultural festival
  'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800&auto=format&fit=crop', // Traditional clothing
  'https://images.unsplash.com/photo-1593697821259-005d5f9dcbd9?w=800&auto=format&fit=crop', // Tamil literature art
];

// Helper function to get random Tamil culture image
const getRandomTamilImage = () => {
  const randomIndex = Math.floor(Math.random() * TAMIL_CULTURE_IMAGES.length);
  return TAMIL_CULTURE_IMAGES[randomIndex];
};
const MyTripsScreen = () => {
  const auth = getAuth();
  const navigation = useNavigation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      logger.info('Fetching MyTrips for user', auth.currentUser.uid);
      const tripsRef = collection(db, 'trips');
      const q = query(
        tripsRef,
        where('userId', '==', auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      const items = [];
      
      snap.forEach((doc) => {
        const data = doc.data();
        const sourceName = getSourceName(data);
        const destinationName = getDestinationName(data);
        
        items.push({ 
          id: doc.id, 
          ...data,
          sourceName,
          destinationName,
          // Get city images
          sourceImage: getRandomImage(),

          destinationImage: getRandomImage(),
          formattedDuration: formatDuration(data.totalDuration || 0),
          formattedDistance: formatDistance(data.totalDistance || 0),
          isAdmin: data.userId === auth.currentUser.uid
        });
      });
      
      const memberTripsRef = collection(db, 'trips');
      const memberQ = query(
        memberTripsRef,
        where('members', 'array-contains', auth.currentUser.uid)
      );
      const memberSnap = await getDocs(memberQ);
      
      memberSnap.forEach((doc) => {
        const data = doc.data();
        if (!items.find(item => item.id === doc.id)) {
          const sourceName = getSourceName(data);
          const destinationName = getDestinationName(data);
          
          items.push({ 
            id: doc.id, 
            ...data,
            sourceName,
            destinationName,
            sourceImage: getRandomImage(),

            destinationImage: getRandomImage(),
            formattedDuration: formatDuration(data.totalDuration || 0),
            formattedDistance: formatDistance(data.totalDistance || 0),
            isAdmin: data.userId === auth.currentUser.uid
          });
        }
      });
      
      items.sort((a, b) => {
        const timeA = a.savedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
        const timeB = b.savedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
        return timeB - timeA;
      });
      
      setTrips(items);
      logger.info('MyTrips fetched, count=', items.length);
    } catch (err) {
      logger.error('Failed to fetch trips', err);
      Alert.alert('Error', 'Failed to load trips. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchTrips();
    }, [])
  );

  const getSourceName = (trip) => {
    return trip.sourceName || trip.source?.sourceName || 'Unknown';
  };

  const getDestinationName = (trip) => {
    return trip.destinationName || trip.destination?.destinationName || 'Unknown';
  };

 // Replace the getCityImage function with:
const getRandomImage = () => {
  return getRandomTamilImage();
};

  const handleDeleteTrip = (tripId, tripName) => {
    Alert.alert(
      'Delete Trip',
      `Are you sure you want to delete "${tripName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'trips', tripId));
              fetchTrips();
            } catch (err) {
              console.error('Failed to delete trip', err);
              Alert.alert('Error', 'Failed to delete trip. Please try again.');
            }
          }
        }
      ]
    );
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDistance = (km) => {
    if (!km) return '0 km';
    return `${km.toFixed(1)} km`;
  };

  // Simple fix - just handle the error case:
const formatDate = (timestamp) => {
  if (!timestamp) return 'Recently';
  
  try {
    // Try to get date from Firestore timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return 'Recently';
    }
    
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (error) {
    return 'Recently';
  }
};

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  const TripCard = ({ item }) => {
    const isSameCity = item.sourceName === item.destinationName;
    
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('TripDashboard', { tripId: item.id })}
        style={styles.card}
        activeOpacity={0.9}
      >
        {/* Image Zone */}
        <View style={styles.imageContainer}>
          {isSameCity ? (
            // Single image for same city
            <ImageBackground
              source={{ uri: item.sourceImage }}
              style={styles.singleImage}
              imageStyle={styles.singleImageStyle}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.imageGradient}
              >
                <Text style={styles.cityLabel}>
                  {item.sourceName.toUpperCase()}
                </Text>
              </LinearGradient>
            </ImageBackground>
          ) : (
            // Split image for different cities
            <View style={styles.splitImageContainer}>
              <ImageBackground
                source={{ uri: item.sourceImage }}
                style={styles.halfImage}
                imageStyle={styles.halfImageStyle}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)']}
                  style={styles.halfImageGradient}
                >
                  <Text style={styles.cityLabel}>
                    {item.sourceName.split(',')[0].toUpperCase()}
                  </Text>
                </LinearGradient>
              </ImageBackground>
              
              <View style={styles.imageDivider} />
              
              <ImageBackground
                source={{ uri: item.destinationImage }}
                style={styles.halfImage}
                imageStyle={styles.halfImageStyle}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)']}
                  style={styles.halfImageGradient}
                >
                  <Text style={styles.cityLabel}>
                    {item.destinationName.split(',')[0].toUpperCase()}
                  </Text>
                </LinearGradient>
              </ImageBackground>
            </View>
          )}
        </View>

        {/* Content Zone */}
        <View style={styles.contentContainer}>
          {/* Title & Admin Badge */}
          <View style={styles.titleRow}>
            <Text style={styles.tripTitle} numberOfLines={1}>
              {item.tripName || 'Untitled Trip'}
            </Text>
            {item.isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>

          {/* Route & Status */}
          <View style={styles.routeRow}>
            {!isSameCity ? (
              <Text style={styles.routeText}>
                {item.sourceName.split(',')[0]} → {item.destinationName.split(',')[0]}
              </Text>
            ) : (
              <Text style={styles.routeText}>
                {item.sourceName.split(',')[0]}
              </Text>
            )}
            {item.status && (
              <Text style={styles.statusText}>
                • {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.statText}>{item.formattedDuration}</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Ionicons name="speedometer-outline" size={16} color="#666" />
              <Text style={styles.statText}>{item.formattedDistance}</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={16} color="#666" />
              <Text style={styles.statText}>{item.members?.length || 1}</Text>
              <Text style={styles.membersSuffix}>
                {item.members?.length === 1 ? ' member' : ' members'}
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.dateText}>
              {formatDate(item.savedAt || item.createdAt)}
            </Text>
            
            <TouchableOpacity 
              style={styles.viewButton}
              onPress={() => navigation.navigate('TripDashboard', { tripId: item.id })}
            >
              <Text style={styles.viewButtonText}>View Trip</Text>
              <Ionicons name="chevron-forward" size={14} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Delete Button (Admin only) */}
        {item.isAdmin && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteTrip(item.id, item.tripName || 'Untitled Trip')}
          >
            <Ionicons name="trash-outline" size={18} color="#ff3b30" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!trips.length) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="map-outline" size={80} color="#E0E0E0" />
        <Text style={styles.emptyTitle}>Your journeys will live here</Text>
        <Text style={styles.emptySubtitle}>
          Plan your first trip and start exploring
        </Text>
        
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('PlanTrip')}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFF" />
          <Text style={styles.primaryButtonText}>Plan a Trip</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('QRScanner')}
        >
          <Ionicons name="qr-code-outline" size={20} color="#007AFF" />
          <Text style={styles.secondaryButtonText}>Scan QR Code</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Trips</Text>
            <Text style={styles.headerSubtitle}>{trips.length} {trips.length === 1 ? 'Trip' : 'Trips'}</Text>
          </View>
        )}
        renderItem={({ item }) => <TripCard item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  separator: {
    height: 16,
  },
  // Card Styles
  card: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  // Image Zone
  imageContainer: {
    height: 180,
  },
  splitImageContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  halfImage: {
    flex: 1,
  },
  halfImageStyle: {
    resizeMode: 'cover',
  },
  halfImageGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  singleImage: {
    flex: 1,
  },
  singleImageStyle: {
    resizeMode: 'cover',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  imageGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  imageDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  cityLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.9,
  },
  // Content Zone
  contentContainer: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  adminBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    fontSize: 10,
    color: '#2E7D32',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  routeText: {
    fontSize: 15,
    color: '#444',
    fontWeight: '500',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 12,
  },
  membersSuffix: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  dateText: {
    fontSize: 13,
    color: '#888',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 4,
  },
  // Delete Button
  deleteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  // Empty State
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    minWidth: 200,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default MyTripsScreen;