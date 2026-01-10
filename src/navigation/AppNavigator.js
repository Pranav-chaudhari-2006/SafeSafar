import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import SOSScreen from '../screens/SOSScreen';
import ReportIncidentScreen from '../screens/ReportIncidentScreen';
import SelectLocationScreen from '../screens/SelectLocationScreen';
import SafetyCheckpointsScreen from '../screens/SafetyCheckpointsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="SOS" component={SOSScreen} />
      <Stack.Screen name="ReportIncident" component={ReportIncidentScreen} />
      <Stack.Screen name="SelectLocation" component={SelectLocationScreen} />
      <Stack.Screen name="SafetyCheckpoints" component={SafetyCheckpointsScreen} />
    </Stack.Navigator>
  );
}
