import { supabase } from './supabaseClient';

export async function fetchEvents(user_id, provider = null, status = null) {
  let query = supabase.from('events').select('*');
  
  if (provider) query = query.eq('provider', provider);
  if (status) query = query.eq('status', status);
  
  query = query.order('end_date', { ascending: false, nullsFirst: false });
  
  const { data: events, error } = await query;
  if (error) throw error;
  
  let userEventsMap = {};
  if (user_id && events.length > 0) {
    const eventIds = events.map(e => e.id);
    const { data: userEvents, error: ueError } = await supabase
      .from('user_events')
      .select('event_id')
      .eq('user_id', user_id)
      .in('event_id', eventIds);
      
    if (!ueError && userEvents) {
      userEvents.forEach(ue => {
        userEventsMap[ue.event_id] = true;
      });
    }
  }

  // merge checked status
  const mergedEvents = events.map(event => ({
    ...event,
    checked: !!userEventsMap[event.id]
  }));

  return { events: mergedEvents };
}

export async function toggleEventChecked(eventId, userId, currentlyChecked) {
  if (!userId) throw new Error("User must be logged in to toggle events");

  if (currentlyChecked) {
    // Delete record
    const { error } = await supabase
      .from('user_events')
      .delete()
      .match({ event_id: eventId, user_id: userId });
    if (error) throw error;
    return { event: { id: eventId, checked: false } };
  } else {
    // Insert record
    const { error } = await supabase
      .from('user_events')
      .insert({ event_id: eventId, user_id: userId });
    if (error) throw error;
    return { event: { id: eventId, checked: true } };
  }
}
