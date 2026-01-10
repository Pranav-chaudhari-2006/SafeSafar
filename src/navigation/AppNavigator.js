import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import SOSScreen from '../screens/SOSScreen';
import ReportIncidentScreen from '../screens/ReportIncidentScreen';
import SelectLocationScreen from '../screens/SelectLocationScreen';
import SafeRouteScreen from '../screens/SafeRouteScreen';
import SafetyCheckpointsScreen from '../screens/SafetyCheckpointsScreen';
import EmergencyContactsScreen from '../screens/EmergencyContactsScreen';
import IncidentHistoryScreen from '../screens/IncidentHistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SafetyNetworkScreen from '../screens/SafetyNetworkScreen';
import CheckInScreen from '../screens/CheckInScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="SOS" component={SOSScreen} />
      <Stack.Screen name="ReportIncident" component={ReportIncidentScreen} />
      <Stack.Screen name="SelectLocation" component={SelectLocationScreen} />
      <Stack.Screen name="SafeRoute" component={SafeRouteScreen} />
      <Stack.Screen name="SafetyCheckpoints" component={SafetyCheckpointsScreen} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
      <Stack.Screen name="History" component={IncidentHistoryScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SafetyNetwork" component={SafetyNetworkScreen} />
      <Stack.Screen name="CheckIn" component={CheckInScreen} />
    </Stack.Navigator>
  );
}

