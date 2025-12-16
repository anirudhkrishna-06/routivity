import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TripSummary = ({ trip }) => {
  // Process trip data into a sequential timeline
  const timelineEvents = useMemo(() => {
    if (!trip) return [];

    const events = [];

    // 1. Start Node
    const startTime =
      trip.recommended_departure_iso ||
      trip.departure_time ||
      trip.itinerary?.departure ||
      trip.startTime ||
      null;

    events.push({
      id: 'start',
      type: 'start',
      title: trip.sourceName || 'Start Location',
      time: startTime,
      icon: 'navigate-circle',
      color: '#007AFF', // Blue
    });

    // 2. Intermediate Stops & Meals
    const rawStops = trip.stops || [];

    rawStops.forEach((stop, index) => {
      let type = stop.type || 'stop';
      let icon = 'location';
      let color = '#607D8B'; // Grey default

      if (type === 'restaurant' || type === 'meal' || stop.isMeal) {
        type = 'meal';
        icon = 'restaurant';
        color = '#FF9800'; // Orange
      } else if (type === 'gas') {
        icon = 'speedometer';
        color = '#F44336';
      } else if (type === 'attraction' || stop.tags?.tourism) {
        type = 'attraction';
        icon = 'camera';
        color = '#9C27B0'; // Purple
      }

      events.push({
        id: stop.osm_id || `stop_${index}`,
        type,
        title: stop.name || stop.title || 'Stop',
        // Prioritize ISO strings usually found in details
        time: stop.details?.eta_iso || stop.eta || stop.arrivalTime || null,
        details: stop.details || {},
        icon,
        color,
        detour: stop.details?.detour_minutes || stop.detour_minutes
      });
    });

    // 3. Destination Node
    let endTime =
      trip.arrival_time ||
      trip.itinerary?.arrival ||
      trip.endTime ||
      null;

    // Fallback: Calculate from start time + duration if explicit end time is missing
    if (!endTime && startTime && trip.route_summary?.total_duration_min) {
      try {
        const start = new Date(startTime);
        const durationMin = trip.route_summary.total_duration_min;
        const end = new Date(start.getTime() + durationMin * 60000); // Add minutes
        endTime = end.toISOString();
      } catch (e) {
        // failed to calc
      }
    }

    events.push({
      id: 'end',
      type: 'destination',
      title: trip.destinationName || 'Destination',
      time: endTime,
      icon: 'flag',
      color: '#4CAF50', // Green
    });

    return events;
  }, [trip]);

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const renderTimelineItem = (item, index, isLast) => {
    return (
      <View key={item.id} style={styles.timelineItem}>
        {/* Left Column: Time */}
        <View style={styles.timeColumn}>
          <Text style={styles.timeText} numberOfLines={1}>
            {item.time ? formatTime(item.time) : '--:--'}
          </Text>
        </View>

        {/* Center Column: Line & Dot */}
        <View style={styles.visualColumn}>
          {/* Top Line (except first item) */}
          <View style={[styles.line, index === 0 && styles.lineHidden]} />

          {/* Node Icon */}
          <View style={styles.nodeCircleContainer}>
            <View style={[styles.nodeCircle, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon} size={14} color="#fff" />
            </View>
          </View>

          {/* Bottom Line (except last item) */}
          <View style={[styles.line, isLast && styles.lineHidden]} />
        </View>

        {/* Right Column: Content */}
        <View style={styles.contentColumn}>
          {item.type === 'meal' || item.type === 'attraction' ? (
            <View style={[styles.card, item.type === 'attraction' && { borderLeftColor: '#9C27B0' }]}>
              <Text style={styles.cardTitle}>{item.title}</Text>

              {(item.details?.tags?.cuisine || item.details?.tags?.tourism) && (
                <Text style={styles.cardSubtitle}>
                  {item.details.tags.cuisine || item.details.tags.tourism} • {item.details.rating ? `⭐ ${item.details.rating}` : ''}
                </Text>
              )}

              {item.detour && (
                <Text style={styles.detourText}>+{item.detour} min detour</Text>
              )}
            </View>
          ) : (
            <View style={styles.simpleNode}>
              <Text style={styles.simpleTitle}>{item.title}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="map" size={20} color="#007AFF" />
        <Text style={styles.headerTitle}>Trip Timeline</Text>
      </View>

      <View style={styles.timelineContainer}>
        {timelineEvents.map((event, index) =>
          renderTimelineItem(event, index, index === timelineEvents.length - 1)
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginLeft: 8,
  },
  timelineContainer: {
    paddingLeft: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 60,
  },
  // --- COLUMN ALIGNMENT ---
  // All columns share paddingTop: 16 to ensure top-alignment of elements
  timeColumn: {
    width: 65,
    alignItems: 'flex-end',
    paddingRight: 12,
    paddingTop: 16,
  },
  visualColumn: {
    width: 30,
    alignItems: 'center',
    paddingTop: 0, // Visual column handles padding internally via line/circle
  },
  contentColumn: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
    paddingTop: 16, // Matches timeColumn
  },
  // ------------------------

  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'right',
    lineHeight: 18,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#E0E0E0',
    minHeight: 16,
  },
  lineHidden: {
    backgroundColor: 'transparent',
  },
  nodeCircleContainer: {
    paddingTop: 16, // Matches content paddingTop
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'absolute',
  },
  nodeCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#999',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    marginTop: 2, // Fine tune to align with text baseline
  },

  card: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    marginTop: -12, // Pull card up slightly to align top text with time
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  detourText: {
    fontSize: 11,
    color: '#E65100',
    marginTop: 4,
    fontStyle: 'italic',
  },
  simpleNode: {
    justifyContent: 'center',
  },
  simpleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
});

export default TripSummary;
