import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Auth + Base Screens
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import CreateAccountScreen from './screens/CreateAccountScreen';
import LandingScreen from './screens/LandingScreen';

// Trip Flow Screens
import PlanTripScreen from './screens/PlanTripScreen';
import TripSuggestionsScreen from './screens/TripSuggestionScreen';
import ItineraryScreen from './screens/ItineraryScreen';
import MyTripsScreen from './screens/MyTripsScreen';
import JoinTripScreen from './screens/JoinTripScreen';
import ProfileScreen from './screens/ProfileScreen';
import PersonalizationForm from './screens/PersonalizationForm';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {/* Auth Flow */}
        <Stack.Screen
          name="Landing"
          component={LandingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SignUp"
          component={CreateAccountScreen}
          options={{ headerShown: false }}
        />

        {/* Main Home */}
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />

        {/* Trip Planning Flow */}
        <Stack.Screen name="PlanTrip" component={PlanTripScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Suggestions" component={TripSuggestionsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Itinerary" component={ItineraryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{headerShown: false}}/>
        <Stack.Screen name="PersonalizationForm" component={PersonalizationForm} options={{headerShown: false}}/>

        {/* Trips Management */}
        <Stack.Screen name="MyTrips" component={MyTripsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="JoinTrip" component={JoinTripScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
