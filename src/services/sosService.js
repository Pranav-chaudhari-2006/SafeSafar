import { supabase } from './supabase';

export async function saveSOSEvent(userId, latitude, longitude, audioUrl) {
  const { data, error } = await supabase
    .from('sos_events')
    .insert({
      user_id: userId,
      latitude,
      longitude,
      audio_url: audioUrl,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
