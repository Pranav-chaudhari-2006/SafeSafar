import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { useState, useEffect, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export default function ProfileScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [profileData, setProfileData] = useState({
        name: '',
        email: '',
        phone: '',
        avatar_url: null,
    });

    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setProfileData({
                name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                email: user.email || '',
                phone: user.user_metadata?.mobile_number || user.user_metadata?.phone || '',
                avatar_url: user.user_metadata?.avatar_url || null,
            });
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to change your photo!');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            uploadAvatar(result.assets[0].uri);
        }
    };

    const uploadAvatar = async (uri) => {
        try {
            setSaving(true);
            const fileExt = uri.split('.').pop() || 'jpg';
            const userId = user.id;
            const fileName = `${userId}/${Date.now()}.${fileExt}`;

            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, decode(base64), {
                    contentType: 'image/' + fileExt,
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);

            // Update auth metadata
            const { error: updateError } = await supabase.auth.updateUser({
                data: { avatar_url: publicUrlData.publicUrl }
            });

            if (updateError) throw updateError;

            setProfileData(prev => ({ ...prev, avatar_url: publicUrlData.publicUrl }));
            Alert.alert('Success', 'Profile photo updated!');

        } catch (error) {
            console.error('Error uploading avatar:', error);
            Alert.alert('Error', 'Failed to update profile photo');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            setSaving(true);

            const { error } = await supabase.auth.updateUser({
                data: {
                    name: profileData.name,
                    phone: profileData.phone,
                }
            });

            if (error) throw error;

            Alert.alert('Success', 'Profile updated successfully');
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = () => {
        Alert.alert(
            'Change Password',
            'A password reset link will be sent to your email',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Link',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.auth.resetPasswordForEmail(user.email);
                            if (error) throw error;
                            Alert.alert('Success', 'Password reset link sent to your email');
                        } catch (error) {
                            console.error('Error sending reset link:', error);
                            Alert.alert('Error', 'Failed to send password reset link');
                        }
                    },
                },
            ]
        );
    };

    const InfoCard = ({ icon, label, value }) => (
        <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
                <Ionicons name={icon} size={20} color="#3b82f6" />
            </View>
            <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value || 'Not set'}</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Profile Picture Section */}
                <View style={styles.profileSection}>
                    <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                        {profileData.avatar_url ? (
                            <Image
                                source={{ uri: profileData.avatar_url }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Ionicons name="person-circle" size={100} color="#3b82f6" />
                        )}
                        <View style={styles.editBadge}>
                            <Ionicons name="camera" size={16} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.userName}>{profileData.name || 'User'}</Text>
                    <Text style={styles.userEmail}>{profileData.email}</Text>
                </View>

                {/* Edit Profile Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your name"
                            value={profileData.name}
                            onChangeText={(text) => setProfileData({ ...profileData, name: text })}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={[styles.input, styles.inputDisabled]}
                            value={profileData.email}
                            editable={false}
                        />
                        <Text style={styles.helperText}>Email cannot be changed</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter phone number"
                            value={profileData.phone}
                            onChangeText={(text) => setProfileData({ ...profileData, phone: text })}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSaveProfile}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Account Stats */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account Information</Text>
                    <InfoCard
                        icon="calendar"
                        label="Member Since"
                        value={new Date(user.created_at).toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric',
                        })}
                    />
                    <InfoCard
                        icon="shield-checkmark"
                        label="Account Status"
                        value="Active"
                    />
                </View>

                {/* Security Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Security</Text>
                    <TouchableOpacity style={styles.actionCard} onPress={handleChangePassword}>
                        <View style={styles.actionIcon}>
                            <Ionicons name="key" size={20} color="#f59e0b" />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Change Password</Text>
                            <Text style={styles.actionDescription}>Reset your account password</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                    </TouchableOpacity>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    avatarContainer: {
        marginBottom: 16,
        position: 'relative',
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#3b82f6',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    userName: {
        fontSize: 24,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: '#6b7280',
    },
    section: {
        padding: 20,
        marginTop: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 16,
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
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1f2937',
    },
    inputDisabled: {
        backgroundColor: '#f9fafb',
        color: '#9ca3af',
    },
    helperText: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    saveButton: {
        backgroundColor: '#3b82f6',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    infoIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1f2937',
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    actionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    actionContent: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1f2937',
        marginBottom: 2,
    },
    actionDescription: {
        fontSize: 12,
        color: '#6b7280',
    },
});
