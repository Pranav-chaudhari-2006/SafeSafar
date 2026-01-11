import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, Image } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUserData();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  const MenuCard = ({ icon, title, description, color, onPress, isEmergency = false }) => (
    <TouchableOpacity
      style={[
        styles.menuCard,
        isEmergency && styles.emergencyCard,
        { borderLeftColor: color }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>
              {user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            {user?.user_metadata?.avatar_url ? (
              <Image
                source={{ uri: user.user_metadata.avatar_url }}
                style={styles.profileImage}
              />
            ) : (
              <Ionicons name="person-circle" size={40} color="#3b82f6" />
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Actions - Emergency Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Actions</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('SOSInstructions')}
              style={styles.helpButton}
            >
            </TouchableOpacity>
          </View>
          <MenuCard
            icon="alert-circle"
            title="Emergency SOS"
            description="Send immediate distress signal with location & audio"
            color="#ef4444"
            isEmergency={true}
            onPress={() => navigation.navigate('SOS')}
          />
        </View>

        {/* Safety Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Tools</Text>
          <MenuCard
            icon="document-text"
            title="Report Incident"
            description="Report safety incidents in your area"
            color="#f59e0b"
            onPress={() => navigation.navigate('ReportIncident')}
          />
          <MenuCard
            icon="navigate"
            title="Safe Route Navigation"
            description="Get safest route to your destination"
            color="#3b82f6"
            onPress={() => navigation.navigate('SafeRoute')}
          />
          <MenuCard
            icon="location"
            title="Safety Checkpoints"
            description="Find nearby police stations & safe zones"
            color="#10b981"
            onPress={() => navigation.navigate('SafetyCheckpoints')}
          />
          <MenuCard
            icon="call-outline"
            title="Fake Call"
            description="Simulate incoming call for safety"
            color="#a855f7"
            onPress={() => navigation.navigate('FakeCall')}
          />
          <MenuCard
            icon="shield"
            title="Safety Tips"
            description="Learn safety best practices"
            color="#06b6d4"
            onPress={() => navigation.navigate('SafetyTips')}
          />
        </View>

        {/* Community & Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community & Resources</Text>
          <MenuCard
            icon="people"
            title="Safety Network"
            description="Connect with trusted contacts"
            color="#8b5cf6"
            onPress={() => navigation.navigate('SafetyNetwork')}
          />
          <MenuCard
            icon="call"
            title="Emergency Contacts"
            description="Quick access to emergency services"
            color="#ec4899"
            onPress={() => navigation.navigate('EmergencyContacts')}
          />
          <MenuCard
            icon="time"
            title="Incident History"
            description="View your past reports & alerts"
            color="#6b7280"
            onPress={() => navigation.navigate('History')}
          />
        </View>

        {/* Settings & Logout */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <MenuCard
            icon="settings"
            title="Settings"
            description="Configure app preferences"
            color="#374151"
            onPress={() => navigation.navigate('Settings')}
          />
          <MenuCard
            icon="log-out"
            title="Logout"
            description="Sign out of your account"
            color="#ef4444"
            onPress={handleLogout}
          />
        </View>

        {/* Safety Status Indicator */}
        <View style={styles.safetyStatus}>
          <View style={styles.statusIndicator}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>System Status: Active</Text>
          </View>
          <Text style={styles.statusSubtext}>
            Location services: {user ? 'Enabled' : 'Checking...'} • SOS Ready
          </Text>
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
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  greeting: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  profileButton: {
    padding: 4,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  helpButton: {
    padding: 4,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emergencyCard: {
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  safetyStatus: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  statusSubtext: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },

  emergencyButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
});