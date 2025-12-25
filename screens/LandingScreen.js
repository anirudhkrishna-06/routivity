import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ImageBackground,
  Animated,
  Dimensions,
} from 'react-native';
const { width, height } = Dimensions.get('window');

export default function LandingScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 4000,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
  }, []);

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <>

      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <ImageBackground
        source={{
          uri: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
        }}
        style={styles.container}
      >
        {/* Light overlay for readability */}
        <View style={styles.overlay} />

        {/* Ambient gradient shapes */}
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        {/* Content */}
        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: floatY }],
            },
          ]}
        >
          {/* Logo */}
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Tagline */}
          <Text style={styles.title}>Plan journeys.{"\n"} not just routes.</Text>
          

          {/* CTA */}
          <TouchableOpacity
            style={styles.getStartedButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>

          {/* Trust strip */}
          
        </Animated.View>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },

  glowTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#2D336B',
    opacity: 0.08,
  },

  glowBottom: {
    position: 'absolute',
    bottom: -140,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#1DB954',
    opacity: 0.08,
  },

  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  logo: {
    width: 340,
    height: 260,
    marginBottom: 10,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#2D336B',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 12,
    letterSpacing: 0.4,
  },

  subtitle: {
    fontSize: 14.5,
    color: '#4A4F87',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 46,
    paddingHorizontal: 10,
  },

  getStartedButton: {
    backgroundColor: '#2D336B',
    paddingVertical: 16,
    paddingHorizontal: 46,
    borderRadius: 40,
    shadowColor: '#2D336B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
    marginTop: 200
  },

  getStartedText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
  },

  trustContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(45,51,107,0.05)',
  },

  trustText: {
    fontSize: 13,
    color: '#2D336B',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
