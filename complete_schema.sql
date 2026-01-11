-- SafeSafar Complete Database Schema
-- Last Updated: 2026-01-11
-- Description: Consolidated schema including Incidents, Emergency Contacts, Safety Network, Check-ins, SOS Events, and Storage Policies.

-- Enable UUID extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. INCIDENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'Harassment', 'Stalking', 'Unsafe Area', etc.
  description TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own incidents" ON incidents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own incidents" ON incidents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own incidents" ON incidents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own incidents" ON incidents FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_incidents_user_id ON incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);

-- ==========================================
-- 2. EMERGENCY CONTACTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  relationship TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emergency contacts" ON emergency_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own emergency contacts" ON emergency_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own emergency contacts" ON emergency_contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own emergency contacts" ON emergency_contacts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_is_primary ON emergency_contacts(user_id, is_primary);

-- ==========================================
-- 3. SAFETY NETWORK & LOCATION TABLES
-- ==========================================
-- 3a. Safety Network Connections
CREATE TABLE IF NOT EXISTS safety_network (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email TEXT,
  contact_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE safety_network ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own network" ON safety_network FOR SELECT USING (auth.uid() = user_id OR auth.uid() = contact_user_id);
CREATE POLICY "Users can insert own network" ON safety_network FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own network" ON safety_network FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = contact_user_id);
CREATE POLICY "Users can delete own network" ON safety_network FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_safety_network_user_id ON safety_network(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_network_contact_user_id ON safety_network(contact_user_id);
CREATE INDEX IF NOT EXISTS idx_safety_network_status ON safety_network(status);

-- 3b. Location Shares
CREATE TABLE IF NOT EXISTS location_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE location_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view locations shared with them" ON location_shares FOR SELECT USING (auth.uid() = shared_with_user_id OR auth.uid() = user_id);
CREATE POLICY "Users can create location shares" ON location_shares FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own location shares" ON location_shares FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_location_shares_user_id ON location_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_location_shares_shared_with ON location_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_location_shares_active ON location_shares(is_active, expires_at);

-- 3c. Check-ins
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL, -- safe, help_needed, checking_in
  message TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own check-ins" ON check_ins FOR SELECT USING (auth.uid() = user_id);

-- Complex Policy: Network can view check-ins if connection is accepted
CREATE POLICY "Network can view check-ins" ON check_ins FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM safety_network
    WHERE (contact_user_id = auth.uid() AND user_id = check_ins.user_id)
    AND status = 'accepted'
  )
);

CREATE POLICY "Users can insert own check-ins" ON check_ins FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON check_ins(created_at DESC);

-- ==========================================
-- 4. SOS EVENTS
-- ==========================================
-- Based on inference from sosService.js
CREATE TABLE IF NOT EXISTS sos_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT DEFAULT 'sos', -- 'sos' vs 'incident_report'
  description TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  audio_url TEXT, -- Path to file in storage bucket
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE sos_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sos events" ON sos_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sos events" ON sos_events FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Optionally allow network to view active SOS? (Not present in partial schema, but good practice). Omitting to match codebase strictness.

CREATE INDEX IF NOT EXISTS idx_sos_events_user_id ON sos_events(user_id);

-- ==========================================
-- 5. STORAGE BUCKETS & POLICIES
-- ==========================================

-- 5a. Avatars Bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, false, 2097152, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Avatars Policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5b. Audio Bucket (for SOS recordings)
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true) ON CONFLICT (id) DO NOTHING;

-- Audio Policies
DROP POLICY IF EXISTS "Public Access Audio" ON storage.objects;
CREATE POLICY "Public Access Audio" ON storage.objects FOR SELECT USING ( bucket_id = 'audio' );

DROP POLICY IF EXISTS "Authenticated Upload Audio" ON storage.objects;
CREATE POLICY "Authenticated Upload Audio" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'audio' );
-- Note: Simplified upload policy (allow any authenticated user to upload to 'audio' bucket)

