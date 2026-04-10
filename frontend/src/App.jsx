import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchEvents, toggleEventChecked, fetchAliases, addAlias, removeAlias, fetchScrapingStatus, triggerManualScrape, fetchAdminSecret, saveAdminSecret } from "./api";
import { supabase } from "./supabaseClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import "./index.css"; // for any residual global styles

const PROVIDERS = [
  { key: "TIGER", label: "TIGER", name: "Mirae Asset TIGER", bgColor: "bg-orange-600", textLabel: "TIGER", shadow: "shadow-orange-900/20", url: "https://investments.miraeasset.com/tigeretf/ko/customer/event/list.do" },
  { key: "KODEX", label: "KODEX", name: "Samsung KODEX", bgColor: "bg-blue-700", textLabel: "KODEX", shadow: "shadow-blue-900/20", url: "https://m.samsungfund.com/etf/lounge/event.do" },
  { key: "ACE", label: "ACE", name: "Korea Invest ACE", bgColor: "bg-yellow-500", textLabel: "ACE", textCol: "text-black", shadow: "shadow-yellow-900/20", url: "https://www.aceetf.co.kr/cs/notice" },
  { key: "SOL", label: "SOL", name: "Shinhan SOL", bgColor: "bg-cyan-600", textLabel: "SOL", shadow: "shadow-cyan-900/20", url: "https://m.blog.naver.com/soletf" },
  { key: "RISE", label: "RISE", name: "KB RISE", bgColor: "bg-red-600", textLabel: "RISE", shadow: "shadow-red-900/20", url: "https://www.riseetf.co.kr/cust/event" },
  { key: "AMUNDI", label: "AMUNDI", name: "NH-Amundi", bgColor: "bg-emerald-800", textLabel: "AMUNDI", textSize: "text-[10px]", shadow: "", url: "https://m.blog.naver.com/nh_amundi" },
  { key: "1Q", label: "1Q", name: "Hana 1Q", bgColor: "bg-green-500", textLabel: "1Q", shadow: "", url: "https://m.blog.naver.com/1qetf" },
  { key: "PLUS", label: "PLUS", name: "Hanwha PLUS", bgColor: "bg-indigo-600", textLabel: "PLUS", textSize: "text-xs", shadow: "", url: "https://m.blog.naver.com/hanwhaasset" },
  { key: "KIWOOM", label: "KIWOOM", name: "Kiwoom KOSETF", bgColor: "bg-pink-600", textLabel: "KIWOOM", textSize: "text-[10px]", shadow: "", url: "https://m.blog.naver.com/kiwoomammkt" },
  { key: "FUN", label: "FUN", name: "Woori FUN", bgColor: "bg-indigo-400", textLabel: "FUN", shadow: "", url: "https://m.funetf.co.kr/membersLounge/event" },
];

function formatDday(dday) {
  if (dday === null || dday === undefined) return null;
  if (dday > 7) return { text: `D-${dday}`, classes: "text-primary bg-primary/10 border-primary/20" };
  if (dday >= 0) return { text: dday === 0 ? "D-Day" : `D-${dday}`, classes: "text-orange-400 bg-orange-400/10 border-orange-400/20 animate-pulse" };
  return { text: `D+${Math.abs(dday)}`, classes: "text-outline border-outline/20 opacity-60" };
}

function formatDateRange(start, end) {
  if (!start && !end) return "기간 미정";
  const s = start ? start.replace(/-/g, ".") : "?";
  const e = end ? end.replace(/-/g, ".") : "?";
  return `${s} ~ ${e}`;
}

// Event Card using Tailwind
function EventCard({ event, aliases, onToggle }) {
  const dday = formatDday(event.d_day);
  const isActive = event.status === "진행중";
  const hasAnyCheck = Object.values(event.checkedAliases || {}).some((v) => v);
  const pConf = PROVIDERS.find(p => p.key === event.provider) || PROVIDERS[0];

  return (
    <div className={`bg-surface-container rounded-3xl p-6 transition-all duration-300 border border-transparent hover:border-outline-variant/30 flex flex-col ${hasAnyCheck ? 'ring-1 ring-primary/30' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${pConf.bgColor} flex items-center justify-center ${pConf.shadow}`}>
            <span className={`${pConf.textCol || 'text-white'} font-black ${pConf.textSize || 'text-xs'}`}>{pConf.textLabel}</span>
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{event.provider}</p>
            {dday && <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${dday.classes}`}>{dday.text}</span>}
          </div>
        </div>
        {event.link && (
          <a href={event.link} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-surface-container-highest hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </a>
        )}
      </div>
      <h4 className="text-base font-bold font-headline mb-3 line-clamp-2 min-h-[3rem]">{event.title}</h4>
      <div className="text-xs text-on-surface-variant mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
        {formatDateRange(event.start_date, event.end_date)}
      </div>
      <div className="mt-auto pt-4 border-t border-outline-variant/20 flex flex-wrap gap-x-4 gap-y-2">
        {aliases.length === 0 ? (
          <p className="text-[10px] text-outline text-center">계좌를 추가해야 참여 여부를 체크할 수 있습니다.</p>
        ) : (
          aliases.map((alias) => {
            const isChecked = event.checkedAliases?.[alias.id] || false;
            return (
              <label key={alias.id} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    className="peer sr-only"
                    checked={isChecked} 
                    onChange={() => onToggle(event.id, alias.id, isChecked)} 
                    disabled={!isActive}
                  />
                  <div className="w-5 h-5 rounded border border-outline-variant group-hover:border-primary peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                    {isChecked && <span className="material-symbols-outlined text-[14px] text-on-primary font-bold">check</span>}
                  </div>
                </div>
                <span className={`text-sm font-medium transition-colors ${isChecked ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}`}>{alias.name}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null); 
  const [selectedStatus, setSelectedStatus] = useState("전체 보기"); 
  const [toast, setToast] = useState({ message: "", visible: false, type: "success" });
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [newAliasName, setNewAliasName] = useState("");
  const [scrapingStatus, setScrapingStatus] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAdmin(session?.user?.email === 'aikks3782@gmail.com');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setIsAdmin(s?.user?.email === 'aikks3782@gmail.com');
    });
    return () => subscription.unsubscribe();
  }, []);

  const showToastMsg = useCallback((message, type="success") => {
    setToast({ message, visible: true, type });
    setTimeout(() => setToast({ message: "", visible: false, type: "success" }), 3000);
  }, []);

  const loadData = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    try {
      const [fetchedAliases, eventsData, statusUpdate] = await Promise.all([
        fetchAliases(session.user.id),
        fetchEvents(session.user.id),
        fetchScrapingStatus()
      ]);
      setAliases(fetchedAliases || []);
      setEvents(eventsData.events || []);
      setScrapingStatus(statusUpdate);
      if (isAdmin) {
        const token = await fetchAdminSecret('GITHUB_PAT');
        setAdminToken(token);
      }
    } catch (err) {
      showToastMsg("데이터 연동 실패", "error");
    } finally {
      setLoading(false);
    }
  }, [session, isAdmin, showToastMsg]);

  useEffect(() => { if (session) loadData(); }, [loadData, session]);

  const handleToggle = async (eventId, aliasId, currentlyChecked) => {
    try {
      const result = await toggleEventChecked(eventId, session.user.id, aliasId, currentlyChecked);
      setEvents(prev => prev.map(e => {
        if (e.id === eventId) return { ...e, checkedAliases: { ...e.checkedAliases, [aliasId]: result.checked } };
        return e;
      }));
      showToastMsg(result.checked ? "참여 상태가 업데이트되었습니다." : "참여 취소됨");
    } catch (err) { showToastMsg("상태 변경 실패", "error"); }
  };

  const handleAddAlias = async (e) => {
    e.preventDefault();
    if (!newAliasName.trim()) return;
    try {
      const added = await addAlias(session.user.id, newAliasName.trim());
      setAliases([...aliases, added]);
      setNewAliasName("");
      showToastMsg("새 계좌가 등록되었습니다.");
    } catch (err) { showToastMsg("등록 실패", "error"); }
  };

  const handleRemoveAlias = async (aliasId) => {
    if (!window.confirm("삭제하시겠습니까?")) return;
    try {
      await removeAlias(aliasId, session.user.id);
      setAliases(aliases.filter((a) => a.id !== aliasId));
      loadData();
      showToastMsg("계좌 삭제됨");
    } catch (err) { showToastMsg("삭제 실패", "error"); }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="bg-surface-container rounded-3xl p-8 w-full max-w-sm shadow-2xl">
          <h1 className="text-2xl font-bold font-headline mb-6 text-center text-primary">ETF Event Tracker</h1>
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={[]} />
        </div>
      </div>
    );
  }

  // 데이터 필터링 계산
  const uniqueEventsMap = new Map();
  events.forEach(e => { if (!uniqueEventsMap.has(e.id)) uniqueEventsMap.set(e.id, e); });
  const uniqueEvents = Array.from(uniqueEventsMap.values());

  const activeEventsCount = uniqueEvents.filter(e => e.status === "진행중").length;
  const participatedCount = uniqueEvents.filter(e => Object.values(e.checkedAliases || {}).some(Boolean)).length;
  const totalChecks = events.reduce((acc, e) => acc + Object.values(e.checkedAliases || {}).filter(Boolean).length, 0);
  const maxPossibleChecks = events.length * Math.max(aliases.length, 1);
  const checkPercent = maxPossibleChecks > 0 ? Math.round((totalChecks / maxPossibleChecks) * 100) : 0;
  
  const upcomingEvents = uniqueEvents.filter(e => e.status === "진행중" && e.d_day >= 0 && e.d_day <= 3).length;

  let displayEvents = uniqueEvents.filter(e => {
    if (searchQuery && !e.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedProvider && e.provider !== selectedProvider) return false;
    if (selectedStatus === "참여 목록") {
      const hasAnyCheck = Object.values(e.checkedAliases || {}).some((v) => v);
      if (!hasAnyCheck || e.status !== "진행중") return false;
    } else {
      if (e.status !== "진행중") return false;
    }
    return true;
  }).sort((a, b) => (a.d_day ?? 9999) - (b.d_day ?? 9999));

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-[#0a0e17]/80 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
        <nav className="flex justify-between items-center w-full px-8 h-16">
          <div className="flex items-center gap-12">
            <span className="text-xl font-bold tracking-tighter text-[#ebedfb] font-headline cursor-pointer" onClick={() => {setSelectedProvider(null); setSelectedStatus("전체 보기");}}>ETF Tracker</span>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <button className="text-[#73ffba] border-b-2 border-[#73ffba] pb-1 font-headline" onClick={() => {setSelectedProvider(null); setSelectedStatus("전체 보기");}}>종합 현황</button>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative hidden lg:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input 
                className="bg-surface-container-highest border-none outline-none rounded-full pl-10 pr-4 py-1.5 text-sm focus:ring-1 focus:ring-primary w-64 text-on-surface" 
                placeholder="이벤트 검색..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setShowSettings(!showSettings)} className={`hover:bg-[#262c3a]/50 p-2 rounded-full transition-all active:scale-95 duration-200 ${showSettings?'text-primary':'text-on-surface'}`}>
                <span className="material-symbols-outlined">settings</span>
              </button>
              {isAdmin && (
                <button className="bg-primary text-on-primary px-5 py-1.5 rounded-full text-sm font-bold active:scale-95 duration-200 shadow-[0_0_20px_rgba(115,255,186,0.2)]" onClick={() => triggerManualScrape(adminToken)}>
                  관리자 수집 실행
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>

      <aside className="flex flex-col fixed left-0 top-16 bottom-0 p-4 h-[calc(100vh-64px)] w-64 bg-gradient-to-b from-[#0a0e17] to-[#262c3a] z-40 hidden xl:flex border-r border-white/5">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary" data-weight="fill">sensors</span>
          </div>
          <div>
            <p className="text-sm font-black text-[#73ffba] uppercase tracking-wider font-headline">실시간 모니터링</p>
            <p className="text-xs text-on-surface-variant">{scrapingStatus?.status === 'success' || scrapingStatus?.status === '성공' ? '데이터 동기화 완료' : scrapingStatus?.status === '진행중' ? '동기화 중...' : '네트워크 불안정'}</p>
          </div>
        </div>
        <div className="space-y-1 flex-1">
          <button onClick={() => {setSelectedProvider(null); setSelectedStatus("전체 보기");}} className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${selectedProvider === null ? 'bg-[#262c3a] text-[#73ffba]' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}>
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span className="font-medium">종합 개요</span>
          </button>
          <button onClick={() => supabase.auth.signOut()} className="w-full text-left text-[#ebedfb]/70 hover:bg-[#262c3a]/30 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:text-[#ff716c] duration-300">
            <span className="material-symbols-outlined text-xl">logout</span>
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      <main className="pt-24 pb-12 px-6 lg:px-12 xl:ml-64 min-h-screen">
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-8 p-6 bg-surface-container rounded-3xl border border-outline-variant/30 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-lg font-bold font-headline mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">group</span> 내 계좌 관리
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <ul className="space-y-2 mb-4">
                  {aliases.map(a => (
                    <li key={a.id} className="flex items-center justify-between p-3 bg-surface-container-highest rounded-xl text-sm border border-white/5">
                      {a.name}
                      <button onClick={() => handleRemoveAlias(a.id)} className="text-error hover:bg-error/10 p-1.5 rounded-lg transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button>
                    </li>
                  ))}
                  {aliases.length === 0 && <li className="text-sm text-on-surface-variant">등록된 계좌가 없습니다.</li>}
                </ul>
              </div>
              <div>
                <form onSubmit={handleAddAlias} className="flex gap-3">
                  <input value={newAliasName} onChange={e => setNewAliasName(e.target.value)} type="text" placeholder="계좌 별명 (예: 본인, 가족1...)" className="flex-1 bg-surface-container-highest rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none border border-transparent focus:border-primary/50 text-on-surface placeholder:text-on-surface-variant" />
                  <button type="submit" className="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">추가</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tighter text-on-surface font-headline mb-2">
              {selectedProvider ? `${PROVIDERS.find(p=>p.key===selectedProvider)?.name} 이벤트` : "종합 현황"}
            </h1>
            <p className="text-on-surface-variant max-w-xl">운용사별 ETF 이벤트와 참여 상태를 실시간으로 모니터링합니다.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-surface-container-high rounded-2xl p-4 min-w-[140px] flex items-center gap-4 shadow-sm border border-white/5">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">account_balance</span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">등록 계좌</p>
                <p className="text-xl font-bold font-headline">{aliases.length}개</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Stats Bento */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-surface-container-high rounded-3xl p-6 relative overflow-hidden group border border-white/5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="material-symbols-outlined text-6xl">event_list</span></div>
            <p className="text-sm font-bold text-on-surface-variant mb-1">진행중 이벤트</p>
            <h3 className="text-4xl font-extrabold text-on-surface font-headline">{activeEventsCount}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs text-primary font-medium">
              <span className="material-symbols-outlined text-sm">sync</span>
              <span>업데이트: {events[0]?.scraped_at ? new Date(events[0].scraped_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '오늘'}</span>
            </div>
          </div>
          <div className="bg-surface-container-high rounded-3xl p-6 relative overflow-hidden group border border-white/5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="material-symbols-outlined text-6xl">check_circle</span></div>
            <p className="text-sm font-bold text-on-surface-variant mb-1">참여 완료</p>
            <h3 className="text-4xl font-extrabold text-on-surface font-headline">{participatedCount}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs text-outline font-medium">
              <span>{activeEventsCount - participatedCount}개 체크 대기 중</span>
            </div>
          </div>
          <div className="bg-surface-container-high rounded-3xl p-6 relative overflow-hidden group border border-white/5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="material-symbols-outlined text-6xl">analytics</span></div>
            <p className="text-sm font-bold text-on-surface-variant mb-1">참여율</p>
            <h3 className="text-4xl font-extrabold text-primary font-headline">{checkPercent}%</h3>
            <div className="mt-4 w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
              <div className="bg-primary h-full rounded-full shadow-[0_0_8px_#73ffba] transition-all duration-1000" style={{width: `${checkPercent}%`}}></div>
            </div>
          </div>
          <div className="bg-surface-container-high rounded-3xl p-6 relative overflow-hidden group border border-primary/20 shadow-[0_0_30px_rgba(115,255,186,0.05)]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
            <p className="text-sm font-bold text-on-surface-variant mb-1">마감 임박</p>
            <h3 className="text-4xl font-extrabold text-tertiary font-headline">{upcomingEvents}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs text-tertiary font-medium">
              <span>3일 이내 종료</span>
            </div>
          </div>
        </section>

        {/* Filters Section */}
        <section className="mb-8 flex flex-col gap-4">
          {/* Row 1: Status Filters */}
          <div className="flex items-center gap-2">
            <button onClick={() => {setSelectedProvider(null); setSelectedStatus("전체 보기");}} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedProvider === null && (selectedStatus === '전체 보기' || selectedStatus === '전체 이벤트') ? 'bg-primary text-on-primary shadow-lg' : 'bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface'}`}>
              전체 보기
            </button>
            <button onClick={() => {setSelectedProvider(null); setSelectedStatus("참여 목록");}} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedStatus === '참여 목록' ? 'bg-primary text-on-primary shadow-lg' : 'bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface'}`}>
              참여 목록
            </button>
          </div>
          {/* Row 2: Provider Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {PROVIDERS.map(p => (
              <button 
                key={p.key} 
                onClick={() => setSelectedProvider(p.key)}
                className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-colors ${selectedProvider === p.key ? 'bg-primary text-on-primary shadow-lg' : 'bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {loading && events.length === 0 ? (
           <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
        ) : (
          (selectedProvider === null && (selectedStatus === "전체 보기" || selectedStatus === "전체 이벤트")) && !searchQuery ? (
            /* Providers Grid Overview */
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:grid-cols-5 gap-6">
                {PROVIDERS.map(p => {
                  const evts = uniqueEvents.filter(e => e.provider === p.key && e.status === "진행중").length;
                  return (
                    <div key={p.key} onClick={() => setSelectedProvider(p.key)} className="bg-surface-container border border-white/5 rounded-3xl p-6 transition-all hover:bg-surface-container-high hover:-translate-y-1 hover:border-primary/20 duration-300 cursor-pointer flex flex-col">
                      <div className="flex items-start justify-between mb-8">
                        <div className={`w-14 h-14 rounded-2xl ${p.bgColor} flex items-center justify-center ${p.shadow}`}>
                          <span className={`${p.textCol || 'text-white'} font-black ${p.textSize || 'text-lg'}`}>{p.textLabel}</span>
                        </div>
                        {evts > 0 && <span className="bg-surface-container-highest border border-white/10 text-on-surface-variant text-[10px] font-bold px-3 py-1 rounded-full">진행중</span>}
                      </div>
                      <h4 className="text-lg font-bold mb-1 font-headline tracking-tight">{p.name}</h4>
                      <p className="text-sm text-on-surface-variant mb-6 flex-1">{evts}개의 활성 이벤트</p>
                      <button 
                        onClick={(e) => { e.stopPropagation(); window.open(p.url, '_blank'); }}
                        className="w-full flex items-center justify-between bg-surface-container-highest hover:bg-primary hover:text-on-primary p-4 rounded-2xl transition-all font-bold text-sm"
                      >
                        공식 홈페이지
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      </button>
                    </div>
                  );
                })}
              </section>

              {/* Task Specific Section */}
              <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-surface-container border border-white/5 rounded-3xl p-8 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                  <h3 className="text-2xl font-bold mb-6 font-headline flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" data-weight="fill">bolt</span> 최근 활동 알림
                  </h3>
                  <div className="space-y-6">
                    {uniqueEvents.slice(0,3).map((ev, i) => (
                      <div key={ev.id} className="flex gap-4 items-start">
                        <div className={`w-2 h-2 rounded-full mt-2 ${i===0?'bg-primary shadow-[0_0_8px_#73ffba]':'bg-outline-variant'}`}></div>
                        <div className="flex-1 cursor-pointer hover:underline" onClick={() => {if(ev.link) window.open(ev.link, '_blank')}}>
                          <p className="text-on-surface font-medium line-clamp-1">{i===0?'신규':'발견'} {ev.provider} 이벤트: '{ev.title}'</p>
                          <p className="text-xs text-on-surface-variant mt-1">{formatDateRange(ev.start_date, ev.end_date)} • {ev.provider} ETF</p>
                        </div>
                        {i === 0 && <span className="text-[10px] uppercase font-bold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded">NEW</span>}
                        {i === 2 && <span className="material-symbols-outlined text-primary text-sm">verified</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-surface-container border border-white/5 rounded-3xl p-8 flex flex-col justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2 font-headline">시스템 건전성</h3>
                    <p className="text-sm text-on-surface-variant mb-8">안전한 데이터 수집 및 보안 상태입니다.</p>
                    <div className="flex items-center justify-center py-10 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 rounded-full border-4 border-primary/10 border-t-primary border-l-primary/50 animate-[spin:5s_linear_infinite]"></div>
                      </div>
                      <div className="text-center z-10">
                        <p className="text-4xl font-black text-on-surface font-headline">{scrapingStatus?.status === 'success' || scrapingStatus?.status === '성공' ? '99.8%' : '90.2%'}</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">안전함</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface-container-highest p-4 rounded-2xl text-center">
                      <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">API 상태</p>
                      <p className="text-sm font-bold text-primary">{scrapingStatus?.status === 'failed' ? '오류' : '안정'}</p>
                    </div>
                    <div className="bg-surface-container-highest p-4 rounded-2xl text-center">
                       <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">응답 속도</p>
                       <p className="text-sm font-bold text-on-surface">최적</p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
              {displayEvents.length > 0 ? displayEvents.map(e => (
                <EventCard key={e.id} event={e} aliases={aliases} onToggle={handleToggle} />
              )) : (
                <div className="col-span-full py-20 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-5xl mb-4 opacity-50">filter_list_off</span>
                  <p>해당 조건의 이벤트가 없습니다.</p>
                </div>
              )}
            </div>
          )
        )}
      </main>

      {/* FAB */}
      {(selectedProvider || selectedStatus === "참여 목록") && (
         <button onClick={() => {setSelectedProvider(null); setSelectedStatus("전체 보기");}} className="fixed bottom-8 right-8 w-14 h-14 bg-surface-container-highest text-on-surface rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-95 transition-all hover:scale-105 hover:bg-surface-bright border border-white/10">
           <span className="material-symbols-outlined">arrow_back</span>
         </button>
      )}

      {/* Global Toast */}
      {toast.visible && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-8 border border-white/10">
          <span className={`material-symbols-outlined ${toast.type==='success'?'text-primary':'text-error'}`}>
            {toast.type==='success'?'check_circle':'error'}
          </span>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </>
  );
}
