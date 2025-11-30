// /navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import PlanTripScreen from '../screens/PlanTripScreen';
import TripSuggestionsScreen from '../screens/TripSuggestionsScreen';
import ItineraryScreen from '../screens/ItineraryScreen';
import MyTripsScreen from '../screens/MyTripsScreen';
import JoinTripScreen from '../screens/JoinTripScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home" 
        screenOptions={{ 
          headerShown: true,
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ title: 'Routivity' }}
        />
        <Stack.Screen 
          name="PlanTrip" 
          component={PlanTripScreen} 
          options={{ title: 'Plan Your Trip' }}
        />
        <Stack.Screen 
          name="TripSuggestions" 
          component={TripSuggestionsScreen} 
          options={{ title: 'Meal Suggestions' }}
        />
        <Stack.Screen 
          name="Itinerary" 
          component={ItineraryScreen} 
          options={{ title: 'Your Itinerary' }}
        />
        <Stack.Screen 
          name="MyTrips" 
          component={MyTripsScreen} 
          options={{ title: 'My Trips' }}
        />
        <Stack.Screen 
          name="JoinTrip" 
          component={JoinTripScreen} 
          options={{ title: 'Join a Trip' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}