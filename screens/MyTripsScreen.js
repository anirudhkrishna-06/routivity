// /screens/MyTripsScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet
} from 'react-native';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons'; // or any icon library you use

const MyTripsScreen = () => {
  const auth = getAuth();
  const navigation = useNavigation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrips = async () => {
  setLoading(true);
  try {
    const tripsRef = collection(db, 'trips');
    // Query trips where user is creator OR member
    const q = query(
      tripsRef,
      where('userId', '==', auth.currentUser.uid)
    );
    const snap = await getDocs(q);
    const items = [];
    snap.forEach((doc) => {
      const data = doc.data();
      items.push({ 
        id: doc.id, 
        ...data,
        // Format total duration for display
        formattedDuration: formatDuration(data.totalDuration || 0),
        // Format total distance for display
        formattedDistance: formatDistance(data.totalDistance || 0),
        // Check if user is admin (creator)
        isAdmin: data.userId === auth.currentUser.uid
      });
    });
    
    // Now also query for trips where user is a member (but not creator)
    const memberTripsRef = collection(db, 'trips');
    const memberQ = query(
      memberTripsRef,
      where('members', 'array-contains', auth.currentUser.uid)
    );
    const memberSnap = await getDocs(memberQ);
    
    memberSnap.forEach((doc) => {
      const data = doc.data();
      // Only add if not already in items (to avoid duplicates)
      if (!items.find(item => item.id === doc.id)) {
        items.push({ 
          id: doc.id, 
          ...data,
          formattedDuration: formatDuration(data.totalDuration || 0),
          formattedDistance: formatDistance(data.totalDistance || 0),
          isAdmin: data.userId === auth.currentUser.uid
        });
      }
    });
    
    // Sort by latest first (by createdAt or savedAt)
    items.sort((a, b) => {
      const timeA = a.savedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const timeB = b.savedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return timeB - timeA;
    });
    
    setTrips(items);
  } catch (err) {
    console.warn('Failed to fetch trips', err);
    Alert.alert('Error', 'Failed to load trips. Please try again.');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  useEffect(() => {
    fetchTrips();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchTrips();
    }, [])
  );

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
              Alert.alert('Success', 'Trip deleted successfully');
              fetchTrips(); // Refresh the list
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
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDistance = (km) => {
    if (!km) return 'N/A';
    return `${km.toFixed(1)} km`;
  };

  const getSourceName = (trip) => {
    return trip.sourceName || trip.source?.sourceName || 'Unknown Source';
  };

  const getDestinationName = (trip) => {
    return trip.destinationName || trip.destination?.destinationName || 'Unknown Destination';
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!trips.length) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="car-outline" size={64} color="#ccc" style={styles.emptyIcon} />
        <Text style={styles.emptyText}>No trips yet.</Text>
        <Text style={styles.emptySubtext}>Create one from Plan Trip.</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchTrips}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate('QRScanner')}
        >
          <Ionicons name="qr-code" size={20} color="#007AFF" />
          <Text style={styles.scanButtonText}>Scan QR Code</Text>
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
            <Text style={styles.headerTitle}>My Trips ({trips.length})</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('TripDashboard', { 
              tripId: item.id 
            })}
            onLongPress={() => handleDeleteTrip(item.id, item.tripName || 'Untitled Trip')}
            style={styles.tripCard}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View style={styles.titleContainer}>
                <Text style={styles.tripTitle} numberOfLines={1}>
                  {item.tripName || 'Untitled Trip'}
                </Text>
                {item.isAdmin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
                <Text style={styles.tripStatus}>
                  {item.status ? `• ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}` : ''}
                </Text>
              </View>
              {item.isAdmin && (
                <TouchableOpacity
                  onPress={() => handleDeleteTrip(item.id, item.tripName || 'Untitled Trip')}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.routeContainer}>
              <View style={styles.routeDot} />
              <View style={styles.routeLine} />
              <View style={[styles.routeDot, styles.destinationDot]} />
            </View>
            
            <View style={styles.routeInfo}>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color="#4CAF50" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {getSourceName(item)}
                </Text>
              </View>
              <View style={styles.locationRow}>
                <Ionicons name="flag-outline" size={16} color="#FF5722" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {getDestinationName(item)}
                </Text>
              </View>
            </View>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={18} color="#666" />
                <Text style={styles.statText}>{item.formattedDuration}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="speedometer-outline" size={18} color="#666" />
                <Text style={styles.statText}>{item.formattedDistance}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={18} color="#666" />
                <Text style={styles.statText}>{item.members?.length || 1}</Text>
                <Text style={styles.membersLabel}> member{item.members?.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            
            <View style={styles.footer}>
              <Text style={styles.dateText}>
                {item.savedAt?.toDate?.().toLocaleDateString() || 
                 item.createdAt?.toDate?.().toLocaleDateString() || 
                 'Recently'}
              </Text>
              <TouchableOpacity 
                style={styles.viewButton}
                onPress={() => navigation.navigate('TripDashboard', { 
                   tripId: item.id 
                })}
              >
                <Text style={styles.viewButtonText}>View Trip</Text>
                <Ionicons name="chevron-forward" size={16} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      
    </View>
    
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  listContent: {
    paddingBottom: 20,
  },
  tripCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  tripStatus: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 4,
  },
  routeContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  destinationDot: {
    backgroundColor: '#FF5722',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#ddd',
    marginVertical: 2,
  },
  routeInfo: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
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
    height: 20,
    backgroundColor: '#ddd',
    marginHorizontal: 8,
  },
  membersLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#888',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 4,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  adminBadge: {
  backgroundColor: '#E8F5E9',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 4,
  marginLeft: 8,
},
adminBadgeText: {
  fontSize: 10,
  color: '#2E7D32',
  fontWeight: '600',
},

scanButton: {
  backgroundColor: 'white',
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 24,
  paddingVertical: 12,
  borderRadius: 8,
  marginTop: 12,
  borderWidth: 1,
  borderColor: '#007AFF',
},
scanButtonText: {
  color: '#007AFF',
  fontSize: 16,
  fontWeight: '600',
  marginLeft: 8,
},

});

export default MyTripsScreen;