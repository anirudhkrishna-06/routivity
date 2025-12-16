// /screens/ProfileScreen.js
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView, 
  Alert,
  Image,
  Animated,
  Dimensions,
  Modal
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    gender: '',
    phone: '',
    contactNumber: '',
    profileImage: null,
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            fullName: data.fullName || '',
            email: data.email || auth.currentUser?.email || '',
            gender: data.gender || '',
            phone: data.phone || '',
            contactNumber: data.contactNumber || '',
            profileImage: data.profileImage || null,
          });
          setSelectedImage(data.profileImage || null);
        } else {
          Alert.alert('Error', 'Profile not found.');
        }
      } catch (error) {
        console.log('Error fetching profile:', error);
        Alert.alert('Error', 'Failed to fetch profile.');
      } finally {
        setLoading(false);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }
    };

    fetchProfile();
  }, [uid]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Sorry, we need camera roll permissions to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setProfile(prev => ({ ...prev, profileImage: result.assets[0].uri }));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Sorry, we need camera permissions to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setProfile(prev => ({ ...prev, profileImage: result.assets[0].uri }));
    }
  };

  const handleSave = async () => {
    setUpdating(true);
    try {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, {
        fullName: profile.fullName,
        gender: profile.gender,
        phone: profile.phone,
        contactNumber: profile.contactNumber,
        profileImage: selectedImage,
        updatedAt: new Date(),
      });
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.log('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    // Re-fetch original data
    const fetchOriginal = async () => {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSelectedImage(data.profileImage || null);
        setProfile({
          fullName: data.fullName || '',
          email: data.email || auth.currentUser?.email || '',
          gender: data.gender || '',
          phone: data.phone || '',
          contactNumber: data.contactNumber || '',
          profileImage: data.profileImage || null,
        });
      }
    };
    fetchOriginal();
  };

  const renderInputField = (label, value, field, placeholder = '', keyboardType = 'default') => (
    <Animated.View style={[styles.fieldContainer, { opacity: fadeAnim }]}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {editing && (
          <Ionicons name="pencil" size={16} color="#64748B" />
        )}
      </View>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, editing && styles.inputEditing]}
          value={value}
          editable={editing}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          onChangeText={(text) => setProfile({ ...profile, [field]: text })}
          keyboardType={keyboardType}
        />
        {!editing && value && (
          <Ionicons name="checkmark-circle" size={20} color="#10B981" style={styles.checkIcon} />
        )}
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <LinearGradient
          colors={['#F8FAFC', '#F1F5F9']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#2D336B" />
        <Text style={styles.loaderText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <Animated.ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Background */}
      <LinearGradient
        colors={['#2D336B', '#3A428A']}
        style={styles.headerBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
            style={styles.backButtonGradient}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Profile Header */}
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.profileImageContainer}
            onPress={() => editing && setModalVisible(true)}
            activeOpacity={editing ? 0.7 : 1}
          >
            <View style={styles.profileImageWrapper}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.profileImage} />
              ) : (
                <LinearGradient
                  colors={['#4F46E5', '#7C3AED']}
                  style={styles.profileImagePlaceholder}
                >
                  <Text style={styles.profileInitials}>
                    {profile.fullName
                      ? profile.fullName
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .toUpperCase()
                      : '?'}
                  </Text>
                </LinearGradient>
              )}
              {editing && (
                <View style={styles.editPhotoButton}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.editPhotoGradient}
                  >
                    <Ionicons name="camera" size={18} color="#FFFFFF" />
                  </LinearGradient>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.userName}>
              {profile.fullName || 'Complete Your Profile'}
            </Text>
            
           
          </Animated.View>
        </View>
      </LinearGradient>

      {/* Profile Form */}
      <Animated.View 
        style={[
          styles.formContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.98)']}
          style={styles.formBackground}
        >
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={['#2D336B', '#3A428A']}
              style={styles.sectionIcon}
            >
              <Ionicons name="person-circle" size={24} color="#FFFFFF" />
            </LinearGradient>
            <View>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <Text style={styles.sectionSubtitle}>Manage your account details</Text>
            </View>
          </View>

          {/* Profile Fields */}
          <View style={styles.fieldsContainer}>
            {renderInputField('Full Name', profile.fullName, 'fullName', 'Enter your full name')}
            {renderInputField('Email Address', profile.email, 'email', '', 'email-address')}
            {renderInputField('Gender', profile.gender, 'gender', 'Male / Female / Other')}
            {renderInputField('Phone Number', profile.phone, 'phone', '+1 234 567 8900', 'phone-pad')}
            {renderInputField('Contact Number', profile.contactNumber, 'contactNumber', 'Alternative contact', 'phone-pad')}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {!editing ? (
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => setEditing(true)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#2D336B', '#3A428A']}
                  style={styles.editButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.saveCancelContainer}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={updating}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.cancelButtonGradient}
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={updating}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.saveButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {updating ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>



      {/* Image Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#FFFFFF', '#F8FAFC']}
              style={styles.modalBackground}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Profile Photo</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalOptions}>
                <TouchableOpacity style={styles.modalOption} onPress={takePhoto}>
                  <LinearGradient
                    colors={['#2D336B', '#3A428A']}
                    style={styles.modalOptionIcon}
                  >
                    <Ionicons name="camera" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.modalOptionText}>Take Photo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.modalOption} onPress={pickImage}>
                  <LinearGradient
                    colors={['#4F46E5', '#6366F1']}
                    style={styles.modalOptionIcon}
                  >
                    <Ionicons name="images" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.modalOptionText}>Choose from Library</Text>
                </TouchableOpacity>
                
                {selectedImage && (
                  <TouchableOpacity 
                    style={[styles.modalOption, styles.removeOption]}
                    onPress={() => {
                      setSelectedImage(null);
                      setModalVisible(false);
                    }}
                  >
                    <LinearGradient
                      colors={['#EF4444', '#DC2626']}
                      style={styles.modalOptionIcon}
                    >
                      <Ionicons name="trash" size={24} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={styles.modalOptionText}>Remove Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  headerBackground: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  profileImageContainer: {
    marginBottom: 20,
  },
  profileImageWrapper: {
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 20,
    overflow: 'hidden',
  },
  editPhotoGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  memberSince: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  memberSinceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 6,
    fontWeight: '500',
  },
  formContainer: {
    marginTop: -20,
    paddingHorizontal: 20,
  },
  formBackground: {
    borderRadius: 20,
    padding: 24,
    elevation: 8,
    shadowColor: '#2D336B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 10,
    color: '#64748B',
  },
  fieldsContainer: {
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
    fontSize: 11,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputEditing: {
    backgroundColor: '#FFFFFF',
    borderColor: '#2D336B',
  },
  checkIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  actionButtons: {
    marginTop: 8,
  },
  editButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  editButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 10,
  },
  saveCancelContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },
  cancelButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 10,
  },
  saveButton: {
    flex: 2,
    borderRadius: 28,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 10,
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 40,
  },
  statsBackground: {
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: '#2D336B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D336B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  modalBackground: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalOptions: {
    gap: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  modalOptionIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  removeOption: {
    marginTop: 8,
  },
});

export default ProfileScreen;