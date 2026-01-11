import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Image, Vibration, Animated, Dimensions, Platform, Easing } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { generateFakeCallScript, DEFAULT_FAKE_CALL_SCRIPT } from '../services/fakeCallService';
import { speakText, stopSpeech } from '../services/ttsService';

const { width, height } = Dimensions.get('window');
const RINGTONE_FILE = require('../../assets/audio/iphone-ringtone.mpeg');

export default function FakeCallScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState(DEFAULT_FAKE_CALL_SCRIPT);
  const [status, setStatus] = useState('idle'); // idle | ringing | inCall
  const [callDuration, setCallDuration] = useState(0);
  const ringtoneRef = useRef(null);
  const timerRef = useRef(null);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const ringtoneAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      interruptionModeIOS: 2,
      interruptionModeAndroid: 1,
    }).catch(err => console.warn('Audio mode setup failed', err?.message));

    return () => {
      stopRingtone();
      stopSpeech();
      Vibration.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status === 'ringing') {
      startPulseAnimation();
      startRingtoneAnimation();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      pulseAnim.setValue(1);
      ringtoneAnim.setValue(0);
    }

    if (status === 'inCall') {
      startCallTimer();
      startWaveAnimation();
    } else {
      stopCallTimer();
      waveAnim.setValue(0);
    }
  }, [status]);

  useEffect(() => {
    if (script && status === 'ringing') {
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    } else {
      textOpacity.setValue(0);
    }
  }, [script, status]);

  const startCallTimer = () => {
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0, 0.2, 1)
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0, 0.2, 1)
        }),
      ])
    ).start();
  };

  const startRingtoneAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringtoneAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(ringtoneAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startWaveAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0, 0.2, 1)
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0, 0.2, 1)
        }),
      ])
    ).start();
  };

  const buttonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const buttonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  async function startRingtone() {
    try {
      await stopRingtone();
      const { sound } = await Audio.Sound.createAsync(
        RINGTONE_FILE,
        { isLooping: true, volume: 1.0 }
      );
      ringtoneRef.current = sound;
      await sound.playAsync();
      Vibration.vibrate([0, 300, 200, 300, 700], true);
    } catch (err) {
      console.error('Ringtone failed:', err?.message);
    }
  }

  async function stopRingtone() {
    try {
      Vibration.cancel();
      if (ringtoneRef.current) {
        await ringtoneRef.current.stopAsync();
        await ringtoneRef.current.unloadAsync();
        ringtoneRef.current = null;
      }
    } catch (err) {
      console.warn('Stop ringtone failed', err?.message);
    }
  }

  async function prepareFakeCall() {
    try {
      setLoading(true);
      setScript('');

      const text = await generateFakeCallScript(DEFAULT_FAKE_CALL_SCRIPT);
      const finalScript = text || DEFAULT_FAKE_CALL_SCRIPT;
      setScript(finalScript);

      setStatus('ringing');
      await startRingtone();
    } catch (error) {
      console.error('Failed to prepare fake call:', error);
      alert(error.message || 'Failed to prepare fake call');
      setStatus('idle');
      await stopRingtone();
    } finally {
      setLoading(false);
    }
  }

  async function acceptCall() {
    if (status !== 'ringing') return;
    setStatus('inCall');
    await stopRingtone();
    Vibration.cancel();

    try {
      const text = script || DEFAULT_FAKE_CALL_SCRIPT;
      const success = await speakText(text, {
        pitch: 0.70,
        rate: 0.85,
        onDone: () => {
          setTimeout(() => declineCall(), 800);
        },
        onError: (error) => {
          console.error('Speech error:', error);
          declineCall();
        }
      });

      if (!success) {
        alert('Text-to-Speech is not available on this device.');
        declineCall();
      }
    } catch (e) {
      console.error('Accept call error:', e?.message || e);
      declineCall();
    }
  }

  function declineCall() {
    stopSpeech();
    stopRingtone();
    Vibration.cancel();
    setStatus('idle');
    pulseAnim.setValue(1);
  }

  const renderStatusIndicator = () => {
    switch (status) {
      case 'ringing':
        return (
          <View style={styles.statusIndicator}>
            <Animated.View style={[
              styles.ringtoneDot,
              {
                opacity: ringtoneAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1]
                })
              }
            ]} />
            <Text style={styles.statusText}>Incoming Call • Ringing</Text>
          </View>
        );
      case 'inCall':
        return (
          <View style={styles.statusIndicator}>
            <Animated.View style={[
              styles.callWave,
              {
                transform: [{
                  scale: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.3]
                  })
                }],
                opacity: waveAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0]
                })
              }
            ]} />
            <Text style={[styles.statusText, styles.activeCallText]}>
              Call in progress • {formatDuration(callDuration)}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Fake Call Generator</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Main Call Button */}
        <View style={styles.sosButtonContainer}>
          <Animated.View
            style={[
              styles.sosPulse,
              {
                transform: [{ scale: pulseAnim }],
                opacity: status === 'ringing' ? 0.6 : 0,
              }
            ]}
          />

          <TouchableOpacity
            style={[
              styles.sosButton,
              (status === 'ringing' || status === 'inCall') && styles.sosButtonActive,
            ]}
            onPress={prepareFakeCall}
            onLongPress={prepareFakeCall}
            disabled={loading || status !== 'idle'}
            activeOpacity={0.9}
          >
            <Ionicons
              name="call"
              size={60}
              color={(status === 'ringing' || status === 'inCall') ? "#ef4444" : "#fff"}
            />
            <Text style={styles.sosButtonText}>
              {loading ? 'PREPARING...' : 
               status === 'ringing' ? 'RINGING...' :
               status === 'inCall' ? 'ON CALL...' : 'START FAKE CALL'}
            </Text>
          </TouchableOpacity>

          {/* Status Indicator */}
          {renderStatusIndicator()}
        </View>

        {/* Call Interface */}
        {(status === 'ringing' || status === 'inCall') && (
          <Animated.View 
            style={[
              styles.callInterface,
              { opacity: fadeAnim }
            ]}
          >
            <View style={styles.callCard}>
              <View style={styles.callHeader}>
                <View style={styles.callerInfo}>
                  <View style={styles.avatarContainer}>
                    <Image
                      source={{ uri: 'https://i.pravatar.cc/300?img=12' }}
                      style={styles.avatar}
                    />
                    {status === 'inCall' && (
                      <Animated.View style={[
                        styles.soundWave,
                        {
                          transform: [{
                            scale: waveAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.2]
                            })
                          }],
                          opacity: waveAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 0]
                          })
                        }
                      ]} />
                    )}
                  </View>
                  <View style={styles.callerDetails}>
                    <Text style={styles.callerName}>Dad</Text>
                    <Text style={styles.callerRelationship}>Father • Mobile</Text>
                    {status === 'inCall' && (
                      <Text style={styles.callDuration}>{formatDuration(callDuration)}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.callStatus}>
                  <Ionicons 
                    name={status === 'ringing' ? 'call-outline' : 'call'} 
                    size={24} 
                    color={status === 'ringing' ? '#3b82f6' : '#10b981'} 
                  />
                </View>
              </View>

              <Text style={styles.callDescription}>
                {status === 'ringing' ? 
                  'Incoming fake call to help you exit uncomfortable situations' : 
                  'Playing pre-recorded message with male voice'}
              </Text>

              {status === 'ringing' ? (
                <View style={styles.callActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.declineButton]}
                    onPress={declineCall}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                    <Text style={styles.actionButtonText}>Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={acceptCall}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call" size={28} color="#fff" />
                    <Text style={styles.actionButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.endCallButton}
                  onPress={declineCall}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.endCallText}>End Call</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Script Preview */}
            <Animated.View
              style={[
                styles.scriptContainer,
                { opacity: textOpacity }
              ]}
            >
              <Text style={styles.scriptTitle}>Script Preview</Text>
              <Text style={styles.scriptText} numberOfLines={3}>
                "{script.length > 100 ? `${script.substring(0, 100)}...` : script}"
              </Text>
            </Animated.View>
          </Animated.View>
        )}

        {/* Quick Actions */}
        {status === 'idle' && (
          <View style={styles.quickActionsContainer}>
            <Text style={styles.quickActionsTitle}>Quick Scenarios</Text>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity
                style={[styles.quickActionButton, styles.emergencyButton]}
                onPress={prepareFakeCall}
                disabled={loading}
              >
                <Ionicons name="flash" size={28} color="#f59e0b" />
                <Text style={styles.quickActionLabel}>Emergency Exit</Text>
                <Text style={styles.quickActionSubtext}>Urgent situation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionButton, styles.dateButton]}
                onPress={prepareFakeCall}
                disabled={loading}
              >
                <Ionicons name="calendar" size={28} color="#3b82f6" />
                <Text style={styles.quickActionLabel}>Date Rescue</Text>
                <Text style={styles.quickActionSubtext}>Uncomfortable date</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionButton, styles.meetingButton]}
                onPress={prepareFakeCall}
                disabled={loading}
              >
                <Ionicons name="people" size={28} color="#8b5cf6" />
                <Text style={styles.quickActionLabel}>Meeting Escape</Text>
                <Text style={styles.quickActionSubtext}>Long meetings</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>How it works:</Text>
          <View style={styles.instructionItem}>
            <Ionicons name="call-outline" size={18} color="#3b82f6" />
            <Text style={styles.instructionText}>Simulates realistic incoming call</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="mic-outline" size={18} color="#3b82f6" />
            <Text style={styles.instructionText}>Plays pre-recorded voice message</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="exit-outline" size={18} color="#3b82f6" />
            <Text style={styles.instructionText}>Helps you exit uncomfortable situations</Text>
          </View>
        </View>

        {/* Status Timeline */}
        {(status === 'ringing' || status === 'inCall') && (
          <View style={styles.timelineContainer}>
            <Text style={styles.timelineTitle}>Call Status</Text>
            <View style={styles.timeline}>
              <View style={styles.timelineItem}>
                <View style={[styles.timelineIcon, { backgroundColor: status !== 'idle' ? '#10b981' : '#6b7280' }]}>
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color="#fff"
                  />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineMessage}>Call prepared and script generated</Text>
                  <Text style={styles.timelineTime}>Just now</Text>
                </View>
              </View>
              
              <View style={styles.timelineItem}>
                <View style={[styles.timelineIcon, { backgroundColor: status === 'ringing' || status === 'inCall' ? '#10b981' : '#6b7280' }]}>
                  <Ionicons
                    name="call-outline"
                    size={16}
                    color="#fff"
                  />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineMessage}>Call initiated and ringing</Text>
                  <Text style={styles.timelineTime}>Just now</Text>
                </View>
              </View>
              
              {status === 'inCall' && (
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineIcon, { backgroundColor: '#10b981' }]}>
                    <Ionicons
                      name="volume-high"
                      size={16}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineMessage}>Playing voice message</Text>
                    <Text style={styles.timelineTime}>In progress</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 20,
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
    backgroundColor: '#06b6d4',
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
  statusIndicator: {
    alignItems: 'center',
    marginTop: 20,
  },
  ringtoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginBottom: 8,
  },
  callWave: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeCallText: {
    color: '#10b981',
  },
  callInterface: {
    marginBottom: 24,
  },
  callCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  callerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  soundWave: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#10b981',
    top: -5,
    left: -5,
  },
  callerDetails: {
    flex: 1,
  },
  callerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  callerRelationship: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  callDuration: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  callStatus: {
    padding: 8,
  },
  callDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 24,
  },
  callActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  declineButton: {
    backgroundColor: '#ef4444',
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  endCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },
  endCallText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scriptContainer: {
    marginTop: 20,
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scriptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  scriptText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emergencyButton: {
    borderColor: '#fef3c7',
    backgroundColor: '#fffbeb',
  },
  dateButton: {
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
  },
  meetingButton: {
    borderColor: '#f3e8ff',
    backgroundColor: '#faf5ff',
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  quickActionSubtext: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'center',
  },
  instructionsContainer: {
    backgroundColor: '#f0f9ff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginBottom: 24,
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
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    zIndex: 2,
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
});