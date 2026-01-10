import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { saveIncident } from '../services/incidentService';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

export default function ReportIncidentScreen({ navigation }) {
  const { user } = useContext(AuthContext);

  const [type, setType] = useState('harassment');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  const incidentTypes = [
    { id: 'harassment', label: 'Harassment', icon: 'person-remove', color: '#ef4444' },
    { id: 'stalking', label: 'Stalking', icon: 'eye', color: '#f59e0b' },
    { id: 'unsafe_area', label: 'Unsafe Area', icon: 'warning', color: '#8b5cf6' },
    { id: 'theft', label: 'Theft/Robbery', icon: 'briefcase', color: '#ec4899' },
    { id: 'assault', label: 'Assault', icon: 'hand-left', color: '#dc2626' },
    { id: 'traffic', label: 'Traffic Incident', icon: 'car', color: '#3b82f6' },
    { id: 'public', label: 'Public Disturbance', icon: 'megaphone', color: '#10b981' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#6b7280' },
  ];

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Location permission is needed to automatically detect your location for incident reporting.',
          [{ text: 'OK' }]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      });
      
      // Auto-set location if not already set
      if (!location) {
        setLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!type) {
      newErrors.type = 'Please select an incident type';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (!location) {
      newErrors.location = 'Please select a location';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      await saveIncident({
        userId: user.id,
        type,
        description: description.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || 'Unknown location',
        reportedAt: new Date().toISOString(),
      });

      setSuccess(true);
      
      Alert.alert(
        '✅ Incident Reported',
        'Thank you for reporting this incident. Your report helps make the community safer.',
        [
          {
            text: 'Report Another',
            onPress: () => resetForm(),
            style: 'default',
          },
          {
            text: 'View History',
            onPress: () => navigation.navigate('History'),
          },
          {
            text: 'Done',
            style: 'cancel',
          }
        ]
      );

    } catch (error) {
      console.error('Error saving incident:', error);
      Alert.alert(
        'Error',
        'Failed to save incident. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setType('harassment');
    setDescription('');
    setLocation(currentLocation);
    setSuccess(false);
    setErrors({});
  };

  const getTypeIcon = (typeId) => {
    const type = incidentTypes.find(t => t.id === typeId);
    return type?.icon || 'help-circle';
  };

  const getTypeColor = (typeId) => {
    const type = incidentTypes.find(t => t.id === typeId);
    return type?.color || '#6b7280';
  };

  const getTypeLabel = (typeId) => {
    const type = incidentTypes.find(t => t.id === typeId);
    return type?.label || 'Unknown';
  };

  const handleLocationSelect = async () => {
    navigation.navigate('SelectLocation', {
      initialLocation: currentLocation,
      onConfirm: (selectedLocation) => {
        setLocation(selectedLocation);
        if (errors.location) setErrors({...errors, location: ''});
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Report Incident</Text>
              <Text style={styles.subtitle}>Help keep the community safe</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Incident Type Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                What type of incident?
                <Text style={styles.required}> *</Text>
              </Text>
              {errors.type && (
                <Text style={styles.errorText}>{errors.type}</Text>
              )}
              <View style={styles.typeGrid}>
                {incidentTypes.map((incidentType) => (
                  <TouchableOpacity
                    key={incidentType.id}
                    style={[
                      styles.typeButton,
                      type === incidentType.id && styles.typeButtonSelected,
                      { borderColor: type === incidentType.id ? incidentType.color : '#e5e7eb' }
                    ]}
                    onPress={() => {
                      setType(incidentType.id);
                      if (errors.type) setErrors({...errors, type: ''});
                    }}
                    disabled={loading}
                  >
                    <View style={[styles.typeIcon, { backgroundColor: incidentType.color }]}>
                      <Ionicons name={incidentType.icon} size={20} color="#fff" />
                    </View>
                    <Text style={[
                      styles.typeLabel,
                      type === incidentType.id && styles.typeLabelSelected
                    ]}>
                      {incidentType.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Description
                <Text style={styles.required}> *</Text>
              </Text>
              {errors.description && (
                <Text style={styles.errorText}>{errors.description}</Text>
              )}
              <View style={[styles.textInputContainer, errors.description && styles.inputError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Describe what happened in detail..."
                  placeholderTextColor="#9ca3af"
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    if (errors.description) setErrors({...errors, description: ''});
                  }}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!loading}
                />
                <Text style={styles.charCount}>
                  {description.length}/1000
                </Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Location
                <Text style={styles.required}> *</Text>
              </Text>
              {errors.location && (
                <Text style={styles.errorText}>{errors.location}</Text>
              )}
              
              {location ? (
                <View style={styles.locationCard}>
                  <View style={styles.locationHeader}>
                    <Ionicons name="location" size={20} color="#3b82f6" />
                    <Text style={styles.locationTitle}>Selected Location</Text>
                  </View>
                  <Text style={styles.locationText}>
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </Text>
                  {location.address && (
                    <Text style={styles.addressText}>{location.address}</Text>
                  )}
                  <TouchableOpacity 
                    style={styles.changeLocationButton}
                    onPress={handleLocationSelect}
                    disabled={loading}
                  >
                    <Ionicons name="swap-horizontal" size={16} color="#3b82f6" />
                    <Text style={styles.changeLocationText}>Change Location</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.selectLocationButton}
                  onPress={handleLocationSelect}
                  disabled={loading}
                >
                  <Ionicons name="add-circle" size={24} color="#3b82f6" />
                  <Text style={styles.selectLocationText}>Select Location</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.useCurrentButton}
                onPress={() => {
                  if (currentLocation) {
                    setLocation(currentLocation);
                    if (errors.location) setErrors({...errors, location: ''});
                  } else {
                    getCurrentLocation();
                  }
                }}
                disabled={loading}
              >
                <Ionicons name="locate" size={20} color="#6b7280" />
                <Text style={styles.useCurrentText}>
                  {currentLocation ? 'Use My Current Location' : 'Get My Current Location'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Privacy Notice */}
            <View style={styles.privacyNotice}>
              <Ionicons name="shield-checkmark" size={20} color="#10b981" />
              <Text style={styles.privacyText}>
                Your report will be anonymous. Personal information is kept confidential.
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={24} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Emergency Notice */}
            <View style={styles.emergencyNotice}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <View style={styles.emergencyContent}>
                <Text style={styles.emergencyTitle}>Emergency?</Text>
                <Text style={styles.emergencyText}>
                  If you're in immediate danger, use the{' '}
                  <Text 
                    style={styles.emergencyLink}
                    onPress={() => navigation.navigate('SOS')}
                  >
                    Emergency SOS
                  </Text>{' '}
                  feature instead.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  required: {
    color: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  typeButtonSelected: {
    backgroundColor: '#f9fafb',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  typeLabelSelected: {
    fontWeight: '600',
  },
  textInputContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    padding: 16,
    minHeight: 150,
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  textInput: {
    fontSize: 16,
    color: '#1f2937',
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 8,
  },
  locationCard: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  changeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  changeLocationText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  selectLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  selectLocationText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  useCurrentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    alignSelf: 'center',
  },
  useCurrentText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  privacyText: {
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 20,
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#6ee7b7',
    opacity: 0.8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 4,
  },
  emergencyText: {
    fontSize: 14,
    color: '#7f1d1d',
    lineHeight: 20,
  },
  emergencyLink: {
    color: '#dc2626',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});