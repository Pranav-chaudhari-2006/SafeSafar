import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Platform
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { debounce } from 'lodash';
import { supabase } from '../services/supabase';

const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImFkN2E1OWNkN2VhMjRlZDViZGI5ZDI0YmFkODdlNGIyIiwiaCI6Im11cm11cjY0In0=';

export default function SafeRouteScreen({ navigation }) {
  const mapRef = useRef(null);

  // State variables
  const [region, setRegion] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [routeDetails, setRouteDetails] = useState(null);
  const [avoidRadius, setAvoidRadius] = useState(200); // meters
  const [userLocation, setUserLocation] = useState(null);
  const [mapType, setMapType] = useState('standard');
  const [routeOptions, setRouteOptions] = useState({
    avoidIncidents: true,
    preferWellLit: false,
    avoidAlleys: true,
  });
  const [waypoints, setWaypoints] = useState([]);
  const [transportMode, setTransportMode] = useState('driving-car'); // 'foot-walking', 'driving-car', 'cycling-regular'

  // Initialize location and incidents
  useEffect(() => {
    initializeLocation();
    fetchIncidents();
  }, []);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'This feature needs your location to calculate safe routes.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Location.getForegroundPermissionsAsync() }
          ]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

      setRegion(currentLocation);
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your current location.');
    }
  };

  const fetchIncidents = async () => {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('id, latitude, longitude, type, description, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .order('created_at', { ascending: false });

      if (error) throw error;

      setIncidents(data || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
      Alert.alert('Error', 'Failed to load incident data.');
    }
  };

  // Search destination with debounce
  const searchDestination = useCallback(
    debounce(async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      setLoading(true);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
          {
            headers: {
              'User-Agent': 'SafeSafar/1.0'
            },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Search failed with status: ${response.status}`);
        }

        const data = await response.json();
        setSearchResults(data);
        setShowSearchResults(data.length > 0);

        if (data.length === 0) {
          Alert.alert('No Results', 'No locations found. Try a different search term.');
        }
      } catch (error) {
        console.error('Search error:', error);
        if (error.name === 'AbortError') {
          Alert.alert('Search Timeout', 'Search took too long. Please check your connection and try again.');
        } else {
          Alert.alert('Search Error', 'Unable to search for location. Please check your internet connection and try again.');
        }
        setSearchResults([]);
        setShowSearchResults(false);
      } finally {
        setLoading(false);
      }
    }, 500),
    []
  );

  const handleSearchChange = (text) => {
    setDestinationQuery(text);
    searchDestination(text);
  };

  const selectDestination = (result) => {
    const dest = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      name: result.display_name,
      address: {
        road: result.address?.road || '',
        suburb: result.address?.suburb || '',
        city: result.address?.city || result.address?.town || '',
        state: result.address?.state || '',
        country: result.address?.country || '',
      }
    };

    setDestination(dest);
    setDestinationQuery(result.display_name);
    setSearchResults([]);
    setShowSearchResults(false);

    // Animate to destination
    mapRef.current?.animateToRegion({
      latitude: dest.latitude,
      longitude: dest.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 1000);

    // Calculate route if we have user location
    if (userLocation) {
      calculateSafeRoute(dest);
    }
  };

  const calculateSafeRoute = async (dest) => {
    if (!userLocation || !dest) return;

    setLoading(true);
    setRoute(null);
    setRouteDetails(null);

    try {
      // Create avoid areas from incidents
      const avoidAreas = incidents.map(incident => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [incident.longitude, incident.latitude]
        },
        properties: {
          radius: avoidRadius,
          type: incident.type
        }
      }));

      const requestBody = {
        coordinates: [
          [userLocation.longitude, userLocation.latitude],
          [dest.longitude, dest.latitude]
        ],
        instructions: 'true',
        language: 'en',
        preference: 'recommended',
        units: 'km',
      };

      // Add avoid polygons if enabled and valid
      if (routeOptions.avoidIncidents && avoidAreas.length > 0) {
        const polygons = createAvoidPolygons();
        if (polygons) {
          requestBody.options = {
            avoid_polygons: polygons
          };
        }
      }

      console.log('Route request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(
        `https://api.openrouteservice.org/v2/directions/${transportMode}/geojson`,
        {
          method: 'POST',
          headers: {
            'Authorization': ORS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Route API error:', errorText);
        throw new Error(`Route calculation failed: ${response.status}`);
      }

      const data = await response.json();

      // Extract route coordinates
      const coordinates = data.features[0].geometry.coordinates.map(coord => ({
        latitude: coord[1],
        longitude: coord[0],
      }));

      // Extract route details
      const summary = data.features[0].properties.summary;
      const segments = data.features[0].properties.segments[0];

      console.log('Route summary:', summary);
      console.log('Segments:', segments);
      console.log('Raw duration:', segments.duration);
      console.log('Duration in minutes (÷60):', segments.duration / 60);
      console.log('Duration in hours:', segments.duration / 3600);

      const durationMinutes = Math.round(segments.duration / 60);
      const durationHours = Math.floor(durationMinutes / 60);
      const remainingMinutes = durationMinutes % 60;

      setRoute(coordinates);
      setRouteDetails({
        distance: summary.distance.toFixed(2), // Already in km from GeoJSON endpoint
        duration: durationMinutes, // Total minutes
        durationDisplay: durationHours > 0
          ? `${durationHours}h ${remainingMinutes}m`
          : `${durationMinutes}m`,
        steps: segments.steps.map(step => ({
          instruction: step.instruction,
          distance: step.distance.toFixed(2), // Already in km
          duration: Math.round(step.duration / 60),
        })).slice(0, 5), // Show first 5 steps
      });

      // Animate to show entire route
      if (coordinates.length > 0) {
        fitToRoute(coordinates);
      }

    } catch (error) {
      console.error('Route calculation error:', error);
      Alert.alert(
        'Route Error',
        'Unable to calculate safe route. Please try again.',
        [
          {
            text: 'Try Without Incident Avoidance',
            onPress: () => {
              setRouteOptions(prev => ({ ...prev, avoidIncidents: false }));
              calculateSafeRoute(dest);
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const createAvoidPolygons = () => {
    if (!routeOptions.avoidIncidents || incidents.length === 0) return null;

    // For MultiPolygon in GeoJSON, structure is:
    // coordinates: [ [[outer ring]], [[outer ring]], ... ]
    // Each polygon is wrapped in an extra array
    const polygons = incidents.map(incident => {
      // 0.001 degrees is roughly 111 meters. 
      const d = 0.001;
      return [
        [
          [incident.longitude - d, incident.latitude - d],
          [incident.longitude + d, incident.latitude - d],
          [incident.longitude + d, incident.latitude + d],
          [incident.longitude - d, incident.latitude + d],
          [incident.longitude - d, incident.latitude - d],
        ]
      ];
    });

    return {
      type: 'MultiPolygon',
      coordinates: polygons,
    };
  };

  const fitToRoute = (coordinates) => {
    if (coordinates.length === 0) return;

    const latitudes = coordinates.map(coord => coord.latitude);
    const longitudes = coordinates.map(coord => coord.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const padding = 0.01; // Additional padding

    mapRef.current?.fitToCoordinates(
      [
        { latitude: minLat - padding, longitude: minLng - padding },
        { latitude: maxLat + padding, longitude: maxLng + padding },
      ],
      {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      }
    );
  };

  const handleStartNavigation = () => {
    if (!route || !destination) {
      Alert.alert('No Route', 'Please calculate a route first.');
      return;
    }

    Alert.alert(
      'Start Navigation',
      'Start turn-by-turn navigation to your destination?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => {
            navigation.navigate('Navigation', {
              route,
              destination,
              routeDetails,
            });
          }
        }
      ]
    );
  };

  const clearRoute = () => {
    setRoute(null);
    setRouteDetails(null);
    setDestination(null);
    setDestinationQuery('');
    if (userLocation && region) {
      mapRef.current?.animateToRegion(region, 500);
    }
  };

  const IncidentMarker = ({ incident }) => {
    const getIncidentIcon = (type) => {
      switch (type) {
        case 'harassment': return 'person-remove';
        case 'stalking': return 'eye';
        case 'unsafe_area': return 'warning';
        case 'theft': return 'briefcase';
        case 'assault': return 'hand-left';
        default: return 'alert-circle';
      }
    };

    const getIncidentColor = (type) => {
      switch (type) {
        case 'harassment': return '#ef4444';
        case 'stalking': return '#f59e0b';
        case 'unsafe_area': return '#8b5cf6';
        case 'theft': return '#ec4899';
        case 'assault': return '#dc2626';
        default: return '#6b7280';
      }
    };

    return (
      <Marker
        coordinate={{
          latitude: incident.latitude,
          longitude: incident.longitude,
        }}
        tracksViewChanges={true}
      >
        <View style={styles.incidentMarker}>
          <View style={[styles.incidentIcon, { backgroundColor: getIncidentColor(incident.type) }]}>
            <Ionicons name={getIncidentIcon(incident.type)} size={14} color="#fff" />
          </View>
          {routeOptions.avoidIncidents && (
            <Circle
              center={{
                latitude: incident.latitude,
                longitude: incident.longitude,
              }}
              radius={avoidRadius}
              strokeColor="rgba(239, 68, 68, 0.3)"
              fillColor="rgba(239, 68, 68, 0.1)"
              strokeWidth={1}
            />
          )}
        </View>
      </Marker>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Safe Route Navigation</Text>
            <Text style={styles.headerSubtitle}>Find the safest path to your destination</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Enter your destination"
              value={destinationQuery}
              onChangeText={handleSearchChange}
              placeholderTextColor="#9ca3af"
            />
            {loading && (
              <ActivityIndicator size="small" color="#3b82f6" style={styles.searchLoader} />
            )}
          </View>

          {/* Search Results */}
          {showSearchResults && searchResults.length > 0 && (
            <View style={styles.searchResults}>
              <ScrollView style={styles.resultsList}>
                {searchResults.map((result, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.resultItem}
                    onPress={() => selectDestination(result)}
                  >
                    <Ionicons name="location" size={20} color="#3b82f6" />
                    <View style={styles.resultText}>
                      <Text style={styles.resultTitle} numberOfLines={1}>
                        {result.display_name.split(',')[0]}
                      </Text>
                      <Text style={styles.resultSubtitle} numberOfLines={2}>
                        {result.display_name.split(',').slice(1).join(',').trim()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Map Container */}
        <View style={styles.mapContainer}>
          {region ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={region}
              provider={PROVIDER_GOOGLE}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={true}
              showsScale={true}
              mapType={mapType}
            >
              {/* User Location */}
              {userLocation && (
                <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.userMarker}>
                    <View style={styles.userMarkerInner}>
                      <Ionicons name="person" size={14} color="#fff" />
                    </View>
                  </View>
                </Marker>
              )}

              {/* Incident Markers */}
              {incidents.map(incident => (
                <IncidentMarker key={incident.id} incident={incident} />
              ))}

              {/* Destination Marker */}
              {destination && (
                <Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }}>
                  <View style={styles.destinationMarker}>
                    <Ionicons name="flag" size={24} color="#fff" />
                    <View style={styles.destinationMarkerBase} />
                  </View>
                </Marker>
              )}

              {/* Route */}
              {route && route.length > 0 && (
                <Polyline
                  coordinates={route}
                  strokeWidth={6}
                  strokeColor="#10b981"
                  lineDashPattern={[1, 0]}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
            </MapView>
          ) : (
            <View style={styles.loadingMap}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          )}

          {/* Map Controls */}
          <View style={styles.mapControls}>
            <TouchableOpacity
              style={styles.mapControlButton}
              onPress={initializeLocation}
            >
              <Ionicons name="locate" size={22} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mapControlButton}
              onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
            >
              <Ionicons name={mapType === 'standard' ? 'map' : 'earth'} size={22} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Transport Mode Selector */}
        <View style={styles.transportModeContainer}>
          <Text style={styles.transportModeTitle}>Travel Mode</Text>
          <View style={styles.transportModeButtons}>
            <TouchableOpacity
              style={[styles.transportModeButton, transportMode === 'foot-walking' && styles.transportModeButtonActive]}
              onPress={() => setTransportMode('foot-walking')}
            >
              <Ionicons
                name="walk"
                size={20}
                color={transportMode === 'foot-walking' ? '#fff' : '#6b7280'}
              />
              <Text style={[styles.transportModeText, transportMode === 'foot-walking' && styles.transportModeTextActive]}>
                Walk
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.transportModeButton, transportMode === 'driving-car' && styles.transportModeButtonActive]}
              onPress={() => setTransportMode('driving-car')}
            >
              <Ionicons
                name="car"
                size={20}
                color={transportMode === 'driving-car' ? '#fff' : '#6b7280'}
              />
              <Text style={[styles.transportModeText, transportMode === 'driving-car' && styles.transportModeTextActive]}>
                Drive
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.transportModeButton, transportMode === 'cycling-regular' && styles.transportModeButtonActive]}
              onPress={() => setTransportMode('cycling-regular')}
            >
              <Ionicons
                name="bicycle"
                size={20}
                color={transportMode === 'cycling-regular' ? '#fff' : '#6b7280'}
              />
              <Text style={[styles.transportModeText, transportMode === 'cycling-regular' && styles.transportModeTextActive]}>
                Bike
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Route Options */}
        <View style={styles.optionsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
            <TouchableOpacity
              style={[styles.optionChip, routeOptions.avoidIncidents && styles.optionChipActive]}
              onPress={() => setRouteOptions(prev => ({ ...prev, avoidIncidents: !prev.avoidIncidents }))}
            >
              <Ionicons
                name={routeOptions.avoidIncidents ? "shield-checkmark" : "shield"}
                size={16}
                color={routeOptions.avoidIncidents ? "#10b981" : "#6b7280"}
              />
              <Text style={[styles.optionText, routeOptions.avoidIncidents && styles.optionTextActive]}>
                Avoid Incidents
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionChip, routeOptions.avoidAlleys && styles.optionChipActive]}
              onPress={() => setRouteOptions(prev => ({ ...prev, avoidAlleys: !prev.avoidAlleys }))}
            >
              <Ionicons
                name={routeOptions.avoidAlleys ? "walk" : "walk-outline"}
                size={16}
                color={routeOptions.avoidAlleys ? "#10b981" : "#6b7280"}
              />
              <Text style={[styles.optionText, routeOptions.avoidAlleys && styles.optionTextActive]}>
                Avoid Alleys
              </Text>
            </TouchableOpacity>

            <View style={styles.radiusOption}>
              <Text style={styles.radiusLabel}>Avoid Radius:</Text>
              <View style={styles.radiusControls}>
                <TouchableOpacity
                  style={[styles.radiusButton, avoidRadius === 100 && styles.radiusButtonActive]}
                  onPress={() => setAvoidRadius(100)}
                >
                  <Text style={[styles.radiusText, avoidRadius === 100 && styles.radiusTextActive]}>100m</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radiusButton, avoidRadius === 200 && styles.radiusButtonActive]}
                  onPress={() => setAvoidRadius(200)}
                >
                  <Text style={[styles.radiusText, avoidRadius === 200 && styles.radiusTextActive]}>200m</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radiusButton, avoidRadius === 500 && styles.radiusButtonActive]}
                  onPress={() => setAvoidRadius(500)}
                >
                  <Text style={[styles.radiusText, avoidRadius === 500 && styles.radiusTextActive]}>500m</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Route Details */}
        {routeDetails && (
          <View style={styles.routeDetails}>
            <View style={styles.routeHeader}>
              <Text style={styles.routeTitle}>Route Details</Text>
              <TouchableOpacity onPress={clearRoute}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.routeStats}>
              <View style={styles.statItem}>
                <Ionicons name="time" size={20} color="#3b82f6" />
                <Text style={styles.statValue}>{routeDetails.durationDisplay || `${routeDetails.duration} min`}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="navigate" size={20} color="#10b981" />
                <Text style={styles.statValue}>{routeDetails.distance} km</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="shield" size={20} color="#ef4444" />
                <Text style={styles.statValue}>{incidents.length}</Text>
                <Text style={styles.statLabel}>Incidents Avoided</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.navigateButton}
              onPress={handleStartNavigation}
            >
              <Ionicons name="navigate" size={24} color="#fff" />
              <Text style={styles.navigateButtonText}>Start Navigation</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Calculate Route Button */}
        {destination && !routeDetails && (
          <TouchableOpacity
            style={styles.calculateButton}
            onPress={() => calculateSafeRoute(destination)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="shield" size={20} color="#fff" />
                <Text style={styles.calculateButtonText}>Calculate Safe Route</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingOverlayText}>Calculating safest route...</Text>
          </View>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1f2937',
  },
  searchLoader: {
    marginLeft: 8,
  },
  searchResults: {
    position: 'absolute',
    top: 68,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    zIndex: 100,
  },
  resultsList: {
    maxHeight: 300,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  resultText: {
    flex: 1,
    marginLeft: 12,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingMap: {
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
  mapControls: {
    position: 'absolute',
    top: 20,
    right: 20,
    gap: 12,
  },
  mapControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incidentMarker: {
    alignItems: 'center',
  },
  incidentIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  destinationMarker: {
    alignItems: 'center',
  },
  destinationMarkerBase: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginTop: 2,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  optionsScroll: {
    flexDirection: 'row',
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
    marginRight: 12,
  },
  optionChipActive: {
    backgroundColor: '#10b98120',
    borderColor: '#10b981',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  optionTextActive: {
    color: '#10b981',
  },
  radiusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  radiusControls: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  radiusButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  radiusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  radiusTextActive: {
    color: '#fff',
  },
  routeDetails: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  navigateButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  calculateButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 18,
    margin: 20,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingOverlayText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  transportModeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  transportModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  transportModeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  transportModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  transportModeButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  transportModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  transportModeTextActive: {
    color: '#fff',
  },
});