import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Switch, Alert, Linking, Platform, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import * as Application from 'expo-application';

export default function SettingsScreen({ navigation }) {
    const { user, signOut } = useContext(AuthContext);
    const [settings, setSettings] = useState({
        notifications: true,
        locationServices: true,
        soundAlerts: true,
        vibration: true,
        autoSOS: false,
        shareLocation: true,
        darkMode: false,
        dataSaver: false,
        biometricLock: false,
        emergencyAudio: true,
        incidentHistory: true,
        routeOptimization: 'safe', // safe, fast, balanced
        mapStyle: 'standard', // standard, satellite, hybrid
        autoRefresh: true,
    });

    const [loading, setLoading] = useState(true);
    const [feedbackModal, setFeedbackModal] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [sendingFeedback, setSendingFeedback] = useState(false);
    const [profileModal, setProfileModal] = useState(false);
    const [profileData, setProfileData] = useState({
        name: '',
        email: '',
        phone: '',
    });

    useEffect(() => {
        loadSettings();
        loadProfileData();
    }, []);

    const loadSettings = async () => {
        try {
            const savedSettings = await AsyncStorage.getItem('app_settings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings));
            }

            // Check actual permissions
            const notificationStatus = await Notifications.getPermissionsAsync();
            const locationStatus = await Location.getForegroundPermissionsAsync();

            setSettings(prev => ({
                ...prev,
                notifications: notificationStatus.granted || notificationStatus.ios?.status === 1,
                locationServices: locationStatus.granted,
            }));
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadProfileData = async () => {
        if (!user) return;

        setProfileData({
            name: user.user_metadata?.name || '',
            email: user.email || '',
            phone: user.user_metadata?.phone || '',
        });
    };

    const saveSettings = async (newSettings) => {
        try {
            await AsyncStorage.setItem('app_settings', JSON.stringify(newSettings));
            setSettings(newSettings);

            // Apply some settings in real-time
            if (newSettings.locationServices !== settings.locationServices) {
                if (newSettings.locationServices) {
                    await Location.requestForegroundPermissionsAsync();
                }
            }

            if (newSettings.notifications !== settings.notifications) {
                if (newSettings.notifications) {
                    await Notifications.requestPermissionsAsync();
                }
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            Alert.alert('Error', 'Failed to save settings');
        }
    };

    const toggleSetting = (key) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        saveSettings(newSettings);
    };

    const updateSetting = (key, value) => {
        const newSettings = { ...settings, [key]: value };
        saveSettings(newSettings);
    };

    const handleClearCache = async () => {
        Alert.alert(
            'Clear Cache',
            'This will clear temporary app data (not your account data). Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear Cache',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Clear various cache items
                            const keys = await AsyncStorage.getAllKeys();
                            const cacheKeys = keys.filter(key =>
                                key.startsWith('cache_') ||
                                key.includes('temp') ||
                                key === 'app_settings' // Preserve settings
                            );

                            for (const key of cacheKeys) {
                                if (key !== 'app_settings') {
                                    await AsyncStorage.removeItem(key);
                                }
                            }

                            Alert.alert('Success', 'Cache cleared successfully');
                        } catch (error) {
                            console.error('Error clearing cache:', error);
                            Alert.alert('Error', 'Failed to clear cache');
                        }
                    },
                },
            ]
        );
    };

    const handleExportData = () => {
        Alert.alert(
            'Export Data',
            'Export your safety data (incident reports, SOS history, etc.) as a JSON file?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Export',
                    onPress: async () => {
                        try {
                            // Here you would implement data export logic
                            Alert.alert('Export Started', 'Your data export has been initiated. You will receive a notification when ready.');
                        } catch (error) {
                            console.error('Error exporting data:', error);
                            Alert.alert('Error', 'Failed to export data');
                        }
                    },
                },
            ]
        );
    };

    const handleResetSettings = () => {
        Alert.alert(
            'Reset Settings',
            'Reset all settings to their default values?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        const defaultSettings = {
                            notifications: true,
                            locationServices: true,
                            soundAlerts: true,
                            vibration: true,
                            autoSOS: false,
                            shareLocation: true,
                            darkMode: false,
                            dataSaver: false,
                            biometricLock: false,
                            emergencyAudio: true,
                            incidentHistory: true,
                            routeOptimization: 'safe',
                            mapStyle: 'standard',
                            autoRefresh: true,
                        };
                        await saveSettings(defaultSettings);
                        Alert.alert('Success', 'Settings reset to default');
                    },
                },
            ]
        );
    };

    const handleSubmitFeedback = async () => {
        if (!feedbackText.trim()) {
            Alert.alert('Error', 'Please enter your feedback');
            return;
        }

        setSendingFeedback(true);
        try {
            // Simulate sending feedback
            await new Promise(resolve => setTimeout(resolve, 1000));

            Alert.alert(
                'Thank You!',
                'Your feedback has been submitted successfully.',
                [{ text: 'OK', onPress: () => setFeedbackModal(false) }]
            );

            setFeedbackText('');
        } catch (error) {
            console.error('Error sending feedback:', error);
            Alert.alert('Error', 'Failed to submit feedback');
        } finally {
            setSendingFeedback(false);
        }
    };

    const handleRateApp = () => {
        const storeUrl = Platform.select({
            ios: 'https://apps.apple.com/app/idYOUR_APP_ID',
            android: 'market://details?id=com.yourcompany.safesafar',
        });

        Linking.openURL(storeUrl).catch(() => {
            Alert.alert('Error', 'Could not open app store');
        });
    };

    const handlePrivacyPolicy = () => {
        Alert.alert(
            'Privacy Policy',
            'SafeSafar Privacy Policy\n\nWe are committed to protecting your privacy and ensuring the security of your personal information.\n\nKey Points:\n• Location data is only used for safety features\n• Audio recordings are encrypted\n• Your data is never sold to third parties\n• You can delete your data at any time\n\nFor full details, contact support@safesafar.com'
        );
    };

    const handleTermsOfService = () => {
        Alert.alert(
            'Terms of Service',
            'SafeSafar Terms of Service\n\nBy using SafeSafar, you agree to:\n• Use the app for personal safety purposes only\n• Provide accurate information\n• Not misuse emergency features\n• Comply with local laws and regulations\n\nFor full terms, contact support@safesafar.com'
        );
    };

    const handleContactSupport = () => {
        const supportEmail = 'support@safesafar.com';
        const subject = encodeURIComponent('SafeSafar Support');
        const body = encodeURIComponent(`User ID: ${user?.id}\n\nIssue Description:\n\n`);

        Linking.openURL(`mailto:${supportEmail}?subject=${subject}&body=${body}`).catch(() => {
            Alert.alert('Error', 'Could not open email client');
        });
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This action is irreversible. All your data will be permanently deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Contact Support',
                    onPress: () => {
                        Alert.alert(
                            'Contact Support',
                            'For account deletion, please contact our support team at support@safesafar.com with your account details.'
                        );
                    },
                },
                {
                    text: 'Delete Anyway',
                    style: 'destructive',
                    onPress: async () => {
                        Alert.alert(
                            'Final Confirmation',
                            'Are you absolutely sure? This cannot be undone.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Yes, Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            // This would be implemented with your backend
                                            Alert.alert(
                                                'Account Deletion',
                                                'Account deletion request submitted. Our team will process it within 24 hours.'
                                            );
                                        } catch (error) {
                                            console.error('Error deleting account:', error);
                                            Alert.alert('Error', 'Failed to delete account');
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut();
                        } catch (error) {
                            console.error('Error logging out:', error);
                            Alert.alert('Error', 'Failed to logout');
                        }
                    },
                },
            ]
        );
    };

    const SettingItem = ({
        icon,
        title,
        description,
        value,
        onToggle,
        iconColor = '#3b82f6',
        disabled = false
    }) => (
        <View style={[styles.settingItem, disabled && styles.settingItemDisabled]}>
            <View style={[styles.settingIcon, { backgroundColor: `${iconColor}20` }]}>
                <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, disabled && styles.settingTitleDisabled]}>{title}</Text>
                {description && <Text style={styles.settingDescription}>{description}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={disabled ? null : onToggle}
                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                thumbColor={value ? '#3b82f6' : '#f3f4f6'}
                disabled={disabled}
            />
        </View>
    );

    const SelectItem = ({
        icon,
        title,
        description,
        value,
        options,
        onSelect,
        iconColor = '#3b82f6'
    }) => (
        <TouchableOpacity style={styles.selectItem} onPress={() => onSelect()}>
            <View style={[styles.settingIcon, { backgroundColor: `${iconColor}20` }]}>
                <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{title}</Text>
                {description && <Text style={styles.settingDescription}>{description}</Text>}
            </View>
            <View style={styles.selectValue}>
                <Text style={styles.selectValueText}>{value}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </View>
        </TouchableOpacity>
    );

    const ActionItem = ({
        icon,
        title,
        description,
        onPress,
        iconColor = '#3b82f6',
        danger = false,
        arrow = true
    }) => (
        <TouchableOpacity style={styles.actionItem} onPress={onPress}>
            <View style={[styles.settingIcon, { backgroundColor: `${iconColor}20` }]}>
                <Ionicons name={icon} size={20} color={danger ? '#ef4444' : iconColor} />
            </View>
            <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>
                {description && <Text style={styles.settingDescription}>{description}</Text>}
            </View>
            {arrow && <Ionicons name="chevron-forward" size={20} color="#9ca3af" />}
        </TouchableOpacity>
    );

    const handleRouteOptimizationSelect = () => {
        Alert.alert(
            'Route Optimization',
            'Choose your preferred route optimization method:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Safety First',
                    onPress: () => updateSetting('routeOptimization', 'safe'),
                },
                {
                    text: 'Fastest Route',
                    onPress: () => updateSetting('routeOptimization', 'fast'),
                },
                {
                    text: 'Balanced',
                    onPress: () => updateSetting('routeOptimization', 'balanced'),
                },
            ]
        );
    };

    const handleMapStyleSelect = () => {
        Alert.alert(
            'Map Style',
            'Choose your preferred map style:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Standard',
                    onPress: () => updateSetting('mapStyle', 'standard'),
                },
                {
                    text: 'Satellite',
                    onPress: () => updateSetting('mapStyle', 'satellite'),
                },
                {
                    text: 'Hybrid',
                    onPress: () => updateSetting('mapStyle', 'hybrid'),
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading settings...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.profileHeader}>
                        <View style={styles.profileAvatar}>
                            <Ionicons name="person" size={32} color="#fff" />
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>
                                {user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
                            </Text>
                            <Text style={styles.profileEmail}>{user?.email}</Text>
                        </View>
                    </View>
                </View>

                {/* Notifications Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notifications & Alerts</Text>
                    <SettingItem
                        icon="notifications"
                        title="Push Notifications"
                        description="Receive emergency alerts and updates"
                        value={settings.notifications}
                        onToggle={() => toggleSetting('notifications')}
                        iconColor="#3b82f6"
                    />
                    <SettingItem
                        icon="volume-high"
                        title="Sound Alerts"
                        description="Play sound for emergency notifications"
                        value={settings.soundAlerts}
                        onToggle={() => toggleSetting('soundAlerts')}
                        iconColor="#8b5cf6"
                    />
                    <SettingItem
                        icon="phone-portrait"
                        title="Vibration"
                        description="Vibrate on emergency alerts"
                        value={settings.vibration}
                        onToggle={() => toggleSetting('vibration')}
                        iconColor="#ec4899"
                    />
                    <SettingItem
                        icon="refresh"
                        title="Auto-refresh"
                        description="Automatically refresh incident data"
                        value={settings.autoRefresh}
                        onToggle={() => toggleSetting('autoRefresh')}
                        iconColor="#06b6d4"
                    />
                </View>

                {/* Privacy & Safety Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Privacy & Safety</Text>
                    <SettingItem
                        icon="location"
                        title="Location Services"
                        description="Essential for SOS and route navigation"
                        value={settings.locationServices}
                        onToggle={() => toggleSetting('locationServices')}
                        iconColor="#10b981"
                        disabled={!settings.locationServices && Platform.OS === 'ios'}
                    />
                    <SettingItem
                        icon="share-social"
                        title="Share Location"
                        description="Share location with emergency contacts"
                        value={settings.shareLocation}
                        onToggle={() => toggleSetting('shareLocation')}
                        iconColor="#06b6d4"
                    />
                    <SettingItem
                        icon="mic"
                        title="Emergency Audio"
                        description="Record audio during SOS activation"
                        value={settings.emergencyAudio}
                        onToggle={() => toggleSetting('emergencyAudio')}
                        iconColor="#f59e0b"
                    />
                    <SettingItem
                        icon="flash"
                        title="Auto SOS"
                        description="Trigger SOS automatically in emergencies"
                        value={settings.autoSOS}
                        onToggle={() => toggleSetting('autoSOS')}
                        iconColor="#ef4444"
                    />
                    <SettingItem
                        icon="finger-print"
                        title="Biometric Lock"
                        description="Secure app with fingerprint/face ID"
                        value={settings.biometricLock}
                        onToggle={() => toggleSetting('biometricLock')}
                        iconColor="#8b5cf6"
                    />
                </View>

                {/* App Preferences */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>App Preferences</Text>
                    <SelectItem
                        icon="navigate"
                        title="Route Optimization"
                        description="Choose route calculation method"
                        value={settings.routeOptimization ? settings.routeOptimization.charAt(0).toUpperCase() + settings.routeOptimization.slice(1) : 'Safe'}
                        onSelect={handleRouteOptimizationSelect}
                        iconColor="#10b981"
                    />
                    <SelectItem
                        icon="map"
                        title="Map Style"
                        description="Choose your preferred map view"
                        value={settings.mapStyle ? settings.mapStyle.charAt(0).toUpperCase() + settings.mapStyle.slice(1) : 'Standard'}
                        onSelect={handleMapStyleSelect}
                        iconColor="#3b82f6"
                    />
                    <SettingItem
                        icon="moon"
                        title="Dark Mode"
                        description="Use dark theme (coming soon)"
                        value={settings.darkMode}
                        onToggle={() => toggleSetting('darkMode')}
                        iconColor="#6b7280"
                        disabled={true}
                    />
                    <SettingItem
                        icon="cellular"
                        title="Data Saver"
                        description="Reduce data usage"
                        value={settings.dataSaver}
                        onToggle={() => toggleSetting('dataSaver')}
                        iconColor="#f59e0b"
                    />
                </View>

                {/* Data Management */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data Management</Text>
                    <ActionItem
                        icon="save"
                        title="Export Data"
                        description="Download your safety data"
                        onPress={handleExportData}
                        iconColor="#10b981"
                    />
                    <ActionItem
                        icon="trash"
                        title="Clear Cache"
                        description="Free up storage space"
                        onPress={handleClearCache}
                        iconColor="#f59e0b"
                    />
                    <ActionItem
                        icon="refresh-circle"
                        title="Reset Settings"
                        description="Restore default settings"
                        onPress={handleResetSettings}
                        iconColor="#6b7280"
                    />
                    <SettingItem
                        icon="document-text"
                        title="Incident History"
                        description="Keep record of your reports"
                        value={settings.incidentHistory}
                        onToggle={() => toggleSetting('incidentHistory')}
                        iconColor="#8b5cf6"
                    />
                </View>

                {/* Support & Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support & Information</Text>
                    <ActionItem
                        icon="chatbubble-ellipses"
                        title="Send Feedback"
                        description="Help us improve the app"
                        onPress={() => setFeedbackModal(true)}
                        iconColor="#3b82f6"
                    />
                    <ActionItem
                        icon="star"
                        title="Rate the App"
                        description="Rate us on the app store"
                        onPress={handleRateApp}
                        iconColor="#f59e0b"
                    />
                    <ActionItem
                        icon="help-circle"
                        title="Help & FAQ"
                        description="Get help with common questions"
                        onPress={() => navigation.navigate('HelpFAQ')}
                        iconColor="#06b6d4"
                    />
                    <ActionItem
                        icon="call"
                        title="Contact Support"
                        description="Get help from our team"
                        onPress={handleContactSupport}
                        iconColor="#10b981"
                    />
                    <ActionItem
                        icon="document-text"
                        title="Privacy Policy"
                        description="Read our privacy policy"
                        onPress={handlePrivacyPolicy}
                        iconColor="#6b7280"
                    />
                    <ActionItem
                        icon="shield-checkmark"
                        title="Terms of Service"
                        description="Read our terms and conditions"
                        onPress={handleTermsOfService}
                        iconColor="#6b7280"
                    />
                </View>

                {/* Account Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <ActionItem
                        icon="log-out"
                        title="Logout"
                        description="Sign out of your account"
                        onPress={handleLogout}
                        iconColor="#6b7280"
                        arrow={false}
                    />
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, styles.dangerSection]}>Danger Zone</Text>
                    <ActionItem
                        icon="warning"
                        title="Delete Account"
                        description="Permanently delete your account and data"
                        onPress={handleDeleteAccount}
                        iconColor="#ef4444"
                        danger={true}
                        arrow={false}
                    />
                </View>

                {/* App Version */}
                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>
                        SafeSafar v{Application.nativeApplicationVersion || '1.0.0'}
                    </Text>
                    <Text style={styles.versionSubtext}>
                        Build {Application.nativeBuildVersion || '1'} • Made for your safety
                    </Text>
                </View>
            </ScrollView>

            {/* Feedback Modal */}
            <Modal
                visible={feedbackModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => !sendingFeedback && setFeedbackModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Send Feedback</Text>
                            <TouchableOpacity
                                onPress={() => !sendingFeedback && setFeedbackModal(false)}
                                disabled={sendingFeedback}
                            >
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalContent}>
                            <Text style={styles.modalDescription}>
                                Your feedback helps us improve SafeSafar. What can we do better?
                            </Text>

                            <TextInput
                                style={styles.feedbackInput}
                                placeholder="Type your feedback here..."
                                placeholderTextColor="#9ca3af"
                                value={feedbackText}
                                onChangeText={setFeedbackText}
                                multiline
                                numberOfLines={6}
                                textAlignVertical="top"
                                editable={!sendingFeedback}
                            />

                            <TouchableOpacity
                                style={[styles.submitButton, sendingFeedback && styles.submitButtonDisabled]}
                                onPress={handleSubmitFeedback}
                                disabled={sendingFeedback}
                            >
                                {sendingFeedback ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="send" size={20} color="#fff" />
                                        <Text style={styles.submitButtonText}>Submit Feedback</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6b7280',
    },
    scrollView: {
        flex: 1,
    },
    profileSection: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 14,
        color: '#6b7280',
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 12,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#e5e7eb',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dangerSection: {
        color: '#ef4444',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    settingItemDisabled: {
        opacity: 0.6,
    },
    settingIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    settingContent: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1f2937',
        marginBottom: 2,
    },
    settingTitleDisabled: {
        color: '#9ca3af',
    },
    settingDescription: {
        fontSize: 12,
        color: '#6b7280',
        lineHeight: 16,
    },
    selectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    selectValue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    selectValueText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    dangerText: {
        color: '#ef4444',
    },
    versionContainer: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 20,
    },
    versionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b7280',
        marginBottom: 4,
    },
    versionSubtext: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 500,
        overflow: 'hidden',
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
    modalContent: {
        padding: 20,
    },
    modalDescription: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
        lineHeight: 20,
    },
    feedbackInput: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1f2937',
        minHeight: 120,
        marginBottom: 20,
        textAlignVertical: 'top',
    },
    submitButton: {
        backgroundColor: '#3b82f6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 12,
    },
    submitButtonDisabled: {
        backgroundColor: '#93c5fd',
        opacity: 0.8,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});