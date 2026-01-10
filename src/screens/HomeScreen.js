import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [sosCount, setSosCount] = useState(0);
  const [reportsCount, setReportsCount] = useState(0);

  useEffect(() => {
    fetchUserData();
    fetchStats();
    
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

  const fetchStats = async () => {
    try {
      // Fetch SOS count
      const { count: sosCount } = await supabase
        .from('sos_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Fetch reports count
      const { count: reportsCount } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      setSosCount(sosCount || 0);
      setReportsCount(reportsCount || 0);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
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

  const StatCard = ({ icon, value, label, color }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
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
            <Ionicons name="person-circle" size={40} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Safety Stats</Text>
          <View style={styles.statsGrid}>
            <StatCard 
              icon="shield-checkmark" 
              value="100%" 
              label="Safe Status" 
              color="#10b981" 
            />
            <StatCard 
              icon="alert-circle" 
              value={sosCount} 
              label="SOS Activated" 
              color="#ef4444" 
            />
            <StatCard 
              icon="document-text" 
              value={reportsCount} 
              label="Reports" 
              color="#f59e0b" 
            />
          </View>
        </View>

        {/* Quick Actions - Emergency Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Actions</Text>
          <MenuCard
            icon="alert-circle"
            title="Emergency SOS"
            description="Send immediate distress signal with location"
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
            icon="shield"
            title="Safety Tips"
            description="Learn safety best practices"
            color="#06b6d4"
            onPress={() => navigation.navigate('SafetyTips')}
          />
          <MenuCard
            icon="alert"
            title="Emergency Contacts"
            description="Quick access to emergency services"
            color="#ec4899"
            onPress={() => navigation.navigate('EmergencyContacts')}
          />
        </View>

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          <TouchableOpacity 
            style={styles.bottomNavItem}
            onPress={() => navigation.navigate('History')}
          >
            <Ionicons name="time" size={24} color="#6b7280" />
            <Text style={styles.bottomNavText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.bottomNavItem}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings" size={24} color="#6b7280" />
            <Text style={styles.bottomNavText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.bottomNavItem}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={24} color="#ef4444" />
            <Text style={[styles.bottomNavText, { color: '#ef4444' }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Floating Emergency Button */}
      <TouchableOpacity 
        style={styles.floatingEmergencyButton}
        onPress={() => navigation.navigate('SOS')}
        activeOpacity={0.9}
      >
        <View style={styles.emergencyButtonInner}>
          <Ionicons name="alert-circle" size={30} color="#fff" />
          <Text style={styles.emergencyButtonText}>SOS</Text>
        </View>
      </TouchableOpacity>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  statsSection: {
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
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
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bottomNavItem: {
    alignItems: 'center',
    gap: 4,
  },
  bottomNavText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  floatingEmergencyButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  emergencyButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
});