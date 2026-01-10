import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useEffect, useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function SelectLocationScreen({ route, navigation }) {
  const { onConfirm, initialLocation } = route.params;
  const [region, setRegion] = useState(null);
  const [marker, setMarker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState('');
  const [accuracy, setAccuracy] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    try {
      setLoading(true);
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permissions to select a location on the map.',
          [
            {
              text: 'Use Default',
              onPress: () => useDefaultLocation(),
            },
            {
              text: 'Settings',
              onPress: () => Location.getForegroundPermissionsAsync().then(console.log),
            }
          ]
        );
        return;
      }

      let initialCoords;
      let initialAccuracy = null;

      if (initialLocation) {
        // Use provided initial location
        initialCoords = {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
        };
        initialAccuracy = initialLocation.accuracy || null;
      } else {
        // Get current location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        initialCoords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        initialAccuracy = location.coords.accuracy;
      }

      const initialRegion = {
        latitude: initialCoords.latitude,
        longitude: initialCoords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setRegion(initialRegion);
      setMarker(initialCoords);
      setAccuracy(initialAccuracy);
      
      // Get address for initial location
      await getAddress(initialCoords);
      
    } catch (error) {
      console.error('Error initializing location:', error);
      Alert.alert('Error', 'Unable to get location. Please try again.');
      useDefaultLocation();
    } finally {
      setLoading(false);
    }
  };

  const useDefaultLocation = () => {
    const defaultRegion = {
      latitude: 28.6139, // Delhi coordinates as default
      longitude: 77.2090,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
    
    setRegion(defaultRegion);
    setMarker({
      latitude: defaultRegion.latitude,
      longitude: defaultRegion.longitude,
    });
    setLoading(false);
    setAddress('Delhi, India');
  };

  const getAddress = async (coords) => {
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (reverseGeocode.length > 0) {
        const location = reverseGeocode[0];
        const addressParts = [];
        
        if (location.name) addressParts.push(location.name);
        if (location.street) addressParts.push(location.street);
        if (location.city) addressParts.push(location.city);
        if (location.region) addressParts.push(location.region);
        if (location.country) addressParts.push(location.country);
        
        setAddress(addressParts.join(', ') || 'Address not available');
      } else {
        setAddress('Address not available');
      }
    } catch (error) {
      console.error('Error getting address:', error);
      setAddress('Unable to fetch address');
    }
  };

  const handleMapPress = async (e) => {
    const coords = e.nativeEvent.coordinate;
    setMarker(coords);
    setIsSelecting(true);
    await getAddress(coords);
    setIsSelecting(false);
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLoading(true);
      setIsSelecting(true);
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setMarker(coords);
      setAccuracy(location.coords.accuracy);
      
      // Animate to new location
      const newRegion = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      mapRef.current?.animateToRegion(newRegion, 500);
      await getAddress(coords);
      
      setIsSelecting(false);
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Unable to get current location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!marker) {
      Alert.alert('No Location Selected', 'Please select a location on the map.');
      return;
    }

    onConfirm({
      latitude: marker.latitude,
      longitude: marker.longitude,
      address: address,
      accuracy: accuracy,
    });
    
    navigation.goBack();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleCancel}
            disabled={loading || isSelecting}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Select Location</Text>
            <Text style={styles.headerSubtitle}>Tap on the map to choose a location</Text>
          </View>
        </View>

        {/* Map Container */}
        <View style={styles.mapContainer}>
          {region && (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={region}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={true}
              showsScale={true}
              loadingEnabled={true}
              loadingIndicatorColor="#3b82f6"
              loadingBackgroundColor="#f8fafc"
            >
              {marker && (
                <Marker
                  coordinate={marker}
                  draggable
                  onDragEnd={(e) => {
                    const coords = e.nativeEvent.coordinate;
                    setMarker(coords);
                    getAddress(coords);
                  }}
                >
                  <View style={styles.markerContainer}>
                    <View style={styles.markerPin}>
                      <Ionicons name="location" size={24} color="#ef4444" />
                    </View>
                    <View style={styles.markerBase} />
                  </View>
                </Marker>
              )}
            </MapView>
          )}

          {/* Current Location Button */}
          <TouchableOpacity 
            style={styles.currentLocationButton}
            onPress={handleUseCurrentLocation}
            disabled={loading || isSelecting}
          >
            <Ionicons name="locate" size={24} color="#3b82f6" />
          </TouchableOpacity>

          {/* Map Instructions */}
          <View style={styles.mapInstructions}>
            <Ionicons name="hand-left" size={16} color="#6b7280" />
            <Text style={styles.instructionsText}>Tap anywhere on the map</Text>
          </View>
        </View>

        {/* Location Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.detailsHeader}>
            <Ionicons name="location" size={20} color="#3b82f6" />
            <Text style={styles.detailsTitle}>Selected Location</Text>
          </View>
          
          {isSelecting ? (
            <View style={styles.loadingAddress}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.loadingAddressText}>Getting address...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.addressText}>
                {address || 'No address available'}
              </Text>
              
              <View style={styles.coordinatesContainer}>
                <View style={styles.coordinateItem}>
                  <Text style={styles.coordinateLabel}>Latitude</Text>
                  <Text style={styles.coordinateValue}>
                    {marker?.latitude?.toFixed(6) || '--'}
                  </Text>
                </View>
                <View style={styles.coordinateDivider} />
                <View style={styles.coordinateItem}>
                  <Text style={styles.coordinateLabel}>Longitude</Text>
                  <Text style={styles.coordinateValue}>
                    {marker?.longitude?.toFixed(6) || '--'}
                  </Text>
                </View>
              </View>
              
              {accuracy && (
                <View style={styles.accuracyContainer}>
                  <Ionicons name="speedometer" size={16} color="#6b7280" />
                  <Text style={styles.accuracyText}>
                    Accuracy: {Math.round(accuracy)} meters
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={loading || isSelecting}
          >
            <Ionicons name="close" size={20} color="#6b7280" />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.confirmButton, (!marker || isSelecting) && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!marker || loading || isSelecting}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerBase: {
    width: 8,
    height: 8,
    backgroundColor: '#ef4444',
    borderRadius: 4,
    marginTop: 2,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mapInstructions: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  instructionsText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  detailsCard: {
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 20,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  loadingAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  loadingAddressText: {
    fontSize: 14,
    color: '#6b7280',
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 16,
  },
  coordinatesContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  coordinateItem: {
    flex: 1,
  },
  coordinateLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  coordinateValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#374151',
    fontWeight: '500',
  },
  coordinateDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  accuracyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accuracyText: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonDisabled: {
    backgroundColor: '#a7f3d0',
    opacity: 0.7,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});