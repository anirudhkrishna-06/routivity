import React from 'react';
import { View, StyleSheet } from 'react-native';
import RouteMap from './RouteMap';

const DashboardRouteMap = ({ region, coords, stops, height = 200, interactive = false, onMessage }) => {
  return (
    <View style={styles.card}>
      <View style={{ height }}>
        <RouteMap region={region} coords={coords} stops={stops} height={height} interactive={interactive} onMessage={onMessage} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default DashboardRouteMap;
