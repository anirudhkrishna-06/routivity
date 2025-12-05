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

import ProfileScreen from './screens/ProfileScreen';
import PersonalizationForm from './screens/PersonalizationForm';
import TripDashboardScreen from './screens/TripDashboardScreen';
import ManageMembersScreen from './screens/TripMembers/ManageMembersScreen';
import AddMemberScreen from './screens/TripMembers/AddMemberScreen'
import JoinTripScreen from './screens/TripMembers/JoinTripScreen';
import QRScannerScreen from './screens/TripMembers/QRScannerScreen';
import BillTrackerScreen from './screens/Expenses/BillTrackerScreen';
import AddExpenseScreen from './screens/Expenses/AddExpenseScreen';
import ExpenseListScreen from './screens/Expenses/ExpenseListScreen';
import ExpenseDetailScreen from './screens/Expenses/ExpenseDetailScreen';





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
        <Stack.Screen name="TripDashboard" component={TripDashboardScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ManageMembers" component={ManageMembersScreen}/>
        <Stack.Screen name="AddMember" component={AddMemberScreen} />
        <Stack.Screen name="QRScanner" component={QRScannerScreen} />
        <Stack.Screen name="BillTracker" component={BillTrackerScreen} />
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
        <Stack.Screen name="ExpenseList" component={ExpenseListScreen} />
        <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />





      </Stack.Navigator>
    </NavigationContainer>
  );
}
