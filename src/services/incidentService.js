import { supabase } from './supabase';

export async function saveIncident({
  userId,
  type,
  description,
  latitude,
  longitude,
}) {
  const { error } = await supabase.from('incidents').insert({
    user_id: userId,
    type,
    description,
    latitude,
    longitude,
  });

  if (error) throw error;
}
