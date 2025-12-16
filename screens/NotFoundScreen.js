// /screens/NotFoundScreen.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Easing } from 'react-native';  // Add this import at the top

const { width, height } = Dimensions.get('window');

const NotFoundScreen = () => {
  const navigation = useNavigation();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  
  const backgroundImage = 'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80';

  useEffect(() => {
    // Start all animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating animation for main content
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.inOut(Easing.ease),  // ✅ CORRECT
            useNativeDriver: true,
            }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleGoBack = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.goBack();
    });
  };

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <ImageBackground
        source={{ uri: backgroundImage }}
        style={styles.background}
        blurRadius={1}
      >
        {/* Overlay for better readability */}
        <LinearGradient
          colors={['rgba(45, 51, 107, 0.85)', 'rgba(58, 66, 138, 0.9)']}
          style={styles.overlay}
        />

        <Animated.View 
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim }
              ]
            }
          ]}
        >
          <Animated.View 
            style={[
              styles.content,
              {
                transform: [{ translateY }]
              }
            ]}
          >
            {/* Icon Container */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#FFFFFF', '#F8FAFC']}
                style={styles.iconCircle}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.iconInnerCircle}>
                  <Ionicons name="construct-outline" size={60} color="#2D336B" />
                </View>
                {/* Animated dots around the icon */}
                {[...Array(8)].map((_, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.orbitDot,
                      {
                        transform: [
                          { rotate: `${index * 45}deg` },
                          { translateX: 80 }
                        ]
                      }
                    ]}
                  />
                ))}
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={styles.title}>Work in Progress</Text>
            
            {/* Subtitle */}
            <Text style={styles.subtitle}>
              We're crafting something amazing here
            </Text>

            {/* Message */}
            

            {/* Estimated Time */}
            

            {/* Action Buttons */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleGoBack}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F8FAFC']}
                  style={styles.primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="arrow-back" size={22} color="#2D336B" />
                  <Text style={styles.primaryButtonText}>Go Back</Text>
                </LinearGradient>
              </TouchableOpacity>

              
            </View>

            {/* Progress Indicator */}
            
            {/* Footer Note */}
            <Text style={styles.footerText}>
              Thank you for your patience and understanding
            </Text>
          </Animated.View>

          {/* Animated Background Elements */}
          <Animated.View 
            style={[
              styles.floatingElement1,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.1]
                })
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.floatingElement2,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.08]
                })
              }
            ]} 
          />
        </Animated.View>
      </ImageBackground>
    </>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  iconCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 15,
    shadowColor: '#2D336B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  iconInnerCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(45, 51, 107, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbitDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4F46E5',
    opacity: 0.6,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '500',
    lineHeight: 24,
  },
  messageBox: {
    width: '100%',
    marginBottom: 28,
    borderRadius: 16,
    overflow: 'hidden',
  },
  messageGradient: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  messageText: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 12,
    lineHeight: 22,
    fontWeight: '400',
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  timeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 12,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  timeSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
    width: '60%',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 34,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    width: 20
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 14,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D336B',
    marginLeft: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 14,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
    fontWeight: '500',
    alignSelf: 'flex-start',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
  floatingElement1: {
    position: 'absolute',
    top: '20%',
    right: '10%',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#A9B5DF',
  },
  floatingElement2: {
    position: 'absolute',
    bottom: '25%',
    left: '10%',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7886C7',
  },
});

export default NotFoundScreen;