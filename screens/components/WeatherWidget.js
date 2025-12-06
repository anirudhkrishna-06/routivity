import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const WeatherWidget = ({ weather, loading, destination }) => {
  const getWeatherIcon = (condition) => {
    const conditionLower = condition?.toLowerCase() || '';
    if (conditionLower.includes('clear')) return 'sunny';
    if (conditionLower.includes('cloud')) return 'cloudy';
    if (conditionLower.includes('rain')) return 'rainy';
    if (conditionLower.includes('snow')) return 'snow';
    if (conditionLower.includes('thunder')) return 'thunderstorm';
    return 'partly-sunny';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="cloud" size={20} color="#FF9800" />
          <Text style={styles.title}>Weather</Text>
        </View>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="small" color="#FF9800" />
          <Text style={styles.loadingText}>Loading weather...</Text>
        </View>
      </View>
    );
  }

  if (!weather) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="cloud-offline" size={20} color="#999" />
          <Text style={styles.title}>Weather</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.noWeatherText}>
            Weather data not available for {destination || 'destination'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="cloud" size={20} color="#FF9800" />
        <Text style={styles.title}>Weather at Destination</Text>
        {destination && (
          <Text style={styles.destination} numberOfLines={1}>
            • {destination}
          </Text>
        )}
      </View>
      
      <View style={styles.content}>
        <View style={styles.weatherMain}>
          <Ionicons 
            name={getWeatherIcon(weather.condition)} 
            size={48} 
            color="#FF9800" 
          />
          <View style={styles.temperatureContainer}>
            <Text style={styles.temperature}>
              {Math.round(weather.temperature)}°
            </Text>
            <Text style={styles.condition}>{weather.condition}</Text>
          </View>
        </View>
        
        <View style={styles.details}>
          <View style={styles.detailItem}>
            <Ionicons name="water" size={16} color="#2196F3" />
            <Text style={styles.detailText}>{weather.humidity}%</Text>
            <Text style={styles.detailLabel}>Humidity</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Ionicons name="speedometer" size={16} color="#4CAF50" />
            <Text style={styles.detailText}>{weather.windSpeed} km/h</Text>
            <Text style={styles.detailLabel}>Wind</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Ionicons name="thermometer" size={16} color="#FF5722" />
            <Text style={styles.detailText}>
              H: {Math.round(weather.tempHigh)}° L: {Math.round(weather.tempLow)}°
            </Text>
            <Text style={styles.detailLabel}>High/Low</Text>
          </View>
        </View>
        
        {weather.forecast && weather.forecast.length > 0 && (
          <View style={styles.forecast}>
            <Text style={styles.forecastTitle}>Next 24 Hours</Text>
            <View style={styles.forecastItems}>
              {weather.forecast.slice(0, 3).map((item, index) => (
                <View key={index} style={styles.forecastItem}>
                  <Text style={styles.forecastTime}>{item.time}</Text>
                  <Ionicons 
                    name={getWeatherIcon(item.condition)} 
                    size={20} 
                    color="#FF9800" 
                  />
                  <Text style={styles.forecastTemp}>{Math.round(item.temp)}°</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  destination: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  content: {
    marginTop: 4,
  },
  noWeatherText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  temperatureContainer: {
    marginLeft: 16,
  },
  temperature: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  condition: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  forecast: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  forecastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  forecastItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  forecastItem: {
    alignItems: 'center',
  },
  forecastTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  forecastTemp: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
});

export default WeatherWidget;