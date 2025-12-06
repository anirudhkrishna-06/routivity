import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TripSummary = ({ trip }) => {
  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="information-circle" size={20} color="#007AFF" />
        <Text style={styles.title}>Trip Summary</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Ionicons name="location" size={16} color="#4CAF50" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.label}>From</Text>
            <Text style={styles.value} numberOfLines={1}>
              {trip.sourceName || 'Unknown location'}
            </Text>
          </View>
        </View>
        
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Ionicons name="flag" size={16} color="#FF5722" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.label}>To</Text>
            <Text style={styles.value} numberOfLines={1}>
              {trip.destinationName || 'Unknown destination'}
            </Text>
          </View>
        </View>
        
        {trip.itinerary?.departure && (
          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Ionicons name="time" size={16} color="#FF9800" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.label}>Departure</Text>
              <Text style={styles.value}>
                {formatDate(trip.itinerary.departure)} at {formatTime(trip.itinerary.departure)}
              </Text>
            </View>
          </View>
        )}
        
        {trip.itinerary?.arrival && (
          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Ionicons name="time" size={16} color="#9C27B0" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.label}>Arrival</Text>
              <Text style={styles.value}>
                {formatDate(trip.itinerary.arrival)} at {formatTime(trip.itinerary.arrival)}
              </Text>
            </View>
          </View>
        )}
        
        <View style={styles.stopsRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="navigate" size={16} color="#607D8B" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.label}>Stops</Text>
            <Text style={styles.value}>
              {trip.stops?.filter(s => s.type === 'meal' || s.type === 'stop').length || 0} stops included
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  content: {
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stopsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});

export default TripSummary;