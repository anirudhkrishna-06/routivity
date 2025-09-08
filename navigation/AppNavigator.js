// /navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import PlanTripScreen from '../screens/PlanTripScreen';
import SuggestionsScreen from '../screens/SuggestionsScreen';
import ItineraryScreen from '../screens/ItineraryScreen';
import MyTripsScreen from '../screens/MyTripsScreen';
import JoinTripScreen from '../screens/JoinTripScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: true }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="PlanTrip" component={PlanTripScreen} />
        <Stack.Screen name="Suggestions" component={SuggestionsScreen} />
        <Stack.Screen name="Itinerary" component={ItineraryScreen} />
        <Stack.Screen name="MyTrips" component={MyTripsScreen} />
        <Stack.Screen name="JoinTrip" component={JoinTripScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
