import { supabase } from './supabaseClient';

// --- (기존 events 로직은 유지하되, alias_id가 포함된 상태로 조회될 것임) ---

export async function fetchEvents(userId, provider = null, status = null) {
  let query = supabase.from('events').select('*');
  
  if (provider) query = query.eq('provider', provider);
  if (status) query = query.eq('status', status);
  
  query = query.order('end_date', { ascending: false, nullsFirst: false });
  
  const { data: events, error } = await query;
  if (error) throw error;
  
  let checkedAliasMap = {}; // { eventId: { aliasId: true, ... } }
  
  if (userId && events.length > 0) {
    const eventIds = events.map(e => e.id);
    const { data: userEvents, error: ueError } = await supabase
      .from('user_events')
      .select('event_id, alias_id')
      .eq('user_id', userId)
      .in('event_id', eventIds);
      
    if (!ueError && userEvents) {
      userEvents.forEach(ue => {
        if (!checkedAliasMap[ue.event_id]) checkedAliasMap[ue.event_id] = {};
        checkedAliasMap[ue.event_id][ue.alias_id] = true;
      });
    }
  }

  // events 에 각 이벤트별로 체크된 alias ID 목록을 매핑
  const mergedEvents = events.map(event => ({
    ...event,
    checkedAliases: checkedAliasMap[event.id] || {}
  }));

  return { events: mergedEvents };
}

// --- 별명(Aliases) 관련 API ---

export async function fetchAliases(userId) {
  const { data, error } = await supabase
    .from('user_aliases')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
    
  if (error) throw error;
  return data || [];
}

export async function addAlias(userId, name) {
  const { data, error } = await supabase
    .from('user_aliases')
    .insert({ user_id: userId, name: name })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function removeAlias(aliasId, userId) {
  const { error } = await supabase
    .from('user_aliases')
    .delete()
    .match({ id: aliasId, user_id: userId });
    
  if (error) throw error;
}

// --- 토글 ---

export async function toggleEventChecked(eventId, userId, aliasId, currentlyChecked) {
  if (!userId) throw new Error("로그인이 필요합니다");

  if (currentlyChecked) {
    // 삭제
    const { error } = await supabase
      .from('user_events')
      .delete()
      .match({ event_id: eventId, user_id: userId, alias_id: aliasId });
    if (error) throw error;
    return { eventId, aliasId, checked: false };
  } else {
    // 추가
    const { error } = await supabase
      .from('user_events')
      .insert({ event_id: eventId, user_id: userId, alias_id: aliasId });
    if (error) throw error;
    return { eventId, aliasId, checked: true };
  }
}
