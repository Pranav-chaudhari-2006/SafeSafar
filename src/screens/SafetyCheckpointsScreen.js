import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  Alert, 
  Platform, 
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Linking,
  Modal
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

export default function SafetyCheckpointsScreen({ navigation }) {
    const [location, setLocation] = useState(null);
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all', 'police', 'hospital', 'pharmacy', 'fire_station'
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [distanceUnit, setDistanceUnit] = useState('km'); // 'km' or 'mi'
    const [searchRadius, setSearchRadius] = useState(5); // kilometers
    const mapRef = useRef(null);

    const PLACE_TYPES = {
        police: { icon: 'shield', color: '#3b82f6', label: 'Police Station' },
        hospital: { icon: 'medkit', color: '#ef4444', label: 'Hospital' },
        pharmacy: { icon: 'medical', color: '#10b981', label: 'Pharmacy' },
        fire_station: { icon: 'flame', color: '#f59e0b', label: 'Fire Station' },
        atm: { icon: 'cash', color: '#8b5cf6', label: 'ATM' },
        embassy: { icon: 'business', color: '#ec4899', label: 'Embassy' },
    };

    useEffect(() => {
        initializeLocation();
    }, []);

    useEffect(() => {
        if (location) {
            fetchNearbyPlaces(location.latitude, location.longitude);
        }
    }, [searchRadius]);

    const initializeLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Location Permission Required',
                    'This app needs location access to show nearby safety checkpoints.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Settings', onPress: () => Linking.openSettings() }
                    ]
                );
                return;
            }

            const locationData = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const currentLocation = {
                latitude: locationData.coords.latitude,
                longitude: locationData.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            };

            setLocation(currentLocation);
            fetchNearbyPlaces(currentLocation.latitude, currentLocation.longitude);
        } catch (error) {
            console.error('Error getting location:', error);
            Alert.alert('Error', 'Unable to get your location. Using default location.');
            // Default to a central location if GPS fails
            setLocation({
                latitude: 28.6139,
                longitude: 77.2090,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            });
        }
    };

    const fetchNearbyPlaces = async (lat, lon) => {
        setLoading(true);
        try {
            const radiusInMeters = searchRadius * 1000;
            const query = `
                [out:json][timeout:30];
                (
                    node["amenity"="police"](around:${radiusInMeters},${lat},${lon});
                    way["amenity"="police"](around:${radiusInMeters},${lat},${lon});
                    relation["amenity"="police"](around:${radiusInMeters},${lat},${lon});
                    
                    node["amenity"="hospital"](around:${radiusInMeters},${lat},${lon});
                    way["amenity"="hospital"](around:${radiusInMeters},${lat},${lon});
                    relation["amenity"="hospital"](around:${radiusInMeters},${lat},${lon});
                    
                    node["amenity"="pharmacy"](around:${radiusInMeters},${lat},${lon});
                    way["amenity"="pharmacy"](around:${radiusInMeters},${lat},${lon});
                    relation["amenity"="pharmacy"](around:${radiusInMeters},${lat},${lon});
                    
                    node["amenity"="fire_station"](around:${radiusInMeters},${lat},${lon});
                    way["amenity"="fire_station"](around:${radiusInMeters},${lat},${lon});
                    relation["amenity"="fire_station"](around:${radiusInMeters},${lat},${lon});
                    
                    node["amenity"="atm"](around:${radiusInMeters},${lat},${lon});
                    way["amenity"="atm"](around:${radiusInMeters},${lat},${lon});
                    relation["amenity"="atm"](around:${radiusInMeters},${lat},${lon});
                    
                    node["office"="diplomatic"](around:${radiusInMeters},${lat},${lon});
                    way["office"="diplomatic"](around:${radiusInMeters},${lat},${lon});
                    relation["office"="diplomatic"](around:${radiusInMeters},${lat},${lon});
                );
                out center;
            `;

            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `data=${encodeURIComponent(query)}`
            });

            const data = await response.json();
            
            const formattedPlaces = data.elements.map(element => {
                const type = element.tags.amenity || 
                            (element.tags.office === 'diplomatic' ? 'embassy' : 'unknown');
                
                // Calculate distance from user
                const distance = calculateDistance(
                    lat, 
                    lon, 
                    element.lat || element.center.lat, 
                    element.lon || element.center.lon
                );
                
                return {
                    id: element.id,
                    type: type,
                    name: element.tags.name || PLACE_TYPES[type]?.label || 'Unnamed Location',
                    latitude: element.lat || element.center.lat,
                    longitude: element.lon || element.center.lon,
                    distance: distance,
                    phone: element.tags.phone || null,
                    address: element.tags['addr:full'] || element.tags['addr:street'] || null,
                    opening_hours: element.tags['opening_hours'] || null,
                };
            }).sort((a, b) => a.distance - b.distance); // Sort by distance

            setPlaces(formattedPlaces);
        } catch (error) {
            console.error('Error fetching places:', error);
            Alert.alert(
                'Connection Error', 
                'Unable to fetch nearby places. Please check your internet connection.',
                [{ text: 'Retry', onPress: () => fetchNearbyPlaces(lat, lon) }]
            );
        } finally {
            setLoading(false);
        }
    };

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const formatDistance = (distance) => {
        if (distanceUnit === 'mi') {
            return `${(distance * 0.621371).toFixed(1)} mi`;
        }
        return distance < 1 ? `${(distance * 1000).toFixed(0)} m` : `${distance.toFixed(1)} km`;
    };

    const handlePlaceSelect = (place) => {
        setSelectedPlace(place);
        setShowDetailsModal(true);
        
        // Animate to selected place
        mapRef.current?.animateToRegion({
            latitude: place.latitude,
            longitude: place.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        }, 500);
    };

    const handleCallEmergency = (phoneNumber) => {
        if (!phoneNumber) {
            Alert.alert('No Phone Number', 'Phone number is not available for this location.');
            return;
        }
        
        Alert.alert(
            'Call Emergency',
            `Do you want to call ${selectedPlace?.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Call', 
                    style: 'destructive',
                    onPress: () => Linking.openURL(`tel:${phoneNumber}`)
                }
            ]
        );
    };

    const handleNavigateTo = (place) => {
        const url = Platform.select({
            ios: `maps://?daddr=${place.latitude},${place.longitude}&dirflg=d`,
            android: `google.navigation:q=${place.latitude},${place.longitude}`,
        });
        
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'No navigation app found. Please install Google Maps.');
        });
    };

    const FilterChip = ({ title, type, icon }) => (
        <TouchableOpacity
            style={[
                styles.chip,
                filter === type && styles.chipActive,
                { 
                    backgroundColor: filter === type ? PLACE_TYPES[type]?.color || '#6b7280' : '#fff',
                    borderColor: filter === type ? PLACE_TYPES[type]?.color || '#6b7280' : '#e5e7eb'
                }
            ]}
            onPress={() => setFilter(type)}
        >
            <Ionicons 
                name={icon} 
                size={16} 
                color={filter === type ? '#fff' : PLACE_TYPES[type]?.color || '#6b7280'} 
            />
            <Text style={[styles.chipText, filter === type && styles.chipTextActive]}>
                {title}
            </Text>
        </TouchableOpacity>
    );

    const filteredPlaces = filter === 'all' 
        ? places 
        : places.filter(p => p.type === filter);

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
                        <Text style={styles.headerTitle}>Safety Checkpoints</Text>
                        <Text style={styles.headerSubtitle}>Find nearby safe locations</Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.refreshButton}
                        onPress={() => location && fetchNearbyPlaces(location.latitude, location.longitude)}
                        disabled={loading}
                    >
                        <Ionicons name="refresh" size={22} color="#3b82f6" />
                    </TouchableOpacity>
                </View>

                {/* Map Container */}
                <View style={styles.mapContainer}>
                    {location ? (
                        <MapView
                            ref={mapRef}
                            style={styles.map}
                            initialRegion={location}
                            showsUserLocation={true}
                            showsMyLocationButton={true}
                            showsCompass={true}
                            showsScale={true}
                            provider={PROVIDER_GOOGLE}
                            customMapStyle={[
                                {
                                    "featureType": "poi",
                                    "elementType": "labels",
                                    "stylers": [{ "visibility": "off" }]
                                }
                            ]}
                        >
                            {filteredPlaces.map(place => (
                                <Marker
                                    key={`${place.id}-${place.type}`}
                                    coordinate={{ 
                                        latitude: place.latitude, 
                                        longitude: place.longitude 
                                    }}
                                    onPress={() => handlePlaceSelect(place)}
                                >
                                    <View style={[
                                        styles.markerContainer,
                                        { 
                                            backgroundColor: PLACE_TYPES[place.type]?.color || '#6b7280',
                                            borderColor: '#fff'
                                        }
                                    ]}>
                                        <Ionicons 
                                            name={PLACE_TYPES[place.type]?.icon || 'location'} 
                                            size={18} 
                                            color="#fff" 
                                        />
                                    </View>
                                    <Callout tooltip style={styles.callout}>
                                        <View style={styles.calloutContainer}>
                                            <View style={styles.calloutHeader}>
                                                <View style={[
                                                    styles.calloutIcon,
                                                    { backgroundColor: PLACE_TYPES[place.type]?.color || '#6b7280' }
                                                ]}>
                                                    <Ionicons 
                                                        name={PLACE_TYPES[place.type]?.icon || 'location'} 
                                                        size={16} 
                                                        color="#fff" 
                                                    />
                                                </View>
                                                <View style={styles.calloutTextContainer}>
                                                    <Text style={styles.calloutTitle}>{place.name}</Text>
                                                    <Text style={styles.calloutSubtitle}>
                                                        {PLACE_TYPES[place.type]?.label || 'Location'} • {formatDistance(place.distance)}
                                                    </Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity 
                                                style={styles.calloutButton}
                                                onPress={() => handlePlaceSelect(place)}
                                            >
                                                <Text style={styles.calloutButtonText}>View Details</Text>
                                                <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
                                            </TouchableOpacity>
                                        </View>
                                    </Callout>
                                </Marker>
                            ))}
                        </MapView>
                    ) : (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text style={styles.loadingText}>Getting your location...</Text>
                        </View>
                    )}

                    {/* Search Radius Controls */}
                    <View style={styles.radiusControls}>
                        <Text style={styles.radiusLabel}>Search Radius: {searchRadius} km</Text>
                        <View style={styles.radiusSlider}>
                            {[1, 3, 5, 10, 15].map(radius => (
                                <TouchableOpacity
                                    key={radius}
                                    style={[
                                        styles.radiusButton,
                                        searchRadius === radius && styles.radiusButtonActive,
                                        { backgroundColor: searchRadius === radius ? '#3b82f6' : '#fff' }
                                    ]}
                                    onPress={() => setSearchRadius(radius)}
                                >
                                    <Text style={[
                                        styles.radiusButtonText,
                                        searchRadius === radius && styles.radiusButtonTextActive
                                    ]}>
                                        {radius}km
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Current Location Button */}
                    <TouchableOpacity 
                        style={styles.currentLocationButton}
                        onPress={initializeLocation}
                        disabled={loading}
                    >
                        <Ionicons name="locate" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                </View>

                {/* Filter Bar */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                    contentContainerStyle={styles.filterScrollContent}
                >
                    <FilterChip title="All" type="all" icon="layers" />
                    <FilterChip title="Police" type="police" icon="shield" />
                    <FilterChip title="Hospitals" type="hospital" icon="medkit" />
                    <FilterChip title="Pharmacies" type="pharmacy" icon="medical" />
                    <FilterChip title="Fire Stations" type="fire_station" icon="flame" />
                    <FilterChip title="ATMs" type="atm" icon="cash" />
                    <FilterChip title="Embassies" type="embassy" icon="business" />
                </ScrollView>

                {/* Places List */}
                <View style={styles.placesListContainer}>
                    <Text style={styles.placesListTitle}>
                        {filteredPlaces.length} {filter === 'all' ? 'Places' : PLACE_TYPES[filter]?.label || 'Places'} Nearby
                    </Text>
                    <ScrollView 
                        style={styles.placesList}
                        showsVerticalScrollIndicator={false}
                    >
                        {filteredPlaces.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="location-off" size={48} color="#d1d5db" />
                                <Text style={styles.emptyStateTitle}>No places found</Text>
                                <Text style={styles.emptyStateText}>
                                    Try increasing the search radius or check your internet connection.
                                </Text>
                            </View>
                        ) : (
                            filteredPlaces.map(place => (
                                <TouchableOpacity
                                    key={`${place.id}-list`}
                                    style={styles.placeItem}
                                    onPress={() => handlePlaceSelect(place)}
                                >
                                    <View style={[
                                        styles.placeIcon,
                                        { backgroundColor: PLACE_TYPES[place.type]?.color || '#6b7280' }
                                    ]}>
                                        <Ionicons 
                                            name={PLACE_TYPES[place.type]?.icon || 'location'} 
                                            size={20} 
                                            color="#fff" 
                                        />
                                    </View>
                                    <View style={styles.placeDetails}>
                                        <Text style={styles.placeName}>{place.name}</Text>
                                        <Text style={styles.placeType}>
                                            {PLACE_TYPES[place.type]?.label || 'Location'}
                                        </Text>
                                        <Text style={styles.placeDistance}>
                                            {formatDistance(place.distance)} away
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                </View>

                {/* Loading Overlay */}
                {loading && (
                    <View style={styles.loaderOverlay}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.loaderText}>Finding nearby locations...</Text>
                    </View>
                )}
            </View>

            {/* Place Details Modal */}
            <Modal
                visible={showDetailsModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowDetailsModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {selectedPlace && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={styles.modalIconContainer}>
                                        <View style={[
                                            styles.modalIcon,
                                            { backgroundColor: PLACE_TYPES[selectedPlace.type]?.color || '#6b7280' }
                                        ]}>
                                            <Ionicons 
                                                name={PLACE_TYPES[selectedPlace.type]?.icon || 'location'} 
                                                size={28} 
                                                color="#fff" 
                                            />
                                        </View>
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.modalCloseButton}
                                        onPress={() => setShowDetailsModal(false)}
                                    >
                                        <Ionicons name="close" size={24} color="#6b7280" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.modalContent}>
                                    <Text style={styles.modalTitle}>{selectedPlace.name}</Text>
                                    <Text style={styles.modalType}>
                                        {PLACE_TYPES[selectedPlace.type]?.label || 'Location'}
                                    </Text>
                                    
                                    <View style={styles.modalInfoSection}>
                                        <View style={styles.infoItem}>
                                            <Ionicons name="location" size={20} color="#3b82f6" />
                                            <View style={styles.infoContent}>
                                                <Text style={styles.infoLabel}>Distance</Text>
                                                <Text style={styles.infoValue}>
                                                    {formatDistance(selectedPlace.distance)} away
                                                </Text>
                                            </View>
                                        </View>
                                        
                                        {selectedPlace.address && (
                                            <View style={styles.infoItem}>
                                                <Ionicons name="pin" size={20} color="#10b981" />
                                                <View style={styles.infoContent}>
                                                    <Text style={styles.infoLabel}>Address</Text>
                                                    <Text style={styles.infoValue}>{selectedPlace.address}</Text>
                                                </View>
                                            </View>
                                        )}
                                        
                                        {selectedPlace.phone && (
                                            <View style={styles.infoItem}>
                                                <Ionicons name="call" size={20} color="#ef4444" />
                                                <View style={styles.infoContent}>
                                                    <Text style={styles.infoLabel}>Phone</Text>
                                                    <Text style={styles.infoValue}>{selectedPlace.phone}</Text>
                                                </View>
                                            </View>
                                        )}
                                        
                                        {selectedPlace.opening_hours && (
                                            <View style={styles.infoItem}>
                                                <Ionicons name="time" size={20} color="#f59e0b" />
                                                <View style={styles.infoContent}>
                                                    <Text style={styles.infoLabel}>Opening Hours</Text>
                                                    <Text style={styles.infoValue}>{selectedPlace.opening_hours}</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.modalActions}>
                                        <TouchableOpacity 
                                            style={[styles.actionButton, styles.callButton]}
                                            onPress={() => selectedPlace.phone && handleCallEmergency(selectedPlace.phone)}
                                            disabled={!selectedPlace.phone}
                                        >
                                            <Ionicons name="call" size={20} color="#fff" />
                                            <Text style={styles.callButtonText}>Call</Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity 
                                            style={[styles.actionButton, styles.navigateButton]}
                                            onPress={() => handleNavigateTo(selectedPlace)}
                                        >
                                            <Ionicons name="navigate" size={20} color="#fff" />
                                            <Text style={styles.navigateButtonText}>Navigate</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
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
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6b7280',
    },
    refreshButton: {
        padding: 8,
    },
    mapContainer: {
        height: Dimensions.get('window').height * 0.4,
        position: 'relative',
    },
    map: {
        width: '100%',
        height: '100%',
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
    radiusControls: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    radiusLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    radiusSlider: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    radiusButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    radiusButtonActive: {
        borderColor: '#3b82f6',
    },
    radiusButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6b7280',
    },
    radiusButtonTextActive: {
        color: '#fff',
    },
    currentLocationButton: {
        position: 'absolute',
        bottom: 20,
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
    filterScroll: {
        maxHeight: 60,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    filterScrollContent: {
        gap: 12,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        gap: 6,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    chipActive: {
        // Styles handled inline for dynamic colors
    },
    chipText: {
        fontSize: 14,
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#fff',
    },
    markerContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    callout: {
        width: 250,
    },
    calloutContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    calloutHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    calloutIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    calloutTextContainer: {
        flex: 1,
    },
    calloutTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    calloutSubtitle: {
        fontSize: 12,
        color: '#6b7280',
    },
    calloutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    calloutButtonText: {
        fontSize: 14,
        color: '#3b82f6',
        fontWeight: '500',
    },
    placesListContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    placesListTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    placesList: {
        flex: 1,
    },
    placeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    placeIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    placeDetails: {
        flex: 1,
    },
    placeName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    placeType: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 2,
    },
    placeDistance: {
        fontSize: 12,
        color: '#10b981',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6b7280',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
        maxWidth: 300,
    },
    loaderOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 12,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        padding: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        alignItems: 'center',
        position: 'relative',
    },
    modalIconContainer: {
        alignItems: 'center',
    },
    modalIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    modalCloseButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        padding: 8,
    },
    modalContent: {
        padding: 24,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    modalType: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 24,
    },
    modalInfoSection: {
        gap: 20,
        marginBottom: 32,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoValue: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 12,
    },
    callButton: {
        backgroundColor: '#ef4444',
    },
    navigateButton: {
        backgroundColor: '#3b82f6',
    },
    callButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    navigateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});