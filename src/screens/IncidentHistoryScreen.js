import { View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView, ActivityIndicator, RefreshControl, Alert, Linking, Modal, ScrollView, Platform } from 'react-native';
import { useState, useEffect, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AuthContext } from '../context/AuthContext';
import { getIncidentHistory, deleteIncident } from '../services/incidentHistoryService';

export default function IncidentHistoryScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [playingAudio, setPlayingAudio] = useState(null);
    const [sound, setSound] = useState(null);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all', 'sos', 'incident'
    const [groupedIncidents, setGroupedIncidents] = useState({});
    const [expandedGroups, setExpandedGroups] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

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

    useEffect(() => {
        groupIncidentsByDate();
    }, [incidents, filter]);

    const loadIncidents = async () => {
        try {
            setLoading(true);
            const data = await getIncidentHistory(user.id);
            console.log('[IncidentHistory] Loaded incidents:', data.length, 'records');
            console.log('[IncidentHistory] Sample data:', data[0]);
            // Sort by date, newest first
            const sortedData = data.sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            );
            setIncidents(sortedData);
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

    const groupIncidentsByDate = () => {
        const filteredIncidents = filter === 'all'
            ? incidents
            : incidents.filter(item => filter === 'sos' ? item.type === 'sos' : item.type !== 'sos');

        const groups = {};

        filteredIncidents.forEach(incident => {
            const date = new Date(incident.created_at);
            const dateKey = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(incident);
        });

        setGroupedIncidents(groups);
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

            // Configure audio mode for better playback
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
            });

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

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDateHeader = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return dateString;
        }
    };

    const getTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now - date;
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInDays < 7) return `${diffInDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const getIncidentIcon = (type) => {
        switch (type) {
            case 'sos':
                return { icon: 'alert-circle', color: '#ef4444', label: 'Emergency SOS' };
            case 'incident_report':
                return { icon: 'document-text', color: '#f59e0b', label: 'Incident Report' };
            default:
                return { icon: 'warning', color: '#6b7280', label: 'Incident' };
        }
    };

    const openInMaps = (latitude, longitude, label = 'Incident Location') => {
        const url = Platform.select({
            ios: `maps://?q=${latitude},${longitude}&z=15`,
            android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
            default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        });

        Linking.openURL(url).catch((err) => {
            console.error('Error opening maps:', err);
            Alert.alert('Error', 'Could not open maps app. Please install Google Maps.');
        });
    };

    const handleViewDetails = (incident) => {
        setSelectedIncident(incident);
        setShowDetailsModal(true);
    };

    const handleShareLocation = async (latitude, longitude, description = 'Incident location') => {
        const url = `https://maps.google.com/?q=${latitude},${longitude}`;
        const message = `Incident Location: ${url}\n\n${description}`;

        try {
            await navigator.share({
                title: 'Incident Location',
                text: message,
            });
        } catch (error) {
            // Fallback to copying to clipboard
            Alert.alert('Location Copied', 'Location link has been copied to clipboard');
        }
    };

    const handleDeleteIncident = (incident) => {
        Alert.alert(
            'Delete Incident',
            `Are you sure you want to delete this ${incident.type === 'sos' ? 'SOS' : 'incident'} record?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteIncident(incident.id, incident.type);
                            loadIncidents();
                            Alert.alert('Deleted', 'Incident record deleted');
                        } catch (error) {
                            console.error('Error deleting incident:', error);
                            Alert.alert('Error', 'Failed to delete incident');
                        }
                    },
                },
            ]
        );
    };

    const toggleGroup = (dateKey) => {
        setExpandedGroups(prev => ({
            ...prev,
            [dateKey]: !prev[dateKey],
        }));
    };

    const renderIncidentItem = (item) => {
        const incidentIcon = getIncidentIcon(item.type);

        return (
            <TouchableOpacity
                style={styles.incidentItem}
                onPress={() => handleViewDetails(item)}
                activeOpacity={0.9}
            >
                <View style={styles.incidentContent}>
                    <View style={[styles.incidentIcon, { backgroundColor: `${incidentIcon.color}20` }]}>
                        <Ionicons name={incidentIcon.icon} size={20} color={incidentIcon.color} />
                    </View>

                    <View style={styles.incidentInfo}>
                        <View style={styles.incidentHeader}>
                            <Text style={styles.incidentType}>{incidentIcon.label}</Text>
                            <Text style={styles.incidentTime}>{getTimeAgo(item.created_at)}</Text>
                        </View>

                        {item.description && (
                            <Text style={styles.incidentDescription} numberOfLines={1}>
                                {item.description}
                            </Text>
                        )}

                        <View style={styles.incidentFooter}>
                            <View style={styles.locationInfo}>
                                <Ionicons name="location" size={12} color="#6b7280" />
                                <Text style={styles.locationText}>
                                    {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
                                </Text>
                            </View>

                            {item.audio_url && (
                                <View style={styles.audioIndicator}>
                                    <Ionicons name="mic" size={12} color="#8b5cf6" />
                                    <Text style={styles.audioText}>Audio</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.quickActions}>
                    {item.audio_url && (
                        <TouchableOpacity
                            style={[styles.quickAction, styles.audioAction]}
                            onPress={() => playAudio(item.audio_url, item.id)}
                        >
                            <Ionicons
                                name={playingAudio === item.id ? 'stop' : 'play'}
                                size={16}
                                color={playingAudio === item.id ? '#fff' : '#8b5cf6'}
                            />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.quickAction, styles.mapAction]}
                        onPress={() => openInMaps(item.latitude, item.longitude)}
                    >
                        <Ionicons name="map" size={16} color="#3b82f6" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const renderGroup = (dateKey, groupIncidents) => {
        const isExpanded = expandedGroups[dateKey] !== false;

        return (
            <View key={dateKey} style={styles.groupContainer}>
                <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => toggleGroup(dateKey)}
                >
                    <Text style={styles.groupTitle}>{formatDateHeader(dateKey)}</Text>
                    <Text style={styles.groupCount}>{groupIncidents.length} incident(s)</Text>
                    <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#6b7280"
                    />
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.groupContent}>
                        {groupIncidents.map(incident => (
                            <View key={incident.id}>
                                {renderIncidentItem(incident)}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
                <Ionicons name="document-text-outline" size={80} color="#dbeafe" />
            </View>
            <Text style={styles.emptyTitle}>No Incident History</Text>
            <Text style={styles.emptyDescription}>
                {filter === 'sos'
                    ? 'Your emergency SOS activations will appear here'
                    : filter === 'incident'
                        ? 'Your incident reports will appear here'
                        : 'Your safety history will appear here'}
            </Text>
            <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => navigation.navigate('ReportIncident')}
            >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.emptyActionText}>Report First Incident</Text>
            </TouchableOpacity>
        </View>
    );

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
                        <Text style={styles.headerTitle}>Safety History</Text>
                        <Text style={styles.headerSubtitle}>Your incident and SOS records</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.refreshButton}
                        onPress={loadIncidents}
                        disabled={loading}
                    >
                        <Ionicons name="refresh" size={22} color="#3b82f6" />
                    </TouchableOpacity>
                </View>

                {/* Filter Tabs */}
                <View style={styles.filterContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterScrollContent}
                    >
                        <TouchableOpacity
                            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                            onPress={() => setFilter('all')}
                        >
                            <Ionicons name="layers" size={16} color={filter === 'all' ? '#fff' : '#6b7280'} />
                            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                                All
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.filterChip, filter === 'sos' && styles.filterChipActive]}
                            onPress={() => setFilter('sos')}
                        >
                            <Ionicons name="alert-circle" size={16} color={filter === 'sos' ? '#fff' : '#ef4444'} />
                            <Text style={[styles.filterText, filter === 'sos' && styles.filterTextActive]}>
                                SOS
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.filterChip, filter === 'incident' && styles.filterChipActive]}
                            onPress={() => setFilter('incident')}
                        >
                            <Ionicons name="document-text" size={16} color={filter === 'incident' ? '#fff' : '#f59e0b'} />
                            <Text style={[styles.filterText, filter === 'incident' && styles.filterTextActive]}>
                                Reports
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* Main Content */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text style={styles.loadingText}>Loading safety history...</Text>
                    </View>
                ) : Object.keys(groupedIncidents).length === 0 ? (
                    <View style={styles.emptyContainer}>
                        {renderEmptyState()}
                    </View>
                ) : (
                    <FlatList
                        data={Object.entries(groupedIncidents)}
                        renderItem={({ item: [dateKey, groupIncidents] }) =>
                            renderGroup(dateKey, groupIncidents)
                        }
                        keyExtractor={([dateKey]) => dateKey}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={['#3b82f6']}
                                tintColor="#3b82f6"
                            />
                        }
                    />
                )}
            </View>

            {/* Incident Details Modal */}
            <Modal
                visible={showDetailsModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowDetailsModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowDetailsModal(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                        style={styles.modalContainer}
                    >
                        {selectedIncident ? (
                            <ScrollView
                                style={styles.modalScrollView}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.modalContent}>
                                    {/* Modal Header */}
                                    <View style={styles.modalHeader}>
                                        <View style={styles.modalTitleRow}>
                                            <View style={[styles.modalIcon, { backgroundColor: `${getIncidentIcon(selectedIncident.type).color}20` }]}>
                                                <Ionicons
                                                    name={getIncidentIcon(selectedIncident.type).icon}
                                                    size={24}
                                                    color={getIncidentIcon(selectedIncident.type).color}
                                                />
                                            </View>
                                            <Text style={styles.modalTitle}>
                                                {getIncidentIcon(selectedIncident.type).label}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.modalCloseButton}
                                            onPress={() => setShowDetailsModal(false)}
                                        >
                                            <Ionicons name="close" size={24} color="#6b7280" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Incident Details */}
                                    <View style={styles.detailsSection}>
                                        <Text style={styles.detailTime}>
                                            {new Date(selectedIncident.created_at).toLocaleString('en-US', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </Text>

                                        {selectedIncident.description && (
                                            <View style={styles.descriptionCard}>
                                                <Text style={styles.descriptionTitle}>Description</Text>
                                                <Text style={styles.descriptionText}>
                                                    {selectedIncident.description}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Location Details */}
                                        <View style={styles.locationCard}>
                                            <View style={styles.sectionHeader}>
                                                <Ionicons name="location" size={20} color="#3b82f6" />
                                                <Text style={styles.sectionTitle}>Location</Text>
                                            </View>
                                            <Text style={styles.coordinates}>
                                                {selectedIncident.latitude?.toFixed(6)}, {selectedIncident.longitude?.toFixed(6)}
                                            </Text>
                                            <View style={styles.locationActions}>
                                                <TouchableOpacity
                                                    style={[styles.detailActionButton, styles.mapButton]}
                                                    onPress={() => openInMaps(selectedIncident.latitude, selectedIncident.longitude)}
                                                >
                                                    <Ionicons name="map" size={18} color="#fff" />
                                                    <Text style={styles.detailActionText}>Open in Maps</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.detailActionButton, styles.shareButton]}
                                                    onPress={() => handleShareLocation(
                                                        selectedIncident.latitude,
                                                        selectedIncident.longitude,
                                                        selectedIncident.description
                                                    )}
                                                >
                                                    <Ionicons name="share" size={18} color="#fff" />
                                                    <Text style={styles.detailActionText}>Share</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Audio Recording */}
                                        {selectedIncident.audio_url && (
                                            <View style={styles.audioCard}>
                                                <View style={styles.sectionHeader}>
                                                    <Ionicons name="mic" size={20} color="#8b5cf6" />
                                                    <Text style={styles.sectionTitle}>Audio Recording</Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={[styles.audioPlayer, playingAudio === selectedIncident.id && styles.audioPlayerActive]}
                                                    onPress={() => playAudio(selectedIncident.audio_url, selectedIncident.id)}
                                                >
                                                    <Ionicons
                                                        name={playingAudio === selectedIncident.id ? 'stop-circle' : 'play-circle'}
                                                        size={32}
                                                        color={playingAudio === selectedIncident.id ? "#ef4444" : "#8b5cf6"}
                                                    />
                                                    <View style={styles.audioInfo}>
                                                        <Text style={styles.audioStatus}>
                                                            {playingAudio === selectedIncident.id ? 'Playing...' : 'Tap to play recording'}
                                                        </Text>
                                                        <Text style={styles.audioDuration}>Emergency audio recording</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* Action Buttons */}
                                        <View style={styles.modalActions}>
                                            <TouchableOpacity
                                                style={[styles.modalActionButton, styles.deleteButton]}
                                                onPress={() => {
                                                    setShowDetailsModal(false);
                                                    handleDeleteIncident(selectedIncident);
                                                }}
                                            >
                                                <Ionicons name="trash" size={20} color="#fff" />
                                                <Text style={styles.deleteButtonText}>Delete Record</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </ScrollView>
                        ) : (
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Loading...</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </TouchableOpacity>
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
    refreshButton: {
        padding: 8,
    },
    filterContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    filterScrollContent: {
        gap: 12,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        gap: 6,
    },
    filterChipActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    filterText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b7280',
    },
    filterTextActive: {
        color: '#fff',
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
    emptyContainer: {
        flex: 1,
    },
    listContainer: {
        paddingBottom: 100,
    },
    groupContainer: {
        marginBottom: 16,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    groupTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    groupCount: {
        fontSize: 14,
        color: '#6b7280',
        marginLeft: 'auto',
        marginRight: 8,
    },
    groupContent: {
        paddingHorizontal: 20,
    },
    incidentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    incidentContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    incidentIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    incidentInfo: {
        flex: 1,
    },
    incidentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    incidentType: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    incidentTime: {
        fontSize: 12,
        color: '#9ca3af',
        fontWeight: '500',
    },
    incidentDescription: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 8,
        lineHeight: 18,
    },
    incidentFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    locationText: {
        fontSize: 12,
        color: '#6b7280',
    },
    audioIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    audioText: {
        fontSize: 12,
        color: '#8b5cf6',
        fontWeight: '500',
    },
    quickActions: {
        flexDirection: 'row',
        gap: 8,
    },
    quickAction: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioAction: {
        backgroundColor: '#f5f3ff',
    },
    mapAction: {
        backgroundColor: '#eff6ff',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#f0f9ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyDescription: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        maxWidth: 280,
        marginBottom: 32,
        lineHeight: 20,
    },
    emptyActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3b82f6',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    emptyActionText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
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
        maxHeight: '85%',
    },
    modalScrollView: {
        // Removed flex: 1 to allow proper scrolling
    },
    modalContent: {
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    modalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    modalCloseButton: {
        padding: 4,
    },
    detailsSection: {
        padding: 24,
    },
    detailTime: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 24,
        textAlign: 'center',
    },
    descriptionCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    descriptionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    descriptionText: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 22,
    },
    locationCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    coordinates: {
        fontSize: 14,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        color: '#3b82f6',
        marginBottom: 16,
    },
    locationActions: {
        flexDirection: 'row',
        gap: 12,
    },
    detailActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
    },
    mapButton: {
        backgroundColor: '#3b82f6',
    },
    shareButton: {
        backgroundColor: '#10b981',
    },
    detailActionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    audioCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    audioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    audioPlayerActive: {
        backgroundColor: '#f5f3ff',
        borderColor: '#8b5cf6',
    },
    audioInfo: {
        flex: 1,
    },
    audioStatus: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
    },
    audioDuration: {
        fontSize: 13,
        color: '#6b7280',
    },
    modalActions: {
        marginTop: 8,
    },
    modalActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 12,
    },
    deleteButton: {
        backgroundColor: '#ef4444',
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});