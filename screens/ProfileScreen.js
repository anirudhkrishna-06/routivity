// /screens/ProfileScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase'; // make sure db is exported from your firebaseConfig.js
import { Ionicons } from '@expo/vector-icons';

const ProfileScreen = ({ navigation }) => {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        } else {
          Alert.alert('Error', 'Profile not found.');
        }
      } catch (error) {
        console.log('Error fetching profile:', error);
        Alert.alert('Error', 'Failed to fetch profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [uid]);

  const handleSave = async () => {
    setUpdating(true);
    try {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, {
        fullName: profile.fullName,
        gender: profile.gender,
        phone: profile.phone,
        contactNumber: profile.contactNumber,
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Back Arrow */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={28} color="#333" />
      </TouchableOpacity>

      <Text style={styles.title}>My Profile</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={profile.fullName}
          editable={editing}
          onChangeText={(text) => setProfile({ ...profile, fullName: text })}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={profile.email} editable={false} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Gender</Text>
        <TextInput
          style={styles.input}
          value={profile.gender}
          editable={editing}
          onChangeText={(text) => setProfile({ ...profile, gender: text })}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={profile.phone}
          editable={editing}
          onChangeText={(text) => setProfile({ ...profile, phone: text })}
        />
      </View>


      {!editing ? (
        <TouchableOpacity style={styles.button} onPress={() => setEditing(true)} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Edit Profile</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleSave} disabled={updating} activeOpacity={0.8}>
          {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF2F2',
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    marginTop: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  field: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;
