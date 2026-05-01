import { supabase } from './supabaseClient';
export { supabase };

// 모든 이벤트를 가져옵니다
// - 진행중 이벤트 전체
// - 내가 참여한(user_events에 기록된) 이벤트 중 종료 후 30일 이내인 것

export async function fetchParkingRates() {
  const { data, error } = await supabase
    .from('parking_rates')
    .select('*')
    .order('max_rate', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchEvents(userId) {
  // 1) 진행중 이벤트 조회
  const { data: activeEvents, error: activeError } = await supabase
    .from('events')
    .select('*')
    .eq('status', '진행중')
    .order('end_date', { ascending: false, nullsFirst: false });
  if (activeError) throw activeError;

  let participatedEndedEvents = [];

  if (userId) {
    // 2) 내가 참여한 이벤트 ID 목록 조회
    const { data: myUserEvents, error: myError } = await supabase
      .from('user_events')
      .select('event_id, alias_id')
      .eq('user_id', userId);

    if (!myError && myUserEvents && myUserEvents.length > 0) {
      const myEventIds = [...new Set(myUserEvents.map(ue => ue.event_id))];

      // 3) 진행중이 아니지만 내가 참여한 이벤트 중 end_date가 30일 이내인 것 조회
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoffStr = cutoffDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'

      const activeEventIds = new Set((activeEvents || []).map(e => e.id));
      const endedParticipatedIds = myEventIds.filter(id => !activeEventIds.has(id));

      if (endedParticipatedIds.length > 0) {
        const { data: endedEvents, error: endedError } = await supabase
          .from('events')
          .select('*')
          .in('id', endedParticipatedIds)
          .gte('end_date', cutoffStr)
          .order('end_date', { ascending: false, nullsFirst: false });

        if (!endedError && endedEvents) {
          participatedEndedEvents = endedEvents;
        }
      }
    }
  }

  // 4) user_events checkedAliasMap 구성 (전체 이벤트 대상)
  const allEvents = [...(activeEvents || []), ...participatedEndedEvents];
  let checkedAliasMap = {}; // { eventId: { aliasId: true, ... } }

  if (userId && allEvents.length > 0) {
    const eventIds = allEvents.map(e => e.id);
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

  // 5) events 에 각 이벤트별로 체크된 alias ID 목록을 매핑
  const mergedEvents = allEvents.map(event => ({
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

export async function fetchIpoEvents(userId) {
  const { data: ipos, error } = await supabase
    .from('ipo_events')
    .select('*')
    .order('subscription_start', { ascending: true, nullsFirst: false });
    
  if (error) {
    console.error("IPO fetch error:", error);
    return [];
  }

  const allIpos = ipos || [];
  let checkedSubscriptionsMap = {}; // { ipoId: { brokerage: { aliasId: true } } }

  if (userId && allIpos.length > 0) {
    const { data: subs, error: subError } = await supabase
      .from('user_ipo_subscriptions')
      .select('ipo_id, brokerage, alias_id')
      .eq('user_id', userId);

    if (!subError && subs) {
      subs.forEach(s => {
        if (!checkedSubscriptionsMap[s.ipo_id]) checkedSubscriptionsMap[s.ipo_id] = {};
        if (!checkedSubscriptionsMap[s.ipo_id][s.brokerage]) checkedSubscriptionsMap[s.ipo_id][s.brokerage] = {};
        checkedSubscriptionsMap[s.ipo_id][s.brokerage][s.alias_id] = true;
      });
    }
  }

  return allIpos.map(ipo => ({
    ...ipo,
    checkedSubscriptions: checkedSubscriptionsMap[ipo.id] || {}
  }));
}

export async function toggleIpoSubscription(ipoId, userId, brokerage, aliasId, currentlyChecked) {
  if (!userId) throw new Error("로그인이 필요합니다");

  if (currentlyChecked) {
    const { error } = await supabase
      .from('user_ipo_subscriptions')
      .delete()
      .match({ ipo_id: ipoId, user_id: userId, brokerage: brokerage, alias_id: aliasId });
    if (error) throw error;
    return { ipoId, brokerage, aliasId, checked: false };
  } else {
    const { error } = await supabase
      .from('user_ipo_subscriptions')
      .insert({ ipo_id: ipoId, user_id: userId, brokerage: brokerage, alias_id: aliasId });
    if (error) throw error;
    return { ipoId, brokerage, aliasId, checked: true };
  }
}
// --- 푸시 알림(Web Push) ---
export async function savePushSubscription(userId, subscription) {
  const sub = JSON.parse(JSON.stringify(subscription));
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ 
      user_id: userId, 
      endpoint: sub.endpoint, 
      p256dh: sub.keys?.p256dh, 
      auth: sub.keys?.auth 
    }, { onConflict: 'user_id, endpoint' });
  if (error) throw error;
}

export async function removePushSubscription(userId, endpoint) {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .match({ user_id: userId, endpoint: endpoint });
  if (error) throw error;
}

export async function checkPushSubscription(userId, endpoint) {
  if (!endpoint) return false;
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .match({ user_id: userId, endpoint: endpoint })
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

// --- 시장 인사이트 ---
export async function fetchMarketInsights() {
  const { data, error } = await supabase
    .from('market_insights')
    .select('*')
    .eq('id', 'current')
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function fetchWhaleInsights() {
  const { data, error } = await supabase
    .from('whale_insights')
    .select('*')
    .eq('id', 'current')
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// --- 부동산 청약 API ---
export async function fetchAptSubscriptions() {
  const { data, error } = await supabase
    .from('apt_subscriptions')
    .select('*')
    .order('subscription_start', { ascending: true, nullsFirst: false });
    
  if (error) {
    console.error("APT fetch error:", error);
    return [];
  }
  return data || [];
}

// --- 방문자 카운터 API ---
export async function fetchVisitorCount() {
  const { data, error } = await supabase
    .from('site_visitors')
    .select('today_count, total_count')
    .eq('id', 'counter')
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error("Visitor fetch error:", error);
    return { today: 0, total: 0 };
  }
  return { today: data?.today_count || 0, total: data?.total_count || 0 };
}

export async function incrementVisitor() {
  const { error } = await supabase.rpc('increment_visitor');
  if (error) console.error("Visitor increment error:", error);
}
