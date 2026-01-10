import { supabase } from './supabase';

export async function getIncidentHistory(userId) {
    try {
        // Fetch SOS events
        const { data: sosData, error: sosError } = await supabase
            .from('sos_events')
            .select('*')
            .eq('user_id', userId);

        if (sosError) throw sosError;

        // Fetch incident reports
        const { data: incidentsData, error: incidentsError } = await supabase
            .from('incidents')
            .select('*')
            .eq('user_id', userId);

        if (incidentsError) throw incidentsError;

        // Normalize and combine both datasets
        const normalizedSOS = (sosData || []).map(item => ({
            ...item,
            type: 'sos',
            description: item.description || null,
        }));

        const normalizedIncidents = (incidentsData || []).map(item => ({
            ...item,
            type: 'incident_report',
            audio_url: null, // Incidents don't have audio
        }));

        // Combine and sort by created_at (newest first)
        const combined = [...normalizedSOS, ...normalizedIncidents].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        return combined;
    } catch (error) {
        console.error('Error fetching incident history:', error);
        throw error;
    }
}

export async function getIncidentDetails(eventId, eventType = 'sos') {
    const tableName = eventType === 'sos' ? 'sos_events' : 'incidents';

    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', eventId)
        .single();

    if (error) {
        throw error;
    }

    return {
        ...data,
        type: eventType,
    };
}

export async function deleteIncident(eventId, eventType = 'sos') {
    const tableName = eventType === 'sos' ? 'sos_events' : 'incidents';

    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', eventId);

    if (error) {
        throw error;
    }

    return true;
}
