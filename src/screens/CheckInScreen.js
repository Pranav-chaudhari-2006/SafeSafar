import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import { createCheckIn, getMyCheckIns, getNetworkCheckIns } from '../services/checkInService';

export default function CheckInScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [myCheckIns, setMyCheckIns] = useState([]);
    const [networkCheckIns, setNetworkCheckIns] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    useEffect(() => {
        if (user) {
            loadCheckIns();
        }
    }, [user]);

    const loadCheckIns = async () => {
        try {
            setLoadingHistory(true);
            const [myData, networkData] = await Promise.all([
                getMyCheckIns(user.id, 5),
                getNetworkCheckIns(user.id, 10),
            ]);
            setMyCheckIns(myData);
            setNetworkCheckIns(networkData);
        } catch (error) {
            console.error('Error loading check-ins:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleCheckIn = async (status) => {
        try {
            setLoading(true);

            // Get current location
            const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
            let location = null;

            if (locationStatus === 'granted') {
                const currentLocation = await Location.getCurrentPositionAsync({});
                location = {
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                };
            }

            await createCheckIn(user.id, status, message || null, location);

            setMessage('');
            loadCheckIns();

            const statusMessages = {
                safe: "You've checked in as safe!",
                help_needed: 'Help request sent to your network!',
                checking_in: 'Check-in sent to your network!',
            };

            Alert.alert('Success', statusMessages[status]);
        } catch (error) {
            console.error('Error creating check-in:', error);
            Alert.alert('Error', 'Failed to send check-in');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'safe':
                return '#10b981';
            case 'help_needed':
                return '#ef4444';
            case 'checking_in':
                return '#f59e0b';
            default:
                return '#6b7280';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'safe':
                return 'checkmark-circle';
            case 'help_needed':
                return 'alert-circle';
            case 'checking_in':
                return 'time';
            default:
                return 'information-circle';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'safe':
                return "I'm Safe";
            case 'help_needed':
                return 'Need Help';
            case 'checking_in':
                return 'Checking In';
            default:
                return status;
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now - date;
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;

        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    };

    const CheckInButton = ({ icon, title, status, color }) => (
        <TouchableOpacity
            style={[styles.checkInButton, { backgroundColor: color }]}
            onPress={() => handleCheckIn(status)}
            disabled={loading}
        >
            <Ionicons name={icon} size={32} color="#fff" />
            <Text style={styles.checkInButtonText}>{title}</Text>
        </TouchableOpacity>
    );

    const CheckInItem = ({ item, showUser = false }) => (
        <View style={styles.checkInItem}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]}>
                <Ionicons name={getStatusIcon(item.status)} size={20} color="#fff" />
            </View>
            <View style={styles.checkInContent}>
                {showUser && (
                    <Text style={styles.checkInUser}>Network Member</Text>
                )}
                <Text style={styles.checkInStatus}>{getStatusLabel(item.status)}</Text>
                {item.message && (
                    <Text style={styles.checkInMessage}>{item.message}</Text>
                )}
                <Text style={styles.checkInTime}>{formatTime(item.created_at)}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Check In</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Quick Check-In Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Check-In</Text>
                    <Text style={styles.sectionDescription}>
                        Let your safety network know your status
                    </Text>

                    <View style={styles.checkInButtons}>
                        <CheckInButton
                            icon="checkmark-circle"
                            title="I'm Safe"
                            status="safe"
                            color="#10b981"
                        />
                        <CheckInButton
                            icon="alert-circle"
                            title="Need Help"
                            status="help_needed"
                            color="#ef4444"
                        />
                        <CheckInButton
                            icon="time"
                            title="Checking In"
                            status="checking_in"
                            color="#f59e0b"
                        />
                    </View>

                    {/* Optional Message */}
                    <View style={styles.messageContainer}>
                        <Text style={styles.label}>Add a message (optional)</Text>
                        <TextInput
                            style={styles.messageInput}
                            placeholder="e.g., At the mall, heading home soon"
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                </View>

                {/* My Recent Check-Ins */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>My Recent Check-Ins</Text>
                    {loadingHistory ? (
                        <ActivityIndicator color="#8b5cf6" />
                    ) : myCheckIns.length > 0 ? (
                        myCheckIns.map((item) => (
                            <CheckInItem key={item.id} item={item} />
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No check-ins yet</Text>
                    )}
                </View>

                {/* Network Check-Ins */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Network Updates</Text>
                    {loadingHistory ? (
                        <ActivityIndicator color="#8b5cf6" />
                    ) : networkCheckIns.length > 0 ? (
                        networkCheckIns.map((item) => (
                            <CheckInItem key={item.id} item={item} showUser={true} />
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No network updates</Text>
                    )}
                </View>
            </ScrollView>
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
    scrollView: {
        flex: 1,
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
    },
    checkInButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    checkInButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    checkInButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
    },
    messageContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    messageInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1f2937',
        textAlignVertical: 'top',
    },
    checkInItem: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    statusIndicator: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    checkInContent: {
        flex: 1,
    },
    checkInUser: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 2,
    },
    checkInStatus: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    checkInMessage: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
    },
    checkInTime: {
        fontSize: 12,
        color: '#9ca3af',
    },
    emptyText: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
        paddingVertical: 20,
    },
});
