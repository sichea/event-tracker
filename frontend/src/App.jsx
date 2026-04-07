import { useState, useEffect, useCallback } from "react";
import { fetchEvents, toggleEventChecked, fetchAliases, addAlias, removeAlias, fetchScrapingStatus, triggerManualScrape, fetchAdminSecret, saveAdminSecret } from "./api";
import { supabase } from "./supabaseClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import "./index.css";

/* ============================================
   Provider 설정 & 다국어
   ============================================ */
const PROVIDERS = [
  { key: "TIGER", label: "TIGER", color: "#FF6B00", url: "https://www.tigeretf.com" },
  { key: "KODEX", label: "KODEX", color: "#2563EB", url: "https://www.samsungfund.com" },
  { key: "ACE", label: "ACE", color: "#EF4444", url: "https://www.aceetf.co.kr" },
  { key: "SOL", label: "SOL", color: "#8B5CF6", url: "https://www.soletf.com" },
  { key: "RISE", label: "RISE", color: "#EAB308", url: "https://www.riseetf.co.kr" },
  { key: "AMUNDI", label: "AMUNDI", color: "#06B6D4", url: "https://www.nh-amundi.com" },
  { key: "1Q", label: "1Q", color: "#10B981", url: "https://www.1qetf.com" },
  { key: "PLUS", label: "PLUS", color: "#EC4899", url: "https://www.plusetf.co.kr" },
  { key: "KIWOOM", label: "KIWOOM", color: "#A21CAF", url: "https://www.kiwoometf.com" },
  { key: "FUN", label: "FUN", color: "#6366F1", url: "https://www.funetf.co.kr" },
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
          <span className={`event-card__provider event-card__provider--${event.provider}`}>
            {event.provider}
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
  const [selectedProvider, setSelectedProvider] = useState("TIGER");
  const [selectedStatus, setSelectedStatus] = useState("이벤트");
  const [toast, setToast] = useState({ message: "", visible: false });
  const [showSettings, setShowSettings] = useState(false);
  const [newAliasName, setNewAliasName] = useState("");
  const [scrapingStatus, setScrapingStatus] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(null);

  // 세션 확인
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAdmin(session?.user?.email === 'aikks3782@gmail.com');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAdmin(session?.user?.email === 'aikks3782@gmail.com');
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
      const [fetchedAliases, eventsData, statusUpdate] = await Promise.all([
        fetchAliases(session.user.id),
        fetchEvents(session.user.id),
        fetchScrapingStatus()
      ]);
      setAliases(fetchedAliases || []);
      setEvents(eventsData.events || []);
      setScrapingStatus(statusUpdate);

      // 관리자라면 토큰도 가져옴
      if (isAdmin) {
        const token = await fetchAdminSecret('GITHUB_PAT');
        setAdminToken(token);
      }
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

  // 수동 스크래핑 트리거
  const handleManualScrape = async () => {
    let token = adminToken;
    
    if (!token) {
      token = prompt("GitHub Personal Access Token을 입력하세요 (최초 1회 저장):");
      if (!token) return;
      
      try {
        await saveAdminSecret('GITHUB_PAT', token);
        setAdminToken(token);
        showToast("💾 토큰이 DB에 저장되었습니다.");
      } catch (err) {
        console.error(err);
        showToast("⚠️ 토큰 저장 실패");
      }
    }
    
    try {
      showToast("🚀 스크래핑 요청을 보냈습니다...");
      await triggerManualScrape(token);
      showToast("✅ 워크플로우 실행됨 (약 5-10분 소요)");
    } catch (err) {
      console.error(err);
      if (err.message.includes("401")) {
        showToast("❌ 토큰 만료! 다시 입력해 주세요.");
        setAdminToken(null);
      } else {
        showToast(`❌ 실행 실패: ${err.message}`);
      }
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

  // [UI렌더링 영역 - 로그인 후]
  // 1. 중복 제거
  const uniqueEventsMap = new Map();
  events.forEach(e => {
    if (!uniqueEventsMap.has(e.id)) {
      uniqueEventsMap.set(e.id, e);
    }
  });
  const uniqueEvents = Array.from(uniqueEventsMap.values());

  let displayEvents = uniqueEvents.filter(e => {
    // 운용사 필터
    if (selectedProvider && e.provider !== selectedProvider) return false;
    
    // 상태 탭 필터링 ("홈페이지" 선택시에는 필터링 스킵)
    if (selectedStatus === "이벤트") {
      // 진행중인 것만 보여줌
      if (e.status !== "진행중") return false;
    } else if (selectedStatus === "참여완료") {
      // 최소 한 가지 계좌라도 체크된 이벤트만 필터링
      const hasAnyCheck = Object.values(e.checkedAliases || {}).some((v) => v);
      if (!hasAnyCheck || e.status !== "진행중") return false;
    } else if (selectedStatus === "종료") {
      if (e.status !== "종료") return false;
    }
    return true;
  });
  
  // 통계 계산
  const participatedCount = uniqueEvents.filter(e => Object.values(e.checkedAliases || {}).some(Boolean)).length;
  const totalChecks = events.reduce((acc, e) => acc + Object.values(e.checkedAliases || {}).filter(Boolean).length, 0);
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
      <header className="header">
        <div className="header__title-area">
          <h1 className="header__title">📊 ETF Event Tracker</h1>
          <p className="header__subtitle">TIGER · KODEX · ACE · SOL · RISE — 이벤트를 한눈에</p>
          {scrapingStatus?.status === 'failed' ? (
            <p className="header__last-updated" style={{ color: '#f87171', fontWeight: 700 }}>
              ⚠️ 최근 수집: 스크래핑 실패 ({new Date(scrapingStatus.last_run).toLocaleString("ko-KR")})
            </p>
          ) : (
            events.length > 0 && events[0]?.scraped_at && (
              <p className="header__last-updated">
                🔄 최근 수집: {new Date(events[0].scraped_at).toLocaleString("ko-KR")}
              </p>
            )
          )}
        </div>
        <div className="header__actions">
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

      {/* 관리자 도구 */}
      {isAdmin && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ color: '#f87171', fontWeight: 700, marginRight: '8px' }}>🛠️ Admin Console</span>
            <span style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
              스크래핑 상태: {scrapingStatus?.status === 'success' ? '정상 ✅' : scrapingStatus?.status === 'failed' ? '실패 ❌' : '확인 중...'}
            </span>
          </div>
          <button 
            onClick={handleManualScrape}
            style={{ background: '#ef4444', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            수동 스크래핑 실행
          </button>
          
          <button 
            onClick={() => {
              const newToken = prompt("새로운 GitHub Token을 입력하세요:", adminToken || "");
              if (newToken) {
                saveAdminSecret('GITHUB_PAT', newToken)
                  .then(() => {
                    setAdminToken(newToken);
                    showToast("✅ 토큰이 업데이트되었습니다.");
                  });
              }
            }}
            style={{ marginLeft: '8px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            토큰 수정
          </button>
        </div>
      )}

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
        <StatCard label="🎁 전체 이벤트" value={events.length} gradient="linear-gradient(90deg, #6366f1, #8b5cf6)" />
        <StatCard label="✅ 참여 완료" value={participatedCount} gradient="linear-gradient(90deg, #f59e0b, #fbbf24)" />
        <StatCard label="📊 참여율" value={`${checkPercent}%`} gradient="linear-gradient(90deg, #10b981, #34d399)" />
        <StatCard label="등록 계좌" value={`${aliases.length}개`} sub="체크 가능 슬롯" gradient="linear-gradient(90deg, #ef4444, #f97316)" />
      </div>

      <div className="filters">
        {PROVIDERS.map((p) => (
          <button key={p.key} className={`filter-tab ${selectedProvider === p.key ? "filter-tab--active" : ""}`} onClick={() => setSelectedProvider(selectedProvider === p.key ? null : p.key)}>
            <span className="filter-dot" style={{ background: p.color }} />
            {p.label}
          </button>
        ))}
        <span className="filter-separator" />
        <button className={`filter-tab filter-tab--status ${selectedStatus === "이벤트" ? "filter-tab--active" : ""}`} onClick={() => setSelectedStatus("이벤트")}>🎁 전체 이벤트</button>
        <button className={`filter-tab filter-tab--status ${selectedStatus === "참여완료" ? "filter-tab--active" : ""}`} onClick={() => setSelectedStatus("참여완료")}>✅ 참여 완료</button>
        <button className={`filter-tab filter-tab--status ${selectedStatus === "홈페이지" ? "filter-tab--active" : ""}`} onClick={() => setSelectedStatus("홈페이지")}>🏢 운용사 홈페이지</button>
      </div>

      {/* 4-3. "홈페이지 바로가기" 탭일 때의 특별 뷰 */}
      {selectedStatus === "홈페이지" && (
        <div className="homepage-shortcuts-grid">
          {PROVIDERS.filter(p => !selectedProvider || p.key === selectedProvider).map(p => (
            <div key={p.key} className="shortcut-card">
              <a href={p.url} target="_blank" rel="noreferrer" className="shortcut-link">
                <div className="shortcut-header">
                  <div className="provider-icon" style={{ backgroundColor: p.color }}>{p.label[0]}</div>
                  <span className="provider-name">{p.label} <span className="provider-sub">공식 홈페이지</span></span>
                </div>
                <div className="shortcut-action">
                  <span>이벤트 보러가기</span>
                  <span className="link-arrow">↗</span>
                </div>
              </a>
            </div>
          ))}
        </div>
      )}

      {selectedStatus !== "홈페이지" && (
        displayEvents.length > 0 ? (
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
        )
      )}

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
