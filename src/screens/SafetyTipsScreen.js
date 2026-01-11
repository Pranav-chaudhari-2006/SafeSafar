import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Animated,
    Platform,
    Share,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSafetyTips, getGeneralTips } from '../services/safetyTipsService';

export default function SafetyTipsScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [locationTips, setLocationTips] = useState(null);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [activeCategory, setActiveCategory] = useState(null);
    const [savedTips, setSavedTips] = useState([]);
    const [showSaved, setShowSaved] = useState(false);

    const fadeAnim = useState(new Animated.Value(0))[0];
    const slideAnim = useState(new Animated.Value(50))[0];

    useEffect(() => {
        fetchLocation();
        loadSavedTips();
    }, []);

    const fetchLocation = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Location Access', 'Enable location for personalized safety tips');
                return;
            }

            let location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest
            });
            setCurrentLocation(location.coords);
        } catch (error) {
            console.error('Location error:', error);
        }
    };

    const loadSavedTips = async () => {
        try {
            const saved = await AsyncStorage.getItem('user_saved_tips');
            if (saved) {
                setSavedTips(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Error loading saved tips:', error);
        }
    };

    const handleGetLocationTips = async () => {
        if (!currentLocation) {
            Alert.alert('Location Needed', 'Waiting for location...');
            return;
        }

        setLoading(true);
        setActiveCategory('location');
        setShowSaved(false);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 50,
                duration: 300,
                useNativeDriver: true,
            })
        ]).start();

        try {
            const tips = await getSafetyTips(currentLocation.latitude, currentLocation.longitude);
            setLocationTips(tips);

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                })
            ]).start();
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch safety tips. Please try again.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryPress = async (category) => {
        setLoading(true);
        setActiveCategory(category);
        setShowSaved(false);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 50,
                duration: 300,
                useNativeDriver: true,
            })
        ]).start();

        try {
            const tips = await getGeneralTips(category);
            setLocationTips(tips);

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                })
            ]).start();
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch tips.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTip = async () => {
        if (!locationTips) return;

        // Prevent duplicates
        const isDuplicate = savedTips.some(tip => tip.content === locationTips);
        if (isDuplicate) {
            Alert.alert('Already Saved', 'This tip is already in your bookmarks.');
            return;
        }

        const newTip = {
            id: Date.now().toString(),
            title: activeCategory === 'location' ? 'Location Safety' :
                categories.find(c => c.id === activeCategory)?.name || 'Safety Tips',
            content: locationTips,
            category: activeCategory,
            savedAt: new Date(),
        };

        const updatedTips = [newTip, ...savedTips];
        setSavedTips(updatedTips);

        try {
            await AsyncStorage.setItem('user_saved_tips', JSON.stringify(updatedTips));
            Alert.alert('Saved', 'Tip added to your saved list');
        } catch (error) {
            console.error('Error saving tip:', error);
        }
    };

    const handleShareTip = async () => {
        if (!locationTips) return;

        let message = '';
        if (Array.isArray(locationTips)) {
            message = locationTips.map((t, i) => `${i + 1}. ${t.title}\n${t.description}`).join('\n\n');
        } else {
            message = locationTips;
        }

        try {
            await Share.share({
                message: `🚨 Safety Guide:\n\n${message}\n\nShared via Safety App`,
                title: 'Safety Guide'
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchLocation();
        setRefreshing(false);
    };

    // DEBUG: Clear all cached tips
    const clearCache = async () => {
        Alert.alert(
            'Clear Cache',
            'This will remove all cached safety tips. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const keys = await AsyncStorage.getAllKeys();
                            const tipKeys = keys.filter(key => key.startsWith('safety_tips_'));
                            await AsyncStorage.multiRemove(tipKeys);
                            setLocationTips(null);
                            setActiveCategory(null);
                            Alert.alert('Success', `Cleared ${tipKeys.length} cached items`);
                            console.log('Cleared cache keys:', tipKeys);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to clear cache');
                            console.error('Cache clear error:', error);
                        }
                    }
                }
            ]
        );
    };

    const categories = [
        {
            id: 'night',
            name: 'Night Safety',
            icon: 'moon',
            color: '#4f46e5',
            gradient: ['#4f46e5', '#6366f1']
        },
        {
            id: 'transport',
            name: 'Transport',
            icon: 'bus',
            color: '#059669',
            gradient: ['#059669', '#10b981']
        },
        {
            id: 'solo',
            name: 'Solo Travel',
            icon: 'person',
            color: '#dc2626',
            gradient: ['#dc2626', '#ef4444']
        },
        {
            id: 'emergency',
            name: 'Emergency',
            icon: 'medical',
            color: '#d97706',
            gradient: ['#d97706', '#f59e0b']
        },
        {
            id: 'cyber',
            name: 'Cyber Safety',
            icon: 'shield',
            color: '#7c3aed',
            gradient: ['#7c3aed', '#8b5cf6']
        },
        {
            id: 'women',
            name: 'Women Safety',
            icon: 'female',
            color: '#db2777',
            gradient: ['#db2777', '#ec4899']
        },
    ];

    const handleOpenSavedTip = (tip) => {
        setLocationTips(tip.content);
        setActiveCategory(tip.category);
        setShowSaved(false);

        fadeAnim.setValue(0);
        slideAnim.setValue(50);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            })
        ]).start();
    };

    const renderContent = () => {
        if (showSaved) {
            return (
                <Animated.View
                    style={[
                        styles.resultContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    <View style={styles.resultHeader}>
                        <View style={[styles.resultIcon, { backgroundColor: '#fef3c7' }]}>
                            <Ionicons name="bookmark" size={24} color="#d97706" />
                        </View>
                        <View style={styles.resultTitleContainer}>
                            <Text style={styles.resultTitle}>Saved Tips</Text>
                            <Text style={styles.resultSubtitle}>{savedTips.length} items saved</Text>
                        </View>
                    </View>

                    {savedTips.length > 0 ? (
                        savedTips.map((tip, index) => (
                            <TouchableOpacity
                                key={tip.id}
                                style={styles.savedTipCard}
                                onPress={() => handleOpenSavedTip(tip)}
                            >
                                <View style={styles.savedTipHeader}>
                                    <View style={styles.categoryBadge}>
                                        <Ionicons
                                            name={categories.find(c => c.id === tip.category)?.icon || 'information'}
                                            size={14}
                                            color="#fff"
                                        />
                                        <Text style={styles.categoryBadgeText}>
                                            {categories.find(c => c.id === tip.category)?.name || 'General'}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={styles.savedDate}>
                                            {new Date(tip.savedAt).toLocaleDateString()}
                                        </Text>
                                        <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                                    </View>
                                </View>
                                <Text style={styles.savedTipTitle}>{tip.title}</Text>
                                <Text style={styles.savedTipContent} numberOfLines={3}>
                                    {Array.isArray(tip.content)
                                        ? tip.content.map(t => t.title).join(' • ')
                                        : tip.content}
                                </Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptySaved}>
                            <Ionicons name="bookmark-outline" size={48} color="#d1d5db" />
                            <Text style={styles.emptySavedText}>No saved tips yet</Text>
                            <Text style={styles.emptySavedSubtext}>Tap the bookmark icon to save tips</Text>
                        </View>
                    )}
                </Animated.View>
            );
        }

        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#06b6d4" />
                    <Text style={styles.loadingTitle}>Generating Safety Tips</Text>
                    <Text style={styles.loadingSubtext}>
                        Analyzing {activeCategory === 'location' ? 'your location data' : 'best practices'}...
                    </Text>
                </View>
            );
        }

        if (locationTips) {
            const isStructured = Array.isArray(locationTips);
            return (
                <Animated.View
                    style={[
                        styles.resultContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    <View style={styles.resultHeader}>
                        <View style={[styles.resultIcon, { backgroundColor: '#dbeafe' }]}>
                            <Ionicons name="shield-checkmark" size={24} color="#2563eb" />
                        </View>
                        <View style={styles.resultTitleContainer}>
                            <Text style={styles.resultTitle}>
                                {activeCategory === 'location' ? 'Location Safety Guide' : 'Safety Guide'}
                            </Text>
                            <Text style={styles.resultSubtitle}>
                                {activeCategory === 'location' ?
                                    'Personalized for your area' :
                                    `${categories.find(c => c.id === activeCategory)?.name} Best Practices`}
                            </Text>
                        </View>
                        <View style={styles.resultActions}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={handleSaveTip}
                            >
                                <Ionicons name="bookmark-outline" size={20} color="#64748b" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={handleShareTip}
                            >
                                <Ionicons name="share-outline" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.tipsContent}>
                        {isStructured ? (
                            locationTips.map((tip, index) => (
                                <View key={index} style={styles.structuredTipCard}>
                                    <View style={styles.tipHeader}>
                                        <View style={styles.tipNumberBadge}>
                                            <Text style={styles.tipNumberText}>{index + 1}</Text>
                                        </View>
                                        <Text style={styles.tipTitleText}>{tip.title}</Text>
                                    </View>
                                    <Text style={styles.tipDescText}>{tip.description}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.tipsText}>{locationTips}</Text>
                        )}
                    </View>

                    <View style={styles.tipsFooter}>
                        <View style={styles.tipInfo}>
                            <Ionicons name="time-outline" size={14} color="#64748b" />
                            <Text style={styles.tipInfoText}>Updated just now</Text>
                        </View>
                        <View style={styles.tipInfo}>
                            <Ionicons name="bulb-outline" size={14} color="#64748b" />
                            <Text style={styles.tipInfoText}>AI-generated advice</Text>
                        </View>
                    </View>
                </Animated.View>
            );
        }

        return (
            <View style={styles.placeholderContainer}>
                <Ionicons name="shield-outline" size={64} color="#e2e8f0" />
                <Text style={styles.placeholderTitle}>Select a Category</Text>
                <Text style={styles.placeholderText}>
                    Choose a safety category or use your location to get personalized safety advice tailored to your situation.
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Safety Guide</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={clearCache}
                    >
                        <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => setShowSaved(!showSaved)}
                    >
                        <Ionicons
                            name={showSaved ? "list" : "bookmark"}
                            size={24}
                            color={showSaved ? "#06b6d4" : "#64748b"}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#06b6d4']}
                        tintColor="#06b6d4"
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Location Card */}
                <TouchableOpacity
                    style={styles.locationCard}
                    onPress={handleGetLocationTips}
                    activeOpacity={0.8}
                    disabled={loading}
                >
                    <View style={styles.locationCardContent}>
                        <View style={styles.locationIconContainer}>
                            <Ionicons name="location" size={28} color="#fff" />
                        </View>
                        <View style={styles.locationTextContainer}>
                            <Text style={styles.locationTitle}>Location Analysis</Text>
                            <Text style={styles.locationSubtitle}>
                                {currentLocation ?
                                    `Get AI-powered safety advice for your area` :
                                    `Enable location for personalized tips`}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#06b6d4" />
                    </View>

                    {currentLocation && (
                        <View style={styles.locationStatus}>
                            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                            <Text style={styles.locationStatusText}>
                                Location ready • {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Categories */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Safety Categories</Text>
                        <Text style={styles.sectionCount}>{categories.length} topics</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoriesScroll}
                    >
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[
                                    styles.categoryCard,
                                    activeCategory === cat.id && styles.activeCategoryCard,
                                    { borderLeftColor: cat.color }
                                ]}
                                onPress={() => handleCategoryPress(cat.id)}
                                disabled={loading}
                            >
                                <View style={[
                                    styles.categoryIcon,
                                    { backgroundColor: activeCategory === cat.id ? cat.color : `${cat.color}20` }
                                ]}>
                                    <Ionicons
                                        name={cat.icon}
                                        size={24}
                                        color={activeCategory === cat.id ? "#fff" : cat.color}
                                    />
                                </View>
                                <Text style={[
                                    styles.categoryName,
                                    activeCategory === cat.id && styles.activeCategoryName
                                ]}>
                                    {cat.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Dynamic Content Area */}
                <View style={styles.contentSection}>
                    <View style={styles.contentHeader}>
                        <Text style={styles.contentTitle}>
                            {showSaved ? 'Saved Tips' : activeCategory ? 'Safety Guide' : 'Select a Category'}
                        </Text>
                        {locationTips && !showSaved && (
                            <TouchableOpacity
                                style={styles.refreshButton}
                                onPress={() => handleCategoryPress(activeCategory)}
                            >
                                <Ionicons name="refresh" size={18} color="#64748b" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {renderContent()}
                </View>

                {/* Quick Tips */}
                {!locationTips && !loading && !showSaved && (
                    <View style={styles.quickTipsSection}>
                        <Text style={styles.quickTipsTitle}>Quick Safety Tips</Text>
                        <View style={styles.quickTipsGrid}>
                            <View style={[styles.quickTip, { backgroundColor: '#f0f9ff' }]}>
                                <Ionicons name="eye" size={20} color="#0ea5e9" />
                                <Text style={styles.quickTipText}>Stay aware of your surroundings</Text>
                            </View>
                            <View style={[styles.quickTip, { backgroundColor: '#f0fdf4' }]}>
                                <Ionicons name="phone-portrait" size={20} color="#22c55e" />
                                <Text style={styles.quickTipText}>Keep phone charged and accessible</Text>
                            </View>
                            <View style={[styles.quickTip, { backgroundColor: '#fef2f2' }]}>
                                <Ionicons name="people" size={20} color="#ef4444" />
                                <Text style={styles.quickTipText}>Share your location with trusted contacts</Text>
                            </View>
                            <View style={[styles.quickTip, { backgroundColor: '#fefce8' }]}>
                                <Ionicons name="walk" size={20} color="#eab308" />
                                <Text style={styles.quickTipText}>Trust your instincts and avoid risky areas</Text>
                            </View>
                        </View>
                    </View>
                )}
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
        borderBottomColor: '#e2e8f0',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    locationCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        ...Platform.select({
            ios: {
                shadowColor: '#06b6d4',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    locationCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    locationIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#06b6d4',
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationTextContainer: {
        flex: 1,
    },
    locationTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    locationSubtitle: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
    },
    locationStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        gap: 8,
    },
    locationStatusText: {
        fontSize: 12,
        color: '#64748b',
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    sectionCount: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    categoriesScroll: {
        paddingHorizontal: 20,
        gap: 12,
    },
    categoryCard: {
        width: 140,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderLeftWidth: 4,
        gap: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    activeCategoryCard: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        ...Platform.select({
            ios: {
                shadowColor: '#06b6d4',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    categoryIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#334155',
    },
    activeCategoryName: {
        color: '#06b6d4',
    },
    contentSection: {
        marginBottom: 24,
    },
    contentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    contentTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    refreshButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 48,
        gap: 20,
    },
    loadingTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0f172a',
        textAlign: 'center',
    },
    loadingSubtext: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
    },
    resultContainer: {
        marginHorizontal: 20,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 16,
    },
    resultIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultTitleContainer: {
        flex: 1,
    },
    resultTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    resultSubtitle: {
        fontSize: 14,
        color: '#64748b',
    },
    resultActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    tipsContent: {
        padding: 20,
    },
    tipsText: {
        fontSize: 15,
        lineHeight: 24,
        color: '#334155',
    },
    tipsFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    tipInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tipInfoText: {
        fontSize: 12,
        color: '#64748b',
    },
    savedTipCard: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    savedTipHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#06b6d4',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    categoryBadgeText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
    },
    savedDate: {
        fontSize: 12,
        color: '#94a3b8',
    },
    savedTipTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 8,
    },
    savedTipContent: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
    },
    emptySaved: {
        alignItems: 'center',
        padding: 48,
    },
    emptySavedText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 16,
    },
    emptySavedSubtext: {
        fontSize: 14,
        color: '#cbd5e1',
        marginTop: 4,
        textAlign: 'center',
    },
    placeholderContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        marginHorizontal: 20,
    },
    placeholderTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#94a3b8',
        marginTop: 20,
        marginBottom: 8,
    },
    placeholderText: {
        fontSize: 14,
        color: '#cbd5e1',
        textAlign: 'center',
        lineHeight: 20,
    },
    quickTipsSection: {
        marginHorizontal: 20,
        marginBottom: 24,
    },
    quickTipsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 16,
    },
    quickTipsGrid: {
        gap: 12,
    },
    quickTip: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    quickTipText: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '500',
        flex: 1,
    },
    structuredTipCard: {
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    tipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 12,
    },
    tipNumberBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#06b6d4',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tipNumberText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    tipTitleText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        flex: 1,
    },
    tipDescText: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 22,
    },
});