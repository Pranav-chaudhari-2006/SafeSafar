import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, TextInput, Modal, Linking, SafeAreaView, ActivityIndicator, ScrollView, Platform, Share } from 'react-native';
import { useState, useEffect, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { getEmergencyContacts, addEmergencyContact, updateEmergencyContact, deleteEmergencyContact, setPrimaryContact } from '../services/emergencyContactsService';

export default function EmergencyContactsScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        phone_number: '',
        relationship: 'family',
        is_primary: false,
        note: '',
    });
    const [showImportOptions, setShowImportOptions] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [selectionMode, setSelectionMode] = useState(false);

    const RELATIONSHIP_OPTIONS = [
        { id: 'family', label: 'Family', icon: 'people', color: '#ef4444' },
        { id: 'friend', label: 'Friend', icon: 'person', color: '#3b82f6' },
        { id: 'colleague', label: 'Colleague', icon: 'briefcase', color: '#8b5cf6' },
        { id: 'partner', label: 'Partner', icon: 'heart', color: '#ec4899' },
        { id: 'neighbor', label: 'Neighbor', icon: 'home', color: '#10b981' },
        { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#6b7280' },
    ];

    const EMERGENCY_SERVICES = [
        { name: 'Police', number: '100', icon: 'shield', color: '#3b82f6' },
        { name: 'Ambulance', number: '102', icon: 'medkit', color: '#ef4444' },
        { name: 'Fire Brigade', number: '101', icon: 'flame', color: '#f59e0b' },
        { name: 'Women\'s Helpline', number: '1091', icon: 'female', color: '#ec4899' },
        { name: 'Child Helpline', number: '1098', icon: 'child', color: '#10b981' },
        { name: 'Disaster Management', number: '108', icon: 'warning', color: '#8b5cf6' },
    ];

    useEffect(() => {
        if (user) {
            loadContacts();
        }
    }, [user]);

    const loadContacts = async () => {
        try {
            setLoading(true);
            const data = await getEmergencyContacts(user.id);
            setContacts(data);
        } catch (error) {
            console.error('Error loading contacts:', error);
            Alert.alert('Error', 'Failed to load emergency contacts');
        } finally {
            setLoading(false);
        }
    };

    const validatePhoneNumber = (phone) => {
        const phoneRegex = /^[0-9]{10}$/;
        return phoneRegex.test(phone.replace(/\D/g, ''));
    };

    const handleAddContact = () => {
        setEditingContact(null);
        setFormData({
            name: '',
            phone_number: '',
            relationship: 'family',
            is_primary: false,
            note: '',
        });
        setModalVisible(true);
    };

    const handleEditContact = (contact) => {
        setEditingContact(contact);
        setFormData({
            name: contact.name,
            phone_number: contact.phone_number,
            relationship: contact.relationship || 'family',
            is_primary: contact.is_primary,
            note: contact.note || '',
        });
        setModalVisible(true);
    };

    const handleSaveContact = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Validation Error', 'Name is required');
            return;
        }

        if (!formData.phone_number.trim()) {
            Alert.alert('Validation Error', 'Phone number is required');
            return;
        }

        if (!validatePhoneNumber(formData.phone_number)) {
            Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number');
            return;
        }

        try {
            const contactData = {
                ...formData,
                phone_number: formData.phone_number.replace(/\D/g, ''),
            };

            if (editingContact) {
                await updateEmergencyContact(editingContact.id, contactData);
            } else {
                await addEmergencyContact(user.id, contactData);
            }
            
            setModalVisible(false);
            loadContacts();
            
            Alert.alert(
                'Success',
                editingContact ? 'Contact updated successfully' : 'Contact added successfully',
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error saving contact:', error);
            Alert.alert('Error', 'Failed to save contact');
        }
    };

    const handleDeleteContact = (contact) => {
        Alert.alert(
            'Delete Contact',
            `Are you sure you want to delete ${contact.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteEmergencyContact(contact.id);
                            loadContacts();
                            Alert.alert('Deleted', 'Contact removed successfully');
                        } catch (error) {
                            console.error('Error deleting contact:', error);
                            Alert.alert('Error', 'Failed to delete contact');
                        }
                    },
                },
            ]
        );
    };

    const handleSetPrimary = async (contact) => {
        try {
            await setPrimaryContact(user.id, contact.id);
            loadContacts();
        } catch (error) {
            console.error('Error setting primary contact:', error);
            Alert.alert('Error', 'Failed to set primary contact');
        }
    };

    const handleCall = (phoneNumber) => {
        Linking.openURL(`tel:${phoneNumber}`).catch(() => {
            Alert.alert('Error', 'Unable to make a call');
        });
    };

    const handleMessage = (phoneNumber, name) => {
        const message = `Emergency Alert: This is an automated message from SafeSafar. I'm in an emergency situation and need immediate assistance. My current location is being shared with you.`;
        
        const url = Platform.select({
            ios: `sms:${phoneNumber}&body=${encodeURIComponent(message)}`,
            android: `sms:${phoneNumber}?body=${encodeURIComponent(message)}`,
        });

        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Unable to send message');
        });
    };

    const handleShareAll = async () => {
        if (contacts.length === 0) {
            Alert.alert('No Contacts', 'Add emergency contacts first');
            return;
        }

        const contactsText = contacts.map(contact => 
            `• ${contact.name}: ${contact.phone_number} (${contact.relationship || 'Emergency Contact'})`
        ).join('\n');

        const shareContent = `🚨 My Emergency Contacts:\n\n${contactsText}\n\nShared via SafeSafar`;

        try {
            await Share.share({
                message: shareContent,
                title: 'My Emergency Contacts',
            });
        } catch (error) {
            console.error('Error sharing contacts:', error);
        }
    };

    const handleToggleSelection = (contact) => {
        if (selectedContacts.includes(contact.id)) {
            setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
        } else {
            setSelectedContacts([...selectedContacts, contact.id]);
        }
    };

    const handleBulkDelete = () => {
        if (selectedContacts.length === 0) return;

        Alert.alert(
            'Delete Selected',
            `Delete ${selectedContacts.length} contact(s)?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Implement bulk delete logic here
                            for (const id of selectedContacts) {
                                await deleteEmergencyContact(id);
                            }
                            setSelectedContacts([]);
                            setSelectionMode(false);
                            loadContacts();
                        } catch (error) {
                            console.error('Error deleting contacts:', error);
                            Alert.alert('Error', 'Failed to delete contacts');
                        }
                    },
                },
            ]
        );
    };

    const getRelationshipIcon = (relationship) => {
        const rel = RELATIONSHIP_OPTIONS.find(r => r.id === relationship);
        return rel?.icon || 'person';
    };

    const getRelationshipColor = (relationship) => {
        const rel = RELATIONSHIP_OPTIONS.find(r => r.id === relationship);
        return rel?.color || '#6b7280';
    };

    const renderEmergencyService = (service) => (
        <TouchableOpacity
            key={service.number}
            style={[styles.serviceCard, { borderLeftColor: service.color }]}
            onPress={() => handleCall(service.number)}
        >
            <View style={[styles.serviceIcon, { backgroundColor: `${service.color}20` }]}>
                <Ionicons name={service.icon} size={24} color={service.color} />
            </View>
            <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceNumber}>{service.number}</Text>
            </View>
            <TouchableOpacity
                style={[styles.callServiceButton, { backgroundColor: service.color }]}
                onPress={() => handleCall(service.number)}
            >
                <Ionicons name="call" size={20} color="#fff" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const renderContact = ({ item }) => {
        const isSelected = selectedContacts.includes(item.id);
        const relationshipIcon = getRelationshipIcon(item.relationship);
        const relationshipColor = getRelationshipColor(item.relationship);

        return (
            <TouchableOpacity
                style={[
                    styles.contactCard,
                    isSelected && styles.contactCardSelected,
                    item.is_primary && styles.primaryContactCard,
                ]}
                onLongPress={() => {
                    setSelectionMode(true);
                    handleToggleSelection(item);
                }}
                delayLongPress={500}
            >
                {selectionMode && (
                    <TouchableOpacity
                        style={styles.selectionCheckbox}
                        onPress={() => handleToggleSelection(item)}
                    >
                        <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={24}
                            color={isSelected ? "#3b82f6" : "#9ca3af"}
                        />
                    </TouchableOpacity>
                )}

                <View style={styles.contactContent}>
                    <View style={styles.contactHeader}>
                        <View style={[styles.contactIcon, { backgroundColor: relationshipColor }]}>
                            <Ionicons name={relationshipIcon} size={20} color="#fff" />
                        </View>
                        <View style={styles.contactInfo}>
                            <View style={styles.nameRow}>
                                <Text style={styles.contactName}>{item.name}</Text>
                                {item.is_primary && (
                                    <View style={styles.primaryBadge}>
                                        <Ionicons name="star" size={12} color="#f59e0b" />
                                        <Text style={styles.primaryText}>Primary</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.contactPhone}>{formatPhoneNumber(item.phone_number)}</Text>
                            {item.relationship && (
                                <Text style={styles.contactRelationship}>
                                    {RELATIONSHIP_OPTIONS.find(r => r.id === item.relationship)?.label || 'Contact'}
                                </Text>
                            )}
                            {item.note && (
                                <Text style={styles.contactNote} numberOfLines={1}>{item.note}</Text>
                            )}
                        </View>
                    </View>

                    {!selectionMode && (
                        <View style={styles.contactActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.callButton]}
                                onPress={() => handleCall(item.phone_number)}
                            >
                                <Ionicons name="call" size={18} color="#fff" />
                                <Text style={styles.actionButtonText}>Call</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.messageButton]}
                                onPress={() => handleMessage(item.phone_number, item.name)}
                            >
                                <Ionicons name="chatbubble" size={18} color="#fff" />
                                <Text style={styles.actionButtonText}>Message</Text>
                            </TouchableOpacity>

                            <View style={styles.secondaryActions}>
                                {!item.is_primary && (
                                    <TouchableOpacity
                                        style={[styles.smallActionButton, styles.primaryButton]}
                                        onPress={() => handleSetPrimary(item)}
                                    >
                                        <Ionicons name="star-outline" size={16} color="#f59e0b" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={[styles.smallActionButton, styles.editButton]}
                                    onPress={() => handleEditContact(item)}
                                >
                                    <Ionicons name="create-outline" size={16} color="#3b82f6" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.smallActionButton, styles.deleteButton]}
                                    onPress={() => handleDeleteContact(item)}
                                >
                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const formatPhoneNumber = (phone) => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
        }
        return phone;
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
                <Ionicons name="people-circle-outline" size={80} color="#dbeafe" />
            </View>
            <Text style={styles.emptyTitle}>No Emergency Contacts Yet</Text>
            <Text style={styles.emptyDescription}>
                Add trusted contacts who will be notified during emergencies
            </Text>
            <TouchableOpacity style={styles.addFirstButton} onPress={handleAddContact}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addFirstButtonText}>Add Your First Contact</Text>
            </TouchableOpacity>
        </View>
    );

    const getRelationshipIconById = (id) => {
        const relationship = RELATIONSHIP_OPTIONS.find(r => r.id === id);
        return relationship?.icon || 'person';
    };

    const getRelationshipColorById = (id) => {
        const relationship = RELATIONSHIP_OPTIONS.find(r => r.id === id);
        return relationship?.color || '#6b7280';
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
                        <Text style={styles.headerTitle}>Emergency Contacts</Text>
                        <Text style={styles.headerSubtitle}>Quick access to help</Text>
                    </View>
                    <View style={styles.headerActions}>
                        {selectionMode ? (
                            <>
                                <TouchableOpacity 
                                    style={styles.headerActionButton}
                                    onPress={() => {
                                        setSelectionMode(false);
                                        setSelectedContacts([]);
                                    }}
                                >
                                    <Ionicons name="close" size={22} color="#6b7280" />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.headerActionButton, selectedContacts.length === 0 && styles.headerActionButtonDisabled]}
                                    onPress={handleBulkDelete}
                                    disabled={selectedContacts.length === 0}
                                >
                                    <Ionicons name="trash" size={22} color={selectedContacts.length > 0 ? "#ef4444" : "#9ca3af"} />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity 
                                    style={styles.headerActionButton}
                                    onPress={handleShareAll}
                                    disabled={contacts.length === 0}
                                >
                                    <Ionicons name="share-social" size={22} color={contacts.length > 0 ? "#3b82f6" : "#9ca3af"} />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={styles.headerActionButton}
                                    onPress={handleAddContact}
                                >
                                    <Ionicons name="add-circle" size={28} color="#3b82f6" />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                    <Text style={styles.sectionTitle}>Emergency Services</Text>
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        style={styles.servicesScroll}
                        contentContainerStyle={styles.servicesScrollContent}
                    >
                        {EMERGENCY_SERVICES.map(renderEmergencyService)}
                    </ScrollView>
                </View>

                {/* Primary Contact */}
                {contacts.some(c => c.is_primary) && (
                    <View style={styles.primarySection}>
                        <Text style={styles.sectionTitle}>Primary Contact</Text>
                        {contacts.filter(c => c.is_primary).map(contact => {
                            const relationshipIcon = getRelationshipIcon(contact.relationship);
                            const relationshipColor = getRelationshipColor(contact.relationship);
                            
                            return (
                                <TouchableOpacity
                                    key={contact.id}
                                    style={[styles.primaryContactCard, { borderLeftColor: relationshipColor }]}
                                    onPress={() => !selectionMode && handleEditContact(contact)}
                                >
                                    <View style={styles.primaryContactContent}>
                                        <View style={[styles.primaryIcon, { backgroundColor: relationshipColor }]}>
                                            <Ionicons name={relationshipIcon} size={24} color="#fff" />
                                            <View style={styles.starOverlay}>
                                                <Ionicons name="star" size={12} color="#f59e0b" />
                                            </View>
                                        </View>
                                        <View style={styles.primaryContactInfo}>
                                            <Text style={styles.primaryContactName}>{contact.name}</Text>
                                            <Text style={styles.primaryContactPhone}>
                                                {formatPhoneNumber(contact.phone_number)}
                                            </Text>
                                            <Text style={styles.primaryContactRelationship}>
                                                {RELATIONSHIP_OPTIONS.find(r => r.id === contact.relationship)?.label || 'Contact'}
                                            </Text>
                                        </View>
                                        <View style={styles.primaryActions}>
                                            <TouchableOpacity
                                                style={[styles.primaryActionButton, styles.callPrimaryButton]}
                                                onPress={() => handleCall(contact.phone_number)}
                                            >
                                                <Ionicons name="call" size={20} color="#fff" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.primaryActionButton, styles.messagePrimaryButton]}
                                                onPress={() => handleMessage(contact.phone_number, contact.name)}
                                            >
                                                <Ionicons name="chatbubble" size={20} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* All Contacts */}
                <View style={styles.contactsSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>All Contacts ({contacts.length})</Text>
                        {contacts.length > 0 && !selectionMode && (
                            <TouchableOpacity
                                style={styles.selectAllButton}
                                onPress={() => setSelectionMode(true)}
                            >
                                <Ionicons name="checkbox-outline" size={20} color="#3b82f6" />
                                <Text style={styles.selectAllText}>Select</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text style={styles.loadingText}>Loading contacts...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={contacts.filter(c => !c.is_primary)}
                            renderItem={renderContact}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={contacts.length === 0 ? styles.emptyContainer : styles.listContainer}
                            ListEmptyComponent={renderEmptyState}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>

                {/* Selection Mode Banner */}
                {selectionMode && (
                    <View style={styles.selectionBanner}>
                        <Text style={styles.selectionCount}>
                            {selectedContacts.length} selected
                        </Text>
                        <TouchableOpacity
                            style={styles.clearSelectionButton}
                            onPress={() => setSelectedContacts([])}
                        >
                            <Text style={styles.clearSelectionText}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Add/Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <ScrollView style={styles.modalContainer} showsVerticalScrollIndicator={false}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>
                                    {editingContact ? 'Edit Contact' : 'Add Emergency Contact'}
                                </Text>
                                <TouchableOpacity 
                                    style={styles.modalCloseButton}
                                    onPress={() => setModalVisible(false)}
                                >
                                    <Ionicons name="close" size={24} color="#6b7280" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.form}>
                                {/* Name Input */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                        Full Name
                                        <Text style={styles.required}> *</Text>
                                    </Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter contact's name"
                                        placeholderTextColor="#9ca3af"
                                        value={formData.name}
                                        onChangeText={(text) => setFormData({ ...formData, name: text })}
                                        autoFocus
                                    />
                                </View>

                                {/* Phone Input */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                        Phone Number
                                        <Text style={styles.required}> *</Text>
                                    </Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter 10-digit phone number"
                                        placeholderTextColor="#9ca3af"
                                        value={formData.phone_number}
                                        onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
                                        keyboardType="phone-pad"
                                        maxLength={10}
                                    />
                                </View>

                                {/* Relationship Selection */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Relationship</Text>
                                    <View style={styles.relationshipGrid}>
                                        {RELATIONSHIP_OPTIONS.map((relationship) => (
                                            <TouchableOpacity
                                                key={relationship.id}
                                                style={[
                                                    styles.relationshipOption,
                                                    formData.relationship === relationship.id && styles.relationshipOptionSelected,
                                                    { borderColor: formData.relationship === relationship.id ? relationship.color : '#e5e7eb' }
                                                ]}
                                                onPress={() => setFormData({ ...formData, relationship: relationship.id })}
                                            >
                                                <View style={[
                                                    styles.relationshipIcon,
                                                    { backgroundColor: relationship.color }
                                                ]}>
                                                    <Ionicons name={relationship.icon} size={16} color="#fff" />
                                                </View>
                                                <Text style={[
                                                    styles.relationshipLabel,
                                                    formData.relationship === relationship.id && { color: relationship.color }
                                                ]}>
                                                    {relationship.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Note Input */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Additional Note (Optional)</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        placeholder="e.g., Available during office hours, Speaks English, etc."
                                        placeholderTextColor="#9ca3af"
                                        value={formData.note}
                                        onChangeText={(text) => setFormData({ ...formData, note: text })}
                                        multiline
                                        numberOfLines={3}
                                        textAlignVertical="top"
                                    />
                                </View>

                                {/* Primary Contact Toggle */}
                                {!editingContact && (
                                    <View style={styles.primaryToggleContainer}>
                                        <View style={styles.primaryToggleContent}>
                                            <Ionicons name="star" size={20} color="#f59e0b" />
                                            <View style={styles.primaryToggleText}>
                                                <Text style={styles.primaryToggleTitle}>Set as Primary Contact</Text>
                                                <Text style={styles.primaryToggleDescription}>
                                                    Primary contacts are notified first during emergencies
                                                </Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={[
                                                styles.toggleButton,
                                                formData.is_primary && styles.toggleButtonActive
                                            ]}
                                            onPress={() => setFormData({ ...formData, is_primary: !formData.is_primary })}
                                        >
                                            <View style={[
                                                styles.toggleCircle,
                                                formData.is_primary && styles.toggleCircleActive
                                            ]} />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Save Button */}
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={handleSaveContact}
                                >
                                    <Ionicons 
                                        name={editingContact ? "checkmark-circle" : "add-circle"} 
                                        size={24} 
                                        color="#fff" 
                                    />
                                    <Text style={styles.saveButtonText}>
                                        {editingContact ? 'Update Contact' : 'Add Contact'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Emergency Notice */}
                                <View style={styles.emergencyNotice}>
                                    <Ionicons name="shield-checkmark" size={20} color="#10b981" />
                                    <Text style={styles.emergencyNoticeText}>
                                        Emergency contacts will receive alerts with your location during SOS activation
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
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
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerActionButton: {
        padding: 8,
    },
    headerActionButtonDisabled: {
        opacity: 0.5,
    },
    quickActions: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    servicesScroll: {
        flexDirection: 'row',
    },
    servicesScrollContent: {
        gap: 12,
        paddingRight: 20,
    },
    serviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        borderLeftWidth: 4,
        width: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    serviceIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    serviceNumber: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3b82f6',
    },
    callServiceButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    primarySection: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
        backgroundColor: '#fefce8',
    },
    primaryContactCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 6,
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryContactContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    primaryIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        position: 'relative',
    },
    starOverlay: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#fff',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    primaryContactInfo: {
        flex: 1,
    },
    primaryContactName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    primaryContactPhone: {
        fontSize: 16,
        color: '#3b82f6',
        fontWeight: '500',
        marginBottom: 2,
    },
    primaryContactRelationship: {
        fontSize: 14,
        color: '#6b7280',
    },
    primaryActions: {
        flexDirection: 'row',
        gap: 8,
    },
    primaryActionButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    callPrimaryButton: {
        backgroundColor: '#10b981',
    },
    messagePrimaryButton: {
        backgroundColor: '#3b82f6',
    },
    contactsSection: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    selectAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#eff6ff',
        borderRadius: 16,
    },
    selectAllText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#3b82f6',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6b7280',
    },
    listContainer: {
        paddingBottom: 100,
    },
    emptyContainer: {
        flex: 1,
    },
    contactCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        overflow: 'hidden',
    },
    contactCardSelected: {
        backgroundColor: '#eff6ff',
        borderColor: '#3b82f6',
    },
    selectionCheckbox: {
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 1,
    },
    contactContent: {
        padding: 16,
        paddingLeft: 56,
    },
    contactHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    contactIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    contactInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    contactName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginRight: 8,
    },
    primaryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    primaryText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#f59e0b',
    },
    contactPhone: {
        fontSize: 15,
        color: '#374151',
        marginBottom: 4,
    },
    contactRelationship: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
    },
    contactNote: {
        fontSize: 12,
        color: '#9ca3af',
        fontStyle: 'italic',
    },
    contactActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    callButton: {
        backgroundColor: '#10b981',
    },
    messageButton: {
        backgroundColor: '#3b82f6',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    secondaryActions: {
        flexDirection: 'row',
        gap: 8,
    },
    smallActionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: '#fef3c7',
    },
    editButton: {
        backgroundColor: '#eff6ff',
    },
    deleteButton: {
        backgroundColor: '#fef2f2',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
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
    },
    emptyDescription: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        maxWidth: 280,
        marginBottom: 32,
        lineHeight: 20,
    },
    addFirstButton: {
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
    addFirstButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    selectionBanner: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#3b82f6',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    selectionCount: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    clearSelectionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    clearSelectionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        maxHeight: '90%',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
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
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    modalCloseButton: {
        padding: 4,
    },
    form: {
        padding: 24,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    required: {
        color: '#ef4444',
    },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#1f2937',
    },
    textArea: {
        minHeight: 80,
        paddingTop: 12,
        paddingBottom: 12,
    },
    relationshipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
    },
    relationshipOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: '#fff',
        gap: 8,
    },
    relationshipOptionSelected: {
        backgroundColor: '#f9fafb',
    },
    relationshipIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    relationshipLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b7280',
    },
    primaryToggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fffbeb',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#fef3c7',
    },
    primaryToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    primaryToggleText: {
        flex: 1,
    },
    primaryToggleTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400e',
        marginBottom: 2,
    },
    primaryToggleDescription: {
        fontSize: 12,
        color: '#b45309',
        lineHeight: 16,
    },
    toggleButton: {
        width: 52,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e5e7eb',
        padding: 2,
        justifyContent: 'center',
    },
    toggleButtonActive: {
        backgroundColor: '#10b981',
    },
    toggleCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#fff',
        alignSelf: 'flex-start',
    },
    toggleCircleActive: {
        alignSelf: 'flex-end',
    },
    saveButton: {
        backgroundColor: '#3b82f6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 18,
        borderRadius: 12,
        marginBottom: 24,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    emergencyNotice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: '#f0f9ff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    emergencyNoticeText: {
        fontSize: 12,
        color: '#0369a1',
        lineHeight: 16,
        flex: 1,
    },
});