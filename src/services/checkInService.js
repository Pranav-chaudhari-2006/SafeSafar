import { supabase } from './supabase';

export async function createCheckIn(userId, status, message, location) {
    const { data, error } = await supabase
        .from('check_ins')
        .insert({
            user_id: userId,
            status,
            message,
            latitude: location?.latitude || null,
            longitude: location?.longitude || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getMyCheckIns(userId, limit = 10) {
    const { data, error } = await supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

export async function getNetworkCheckIns(userId, limit = 20) {
    // Get all accepted network connections
    const { data: network, error: networkError } = await supabase
        .from('safety_network')
        .select('user_id, contact_user_id')
        .or(`user_id.eq.${userId},contact_user_id.eq.${userId}`)
        .eq('status', 'accepted');

    if (networkError) throw networkError;

    // Extract user IDs from network
    const networkUserIds = network.map(conn =>
        conn.user_id === userId ? conn.contact_user_id : conn.user_id
    ).filter(Boolean);

    if (networkUserIds.length === 0) {
        return [];
    }

    // Get check-ins from network members
    const { data, error } = await supabase
        .from('check_ins')
        .select('*')
        .in('user_id', networkUserIds)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}
