import React, { useRef, useEffect } from 'react';
import { Animated, View, StyleSheet, Dimensions } from 'react-native';
import RouteMap from './RouteMap';

const { height } = Dimensions.get('window');

const ItineraryRouteMap = ({ region, coords, stops, height: mapHeight = Math.round(height * 0.75), interactive = false, onMessage }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ width: '100%', height: mapHeight, backgroundColor: 'transparent', opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }] }>
      <View style={styles.wrapper}>
        <RouteMap region={region} coords={coords} stops={stops} height={mapHeight} interactive={interactive} onMessage={onMessage} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});

export default ItineraryRouteMap;
