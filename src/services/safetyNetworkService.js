import { supabase } from './supabase';

export async function getMyNetwork(userId) {
    const { data, error } = await supabase
        .from('safety_network')
        .select('*')
        .or(`user_id.eq.${userId},contact_user_id.eq.${userId}`)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function getPendingRequests(userId) {
    const { data, error } = await supabase
        .from('safety_network')
        .select('*')
        .or(`user_id.eq.${userId},contact_user_id.eq.${userId}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function addToNetwork(userId, contactEmail, contactName) {
    // First, try to find the user by email
    const { data: userData, error: userError } = await supabase
        .from('auth.users')
        .select('id')
        .eq('email', contactEmail)
        .single();

    const { data, error } = await supabase
        .from('safety_network')
        .insert({
            user_id: userId,
            contact_user_id: userData?.id || null,
            contact_email: contactEmail,
            contact_name: contactName,
            status: 'pending',
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function acceptRequest(requestId, userId) {
    const { data, error } = await supabase
        .from('safety_network')
        .update({
            status: 'accepted',
            updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('contact_user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function rejectRequest(requestId, userId) {
    const { data, error } = await supabase
        .from('safety_network')
        .update({
            status: 'rejected',
            updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('contact_user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function removeFromNetwork(connectionId) {
    const { error } = await supabase
        .from('safety_network')
        .delete()
        .eq('id', connectionId);

    if (error) throw error;
    return true;
}
