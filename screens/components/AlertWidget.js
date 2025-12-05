import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AlertWidget = ({ alerts, onViewAll }) => {
  const getAlertIcon = (type) => {
    switch (type) {
      case 'weather': return 'cloud';
      case 'traffic': return 'car';
      case 'reminder': return 'notifications';
      case 'safety': return 'shield';
      default: return 'warning';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#607D8B';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="warning" size={20} color="#FF9800" />
          <Text style={styles.title}>Alerts ({alerts.length})</Text>
        </View>
        {alerts.length > 2 && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.alertsContainer}
      >
        {alerts.slice(0, 3).map((alert, index) => (
          <View 
            key={alert.id || index} 
            style={[
              styles.alertCard,
              { borderLeftColor: getSeverityColor(alert.severity) }
            ]}
          >
            <View style={styles.alertHeader}>
              <Ionicons 
                name={getAlertIcon(alert.type)} 
                size={16} 
                color={getSeverityColor(alert.severity)} 
              />
              <Text style={[
                styles.alertSeverity,
                { color: getSeverityColor(alert.severity) }
              ]}>
                {alert.severity?.toUpperCase() || 'INFO'}
              </Text>
              <Text style={styles.alertTime}>
                {formatTime(alert.time)}
              </Text>
            </View>
            
            <Text style={styles.alertTitle} numberOfLines={1}>
              {alert.title}
            </Text>
            
            <Text style={styles.alertMessage} numberOfLines={2}>
              {alert.message}
            </Text>
            
            {alert.suggestedAction && (
              <View style={styles.actionContainer}>
                <Text style={styles.actionText}>
                  Suggested: {alert.suggestedAction}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  alertsContainer: {
    flexDirection: 'row',
  },
  alertCard: {
    width: 280,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertSeverity: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 6,
    marginRight: 'auto',
  },
  alertTime: {
    fontSize: 10,
    color: '#666',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  actionContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionText: {
    fontSize: 11,
    color: '#1976D2',
    fontStyle: 'italic',
  },
});

export default AlertWidget;