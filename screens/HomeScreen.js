// /screens/HomeScreen.js
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, Image, ActivityIndicator } from 'react-native';
import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase'; // ✅ use your firebase.js db

const HomeScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();

  const [loading, setLoading] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState(false);

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      try {
        const ref = doc(db, 'users', auth.currentUser.uid, 'preferences', 'userPrefs');
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setProfileCompleted(snap.data()?.profileCompleted || false);
        } else {
          setProfileCompleted(false); // ✅ No data → show Get Started
        }
      } catch (e) {
        console.log('Error fetching preferences:', e);
        setProfileCompleted(false);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [auth.currentUser]);

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        navigation.replace('Landing');
      })
      .catch((error) => {
        console.log(error);
      });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2D336B" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF2F2" />
      <View style={styles.container}>
        {/* Background Decorations */}
        <View style={styles.backgroundDecoration1} />
        <View style={styles.backgroundDecoration2} />

        {/* Main Content */}
        <View style={styles.contentContainer}>
          {/* Logo */}
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />

          {/* Welcome Text */}
          <Text style={styles.emailText}>{auth.currentUser?.email}</Text>

          {/* Show Get Started button if not completed */}
          {!profileCompleted && (
            <TouchableOpacity
              onPress={() => navigation.navigate('PersonalizationForm')}
              style={[styles.actionButton, { marginTop: 24, backgroundColor: '#2D336B' }]}
            >
              <Text style={[styles.actionText, { color: 'white' }]}>Get Started</Text>
            </TouchableOpacity>
          )}

          {/* Other Action Buttons */}
          {profileCompleted && (
            <View style={{ marginTop: 24, width: '100%' }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Profile')}
                style={[styles.actionButton, { marginBottom: 12 }]}
              >
                <Text style={styles.actionText}>My Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('PlanTrip')}
                style={[styles.actionButton, { marginBottom: 12 }]}
              >
                <Text style={styles.actionText}>Plan a Trip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('MyTrips')}
                style={[styles.actionButton, { marginBottom: 12 }]}
              >
                <Text style={styles.actionText}>My Trips</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('JoinTrip')}
                style={[styles.actionButton, { marginBottom: 12 }]}
              >
                <Text style={styles.actionText}>Join a Trip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

export default HomeScreen;


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backgroundDecoration1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#A9B5DF',
    opacity: 0.1,
  },
  backgroundDecoration2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#7886C7',
    opacity: 0.1,
  },
  contentContainer: {
    alignItems: 'center',
    marginBottom: 80,
  },
  logo: {
    width: 260,
    height: 120,
    marginBottom: 20,
  },
  emailText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#7886C7',
    textAlign: 'center',
  },
  signOutButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#181f39ff',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 40,
    alignItems: 'center',
    elevation: 4,
    position: 'absolute',
    bottom: 24,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D336B',
    letterSpacing: 0.5,
  },
  actionButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
