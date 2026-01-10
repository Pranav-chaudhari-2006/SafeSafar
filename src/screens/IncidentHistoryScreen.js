import { View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { useState, useEffect, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { AuthContext } from '../context/AuthContext';
import { getIncidentHistory } from '../services/incidentHistoryService';

export default function IncidentHistoryScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [playingAudio, setPlayingAudio] = useState(null);
    const [sound, setSound] = useState(null);

    useEffect(() => {
        if (user) {
            loadIncidents();
        }

        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [user]);

    const loadIncidents = async () => {
        try {
            setLoading(true);
            const data = await getIncidentHistory(user.id);
            setIncidents(data);
        } catch (error) {
            console.error('Error loading incidents:', error);
            Alert.alert('Error', 'Failed to load incident history');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadIncidents();
        setRefreshing(false);
    };

    const playAudio = async (audioUrl, incidentId) => {
        try {
            // Stop any currently playing audio
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
                if (playingAudio === incidentId) {
                    setPlayingAudio(null);
                    return;
                }
            }

            console.log('[Audio] Loading audio from:', audioUrl);

            // Use createAsync instead of createFromURI
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: audioUrl },
                { shouldPlay: true }
            );

            setSound(newSound);
            setPlayingAudio(incidentId);

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setPlayingAudio(null);
                    newSound.unloadAsync();
                    setSound(null);
                }
            });
        } catch (error) {
            console.error('Error playing audio:', error);
            Alert.alert('Error', 'Failed to play audio recording');
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now - date;
        const diffInHours = diffInMs / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
            });
        } else if (diffInHours < 48) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        }
    };

    const formatLocation = (latitude, longitude) => {
        if (!latitude || !longitude) return 'Location unavailable';
        return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    };

    const openInMaps = (latitude, longitude) => {
        const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        Linking.openURL(url).catch((err) => {
            console.error('Error opening maps:', err);
            Alert.alert('Error', 'Could not open maps');
        });
    };

    const renderIncident = ({ item }) => (
        <View style={styles.incidentCard}>
            <View style={styles.incidentHeader}>
                <View style={styles.iconContainer}>
                    <Ionicons name="alert-circle" size={24} color="#ef4444" />
                </View>
                <View style={styles.incidentInfo}>
                    <Text style={styles.incidentTitle}>Emergency SOS</Text>
                    <Text style={styles.incidentDate}>{formatDate(item.created_at)}</Text>
                </View>
                <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Recorded</Text>
                </View>
            </View>

            <View style={styles.incidentDetails}>
                <View style={styles.detailRow}>
                    <Ionicons name="location" size={16} color="#6b7280" />
                    <Text style={styles.detailText}>{formatLocation(item.latitude, item.longitude)}</Text>
                </View>

                <View style={styles.detailRow}>
                    <Ionicons name="time" size={16} color="#6b7280" />
                    <Text style={styles.detailText}>
                        {new Date(item.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </Text>
                </View>
            </View>

            <View style={styles.incidentActions}>
                {item.audio_url && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.audioButton]}
                        onPress={() => playAudio(item.audio_url, item.id)}
                    >
                        <Ionicons
                            name={playingAudio === item.id ? 'stop-circle' : 'play-circle'}
                            size={20}
                            color="#fff"
                        />
                        <Text style={styles.actionButtonText}>
                            {playingAudio === item.id ? 'Stop Audio' : 'Play Audio'}
                        </Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.actionButton, styles.locationButton]}
                    onPress={() => openInMaps(item.latitude, item.longitude)}
                >
                    <Ionicons name="map" size={20} color="#3b82f6" />
                    <Text style={[styles.actionButtonText, { color: '#3b82f6' }]}>View Map</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={80} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No Incident History</Text>
            <Text style={styles.emptyDescription}>
                Your emergency SOS activations will appear here
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Incident History</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : (
                <FlatList
                    data={incidents}
                    renderItem={renderIncident}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={incidents.length === 0 ? styles.emptyContainer : styles.listContainer}
                    ListEmptyComponent={renderEmptyState}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
                    }
                />
            )}
        </SafeAreaView>
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
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
    },
    incidentCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    incidentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    incidentInfo: {
        flex: 1,
    },
    incidentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    incidentDate: {
        fontSize: 14,
        color: '#6b7280',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#10b981',
    },
    incidentDetails: {
        marginBottom: 12,
        paddingLeft: 60,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 8,
    },
    detailText: {
        fontSize: 14,
        color: '#6b7280',
    },
    incidentActions: {
        flexDirection: 'row',
        gap: 8,
        paddingLeft: 60,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 4,
        flex: 1,
    },
    audioButton: {
        backgroundColor: '#8b5cf6',
    },
    locationButton: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#3b82f6',
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyDescription: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
});
