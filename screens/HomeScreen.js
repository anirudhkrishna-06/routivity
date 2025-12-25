// /screens/HomeScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Animated,
  ImageBackground,
} from 'react-native';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_HEIGHT = 180;

const CARD_DATA = [
  {
    key: 'myTrips',
    title: 'My Trips',
    subtitle: 'View, manage and relive your journeys',
    icon: 'map-marked-alt',
    iconType: 'fontawesome5',
    gradient: ['#2D336B', '#3A428A'],
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
    route: 'MyTrips',
  },
  {
    key: 'planTrip',
    title: 'Plan a Trip',
    subtitle: 'Create intelligent, AI-powered itineraries',
    icon: 'route',
    iconType: 'fontawesome5',
    gradient: ['#4F46E5', '#6366F1'],
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
    route: 'PlanTrip',
  },
  {
    key: 'joinTrip',
    title: 'Join a Trip',
    subtitle: 'Collaborate with friends on shared plans',
    icon: 'users',
    iconType: 'fontawesome5',
    gradient: ['#059669', '#10B981'],
    image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=800&q=80',
    route: 'JoinTrip',
  },
  {
    key: 'profile',
    title: 'My Profile',
    subtitle: 'Personalize your travel preferences',
    icon: 'user-cog',
    iconType: 'fontawesome5',
    gradient: ['#7C3AED', '#8B5CF6'],
    image: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=800&q=80',
    route: 'Profile',
  },
  {
    key: 'plantripplus',
    title: 'Plan Trip Plus',
    subtitle: 'Ace through our Dynamic Itenerary Generation',
    icon: 'user-cog',
    iconType: 'fontawesome5',
    gradient: ['#7C3AED', '#8B5CF6'],
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
    route: 'PlanTripPlus',
  },
];

const HomeScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();
  
  const [loading, setLoading] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [userName, setUserName] = useState('');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnimations = useRef(CARD_DATA.map(() => new Animated.Value(0))).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      
      try {
        // Fetch preferences
        const prefRef = doc(db, 'users', auth.currentUser.uid, 'preferences', 'userPrefs');
        const prefSnap = await getDoc(prefRef);
        setProfileCompleted(prefSnap.exists() ? prefSnap.data()?.profileCompleted : false);
        
        // Fetch user name from main user document
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().name) {
          setUserName(userSnap.data().name);
        }
        
        // Start animations after data is loaded
        setTimeout(() => {
          setLoading(false);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }).start();
          
          // Staggered card animations
          cardAnimations.forEach((anim, index) => {
            Animated.timing(anim, {
              toValue: 1,
              duration: 400,
              delay: index * 100,
              useNativeDriver: true,
            }).start();
          });
        }, 300);
        
      } catch (e) {
        console.log('Error fetching user data:', e);
        setProfileCompleted(false);
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleSignOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.9,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      signOut(auth)
        .then(() => navigation.replace('Landing'))
        .catch(console.log);
    });
  };

  const handleCardPress = (route, index) => {
    Animated.sequence([
      Animated.timing(cardAnimations[index], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(cardAnimations[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.navigate(route);
    });
  };

  const handleGetStartedPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.navigate('PersonalizationForm');
    });
  };

  const renderIcon = (icon, type, size = 24) => {
    switch (type) {
      case 'fontawesome5':
        return <FontAwesome5 name={icon} size={size} color="white" />;
      case 'material':
        return <MaterialIcons name={icon} size={size} color="white" />;
      default:
        return <Ionicons name={icon} size={size} color="white" />;
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <Animated.View style={[styles.loaderLogoContainer, { opacity: fadeAnim }]}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.loaderLogo}
            resizeMode="contain"
          />
        </Animated.View>
        <ActivityIndicator size="large" color="#2D336B" />
        <Text style={styles.loaderText}>Optimizing your experience…</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Header with Gradient Background */}
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80' }}
          style={styles.headerBackground}
          blurRadius={2}
        >
          <View style={styles.headerOverlay}>
            {/* Top Navigation */}
            <View style={styles.topBar}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <TouchableOpacity 
                onPress={handleSignOut} 
                style={styles.userIconContainer}
                activeOpacity={0.7}
              >
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <View style={styles.userIcon}>
                    <Ionicons name="log-out-outline" size={22} color="#2D336B" />
                  </View>
                </Animated.View>
              </TouchableOpacity>
            </View>

            {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>
                {userName 
      ? `Hi, ${userName}!` 
      : `Welcome, ${auth.currentUser?.email?.split('@')[0] || 'there'}!`}
              </Text>
              <Text style={styles.emailText}>Gearing up for an exciting Trip?</Text>
            </View>
          </View>
        </ImageBackground>

        {/* Main Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.cardsContainer}
          showsVerticalScrollIndicator={false}
        >
          {!profileCompleted ? (
            <Animated.View style={{ opacity: fadeAnim }}>
              <TouchableOpacity
                onPress={handleGetStartedPress}
                activeOpacity={0.9}
                style={[styles.getStartedCard]}
              >
                <View style={styles.getStartedContent}>
                  <View style={styles.getStartedIconContainer}>
                    <MaterialIcons name="stars" size={32} color="#2D336B" />
                  </View>
                  <View style={styles.getStartedTextContainer}>
                    <Text style={styles.getStartedTitle}>Complete Your Profile</Text>
                    <Text style={styles.getStartedSubtitle}>
                      Unlock intelligent trip planning with AI-powered recommendations
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-forward-ios" size={20} color="#2D336B" />
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: '30%' }]} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            CARD_DATA.map((item, index) => (
              <Animated.View
                key={item.key}
                style={[
                  styles.cardWrapper,
                  {
                    opacity: cardAnimations[index],
                    transform: [
                      { translateY: cardAnimations[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0]
                      })},
                      { scale: cardAnimations[index] }
                    ]
                  }
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleCardPress(item.route, index)}
                  style={styles.card}
                >
                  <ImageBackground
                    source={{ uri: item.image }}
                    style={styles.cardImage}
                    imageStyle={styles.cardImageStyle}
                  >
                    <View style={[styles.cardOverlay, { backgroundColor: `rgba(${parseInt(item.gradient[0].slice(1,3), 16)}, ${parseInt(item.gradient[0].slice(3,5), 16)}, ${parseInt(item.gradient[0].slice(5,7), 16)}, 0.3)` }]}>
                      <View style={styles.cardHeader}>
                        <View style={styles.iconContainer}>
                          {renderIcon(item.icon, item.iconType, 22)}
                        </View>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                      </View>
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardActionText}>Explore</Text>
                        <Ionicons name="arrow-forward-circle" size={24} color="white" />
                      </View>
                    </View>
                  </ImageBackground>
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
          

        </ScrollView>
      </Animated.View>
    </>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loaderLogoContainer: {
    marginBottom: 30,
  },
  loaderLogo: {
    width: 200,
    height: 80,
  },
  loaderText: {
    marginTop: 20,
    fontSize: 15,
    color: '#7886C7',
    fontWeight: '500',
  },
  headerBackground: {
    height: 210,
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(248, 250, 252, 0.95)',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 160,
    height: 60,
  },
  userIconContainer: {
    padding: 8,
  },
  userIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#2D336B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  welcomeSection: {
    marginTop: 10,
    marginLeft: 10
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 16,
    color: '#2D336B',
    fontWeight: '500',
    marginBottom: 8,

  },
  emailText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '400',
  },
  scrollView: {
    flex: 1,
  },
  cardsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  cardWrapper: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#2D336B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardImage: {
    flex: 1,
  },
  cardImageStyle: {
    borderRadius: 20,
  },
  cardOverlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(76, 173, 208, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardActionText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  getStartedCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#2D336B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  getStartedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  getStartedIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(76, 173, 208, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  getStartedTextContainer: {
    flex: 1,
  },
  getStartedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  getStartedSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2D336B',
    borderRadius: 3,
  },
  statsContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginTop: 10,
    elevation: 4,
    shadowColor: '#2D336B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2D336B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});