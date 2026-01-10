import { supabase } from './supabase';

export async function getEmergencyContacts(userId) {
    const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data;
}

export async function addEmergencyContact(userId, contactData) {
    const { data, error } = await supabase
        .from('emergency_contacts')
        .insert({
            user_id: userId,
            name: contactData.name,
            phone_number: contactData.phone_number,
            relationship: contactData.relationship,
            is_primary: contactData.is_primary || false,
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function updateEmergencyContact(contactId, contactData) {
    const { data, error } = await supabase
        .from('emergency_contacts')
        .update({
            name: contactData.name,
            phone_number: contactData.phone_number,
            relationship: contactData.relationship,
            is_primary: contactData.is_primary,
            updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function deleteEmergencyContact(contactId) {
    const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', contactId);

    if (error) {
        throw error;
    }

    return true;
}

export async function setPrimaryContact(userId, contactId) {
    // First, unset all primary contacts for this user
    await supabase
        .from('emergency_contacts')
        .update({ is_primary: false })
        .eq('user_id', userId);

    // Then set the selected contact as primary
    const { data, error } = await supabase
        .from('emergency_contacts')
        .update({ is_primary: true })
        .eq('id', contactId)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}
