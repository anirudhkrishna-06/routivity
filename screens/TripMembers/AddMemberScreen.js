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
  TextInput,
  Clipboard,
  Modal,
  Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { 
  findUserByContactNumber, 
  findUserByEmail,
  generateInviteCode,
  addMemberToTrip
} from '../../utils/firebase/memberService';
import * as ClipboardModule from 'expo-clipboard';
import Svg, { Rect } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-file-system";


const AddMemberScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const auth = getAuth();
  
  const { tripId } = route.params;
  
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState('phone'); // 'phone' or 'email'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [qrCodeData, setQrCodeData] = useState('');
  const [qrCodeRef, setQrCodeRef] = useState(null);
  const [savingQR, setSavingQR] = useState(false);
  const [sharingQR, setSharingQR] = useState(false);


  useEffect(() => {
    fetchTripData();
    generateInvite();
  }, []);

  const fetchTripData = async () => {
    try {
      const tripDoc = await getDoc(doc(db, 'trips', tripId));
      if (tripDoc.exists()) {
        setTrip({ id: tripDoc.id, ...tripDoc.data() });
      } else {
        Alert.alert('Error', 'Trip not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching trip:', error);
      Alert.alert('Error', 'Failed to load trip');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = () => {
    const code = tripId;
    setInviteCode(code);
    
    // Generate QR code data
    const qrData = JSON.stringify({
      type: 'trip_invite',
      tripId: tripId,
      tripName: trip?.tripName || 'Untitled Trip',
      timestamp: Date.now(),
    });
    setQrCodeData(qrData);
  };

  const saveQRCode = async () => {
    if (!qrCodeRef) return;
    
    setSavingQR(true);
    try {
      const qrCodeData = qrCodeRef.toDataURL();
      const filename = FileSystem.documentDirectory + `trip_${tripId}_qrcode.png`;
      
      // Convert base64 to file
      await FileSystem.writeAsStringAsync(filename, qrCodeData.split(',')[1], {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Save to media library
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(filename);
        const album = await MediaLibrary.getAlbumAsync('RoadTripApp');
        
        if (album === null) {
          await MediaLibrary.createAlbumAsync('RoadTripApp', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
        
        Alert.alert('Saved!', 'QR code saved to your photos.');
      }
    } catch (error) {
      console.error('Error saving QR code:', error);
      Alert.alert('Error', 'Failed to save QR code.');
    } finally {
      setSavingQR(false);
    }
  };
  
  const shareQRCode = async () => {
    if (!qrCodeRef) return;
    
    setSharingQR(true);
    try {
      const qrCodeData = qrCodeRef.toDataURL();
      const filename = FileSystem.documentDirectory + `trip_${tripId}_qrcode.png`;
      
      // Convert base64 to file
      await FileSystem.writeAsStringAsync(filename, qrCodeData.split(',')[1], {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filename, {
          mimeType: 'image/png',
          dialogTitle: 'Share Trip QR Code',
          UTI: 'public.image',
        });
      }
    } catch (error) {
      console.error('Error sharing QR code:', error);
      Alert.alert('Error', 'Failed to share QR code.');
    } finally {
      setSharingQR(false);
    }
  };



  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a phone number or email');
      return;
    }

    setSearching(true);
    setSearchResults([]);

    try {
      let user;
      if (searchType === 'phone') {
        user = await findUserByContactNumber(searchQuery);
      } else {
        user = await findUserByEmail(searchQuery);
      }

      if (user) {
        // Check if user is already a member
        if (trip?.members?.includes(user.id)) {
          Alert.alert('Already a Member', 'This user is already part of the trip');
        } else {
          setSearchResults([user]);
        }
      } else {
        Alert.alert('Not Found', 'No user found with the provided information');
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search for user');
    } finally {
      setSearching(false);
    }
  };

  const handleAddMember = async (user) => {
    Alert.alert(
      'Add Member',
      `Add ${user.displayName} to this trip?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          style: 'default',
          onPress: async () => {
            try {
              const result = await addMemberToTrip(tripId, user.id);
              if (result.success) {
                Alert.alert('Success', `${user.displayName} has been added to the trip`);
                navigation.goBack();
              } else {
                Alert.alert('Error', result.error || 'Failed to add member');
              }
            } catch (error) {
              console.error('Error adding member:', error);
              Alert.alert('Error', 'Failed to add member');
            }
          },
        },
      ]
    );
  };

  const copyInviteCode = async () => {
    try {
      await ClipboardModule.setStringAsync(inviteCode);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const shareInviteLink = () => {
    // For now, we'll just copy the code
    // In a real app, you could use expo-sharing or deep links
    copyInviteCode();
  };

  const renderQRCode = () => {
    // Simple QR code using text - in real app use expo-barcode-generator
    return (
      <View style={styles.qrCodeContainer}>
        <View style={styles.qrCodePlaceholder}>
          <Ionicons name="qr-code" size={120} color="#333" />
        </View>
        <Text style={styles.qrCodeText}>Scan to join trip</Text>
        <Text style={styles.inviteCodeDisplay}>{inviteCode}</Text>
        <Text style={styles.qrInstruction}>
          Show this QR code to friends to let them join your trip
        </Text>
      </View>
    );
  };

  const renderInviteModal = () => (
    <Modal
      visible={showInviteModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowInviteModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Code</Text>
            <TouchableOpacity
              onPress={() => setShowInviteModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.inviteCodeBox}>
            <Text style={styles.inviteCode}>{inviteCode}</Text>
          </View>
          
          <Text style={styles.inviteInstructions}>
            Share this code with friends. They can use it to join your trip.
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.copyButton]}
              onPress={copyInviteCode}
            >
              <Ionicons name="copy" size={20} color="#fff" />
              <Text style={styles.modalButtonText}>Copy Code</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.shareButton]}
              onPress={shareInviteLink}
            >
              <Ionicons name="share" size={20} color="#fff" />
              <Text style={styles.modalButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
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
        <Text style={styles.headerTitle}>Add Members</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* QR Code Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="qr-code" size={20} color="#007AFF" />
            <Text style={styles.sectionTitle}>Quick Invite</Text>
          </View>
          
          <TouchableOpacity
            style={styles.qrInviteCard}
            onPress={() => setShowQRCode(!showQRCode)}
          >
            <View style={styles.qrInviteContent}>
              <View style={styles.qrIconContainer}>
                <Ionicons name="qr-code" size={32} color="#007AFF" />
              </View>
              <View style={styles.qrInviteText}>
                <Text style={styles.qrInviteTitle}>QR Code Invite</Text>
                <Text style={styles.qrInviteDescription}>
                  Generate a QR code for others to scan and join
                </Text>
              </View>
              <Ionicons 
                name={showQRCode ? "chevron-up" : "chevron-down"} 
                size={24} 
                color="#666" 
              />
            </View>
          </TouchableOpacity>
          
          {showQRCode && (
            <View style={styles.qrCodeContainer}>
              <View style={styles.qrCodeWrapper}>
                {qrCodeData ? (
                  <QRCode
                    value={qrCodeData}
                    size={200}
                    color="#000"
                    backgroundColor="#fff"
                    getRef={(ref) => setQrCodeRef(ref)}
                  />
                ) : (
                  <View style={styles.qrCodePlaceholder}>
                    <Ionicons name="qr-code" size={120} color="#ccc" />
                  </View>
                )}
              </View>
              
              <Text style={styles.qrCodeText}>Scan to join "{trip?.tripName || 'trip'}"</Text>
              <Text style={styles.tripIdText}>Trip ID: {inviteCode}</Text>
              
              <View style={styles.qrActions}>
                <TouchableOpacity
                  style={[styles.qrActionButton, styles.saveButton]}
                  onPress={saveQRCode}
                  disabled={savingQR || !qrCodeData}
                >
                  {savingQR ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="download" size={18} color="#fff" />
                      <Text style={styles.qrActionText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.qrActionButton, styles.shareButton]}
                  onPress={shareQRCode}
                  disabled={sharingQR || !qrCodeData}
                >
                  {sharingQR ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="share" size={18} color="#fff" />
                      <Text style={styles.qrActionText}>Share</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              
              <Text style={styles.qrInstruction}>
                Show or share this QR code with friends to let them join your trip
              </Text>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.inviteCodeCard}
            onPress={() => setShowInviteModal(true)}
          >
            <View style={styles.inviteCodeContent}>
              <View style={styles.inviteIconContainer}>
                <Ionicons name="key" size={24} color="#4CAF50" />
              </View>
              <View style={styles.inviteCodeText}>
                <Text style={styles.inviteCodeTitle}>Invite Code</Text>
                <Text style={styles.inviteCodeValue}>{inviteCode}</Text>
                <Text style={styles.inviteCodeDescription}>
                Share this Trip ID with friends
                </Text>
              </View>
              <Ionicons name="copy" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="search" size={20} color="#FF9800" />
            <Text style={styles.sectionTitle}>Search Users</Text>
          </View>
          
          <View style={styles.searchTypeSelector}>
            <TouchableOpacity
              style={[
                styles.searchTypeButton,
                searchType === 'phone' && styles.searchTypeButtonActive
              ]}
              onPress={() => setSearchType('phone')}
            >
              <Text style={[
                styles.searchTypeText,
                searchType === 'phone' && styles.searchTypeTextActive
              ]}>
                Phone
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.searchTypeButton,
                searchType === 'email' && styles.searchTypeButtonActive
              ]}
              onPress={() => setSearchType('email')}
            >
              <Text style={[
                styles.searchTypeText,
                searchType === 'email' && styles.searchTypeTextActive
              ]}>
                Email
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={
                searchType === 'phone' 
                  ? 'Enter phone number' 
                  : 'Enter email address'
              }
              value={searchQuery}
              onChangeText={setSearchQuery}
              keyboardType={searchType === 'phone' ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="search" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          
          {searching && (
            <View style={styles.searchingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.searchingText}>Searching...</Text>
            </View>
          )}
          
          {searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Found User</Text>
              {searchResults.map(user => (
                <View key={user.id} style={styles.userCard}>
                  <View style={styles.userAvatar}>
                    <Ionicons name="person" size={24} color="#666" />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {user.displayName || 'User'}
                    </Text>
                    <Text style={styles.userDetail}>
                      {user.email || 'No email'}
                    </Text>
                    {user.phoneNumber && (
                      <Text style={styles.userDetail}>{user.phoneNumber}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.addUserButton}
                    onPress={() => handleAddMember(user)}
                  >
                    <Ionicons name="person-add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>How to Add Members</Text>
          
          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>1</Text>
            </View>
            <Text style={styles.instructionText}>
              <Text style={styles.instructionBold}>QR Code:</Text> Show the QR code to friends for quick scanning
            </Text>
          </View>
          
          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>2</Text>
            </View>
            <Text style={styles.instructionText}>
              <Text style={styles.instructionBold}>Invite Code:</Text> Share the code with friends to enter in their app
            </Text>
          </View>
          
          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>3</Text>
            </View>
            <Text style={styles.instructionText}>
              <Text style={styles.instructionBold}>Search:</Text> Find registered users by phone or email
            </Text>
          </View>
        </View>
      </ScrollView>

      {renderInviteModal()}
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRightPlaceholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  qrInviteCard: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  qrInviteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  qrIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  qrInviteText: {
    flex: 1,
  },
  qrInviteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  qrInviteDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  inviteCodeCard: {
    backgroundColor: '#F1F8E9',
    borderRadius: 8,
    padding: 16,
  },
  inviteCodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inviteCodeText: {
    flex: 1,
  },
  inviteCodeTitle: {
    fontSize: 14,
    color: '#666',
  },
  inviteCodeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 2,
  },
  inviteCodeDescription: {
    fontSize: 12,
    color: '#888',
  },
  qrCodeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 12,
  },
  qrCodePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  qrCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inviteCodeDisplay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  qrInstruction: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 20,
  },
  searchTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  searchTypeButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchTypeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  searchTypeTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchButton: {
    width: 48,
    height: 48,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  searchingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  resultsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  addUserButton: {
    width: 40,
    height: 40,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionsSection: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionNumberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  instructionBold: {
    fontWeight: '600',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  inviteCodeBox: {
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteCode: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 2,
  },
  inviteInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  copyButton: {
    backgroundColor: '#007AFF',
  },
  shareButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  qrCodeWrapper: {
  width: 220,
  height: 220,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'white',
  borderRadius: 12,
  padding: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 3,
},
tripIdText: {
  fontSize: 14,
  color: '#666',
  marginTop: 8,
  textAlign: 'center',
  fontFamily: 'monospace',
},
qrActions: {
  flexDirection: 'row',
  marginTop: 16,
  marginBottom: 12,
},
qrActionButton: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 10,
  borderRadius: 8,
  marginHorizontal: 8,
},
saveButton: {
  backgroundColor: '#4CAF50',
},
shareButton: {
  backgroundColor: '#007AFF',
},
qrActionText: {
  color: 'white',
  fontSize: 14,
  fontWeight: '600',
  marginLeft: 6,
},
});

export default AddMemberScreen;