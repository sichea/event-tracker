import { supabase } from './supabaseClient';

// 모든 이벤트를 가져옵니다 (필터링은 프론트엔드에서 처리)
export async function fetchEvents(userId) {
  let query = supabase
    .from('events')
    .select('*')
    .eq('status', '진행중')
    .order('end_date', { ascending: false, nullsFirst: false });
  
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

// --- 스크래핑 상태 관리 ---

export async function fetchScrapingStatus() {
  const { data, error } = await supabase
    .from('scraping_status')
    .select('*')
    .eq('id', 1)
    .single();
    
  if (error && error.code !== 'PGRST116') { // PGRST116: 결과 없음 (정상 범위)
    console.error("Status fetch error:", error);
    return null;
  }
  return data;
}

/**
 * GitHub Actions 워크플로우를 수동으로 실행합니다.
 * @param {string} token - GitHub Personal Access Token
 */
export async function triggerManualScrape(token) {
  const GITHUB_REPO = "sichea/event-tracker"; // 실제 저장소 경로로 수정 필요
  const WORKFLOW_ID = "scrape.yml";
  
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main', // 또는 스크래퍼가 있는 브랜치
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API Error: ${response.status} - ${errorBody}`);
  }
  
  return true;
}

// --- 관리자 전용 비밀 데이터 (토큰 등) 관리 ---

/**
 * 관리자용 비밀 데이터를 저장합니다.
 */
export async function saveAdminSecret(key, value) {
  const { data, error } = await supabase
    .from('admin_secrets')
    .upsert({ key_name: key, secret_value: value }, { onConflict: 'key_name' })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

/**
 * 관리자용 비밀 데이터를 가져옵니다.
 */
export async function fetchAdminSecret(key) {
  const { data, error } = await supabase
    .from('admin_secrets')
    .select('secret_value')
    .eq('key_name', key)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') return null; // 데이터 없음
    throw error;
  }
  return data.secret_value;
}

// --- IPO(공모주) 일정 API ---

export async function fetchIpoEvents() {
  const { data, error } = await supabase
    .from('ipo_events')
    .select('*')
    .order('subscription_start', { ascending: true, nullsFirst: false });
    
  if (error) {
    console.error("IPO fetch error:", error);
    return [];
  }
  return data || [];
}

