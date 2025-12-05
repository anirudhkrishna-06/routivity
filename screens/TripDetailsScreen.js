// screens/TripDetailsScreen.js
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TripDetailsScreen = ({ route, navigation }) => {
  const { trip } = route.params || {};

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text>No trip data available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.card}>
        <Text style={styles.tripName}>{trip.tripName || 'Untitled Trip'}</Text>
        <Text style={styles.status}>{trip.status?.toUpperCase() || 'PLANNED'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route Information</Text>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={20} color="#4CAF50" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Source</Text>
            <Text style={styles.infoText}>
              {trip.sourceName || trip.source?.sourceName || 'Unknown'}
            </Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="flag-outline" size={20} color="#FF5722" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Destination</Text>
            <Text style={styles.infoText}>
              {trip.destinationName || trip.destination?.destinationName || 'Unknown'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trip Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Ionicons name="time-outline" size={24} color="#007AFF" />
            <Text style={styles.statValue}>
              {trip.formattedDuration || 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="speedometer-outline" size={24} color="#007AFF" />
            <Text style={styles.statValue}>
              {trip.formattedDistance || 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features Coming Soon</Text>
        {[
          'Real-time navigation',
          'Share with friends',
          'Expense tracking',
          'Photo gallery',
          'Weather updates',
          'Live location sharing'
        ].map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="time-outline" size={20} color="#888" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity 
        style={styles.alertButton}
        onPress={() => Alert.alert('Info', 'This screen is under development. Full trip management coming soon!')}
      >
        <Text style={styles.alertButtonText}>Under Development</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerPlaceholder: {
    width: 32,
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  status: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    minWidth: 120,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  alertButton: {
    backgroundColor: '#FFA000',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  alertButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TripDetailsScreen;