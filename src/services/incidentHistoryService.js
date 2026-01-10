import { supabase } from './supabase';

export async function getIncidentHistory(userId) {
    const { data, error } = await supabase
        .from('sos_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data;
}

export async function getIncidentDetails(eventId) {
    const { data, error } = await supabase
        .from('sos_events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (error) {
        throw error;
    }

    return data;
}
