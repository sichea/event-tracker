import { useState, useEffect, useCallback } from "react";
import { fetchEvents, toggleEventChecked } from "./api";
import { supabase } from "./supabaseClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import "./index.css";

/* ============================================
   Provider 설정
   ============================================ */
const PROVIDERS = [
  { key: "TIGER", label: "TIGER", color: "#FF6B00" },
  { key: "KODEX", label: "KODEX", color: "#3B82F6" },
  { key: "ACE", label: "ACE", color: "#10B981" },
  { key: "SOL", label: "SOL", color: "#8B5CF6" },
];

/* ============================================
   Helper Functions
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
   Components
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

function EventCard({ event, onToggle }) {
  const dday = formatDday(event.d_day);
  const isChecked = event.checked || false;

  return (
    <div className={`event-card ${isChecked ? "event-card--checked" : ""}`} style={{ animationDelay: `${Math.random() * 0.15}s` }}>
      <div className={`event-card__accent event-card__accent--${event.provider}`} />
      <div className="event-card__body">
        <div className="event-card__header">
          <span className={`event-card__provider event-card__provider--${event.provider}`}>{event.provider}</span>
          <span className={`event-card__status ${event.status === "진행중" ? "event-card__status--active" : "event-card__status--ended"}`}>
            <span className="event-card__status-dot" />
            {event.status}
          </span>
          {dday && <span className={`event-card__dday ${dday.className}`}>{dday.text}</span>}
        </div>
        <div className="event-card__title">{event.title}</div>
        <div className="event-card__meta">
          <span className="event-card__date">📅 {formatDateRange(event.start_date, event.end_date)}</span>
        </div>
      </div>
      <div className="event-card__actions">
        {event.link && (
          <a href={event.link} target="_blank" rel="noopener noreferrer" className="event-card__link" title="이벤트 페이지 열기">↗</a>
        )}
        <label className="event-card__checkbox" title="참여 완료 체크">
          <input type="checkbox" checked={isChecked} onChange={() => onToggle(event.id, isChecked)} />
        </label>
      </div>
    </div>
  );
}

/* ============================================
   Main App Component
   ============================================ */
export default function App() {
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [toast, setToast] = useState({ message: "", visible: false });

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

  const loadData = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { events } = await fetchEvents(session.user.id, selectedProvider, selectedStatus);
      setEvents(events || []);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
      setEvents([]);
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

  const handleToggle = async (eventId, currentlyChecked) => {
    try {
      const result = await toggleEventChecked(eventId, session.user.id, currentlyChecked);
      const updatedEvent = result.event;
      
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, checked: updatedEvent.checked } : e))
      );
      
      showToast(updatedEvent.checked ? "✅ 참여 완료!" : "↩️ 참여 취소");
    } catch (err) {
      console.error(err);
      showToast("⚠️ 상태 변경 실패");
    }
  };

  if (!session) {
    return (
      <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: '400px', width: '100%', padding: '2rem', background: 'rgba(30, 41, 59, 0.7)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: 'white' }}>ETF Event Tracker</h1>
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={[]} />
        </div>
      </div>
    );
  }

  const activeEvents = events.filter((e) => e.status === "진행중");
  const checkedCount = events.filter((e) => e.checked).length;

  if (loading) {
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
        <button 
          onClick={() => supabase.auth.signOut()}
          style={{ background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
        >
          로그아웃
        </button>
      </header>

      <div className="stats-bar">
        <StatCard label="전체 이벤트" value={events.length} gradient="linear-gradient(90deg, #6366f1, #8b5cf6)" />
        <StatCard label="진행중" value={activeEvents.length} sub="현재 참여 가능" gradient="linear-gradient(90deg, #22c55e, #34d399)" />
        <StatCard label="참여 완료" value={checkedCount} sub={`${events.length ? Math.round((checkedCount / events.length) * 100) : 0}% 달성`} gradient="linear-gradient(90deg, #f59e0b, #fbbf24)" />
        <StatCard label="운용사" value="4" sub="TIGER · KODEX · ACE · SOL" gradient="linear-gradient(90deg, #ef4444, #f97316)" />
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
        <button className={`filter-tab filter-tab--status ${selectedStatus === "종료" ? "filter-tab--active" : ""}`} onClick={() => setSelectedStatus(selectedStatus === "종료" ? null : "종료")}>🔴 종료</button>
      </div>

      {events.length > 0 ? (
        <div className="events-grid">
          {events.map((event, idx) => (
            <EventCard key={event.id || idx} event={event} onToggle={handleToggle} />
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
