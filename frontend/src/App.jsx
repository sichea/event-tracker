import { useState, useEffect, useCallback } from "react";
import { fetchEvents, toggleEventChecked, fetchAliases, addAlias, removeAlias } from "./api";
import { supabase } from "./supabaseClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import "./index.css";

/* ============================================
   Provider 설정 & 다국어
   ============================================ */
const PROVIDERS = [
  { key: "TIGER", label: "TIGER", color: "#FF6B00" },
  { key: "KODEX", label: "KODEX", color: "#3B82F6" },
  { key: "ACE", label: "ACE", color: "#10B981" },
  { key: "SOL", label: "SOL", color: "#8B5CF6" },
];

const korAuthLocalization = {
  variables: {
    sign_up: {
      email_label: '이메일 주소',
      password_label: '비밀번호',
      email_input_placeholder: '이메일을 입력하세요',
      password_input_placeholder: '비밀번호를 입력하세요',
      button_label: '회원가입',
      loading_button_label: '가입 중...',
      social_provider_text: '{{provider}}로 회원가입',
      link_text: '계정이 없으신가요? 등록하기',
      confirmation_text: '회원가입 확인 메일을 보냈습니다.',
    },
    sign_in: {
      email_label: '이메일 주소',
      password_label: '비밀번호',
      email_input_placeholder: '이메일을 입력하세요',
      password_input_placeholder: '비밀번호를 입력하세요',
      button_label: '로그인',
      loading_button_label: '로그인 중...',
      social_provider_text: '{{provider}}로 로그인',
      link_text: '이미 계정이 있으신가요? 로그인하기',
    },
    forgotten_password: {
      email_label: '이메일 주소',
      password_label: '비밀번호',
      email_input_placeholder: '이메일을 입력하세요',
      button_label: '비밀번호 재설정 메일 전송',
      loading_button_label: '전송 중...',
      link_text: '비밀번호를 잊으셨나요?',
      confirmation_text: '비밀번호 재설정 메일을 확인해주세요.',
    },
  },
};

/* ============================================
   비주얼 헬퍼 함수
   ============================================ */
function formatDday(dday) {
  if (dday === null || dday === undefined) return null;
  if (dday > 7) return { text: `D-${dday}`, className: "event-card__dday--active" };
  if (dday >= 0) return { text: dday === 0 ? "D-Day" : `D-${dday}`, className: "event-card__dday--soon" };
  return { text: `D+${Math.abs(dday)}`, className: "event-card__dday--ended" };
}

function formatDateRange(start, end) {
  if (!start && !end) return "기간 미정";
  const s = start ? start.replace(/-/g, ".") : "?";
  const e = end ? end.replace(/-/g, ".") : "?";
  return `${s} ~ ${e}`;
}

/* ============================================
   서브 컴포넌트
   ============================================ */
function Toast({ message, visible }) {
  return <div className={`toast ${visible ? "toast--visible" : ""}`}>{message}</div>;
}

function StatCard({ label, value, sub, gradient }) {
  return (
    <div className="stat-card" style={{ "--gradient": gradient }}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}

// 이벤트 카드
function EventCard({ event, aliases, onToggle }) {
  const dday = formatDday(event.d_day);

  // 이벤트가 현재 활성화(진행중)인지?
  const isActive = event.status === "진행중";

  // 하나라도 체크된 계좌가 있는지 여부를 시각적 하이라이트용으로 사용
  const hasAnyCheck = Object.values(event.checkedAliases || {}).some((v) => v);

  return (
    <div className={`event-card ${hasAnyCheck ? "event-card--checked" : ""}`} style={{ animationDelay: `${Math.random() * 0.15}s` }}>
      <div className={`event-card__accent event-card__accent--${event.provider}`} />
      
      <div className="event-card__body">
        <div className="event-card__header">
          <span className={`event-card__provider event-card__provider--${event.provider}`}>{event.provider}</span>
          <span className={`event-card__status ${isActive ? "event-card__status--active" : "event-card__status--ended"}`}>
            <span className="event-card__status-dot" />
            {event.status}
          </span>
          {dday && <span className={`event-card__dday ${dday.className}`}>{dday.text}</span>}
        </div>
        
        <div className="event-card__title">
          {event.title}
          {event.link && (
            <a href={event.link} target="_blank" rel="noopener noreferrer" className="event-card__link" title="이벤트 창 열기"> ↗</a>
          )}
        </div>
        <div className="event-card__meta">
          <span className="event-card__date">📅 {formatDateRange(event.start_date, event.end_date)}</span>
        </div>
      </div>

      <div className="event-card__accounts">
        {aliases.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>우측 상단 ⚙️설정에서 계좌(별명)를 추가해주세요!</div>
        ) : (
          aliases.map((alias) => {
            const isChecked = event.checkedAliases?.[alias.id] || false;
            return (
              <label key={alias.id} className="event-card__checkbox-container">
                <input 
                  type="checkbox" 
                  checked={isChecked} 
                  onChange={() => onToggle(event.id, alias.id, isChecked)} 
                  disabled={!isActive} // 끝난 이벤트는 조작 방지 (원치 않으면 해제)
                />
                <span className="event-card__alias-name">{alias.name}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ============================================
   메인 App 컴포넌트
   ============================================ */
export default function App() {
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [toast, setToast] = useState({ message: "", visible: false });
  const [showSettings, setShowSettings] = useState(false);
  const [newAliasName, setNewAliasName] = useState("");

  // 세션 확인
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const showToast = useCallback((message) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 2500);
  }, []);

  // 기초 데이터 로드 (이벤트 + 별명)
  const loadData = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 순차/병렬 로드
      const [fetchedAliases, eventsData] = await Promise.all([
        fetchAliases(session.user.id),
        fetchEvents(session.user.id)
      ]);
      setAliases(fetchedAliases || []);
      setEvents(eventsData.events || []);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
      showToast("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [session, selectedProvider, selectedStatus, showToast]);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [loadData, session]);

  // 체크박스 토글
  const handleToggle = async (eventId, aliasId, currentlyChecked) => {
    try {
      const result = await toggleEventChecked(eventId, session.user.id, aliasId, currentlyChecked);
      
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id === eventId) {
            return {
              ...e,
              checkedAliases: {
                ...e.checkedAliases,
                [aliasId]: result.checked
              }
            };
          }
          return e;
        })
      );
      
      showToast(result.checked ? "✅ 참여 완료!" : "↩️ 참여 취소");
    } catch (err) {
      console.error(err);
      showToast("⚠️ 상태 변경 실패");
    }
  };

  // 계좌 추가 액션
  const handleAddAlias = async (e) => {
    e.preventDefault();
    if (!newAliasName.trim()) return;
    try {
      const added = await addAlias(session.user.id, newAliasName.trim());
      setAliases([...aliases, added]);
      setNewAliasName("");
      showToast("계좌가 추가되었습니다.");
    } catch (err) {
      console.error(err);
      showToast("⚠️ 계좌 추가 실패");
    }
  };

  // 계좌 삭제 액션
  const handleRemoveAlias = async (aliasId) => {
    if (!confirm("이 계좌의 참여 내역이 함께 삭제될 수 있습니다. 진행할까요?")) return;
    try {
      await removeAlias(aliasId, session.user.id);
      setAliases(aliases.filter((a) => a.id !== aliasId));
      loadData(); // 체크 상태 동기화를 위해 재로드
      showToast("계좌가 삭제되었습니다.");
    } catch (err) {
      console.error(err);
      showToast("⚠️ 삭제 실패");
    }
  };

  // [UI렌더링 영역 - 로그인 전]
  if (!session) {
    return (
      <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: '400px', width: '100%', padding: '2rem', background: 'rgba(30, 41, 59, 0.7)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: 'white' }}>ETF Event Tracker</h1>
          <Auth 
            supabaseClient={supabase} 
            appearance={{ theme: ThemeSupa }} 
            localization={korAuthLocalization}
            providers={[]} 
          />
        </div>
      </div>
    );
  }

  // 헬퍼: 이벤트가 "기타(발표/세미나)"인지 판별
  const isMiscEvent = (e) => {
    if (!e.start_date && !e.end_date) return true;
    if (e.title.includes("당첨") || e.title.includes("세미나") || e.title.includes("휴장")) return true;
    return false;
  };

  // [UI렌더링 영역 - 로그인 후]
  const activeEvents = events.filter((e) => e.status === "진행중" && !isMiscEvent(e));
  const miscEvents = events.filter((e) => e.status === "진행중" && isMiscEvent(e));

  // 프론트엔드 필터링 적용
  let displayEvents = events.filter(e => {
    if (selectedProvider && e.provider !== selectedProvider) return false;
    
    const isMisc = isMiscEvent(e);
    if (selectedStatus === "진행중") {
      if (e.status !== "진행중" || isMisc) return false;
    } else if (selectedStatus === "기타") {
      if (!isMisc) return false;
    } else if (selectedStatus === "종료") {
      if (e.status !== "종료") return false;
    }
    
    return true;
  });
  
  // 통계 계산: 모든 체크된 이벤트의 수 (이벤트 수 × 계좌 수는 아님)
  let totalChecks = 0;
  events.forEach(e => {
    totalChecks += Object.values(e.checkedAliases || {}).filter(Boolean).length;
  });
  const maxPossibleChecks = events.length * Math.max(aliases.length, 1);
  const checkPercent = maxPossibleChecks > 0 ? Math.round((totalChecks / maxPossibleChecks) * 100) : 0;

  if (loading && events.length === 0) {
    return (
      <div className="app">
        <div className="loading">
          <div className="loading__spinner" />
          <div className="loading__text">이벤트 데이터를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="header__title">📊 ETF Event Tracker</h1>
          <p className="header__subtitle">TIGER · KODEX · ACE · SOL — 이벤트를 한눈에</p>
          {events.length > 0 && events[0]?.scraped_at && (
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              🔄 최근 수집: {new Date(events[0].scraped_at).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', color: '#e0f2fe', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
          >
            ⚙️ 내 계좌 설정
          </button>
          <button 
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 설정 패널 (아코디언 형태) */}
      {showSettings && (
        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid #334155' }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '1rem', marginTop: 0 }}>👥 관리할 계좌(별명) 목록</h3>
          <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1rem' }}>
            {aliases.map(a => (
              <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0f172a', borderRadius: '6px', marginBottom: '8px' }}>
                <span style={{ color: '#e2e8f0' }}>{a.name}</span>
                <button onClick={() => handleRemoveAlias(a.id)} style={{ background: '#ef4444', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>삭제</button>
              </li>
            ))}
            {aliases.length === 0 && <li style={{ color: '#94a3b8', fontSize: '0.9rem' }}>등록된 계좌가 없습니다. 이벤트를 기록할 계좌를 추가해주세요. (예: 본인, 아내, 자녀1)</li>}
          </ul>
          <form onSubmit={handleAddAlias} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="새로운 계좌(별명) 입력" 
              value={newAliasName}
              onChange={(e) => setNewAliasName(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: 'white' }}
            />
            <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600 }}>추가</button>
          </form>
        </div>
      )}

      <div className="stats-bar">
        <StatCard label="전체 이벤트" value={events.length} gradient="linear-gradient(90deg, #6366f1, #8b5cf6)" />
        <StatCard label="진행중" value={activeEvents.length} sub="현재 참여 가능" gradient="linear-gradient(90deg, #22c55e, #34d399)" />
        <StatCard label="총 체크 횟수" value={totalChecks} sub={`${checkPercent}% 목표 달성`} gradient="linear-gradient(90deg, #f59e0b, #fbbf24)" />
        <StatCard label="등록 계좌" value={`${aliases.length}개`} sub="체크 가능 슬롯" gradient="linear-gradient(90deg, #ef4444, #f97316)" />
      </div>

      <div className="filters">
        <button className={`filter-tab ${!selectedProvider ? "filter-tab--active" : ""}`} onClick={() => setSelectedProvider(null)}>전체</button>
        {PROVIDERS.map((p) => (
          <button key={p.key} className={`filter-tab ${selectedProvider === p.key ? "filter-tab--active" : ""}`} onClick={() => setSelectedProvider(selectedProvider === p.key ? null : p.key)}>
            <span className="filter-dot" style={{ background: p.color }} />
            {p.label}
          </button>
        ))}
        <span className="filter-separator" />
        <button className={`filter-tab filter-tab--status ${selectedStatus === "진행중" ? "filter-tab--active" : ""}`} onClick={() => setSelectedStatus(selectedStatus === "진행중" ? null : "진행중")}>🟢 진행중</button>
        <button className={`filter-tab filter-tab--status ${selectedStatus === "기타" ? "filter-tab--active" : ""}`} onClick={() => setSelectedStatus(selectedStatus === "기타" ? null : "기타")}>📢 안내/발표</button>
        <button className={`filter-tab filter-tab--status ${selectedStatus === "종료" ? "filter-tab--active" : ""}`} onClick={() => setSelectedStatus(selectedStatus === "종료" ? null : "종료")}>🔴 종료</button>
      </div>

      {displayEvents.length > 0 ? (
        <div className="events-grid">
          {displayEvents.map((event, idx) => (
            <EventCard key={event.id || idx} event={event} aliases={aliases} onToggle={handleToggle} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state__icon">📭</div>
          <div className="empty-state__text">{selectedProvider || selectedStatus ? "해당 조건의 이벤트가 없습니다" : "수집된 이벤트가 없습니다."}</div>
        </div>
      )}

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
