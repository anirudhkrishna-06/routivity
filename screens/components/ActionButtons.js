import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ActionButtons = ({
  onManageMembers,
  onViewExpenses,
  onFindServices,
  onViewAlerts,
  tripStatus,
  onUpdateStatus,
}) => {
  const handleStatusChange = () => {
    if (!onUpdateStatus) return;
    
    let newStatus;
    let statusMessage;
    
    switch (tripStatus) {
      case 'planned':
        newStatus = 'active';
        statusMessage = 'Start the trip? This will mark it as active.';
        break;
      case 'active':
        newStatus = 'completed';
        statusMessage = 'Complete the trip? This will mark it as finished.';
        break;
      case 'completed':
        newStatus = 'planned';
        statusMessage = 'Reopen the trip? This will mark it as planned again.';
        break;
      default:
        newStatus = 'active';
        statusMessage = 'Start the trip?';
    }
    
    Alert.alert(
      'Update Trip Status',
      statusMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: () => onUpdateStatus(newStatus),
        },
      ]
    );
  };

  const getStatusButtonConfig = () => {
    switch (tripStatus) {
      case 'planned':
        return {
          icon: 'play',
          text: 'Start Trip',
          color: '#4CAF50',
          bgColor: '#E8F5E9',
        };
      case 'active':
        return {
          icon: 'checkmark',
          text: 'Complete Trip',
          color: '#2196F3',
          bgColor: '#E3F2FD',
        };
      case 'completed':
        return {
          icon: 'refresh',
          text: 'Reopen Trip',
          color: '#FF9800',
          bgColor: '#FFF3E0',
        };
      default:
        return {
          icon: 'play',
          text: 'Start Trip',
          color: '#4CAF50',
          bgColor: '#E8F5E9',
        };
    }
  };

  const statusConfig = getStatusButtonConfig();

  return (
    <View style={styles.container}>
      {/* Status Button */}
      <TouchableOpacity
        style={[styles.statusButton, { backgroundColor: statusConfig.bgColor }]}
        onPress={handleStatusChange}
      >
        <Ionicons name={statusConfig.icon} size={20} color={statusConfig.color} />
        <Text style={[styles.statusButtonText, { color: statusConfig.color }]}>
          {statusConfig.text}
        </Text>
      </TouchableOpacity>

      {/* Action Buttons Row */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={onManageMembers}>
          <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="people" size={20} color="#2196F3" />
          </View>
          <Text style={styles.actionButtonText}>Members</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onViewExpenses}>
          <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="cash" size={20} color="#4CAF50" />
          </View>
          <Text style={styles.actionButtonText}>Expenses</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onFindServices}>
          <View style={[styles.iconContainer, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="build" size={20} color="#FF9800" />
          </View>
          <Text style={styles.actionButtonText}>Services</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onViewAlerts}>
          <View style={[styles.iconContainer, { backgroundColor: '#FFEBEE' }]}>
            <Ionicons name="warning" size={20} color="#F44336" />
          </View>
          <Text style={styles.actionButtonText}>Alerts</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
});

export default ActionButtons;