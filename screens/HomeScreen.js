import { StyleSheet, Text, View, TouchableOpacity, StatusBar, Image } from 'react-native';
import React from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';


const HomeScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        navigation.replace('Landing');
      })
      .catch((error) => {
        console.log(error);
      });
  };

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
          <Image 
            source={require('../assets/logo.png')} // <-- Place your logo here
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Welcome Text */}
          <Text style={styles.emailText}>{auth.currentUser?.email}</Text>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
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
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2D336B',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
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
    shadowColor: '#A9B5DF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D336B',
    letterSpacing: 0.5,
  },
});