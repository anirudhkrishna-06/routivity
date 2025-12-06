import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getTripMembersWithProfiles, isTripAdmin } from '../../utils/firebase/memberService';

const ManageMembersScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const auth = getAuth();
  
  const { tripId } = route.params;
  
  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!tripId) {
      Alert.alert('Error', 'No trip ID provided');
      navigation.goBack();
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'trips', tripId),
      async (docSnap) => {
        if (docSnap.exists()) {
          const tripData = { id: docSnap.id, ...docSnap.data() };
          setTrip(tripData);
          
          // Check if current user is admin
          const adminStatus = isTripAdmin(tripData, auth.currentUser.uid);
          setIsAdmin(adminStatus);
          
          // Get members with profiles
          const membersWithProfiles = await getTripMembersWithProfiles(tripData);
          setMembers(membersWithProfiles);
        } else {
          Alert.alert('Error', 'Trip not found');
          navigation.goBack();
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching trip:', error);
        Alert.alert('Error', 'Failed to load trip data');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tripId]);

  const handleCallMember = (phoneNumber) => {
    if (!phoneNumber) {
      Alert.alert('Info', 'No phone number available for this member');
      return;
    }
    
    Linking.openURL(`tel:${phoneNumber}`)
      .catch(err => {
        console.error('Error opening phone app:', err);
        Alert.alert('Error', 'Cannot make call from this device');
      });
  };

  const handleMessageMember = (member) => {
    navigation.navigate('MessageMember', { 
      tripId, 
      memberId: member.id,
      memberName: member.displayName || member.email 
    });
  };

  const handleAddMember = () => {
    navigation.navigate('AddMember', { tripId });
  };

  const handleRemoveMember = (member) => {
    if (member.isAdmin) {
      Alert.alert('Cannot Remove', 'Cannot remove the trip admin');
      return;
    }
    
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.displayName || member.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMember(member.id),
        },
      ]
    );
  };

  const removeMember = async (memberId) => {
    // We'll implement this in next step
    Alert.alert('Coming Soon', 'Remove member functionality will be added in next update');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading members...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Trip Members
          </Text>
          <Text style={styles.memberCount}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddMember}
          >
            <Ionicons name="person-add" size={22} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Admin Section */}
        {members.filter(m => m.isAdmin).map(member => (
          <View key={member.id} style={styles.adminSection}>
            <View style={styles.adminBadge}>
              <Ionicons name="shield" size={14} color="#4CAF50" />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
            <View style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                {member.photoURL ? (
                  <Image source={{ uri: member.photoURL }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={24} color="#666" />
                )}
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.displayName || 'User'}
                </Text>
                <Text style={styles.memberEmail}>
                  {member.email || 'No email'}
                </Text>
                {member.phoneNumber && (
                  <Text style={styles.memberPhone}>{member.phoneNumber}</Text>
                )}
              </View>
            </View>
          </View>
        ))}

        {/* Members List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {members.filter(m => !m.isAdmin).length === 0 ? (
            <View style={styles.emptyMembers}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No other members yet</Text>
              {isAdmin && (
                <Text style={styles.emptySubtext}>
                  Tap the + button to add members
                </Text>
              )}
            </View>
          ) : (
            members.filter(m => !m.isAdmin).map(member => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  {member.photoURL ? (
                    <Image source={{ uri: member.photoURL }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={24} color="#666" />
                  )}
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {member.displayName || 'User'}
                  </Text>
                  <Text style={styles.memberEmail}>
                    {member.email || 'No email'}
                  </Text>
                  {member.phoneNumber && (
                    <Text style={styles.memberPhone}>{member.phoneNumber}</Text>
                  )}
                </View>
                <View style={styles.memberActions}>
                  {member.phoneNumber && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleCallMember(member.phoneNumber)}
                    >
                      <Ionicons name="call" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleMessageMember(member)}
                  >
                    <Ionicons name="chatbubble" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleRemoveMember(member)}
                    >
                      <Ionicons name="close" size={20} color="#F44336" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Trip Info Card */}
        <View style={styles.tripInfoCard}>
          <Ionicons name="information-circle" size={20} color="#007AFF" />
          <View style={styles.tripInfoContent}>
            <Text style={styles.tripInfoTitle}>
              {trip?.tripName || 'Trip'}
            </Text>
            <Text style={styles.tripInfoText}>
              {trip?.destinationName || 'Unknown destination'}
            </Text>
            <Text style={styles.tripInfoDate}>
              {trip?.createdAt?.toDate?.().toLocaleDateString() || 'Recently created'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  memberCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  adminSection: {
    backgroundColor: 'white',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  adminBadgeText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
    marginLeft: 4,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyMembers: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  memberPhone: {
    fontSize: 13,
    color: '#4CAF50',
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  tripInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripInfoContent: {
    flex: 1,
    marginLeft: 12,
  },
  tripInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tripInfoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  tripInfoDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});

export default ManageMembersScreen;