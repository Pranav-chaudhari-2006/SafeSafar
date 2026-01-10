import { View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { useState, useEffect, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { getMyNetwork, getPendingRequests, addToNetwork, acceptRequest, rejectRequest, removeFromNetwork } from '../services/safetyNetworkService';

export default function SafetyNetworkScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('network'); // network, pending
    const [network, setNetwork] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        name: '',
    });

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [networkData, pendingData] = await Promise.all([
                getMyNetwork(user.id),
                getPendingRequests(user.id),
            ]);
            setNetwork(networkData);
            setPendingRequests(pendingData);
        } catch (error) {
            console.error('Error loading network:', error);
            Alert.alert('Error', 'Failed to load safety network');
        } finally {
            setLoading(false);
        }
    };

    const handleAddContact = async () => {
        if (!formData.email.trim() || !formData.name.trim()) {
            Alert.alert('Validation Error', 'Email and name are required');
            return;
        }

        try {
            await addToNetwork(user.id, formData.email, formData.name);
            setModalVisible(false);
            setFormData({ email: '', name: '' });
            loadData();
            Alert.alert('Success', 'Connection request sent');
        } catch (error) {
            console.error('Error adding contact:', error);
            Alert.alert('Error', 'Failed to send connection request');
        }
    };

    const handleAcceptRequest = async (requestId) => {
        try {
            await acceptRequest(requestId, user.id);
            loadData();
            Alert.alert('Success', 'Connection accepted');
        } catch (error) {
            console.error('Error accepting request:', error);
            Alert.alert('Error', 'Failed to accept request');
        }
    };

    const handleRejectRequest = async (requestId) => {
        try {
            await rejectRequest(requestId, user.id);
            loadData();
        } catch (error) {
            console.error('Error rejecting request:', error);
            Alert.alert('Error', 'Failed to reject request');
        }
    };

    const handleRemoveContact = (connection) => {
        Alert.alert(
            'Remove Contact',
            `Remove ${connection.contact_name} from your safety network?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeFromNetwork(connection.id);
                            loadData();
                        } catch (error) {
                            console.error('Error removing contact:', error);
                            Alert.alert('Error', 'Failed to remove contact');
                        }
                    },
                },
            ]
        );
    };

    const renderNetworkMember = ({ item }) => {
        const isMyRequest = item.user_id === user.id;
        const displayName = isMyRequest ? item.contact_name : item.contact_name;
        const displayEmail = isMyRequest ? item.contact_email : item.contact_email;

        return (
            <View style={styles.memberCard}>
                <View style={styles.avatarContainer}>
                    <Ionicons name="person-circle" size={50} color="#8b5cf6" />
                </View>
                <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{displayName}</Text>
                    <Text style={styles.memberEmail}>{displayEmail || 'SafeSafar User'}</Text>
                    <View style={styles.statusBadge}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>Connected</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveContact(item)}
                >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
            </View>
        );
    };

    const renderPendingRequest = ({ item }) => {
        const isIncoming = item.contact_user_id === user.id;
        const displayName = isIncoming ? item.contact_name : item.contact_name;
        const displayEmail = isIncoming ? item.contact_email : item.contact_email;

        return (
            <View style={styles.requestCard}>
                <View style={styles.avatarContainer}>
                    <Ionicons name="person-circle" size={50} color="#f59e0b" />
                </View>
                <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{displayName}</Text>
                    <Text style={styles.memberEmail}>{displayEmail || 'SafeSafar User'}</Text>
                    <Text style={styles.requestType}>
                        {isIncoming ? 'Wants to connect' : 'Pending approval'}
                    </Text>
                </View>
                {isIncoming && (
                    <View style={styles.requestActions}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.acceptButton]}
                            onPress={() => handleAcceptRequest(item.id)}
                        >
                            <Ionicons name="checkmark" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.rejectButton]}
                            onPress={() => handleRejectRequest(item.id)}
                        >
                            <Ionicons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons
                name={activeTab === 'network' ? 'people-outline' : 'time-outline'}
                size={80}
                color="#d1d5db"
            />
            <Text style={styles.emptyTitle}>
                {activeTab === 'network' ? 'No Network Members' : 'No Pending Requests'}
            </Text>
            <Text style={styles.emptyDescription}>
                {activeTab === 'network'
                    ? 'Add trusted contacts to your safety network'
                    : 'No pending connection requests'}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Safety Network</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
                    <Ionicons name="person-add" size={24} color="#8b5cf6" />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'network' && styles.activeTab]}
                    onPress={() => setActiveTab('network')}
                >
                    <Text style={[styles.tabText, activeTab === 'network' && styles.activeTabText]}>
                        My Network ({network.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
                    onPress={() => setActiveTab('pending')}
                >
                    <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
                        Pending ({pendingRequests.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8b5cf6" />
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'network' ? network : pendingRequests}
                    renderItem={activeTab === 'network' ? renderNetworkMember : renderPendingRequest}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={
                        (activeTab === 'network' ? network : pendingRequests).length === 0
                            ? styles.emptyContainer
                            : styles.listContainer
                    }
                    ListEmptyComponent={renderEmptyState}
                />
            )}

            {/* Quick Actions */}
            <View style={styles.quickActions}>
                <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => navigation.navigate('CheckIn')}
                >
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                    <Text style={styles.quickActionText}>Check In</Text>
                </TouchableOpacity>
            </View>

            {/* Add Contact Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add to Network</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter contact name"
                                    value={formData.name}
                                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter email address"
                                    value={formData.email}
                                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <TouchableOpacity style={styles.sendButton} onPress={handleAddContact}>
                                <Text style={styles.sendButtonText}>Send Request</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    addButton: {
        padding: 4,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#8b5cf6',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b7280',
    },
    activeTabText: {
        color: '#8b5cf6',
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
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
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
    requestCard: {
        flexDirection: 'row',
        alignItems: 'center',
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
    avatarContainer: {
        marginRight: 12,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    memberEmail: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
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
        color: '#10b981',
    },
    requestType: {
        fontSize: 12,
        color: '#f59e0b',
        fontStyle: 'italic',
    },
    removeButton: {
        padding: 4,
    },
    requestActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: '#10b981',
    },
    rejectButton: {
        backgroundColor: '#ef4444',
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
    quickActions: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    quickActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8b5cf6',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    quickActionText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    form: {
        padding: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1f2937',
    },
    sendButton: {
        backgroundColor: '#8b5cf6',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    sendButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
