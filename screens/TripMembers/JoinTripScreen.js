import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { validateInviteCode, addMemberToTrip } from '../../utils/firebase/memberService';

const JoinTripScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();
  
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const isValidTripId = (id) => {
  // Firebase document IDs are alphanumeric and can include underscores
  // Typically 20-28 characters
    return id && id.length >= 20 && id.length <= 28 && /^[a-zA-Z0-9_-]+$/.test(id);
    };
  const handleJoinTrip = async () => {
  if (!inviteCode.trim()) {
    Alert.alert('Error', 'Please enter a Trip ID');
    return;
  }

  setLoading(true);

  try {
    const tripId = inviteCode.trim();
    console.log(`DEBUG: Attempting to join trip with ID: ${tripId}`);
    console.log(`DEBUG: Current user UID: ${auth.currentUser?.uid}`);
    
    // Optional: Add basic validation (much looser)
    if (tripId.length < 5) {
      Alert.alert('Invalid Trip ID', 'Trip ID is too short');
      setLoading(false);
      return;
    }
    
    // Check if trip exists
    console.log(`DEBUG: Checking if trip exists...`);
    const tripDoc = await getDoc(doc(db, 'trips', tripId));
    
    if (!tripDoc.exists()) {
      console.log(`DEBUG: Trip not found!`);
      Alert.alert('Invalid Trip ID', 'No trip found with this ID');
      setLoading(false);
      return;
    }

    console.log(`DEBUG: Trip found!`);
    const trip = { id: tripDoc.id, ...tripDoc.data() };
    console.log(`DEBUG: Trip data:`, {
      tripName: trip.tripName,
      userId: trip.userId,
      members: trip.members
    });
    
    // Check if user is already a member
    const cleanMembers = (trip.members || []).filter(m => m && m.trim() !== '');
    console.log(`DEBUG: Clean members array:`, cleanMembers);
    console.log(`DEBUG: Checking if user ${auth.currentUser?.uid} is in members...`);
    
    if (cleanMembers.includes(auth.currentUser.uid)) {
      console.log(`DEBUG: User is already a member!`);
      Alert.alert('Already Joined', 'You are already a member of this trip');
      navigation.navigate('TripDashboard', { tripId });
      setLoading(false);
      return;
    }

    console.log(`DEBUG: User is not a member, attempting to add...`);
    // Add user to trip
    const result = await addMemberToTrip(tripId, auth.currentUser.uid);
    
    if (result.success) {
      console.log(`DEBUG: Successfully joined trip!`);
      Alert.alert(
        'Success!',
        `You've joined "${trip.tripName || 'the trip'}"`,
        [
          {
            text: 'Go to Trip',
            onPress: () => {
              navigation.navigate('TripDashboard', { tripId });
            },
          },
        ]
      );
    } else {
      console.log(`DEBUG: Failed to join: ${result.error}`);
      Alert.alert('Error', result.error || 'Failed to join trip');
    }
  } catch (error) {
    console.error('DEBUG: Error joining trip:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    Alert.alert('Error', 'Failed to join trip. Please check the Trip ID and try again.');
  } finally {
    setLoading(false);
  }
};
  const handleScanQRCode = () => {
    // For now, show a message
    // In next step, we'll implement QR scanning
    navigation.navigate('QRScanner');
    // setScanning(true);
    // navigation.navigate('QRScanner');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join a Trip</Text>
          <View style={styles.headerRightPlaceholder} />
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleScanQRCode}
          >
            <Ionicons name="qr-code" size={20} color="#007AFF" />
            <Text style={styles.scanButtonText}>Scan QR Code</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Ionicons name="people" size={40} color="#007AFF" />
            <Text style={styles.instructionsTitle}>Join a Trip</Text>
            <Text style={styles.instructionsText}>
                Enter the Trip ID provided by the trip organizer to join their trip.
            </Text>
          </View>

          {/* Invite Code Input */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Invite Code</Text>
            <TextInput
                style={styles.input}
                placeholder="Enter Trip ID"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="none"
                placeholderTextColor="#999"
            />
            
            <TouchableOpacity
              style={[
                styles.joinButton,
                (!inviteCode.trim() || loading) && styles.joinButtonDisabled
              ]}
              onPress={handleJoinTrip}
              disabled={!inviteCode.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="enter" size={20} color="#fff" />
                  <Text style={styles.joinButtonText}>Join Trip</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* OR Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* QR Code Option */}
          <TouchableOpacity
            style={styles.qrOptionCard}
            onPress={handleScanQRCode}
          >
            <View style={styles.qrIconContainer}>
              <Ionicons name="qr-code" size={32} color="#4CAF50" />
            </View>
            <View style={styles.qrTextContainer}>
              <Text style={styles.qrOptionTitle}>Scan QR Code</Text>
              <Text style={styles.qrOptionDescription}>
                Scan a QR code from the trip organizer
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          {/* Help Info */}
          <View style={styles.helpCard}>
            <Ionicons name="help-circle" size={20} color="#666" />
            <View style={styles.helpContent}>
              <Text style={styles.helpTitle}>Need an invite code?</Text>
              <Text style={styles.helpText}>
                Ask the trip organizer to share their Trip ID with you.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
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
    fontWeight: 'bold',
    color: '#333',
  },
  headerRightPlaceholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  instructionsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  inputCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: '#f8f8f8',
  },
  joinButton: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: '#ccc',
  },
  joinButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  qrOptionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  qrTextContainer: {
    flex: 1,
  },
  qrOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  qrOptionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  helpCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpContent: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  helpText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },

  scanButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 12,
  backgroundColor: 'white',
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

export default JoinTripScreen;