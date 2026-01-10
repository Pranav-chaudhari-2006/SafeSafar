import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, Animated, Alert, SafeAreaView } from 'react-native';
import { useContext, useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { saveSOSEvent } from '../services/sosService';
import { Ionicons } from '@expo/vector-icons';

export default function SOSScreen() {
  const { user } = useContext(AuthContext);
  const [status, setStatus] = useState('Ready');
  const [isActive, setIsActive] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [statusTimeline, setStatusTimeline] = useState([]);
  const [location, setLocation] = useState(null);
  const recordingRef = useRef(null);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const STATUS_TYPES = {
    IDLE: { icon: 'alert-circle-outline', color: '#6b7280' },
    PROCESSING: { icon: 'sync-outline', color: '#f59e0b' },
    SUCCESS: { icon: 'checkmark-circle', color: '#10b981' },
    ERROR: { icon: 'close-circle', color: '#ef4444' },
  };

  const addTimelineEvent = (message, type = 'PROCESSING') => {
    const timelineEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // unique ID
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };
    setStatusTimeline(prev => [timelineEvent, ...prev]);
  };

  useEffect(() => {
    // Start pulse animation when SOS is active
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const [audioPermission, locationPermission] = await Promise.all([
        Audio.requestPermissionsAsync(),
        Location.requestForegroundPermissionsAsync(),
      ]);

      if (!audioPermission.granted) {
        addTimelineEvent('Microphone permission required', 'ERROR');
      }
      if (!locationPermission.granted) {
        addTimelineEvent('Location permission required', 'ERROR');
      }
    } catch (error) {
      console.error('Permission request error:', error);
    }
  };

  const wait = ms => new Promise(res => setTimeout(res, ms));

  const startRecording = async () => {
    try {
      console.log("[SOS] Starting recording...");
      const permission = await Audio.getPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission denied');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      addTimelineEvent('Audio recording started', 'PROCESSING');
      
      // Start recording timer
      let time = 0;
      timerRef.current = setInterval(() => {
        time += 1;
        setRecordingTime(time);
        // Update progress animation (10 seconds total)
        if (time <= 10) {
          Animated.timing(progressAnim, {
            toValue: time / 10,
            duration: 100,
            useNativeDriver: false,
          }).start();
        }
      }, 1000);
      
      return true;
    } catch (e) {
      console.error("[SOS] Start recording failed", e);
      addTimelineEvent('Failed to start recording', 'ERROR');
      throw e;
    }
  };

  const stopAndUploadRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    const recording = recordingRef.current;
    if (!recording) {
      console.warn("[SOS] No active recording found");
      throw new Error('No active recording');
    }

    console.log("[SOS] Stopping recording...");
    try {
      await recording.stopAndUnloadAsync();
      addTimelineEvent('Audio recording stopped', 'PROCESSING');
    } catch (error) {
      console.warn("Error stopping recording:", error);
    }

    const uri = recording.getURI();
    console.log("[SOS] Recording URI:", uri);

    if (!uri) {
      addTimelineEvent('Recording failed - no audio file', 'ERROR');
      throw new Error('Recording failed - no audio file');
    }

    try {
      const fileName = `sos-audio-${user.id}-${Date.now()}.m4a`;
      let fileBody;
      let fileOptions = { contentType: 'audio/m4a', upsert: true };

      addTimelineEvent('Preparing audio for upload', 'PROCESSING');

      if (Platform.OS === 'web') {
        fileBody = await fetch(uri).then(res => res.blob());
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
        fileBody = decode(base64);
      }

      addTimelineEvent('Uploading audio to server', 'PROCESSING');
      
      const { data, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(fileName, fileBody, fileOptions);

      if (uploadError) {
        console.error("[SOS] Upload error:", uploadError);
        addTimelineEvent('Audio upload failed', 'ERROR');
        throw uploadError;
      }

      const { data: publicData } = await supabase.storage
        .from("audio")
        .getPublicUrl(fileName);

      const publicUrl = publicData?.publicUrl;
      console.log("[SOS] Public URL:", publicUrl);

      if (!publicUrl) {
        addTimelineEvent('Could not generate audio URL', 'ERROR');
        throw new Error("Could not generate audio public URL");
      }

      recordingRef.current = null;
      setRecordingTime(0);
      progressAnim.setValue(0);
      
      addTimelineEvent('Audio uploaded successfully', 'SUCCESS');
      return publicUrl;
    } catch (err) {
      console.error("[SOS] Upload process failed:", err);
      recordingRef.current = null;
      addTimelineEvent('Audio processing failed', 'ERROR');
      throw err;
    }
  };

  const getCurrentLocation = async () => {
    try {
      addTimelineEvent('Getting current location', 'PROCESSING');
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
      
      setLocation(coords);
      addTimelineEvent('Location acquired', 'SUCCESS');
      return coords;
    } catch (error) {
      addTimelineEvent('Failed to get location', 'ERROR');
      throw error;
    }
  };

  const handleSOS = async () => {
    if (isActive) return; // Prevent multiple activations
    
    setIsActive(true);
    setStatusTimeline([]); // Clear previous timeline
    addTimelineEvent('SOS activation initiated', 'PROCESSING');

    try {
      // Step 1: Get location
      setStatus('Getting Location');
      const locationData = await getCurrentLocation();

      // Step 2: Start recording
      setStatus('Recording Audio');
      await startRecording();

      // Step 3: Wait for minimum recording time
      addTimelineEvent('Recording emergency audio (10 seconds)', 'PROCESSING');
      await wait(10000);

      // Step 4: Stop and upload recording
      setStatus('Uploading Audio');
      const audioUrl = await stopAndUploadRecording();

      // Step 5: Refresh session if needed
      addTimelineEvent('Verifying authentication', 'PROCESSING');
      await supabase.auth.refreshSession();

      // Step 6: Save SOS event
      setStatus('Saving Emergency Data');
      addTimelineEvent('Saving emergency event to database', 'PROCESSING');
      
      await saveSOSEvent(
        user.id, 
        locationData.latitude, 
        locationData.longitude, 
        audioUrl
      );

      // Success
      setStatus('Emergency Alert Sent');
      addTimelineEvent('SOS alert successfully sent! Emergency services notified.', 'SUCCESS');
      
      // Show success alert
      Alert.alert(
        '🚨 Emergency Alert Sent',
        'Your SOS signal has been sent successfully. Emergency services have been notified with your location and audio recording.',
        [
          {
            text: 'OK',
            onPress: () => setIsActive(false),
            style: 'default',
          }
        ]
      );

    } catch (error) {
      console.error('SOS Error:', error);
      setStatus('Failed');
      addTimelineEvent(`Failed: ${error.message}`, 'ERROR');
      
      Alert.alert(
        '⚠️ SOS Failed',
        error.message || 'Failed to send emergency alert. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setIsActive(false);
              setStatus('Ready');
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          }
        ]
      );
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
      progressAnim.setValue(0);
    }
  };

  const cancelSOS = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (error) {
        console.warn('Error stopping recording on cancel:', error);
      }
      recordingRef.current = null;
    }
    
    setIsActive(false);
    setStatus('Ready');
    setRecordingTime(0);
    progressAnim.setValue(0);
    addTimelineEvent('SOS activation cancelled', 'PROCESSING');
  };

  const getStatusIcon = (type) => {
    const statusType = STATUS_TYPES[type] || STATUS_TYPES.PROCESSING;
    return statusType.icon;
  };

  const getStatusColor = (type) => {
    const statusType = STATUS_TYPES[type] || STATUS_TYPES.PROCESSING;
    return statusType.color;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🚨 Emergency SOS</Text>
          <Text style={styles.subtitle}>
            Press and hold the button to activate emergency alert
          </Text>
        </View>

        {/* SOS Button */}
        <View style={styles.sosButtonContainer}>
          <Animated.View 
            style={[
              styles.sosPulse,
              {
                transform: [{ scale: pulseAnim }],
                opacity: isActive ? 0.6 : 0,
              }
            ]} 
          />
          
          <TouchableOpacity
            style={[
              styles.sosButton,
              isActive && styles.sosButtonActive,
            ]}
            onPress={handleSOS}
            onLongPress={handleSOS}
            disabled={isActive}
            activeOpacity={0.9}
          >
            <Ionicons 
              name="alert-circle" 
              size={60} 
              color={isActive ? "#ef4444" : "#fff"} 
            />
            <Text style={styles.sosButtonText}>
              {isActive ? 'SENDING ALERT...' : 'ACTIVATE SOS'}
            </Text>
          </TouchableOpacity>

          {/* Progress Bar */}
          {isActive && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Recording: {recordingTime}s / 10s
              </Text>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    }
                  ]} 
                />
              </View>
            </View>
          )}
        </View>

        {/* Current Status */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>Current Status</Text>
          <View style={[styles.statusCard, isActive && styles.statusCardActive]}>
            <Ionicons 
              name={isActive ? "radio" : "shield-checkmark"} 
              size={24} 
              color={isActive ? "#ef4444" : "#10b981"} 
            />
            <Text style={[
              styles.statusText,
              isActive && styles.statusTextActive
            ]}>
              {isActive ? `🚨 ${status}` : '✅ System Ready'}
            </Text>
          </View>
        </View>

        {/* Location Display */}
        {location && (
          <View style={styles.locationContainer}>
            <Text style={styles.locationTitle}>📍 Your Location</Text>
            <View style={styles.locationCard}>
              <Ionicons name="location" size={20} color="#3b82f6" />
              <Text style={styles.locationText}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
              <Text style={styles.accuracyText}>
                Accuracy: {location.accuracy ? `${Math.round(location.accuracy)}m` : 'Unknown'}
              </Text>
            </View>
          </View>
        )}

        {/* Status Timeline */}
        <View style={styles.timelineContainer}>
          <Text style={styles.timelineTitle}>Status Timeline</Text>
          {statusTimeline.length > 0 ? (
            <View style={styles.timeline}>
              {statusTimeline.map((event, index) => (
                <View key={event.id} style={styles.timelineItem}>
                  <View style={styles.timelineIconContainer}>
                    <View style={[
                      styles.timelineIcon,
                      { backgroundColor: getStatusColor(event.type) }
                    ]}>
                      <Ionicons 
                        name={getStatusIcon(event.type)} 
                        size={16} 
                        color="#fff" 
                      />
                    </View>
                    {index < statusTimeline.length - 1 && (
                      <View style={styles.timelineLine} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineMessage}>{event.message}</Text>
                    <Text style={styles.timelineTime}>{event.timestamp}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyTimeline}>
              <Ionicons name="time-outline" size={40} color="#d1d5db" />
              <Text style={styles.emptyTimelineText}>
                No events yet. SOS timeline will appear here.
              </Text>
            </View>
          )}
        </View>

        {/* Cancel Button */}
        {isActive && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelSOS}
          >
            <Ionicons name="close-circle" size={20} color="#fff" />
            <Text style={styles.cancelButtonText}>Cancel SOS</Text>
          </TouchableOpacity>
        )}

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>How it works:</Text>
          <View style={styles.instructionItem}>
            <Ionicons name="location-outline" size={18} color="#3b82f6" />
            <Text style={styles.instructionText}>Sends your exact location</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="mic-outline" size={18} color="#3b82f6" />
            <Text style={styles.instructionText}>Records 10 seconds of audio</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="alert-outline" size={18} color="#3b82f6" />
            <Text style={styles.instructionText}>Notifies emergency contacts</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  sosButtonContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  sosPulse: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fee2e2',
    zIndex: 1,
  },
  sosButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sosButtonActive: {
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#ef4444',
  },
  sosButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginTop: 30,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  statusContainer: {
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  statusCardActive: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  statusText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  statusTextActive: {
    color: '#dc2626',
    fontWeight: '600',
  },
  locationContainer: {
    marginBottom: 24,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  locationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#1f2937',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '500',
  },
  accuracyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  timelineContainer: {
    marginBottom: 32,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  timeline: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 32,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
    minHeight: 20,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineMessage: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyTimeline: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTimelineText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6b7280',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: '#f0f9ff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
});