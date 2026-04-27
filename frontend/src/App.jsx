import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchEvents, toggleEventChecked, fetchAliases, addAlias, removeAlias, fetchScrapingStatus, triggerManualScrape, fetchAdminSecret, saveAdminSecret, fetchIpoEvents, toggleIpoSubscription, savePushSubscription, removePushSubscription, checkPushSubscription, fetchMarketInsights, fetchAptSubscriptions, fetchParkingRates } from "./api";
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
function EventCard({ event, aliases, onToggle, showToastMsg }) {
  const dday = formatDday(event.d_day);
  const isActive = event.status === "진행중";
  const hasAnyCheck = Object.values(event.checkedAliases || {}).some((v) => v);
  const pConf = PROVIDERS.find(p => p.key === event.provider) || PROVIDERS[0];

  // 종료 후 남은 열람 가능 일수 계산 (참여 목록용)
  const daysAfterEnd = (() => {
    if (isActive || !event.end_date) return null;
    const end = new Date(event.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.floor((today - end) / (1000 * 60 * 60 * 24));
  })();

  const handleShare = async (e) => {
    e.preventDefault();
    const shareData = {
      title: `[ETF 이벤트] ${event.title}`,
      text: `${event.provider}에서 진행하는 ETF 이벤트를 확인해보세요!`,
      url: event.link || window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(event.link || window.location.href);
        if (typeof showToastMsg === 'function') {
           showToastMsg("링크가 클립보드에 복사되었습니다.", "success");
        } else {
           alert("링크가 복사되었습니다.");
        }
      }
    } catch (err) {
      console.error("공유 실패:", err);
    }
  };

  return (
    <div className={`bg-surface-container rounded-3xl p-4 md:p-6 transition-all duration-300 border flex flex-col
      ${!isActive
        ? 'border-outline-variant/10 opacity-70 grayscale-[30%]'
        : hasAnyCheck
          ? 'border-transparent ring-1 ring-primary/30 shadow-[0_0_15px_rgba(115,255,186,0.05)] hover:border-outline-variant/30'
          : 'border-transparent hover:border-outline-variant/30'
      }`}>
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl ${pConf.bgColor} flex items-center justify-center ${pConf.shadow}`}>
            <span className={`${pConf.textCol || 'text-white'} font-black ${pConf.textSize || 'text-[10px] md:text-xs'}`}>{pConf.textLabel}</span>
          </div>
          <div>
            <p className="text-[10px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">{event.provider}</p>
            {isActive && dday && <span className={`inline-block mt-0.5 text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full border ${dday.classes}`}>{dday.text}</span>}
            {!isActive && (
              <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full border border-outline-variant/30 bg-outline-variant/10 text-outline">
                <span className="material-symbols-outlined text-[10px]">event_busy</span>
                종료 {daysAfterEnd !== null ? `D+${daysAfterEnd}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          {!isActive && daysAfterEnd !== null && (
            <span className="text-[9px] text-outline/60 font-medium">{30 - daysAfterEnd}일 후 목록에서 제거</span>
          )}
          <button 
            onClick={handleShare}
            className="w-8 h-8 rounded-full bg-surface-container-highest hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors group/share"
            title="이벤트 공유하기"
          >
            <span className="material-symbols-outlined text-sm">share</span>
          </button>
          {event.link && (
            <a href={event.link} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-surface-container-highest hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors" title="이벤트 페이지 열기">
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
          )}
        </div>
      </div>

      <h4 className="text-sm md:text-base font-bold font-headline mb-2 md:mb-3 line-clamp-2 min-h-[2.5rem] md:min-h-[3rem] leading-snug">{event.title}</h4>
      <div className="text-[11px] md:text-xs text-on-surface-variant mb-4 md:mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
        {formatDateRange(event.start_date, event.end_date)}
      </div>
      <div className="mt-auto pt-3 md:pt-4 border-t border-outline-variant/20 flex flex-wrap gap-x-3 md:gap-x-4 gap-y-2">
        {!isActive ? (
          <div className="w-full flex flex-col gap-2">
            <p className="text-[10px] text-outline w-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">lock</span>
              종료된 이벤트입니다. 참여 기록은 {30 - (daysAfterEnd ?? 0)}일간 보관됩니다.
            </p>
            {hasAnyCheck && (
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {aliases.map((alias) => {
                  if (event.checkedAliases?.[alias.id]) {
                    return (
                      <span key={alias.id} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20 font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">check</span>
                        {alias.name}
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        ) : aliases.length === 0 ? (
          <p className="text-[10px] text-outline text-center w-full">계좌를 추가해야 참여 여부를 체크할 수 있습니다.</p>
        ) : (
          aliases.map((alias) => {
            const isChecked = event.checkedAliases?.[alias.id] || false;
            return (
              <label key={alias.id} className="flex items-center gap-2 md:gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    className="peer sr-only"
                    checked={isChecked} 
                    onChange={() => onToggle(event.id, alias.id, isChecked)} 
                    disabled={!isActive}
                  />
                  <div className="w-4 h-4 md:w-5 md:h-5 rounded border border-outline-variant group-hover:border-primary peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                    {isChecked && <span className="material-symbols-outlined text-[10px] md:text-[14px] text-on-primary font-bold">check</span>}
                  </div>
                </div>
                <span className={`text-xs md:text-sm font-medium transition-colors ${isChecked ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}`}>{alias.name}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============ Apt Card Component ============
function AptCard({ apt }) {
  const statusColors = {
    '청약중': 'text-primary bg-primary/10 border-primary/20',
    '청약예정': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    '청약마감': 'text-outline border-outline/20 opacity-60'
  };

  return (
    <div className={`bg-surface-container rounded-3xl p-5 md:p-6 transition-all duration-300 border flex flex-col h-full
      ${apt.status === '청약마감' ? 'border-outline-variant/10 opacity-70 grayscale-[30%]' : 'border-transparent hover:border-outline-variant/30'}
    `}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">{apt.region} | {apt.housing_type}</span>
            <span className={`text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[apt.status] || ''}`}>{apt.status}</span>
          </div>
          {apt.is_lotto && (
            <div className="flex items-center gap-1.5 animate-rainbow">
              <span className="material-symbols-outlined text-sm" data-weight="fill">casino</span>
              <span className="text-[10px] uppercase tracking-tight">잭팟! 로또 청약 ({apt.lotto_reason})</span>
            </div>
          )}
        </div>
      </div>

      <h4 className="text-base md:text-lg font-bold font-headline mb-3 line-clamp-2 leading-snug">{apt.name}</h4>
      
      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-sm opacity-60">calendar_today</span>
          <span className="font-medium">청약: {formatDateRange(apt.subscription_start, apt.subscription_end)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-sm opacity-60">campaign</span>
          <span className={`font-medium ${new Date().toISOString().split('T')[0] >= (apt.winner_date || '') ? 'text-primary font-bold' : ''}`}>당첨자 발표: {apt.winner_date?.replace(/-/g, '.') || '미정'}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-on-surface-variant/70">
          <span className="material-symbols-outlined text-sm opacity-50">apartment</span>
          <span>{apt.constructor} | {apt.sale_type}</span>
        </div>
      </div>

      {/* 당첨자 확인 버튼 (발표일 이후 노출) */}
      {apt.winner_date && new Date().toISOString().split('T')[0] >= apt.winner_date && (
        <a 
          href="https://www.applyhome.co.kr/co/coa/selectMainView.do#" 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-auto w-full py-3 bg-primary/20 hover:bg-primary text-primary hover:text-on-primary text-xs font-bold rounded-xl border border-primary/30 transition-all flex items-center justify-center gap-2 group"
        >
          <span className="material-symbols-outlined text-sm group-hover:animate-bounce">celebration</span>
          당첨자 확인하기
        </a>
      )}



    </div>
  );
}

// ============ Ipo Modal Component ============
function IpoModal({ ipo, aliases, onClose, onToggleIpo }) {
  if (!ipo) return null;

  const brokerages = (ipo.lead_manager || '알 수 없음')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const statusColor = (status) => {
    if (status === '청약예정') return 'bg-tertiary/20 text-tertiary border-tertiary/30';
    if (status === '청약중') return 'bg-primary/20 text-primary border-primary/30 animate-pulse';
    return 'bg-outline-variant/20 text-outline border-outline-variant/30';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="bg-surface-container rounded-3xl w-full max-w-lg border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold font-headline truncate flex-1 pr-4">{ipo.company_name}</h2>
          <button onClick={onClose} className="p-2 -mr-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors shrink-0">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(ipo.status)}`}>{ipo.status}</span>
            {ipo.listing_date && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-400/30 bg-purple-400/10 text-purple-400">상장예정: {ipo.listing_date}</span>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm bg-surface-container-highest p-4 rounded-2xl border border-white/5">
            <div>
              <p className="text-[10px] text-on-surface-variant font-bold mb-1">청약일정</p>
              <p className="font-medium text-on-surface">{ipo.subscription_start?.replace(/-/g,'.')} ~ {ipo.subscription_end?.replace(/-/g,'.')}</p>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant font-bold mb-1">확정/희망공모가</p>
              <p className="font-medium text-on-surface">{ipo.confirmed_price || ipo.desired_price || '-'}</p>
            </div>
            {ipo.min_subscription_amount && (
              <div className="col-span-2 border-t border-white/5 pt-3">
                <p className="text-[10px] text-primary font-bold mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">payments</span> 균등 청약 최소 증거금 (10주 기준)
                </p>
                <p className="text-lg font-black text-primary font-headline">
                  {new Intl.NumberFormat('ko-KR').format(ipo.min_subscription_amount)}원
                </p>
              </div>
            )}
            {ipo.competition_rate && ipo.competition_rate !== '-' && (
              <div className="col-span-2 border-t border-white/5 pt-3 mt-1">
                <p className="text-[10px] text-on-surface-variant font-bold mb-1">기관경쟁률</p>
                <p className="font-medium text-on-surface">{ipo.competition_rate}</p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <h3 className="text-sm font-bold font-headline mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">domain</span> 주관사 및 청약 기록
            </h3>
            {brokerages.map(brk => (
              <div key={brk} className="mb-4 bg-surface-container-high rounded-xl p-4 border border-white/5">
                <p className="text-xs font-bold text-on-surface mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  {brk}
                </p>
                <div className="flex flex-wrap gap-2">
                  {aliases.length === 0 ? (
                    <p className="text-[10px] text-outline">등록된 계좌가 없습니다. 창을 닫고 계좌관리를 이용해주세요.</p>
                  ) : (
                    aliases.map(alias => {
                      const isChecked = ipo.checkedSubscriptions?.[brk]?.[alias.id] || false;
                      return (
                        <button 
                          key={alias.id}
                          onClick={() => onToggleIpo(ipo.id, brk, alias.id, isChecked)}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5
                            ${isChecked ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(115,255,186,0.1)] text-primary' 
                                        : 'bg-surface-container-highest border-transparent text-on-surface-variant hover:border-white/10 hover:text-on-surface'}`}
                        >
                          {isChecked && <span className="material-symbols-outlined text-[12px]">check</span>}
                          {alias.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PUBLIC_HOLIDAYS_2026 = {
  "2026-01-01": "신정",
  "2026-02-16": "설연휴", "2026-02-17": "설날", "2026-02-18": "설연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석연휴", "2026-09-25": "추석", "2026-09-26": "추석연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절"
};

// ============ IPO Calendar Component ============
function IpoCalendar({ ipoEvents, onSelectIpo }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  
  // Build a map: dateStr -> [events]
  const dateEventMap = useMemo(() => {
    const map = {};
    (ipoEvents || []).forEach(evt => {
      if (evt.subscription_start) {
        const s = evt.subscription_start;
        if (!map[s]) map[s] = [];
        map[s].push({ ...evt, type: '청약시작' });
      }
      if (evt.subscription_end) {
        const e = evt.subscription_end;
        if (!map[e]) map[e] = [];
        map[e].push({ ...evt, type: '청약마감' });
      }
      if (evt.listing_date) {
        const l = evt.listing_date;
        if (!map[l]) map[l] = [];
        map[l].push({ ...evt, type: '상장' });
      }
    });
    return map;
  }, [ipoEvents]);
  
  const days = [];
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  
  // Status color helper
  const statusColor = (status) => {
    if (status === '청약예정') return 'bg-tertiary/20 text-tertiary border-tertiary/30';
    if (status === '청약중') return 'bg-primary/20 text-primary border-primary/30 animate-pulse';
    return 'bg-outline-variant/20 text-outline border-outline-variant/30';
  };
  
  // Tag color helper
  const getTagStyle = (type) => {
    if (type === '청약시작') return 'bg-primary/20 text-primary border-primary/30';
    if (type === '청약마감') return 'bg-orange-400/20 text-orange-400 border-orange-400/30';
    if (type === '상장') return 'bg-purple-400/20 text-purple-400 border-purple-400/30';
    return 'bg-outline-variant/20 text-outline border-outline-variant/30';
  };

  const getDotStyle = (type) => {
    if (type === '청약시작') return 'bg-primary';
    if (type === '청약마감') return 'bg-orange-400';
    if (type === '상장') return 'bg-purple-400';
    return 'bg-outline';
  };
  
  // Upcoming IPOs (sorted by date)
  const upcomingIpos = (ipoEvents || []).filter(e => e.status === '청약예정' || e.status === '청약중').sort((a,b) => (a.subscription_start || '').localeCompare(b.subscription_start || ''));

  return (
    <div>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tighter text-on-surface font-headline">공모주 캘린더</h1>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="w-10 h-10 rounded-full bg-surface-container-highest hover:bg-surface-bright flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="text-lg font-bold font-headline min-w-[140px] text-center">{year}년 {month + 1}월</span>
          <button onClick={nextMonth} className="w-10 h-10 rounded-full bg-surface-container-highest hover:bg-surface-bright flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          {/* Desktop Grid View */}
          <div className="hidden md:block bg-surface-container border border-white/5 rounded-3xl p-6">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(wd => (
                <div key={wd} className={`text-center text-xs font-bold py-2 ${wd === '일' ? 'text-error' : wd === '토' ? 'text-tertiary' : 'text-on-surface-variant'}`}>{wd}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />;
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const eventsForDay = dateEventMap[dateStr] || [];
                const isToday = dateStr === todayStr;
                const dayOfWeek = new Date(year, month, day).getDay();
                const holiday = PUBLIC_HOLIDAYS_2026[dateStr];
                
                return (
                  <div key={day} className={`aspect-square rounded-xl p-1 relative group transition-colors ${isToday ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-surface-container-highest'}`}>
                    <span className={`text-xs font-bold block text-center ${isToday ? 'text-primary' : (dayOfWeek === 0 || holiday) ? 'text-error font-extrabold' : dayOfWeek === 6 ? 'text-tertiary/70' : 'text-on-surface-variant'}`}>{day}</span>
                    {holiday && <div className="text-[7px] text-error font-black text-center -mt-0.5 truncate uppercase">{holiday}</div>}
                    <div className="mt-0.5 space-y-0.5 overflow-hidden">
                      {eventsForDay.slice(0, 3).map((ev, ei) => (
                        <div key={ei} onClick={() => onSelectIpo(ev)} title={`${ev.company_name} (${ev.type})`} className={`text-[8px] leading-tight px-1 py-0.5 rounded truncate border cursor-pointer hover:opacity-80 transition-opacity ${getTagStyle(ev.type)}`}>
                          {ev.company_name}
                        </div>
                      ))}
                      {eventsForDay.length > 3 && <div className="text-[8px] text-on-surface-variant text-center">+{eventsForDay.length - 3}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Dot Grid View */}
          <div className="md:hidden bg-surface-container border border-white/10 rounded-3xl overflow-hidden mb-6 shadow-2xl">
            <div className="grid grid-cols-7 gap-px bg-white/5 p-4">
              {weekDays.map(wd => (
                <div key={wd} className={`text-center text-[10px] font-black pb-2 ${wd === '일' ? 'text-error' : wd === '토' ? 'text-tertiary' : 'text-on-surface-variant'}`}>{wd}</div>
              ))}
              {days.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="aspect-square bg-surface-container/50 opacity-10" />;
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const eventsForDay = dateEventMap[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const dayOfWeek = new Date(year, month, day).getDay();
                const holiday = PUBLIC_HOLIDAYS_2026[dateStr];
                
                return (
                  <div 
                    key={dateStr} 
                    onClick={() => setSelectedDate(dateStr)}
                    className={`aspect-square relative flex flex-col items-center justify-center gap-0.5 transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/10 rounded-lg z-10' : ''}`}
                  >
                    <span className={`text-sm font-bold ${isToday ? 'text-primary underline underline-offset-4 decoration-2' : (dayOfWeek === 0 || holiday) ? 'text-error' : isSelected ? 'text-on-surface' : 'text-on-surface/80'}`}>{day}</span>
                    {holiday && <span className="text-[6px] text-error font-black truncate px-0.5 text-center leading-none">{holiday}</span>}
                    <div className="flex gap-0.5 flex-wrap justify-center px-1 h-1">
                      {eventsForDay.slice(0,3).map((ev,i) => (
                        <div key={i} className={`w-1 h-1 rounded-full ${getDotStyle(ev.type)}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Selected Date Detail List (Mobile) */}
            <div className="bg-[#1a1f2c] p-6 border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-[#ebedfb] flex items-center gap-2">
                   <span className="material-symbols-outlined text-sm text-primary">event_note</span>
                   {selectedDate.replace(/-/g, '.')} 일정
                </h4>
                {selectedDate === todayStr && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">TODAY</span>}
              </div>
              <div className="space-y-3">
                {(dateEventMap[selectedDate] || []).length === 0 ? (
                  <div className="text-center py-6 opacity-40">
                    <p className="text-xs italic text-on-surface-variant">일정이 없습니다.</p>
                  </div>
                ) : (
                  dateEventMap[selectedDate].map((ev, i) => (
                    <div key={i} onClick={() => onSelectIpo(ev)} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-bottom-2 cursor-pointer hover:bg-white/10 transition-colors">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-on-surface">{ev.company_name}</span>
                          {ev.min_subscription_amount && ev.type === '청약' && (
                            <span className="text-[9px] text-primary font-bold">약 {new Intl.NumberFormat('ko-KR').format(ev.min_subscription_amount)}원</span>
                          )}
                        </div>
                        {ev.type !== '상장' && ev.lead_manager && <span className="text-[9px] text-on-surface-variant truncate max-w-[150px]">{ev.lead_manager}</span>}
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border shrink-0 ${getTagStyle(ev.type)}`}>{ev.type}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Upcoming IPO List */}
        <div className="xl:block">
          <div className="bg-surface-container border border-white/5 rounded-3xl p-6">
            <h3 className="text-xl font-bold font-headline mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary">upcoming</span> 예정된 공모주
            </h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {upcomingIpos.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-8">예정된 공모주가 없습니다.</p>
              ) : upcomingIpos.map(ipo => (
                <div key={ipo.id} onClick={() => onSelectIpo(ipo)} className="bg-surface-container-highest rounded-2xl p-4 border border-white/5 hover:border-primary/20 transition-all cursor-pointer flex flex-col group">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h4 className="font-bold text-sm font-headline line-clamp-1 group-hover:text-primary transition-colors">{ipo.company_name}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusColor(ipo.status)}`}>{ipo.status}</span>
                  </div>
                  <div className="text-xs text-on-surface-variant space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      <span>{ipo.subscription_start?.replace(/-/g,'.')} ~ {ipo.subscription_end?.replace(/-/g,'.')}</span>
                    </div>
                    {ipo.listing_date && (
                      <div className="flex items-center gap-2 text-purple-400 font-bold">
                        <span className="material-symbols-outlined text-[14px]">rocket_launch</span>
                        <span>상장일: {ipo.listing_date?.replace(/-/g,'.')}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 pt-1">
                      {ipo.confirmed_price && (
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">price_check</span>
                          <span>공모가: {ipo.confirmed_price}</span>
                        </div>
                      )}
                      {ipo.min_subscription_amount && (
                        <div className="flex items-center gap-1 text-primary font-bold">
                          <span className="material-symbols-outlined text-[14px]">payments</span>
                          <span>균등 최소: {new Intl.NumberFormat('ko-KR').format(ipo.min_subscription_amount)}원</span>
                        </div>
                      )}
                      {ipo.lead_manager && (
                        <div className="flex items-start gap-1">
                          <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">business</span>
                          <span className="break-words whitespace-normal">{ipo.lead_manager}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 투자 인사이트 대시보드 ───
const INSIGHTS_DATA = [
  {
    id: 'war',
    label: '전쟁/위기',
    icon: 'local_fire_department',
    color: '#ef4444',
    bgGrad: 'from-red-500/20 to-orange-500/10',
    summary: '불확실성 극대화로 실물 자산과 절대적 안전 자산으로 돈이 대피합니다.',
    up: [
      { 
        name: '방산주', 
        desc: '지정학적 리스크 확대로 인한 국방 수요 및 수출 증가',
        products: [
          {"name": "TIGER 현대로템 (064350)", "strategy": "지정학적 분쟁 상황에서 지상 무기 체계 수요 급증 수혜"},
          {"name": "KODEX iSelect방산테마 (456310)", "strategy": "국내 주요 방산업체에 분산 투자하여 안보 위기 상황 대응"},
          {"name": "TIGER 우주방산 (441900)", "strategy": "우주 항공 및 첨단 무기 체계 모멘텀을 동시에 보유한 기업군"}
        ],
        icon: 'shield' 
      },
      { 
        name: '금/은', 
        desc: '불확실성 속에서 가치가 오르는 최고의 안전 자산',
        products: [
          {"name": "ACE KRX금현물 (411060)", "strategy": "화폐 가치 하락 및 위기 상황에서 실물 금을 통한 가치 보존"},
          {"name": "TIGER 금은선물(H) (139310)", "strategy": "장내 선물을 통해 비용 효율적으로 금과 은에 동시에 투자"},
          {"name": "KODEX 골드선물(H) (132030)", "strategy": "환율 변동 위험 없이 국제 금 시세 수익을 추구하는 전략"}
        ],
        icon: 'diamond' 
      },
      { 
        name: '에너지 ETF', 
        desc: '전쟁으로 인한 공급망 차질 및 에너지 가격 폭등 수혜',
        products: [
          {"name": "TIGER 미국S&P500에너지 (414210)", "strategy": "글로벌 정유사 투자를 통해 원유 가격 상승분을 수익화"},
          {"name": "KODEX 미국S&P500에너지 (414260)", "strategy": "엑손모빌 등 거대 에너지 기업 중심의 안정적인 에너지 섹터 투자"},
          {"name": "TIGER 구리실물 (160580)", "strategy": "공급망 위축 상황에서 산업 전반의 기초가 되는 구리 가격 상승 수혜"}
        ],
        icon: 'local_gas_station' 
      },
    ],
    down: [
      { 
        name: '글로벌 증시 전반', 
        desc: '리스크 회피 심리 확산으로 인한 위험 자산 매도 압력',
        products: [
          {"name": "TIGER 나스닥100 (133690)", "strategy": "글로벌 유동성 위축 시 변동성이 커질 수 있는 대표 기술주 섹터"},
          {"name": "KODEX 200 (069500)", "strategy": "지정학적 리스크로 인한 국내 코스피 지수의 단기 하락 압력"},
          {"name": "SOL 미국S&P500 (433330)", "strategy": "전 세계적 위기 상황에서 주식형 자산의 전반적인 가치 하락 우려"}
        ],
        icon: 'public' 
      },
      { 
        name: '금융/항공/여행', 
        desc: '이동 제한 및 경기 위축으로 인한 실적 악화 직격탄',
        products: [
          {"name": "KODEX 은행 (091170)", "strategy": "경제 위기 시 대출 건전성 악화 및 금융 시장 경색 우려"},
          {"name": "TIGER 현대차그룹+ (138540)", "strategy": "물류 마비 및 소비 심리 위축으로 인한 대형 내구재 수요 급감"},
          {"name": "ACE 베트남VN30(합성) (245100)", "strategy": "지정학적 리스크에 민감한 신흥국 시장의 자금 유출 우려"}
        ],
        icon: 'flight' 
      }
    ],
  },
  {
    id: 'rate_cut',
    label: '금리 인하',
    icon: 'south',
    color: '#22c55e',
    bgGrad: 'from-green-500/20 to-emerald-500/10',
    summary: '중앙은행이 금리를 인하해 돈줄을 풀어 시중에 돈이 흔해지고, 기업 성장이 가속됩니다.',
    up: [
      { 
        name: '기술주', 
        desc: '저금리 수혜를 직접적으로 받는 나스닥 및 혁신 기술주',
        products: [
          {"name": "TIGER 미국나스닥100 (133690)", "strategy": "저금리 환경에서 밸류에이션 매력이 높아지는 빅테크 중심 투자"},
          {"name": "ACE 미국S&P500 (360200)", "strategy": "시장 전반의 완만한 상승세에 투자하는 가장 안정적인 선택"},
          {"name": "KODEX 미국나스닥100선물(H) (304660)", "strategy": "환율 변동 위험 없이 주수익에 집중하는 환헤지형 기술주"}
        ],
        icon: 'memory' 
      },
      { 
        name: '장기 채권', 
        desc: '금리 하락에 따른 자본 차익을 극대화하는 장기 국채',
        products: [
          {"name": "KODEX 미국채울트라30년선물(H) (304660)", "strategy": "금리 하락 시 채권 가격 상승폭이 가장 큰 장기물 타겟"},
          {"name": "TIGER 미국채30년스트립액티브(합성H) (458730)", "strategy": "이표를 제거해 듀레이션을 늘림으로써 수익률 변동성 극대화"},
          {"name": "ACE 미국채20년이상 (451240)", "strategy": "안정적인 미국 장기 국채에 직접 투자하는 대표 상품"}
        ],
        icon: 'account_balance' 
      },
      { 
        name: '리츠(부동산)', 
        desc: '금리 하락으로 조달 비용이 감소하는 수익형 부동산',
        products: [
          {"name": "TIGER 리츠부동산인프라 (329200)", "strategy": "조달 비용 감소로 인한 배당 수익률 및 자산 가치 상승"},
          {"name": "KODEX 미국부동산리츠(합성H) (225060)", "strategy": "전 세계 부동산 시장의 핵심인 미국 리츠에 투자"},
          {"name": "TIGER 미국MSCI리츠(합성H) (182480)", "strategy": "글로벌 상업용 부동산 투자의 정석적인 선택"}
        ],
        icon: 'apartment' 
      },
    ],
    down: [
      { 
        name: '은행/보험', 
        desc: '금리 하락으로 예대마진 및 운용 수익성이 약화되는 섹터',
        products: [
          {"name": "TIGER 은행 (091170)", "strategy": "예대금리차 축소로 인한 금융사 수익성 악화 우려"},
          {"name": "KODEX 보험 (091180)", "strategy": "금리 하락으로 인한 신규 자금 운용 수익률 저하"}
        ],
        icon: 'account_balance_wallet' 
      }
    ],
  },
  {
    id: 'inflation',
    label: '인플레이션',
    icon: 'local_fire_department',
    color: '#f59e0b',
    bgGrad: 'from-amber-500/20 to-yellow-500/10',
    summary: '수요 폭발로 물건값이 오르고 화폐 가치가 떨어지며, 실물 자산의 몸값이 오릅니다.',
    up: [
      { 
        name: '실물 자산(금)', 
        desc: '화폐 가치 하락에 대비하는 영원한 안전 자산',
        products: [
          {"name": "ACE KRX금현물 (411060)", "strategy": "화폐 가치 하락 시 실물 자산으로의 가치 저장 수단 활용"},
          {"name": "TIGER 금은선물(H) (139310)", "strategy": "금과 함께 물가 상승기에 강세를 보이는 은에 분산 투자"},
          {"name": "KODEX 골드선물(H) (132030)", "strategy": "장내 선물을 통해 비용 효율적으로 금에 투자"}
        ],
        icon: 'diamond' 
      },
      { 
        name: '원자재/에너지', 
        desc: '물가 상승을 직접적으로 견인하는 에너지 및 산업용 금속',
        products: [
          {"name": "TIGER 미국S&P500에너지 (414210)", "strategy": "에너지 가격 상승 수혜를 직접적으로 받는 글로벌 정유사 투자"},
          {"name": "KODEX 미국S&P500에너지 (414260)", "strategy": "엑손모빌, 쉐브론 등 글로벌 에너지 대기업 중심 포트폴리오"},
          {"name": "TIGER 구리실물 (160580)", "strategy": "실물 경기 회복과 인플레 상황에서 수요가 급증하는 구리 투자"}
        ],
        icon: 'local_gas_station' 
      },
      { 
        name: '고배당주', 
        desc: '물가 상승분을 이익에 반영할 수 있는 방어적 고배당 섹터',
        products: [
          {"name": "KODEX 고배당 (211900)", "strategy": "물가 상승기에도 견고한 이익을 바탕으로 고배당을 유지하는 기업"},
          {"name": "TIGER 미국배당다우존스 (451150)", "strategy": "미국의 우량 배당 성장주에 투자하여 안정적인 현금 흐름 확보"},
          {"name": "ARIRANG 고배당주 (161510)", "strategy": "국내 고배당 섹터인 금융, 통신주 중심의 분산 투자"}
        ],
        icon: 'payments' 
      },
    ],
    down: [
      { 
        name: '현금/장기채', 
        desc: '물가 상승으로 인해 구매력과 상대적 가치가 급락하는 자산',
        products: [
          {"name": "KODEX 국고채30년액티브 (403990)", "strategy": "물가 상승에 따른 시장 금리 급등 시 채권 가격 폭락 위험"},
          {"name": "TIGER 미국채30년선물 (305080)", "strategy": "인플레 장기화 시 장기 국채 가격 하락 압력 확대"},
          {"name": "KODEX 단기채권 (153130)", "strategy": "실질 금리 마이너스 구간에서 현금성 자산의 구매력 손실"}
        ],
        icon: 'money_off' 
      }
    ],
  },
  {
    id: 'rate_hike',
    label: '금리 인상',
    icon: 'trending_up',
    color: '#6366f1',
    bgGrad: 'from-indigo-500/20 to-violet-500/10',
    summary: '물가를 잡기 위해 금리를 올려 돈줄을 조이며, 현금성 자산을 쥐고 관망하는 것이 최선입니다.',
    up: [
      { 
        name: '은행/금융', 
        desc: '금리 상승에 따른 예대마진(NIM) 확대로 수익성이 직접 개선되는 섹터',
        products: [
          {"name": "KODEX 은행 (091170)", "strategy": "금리 상승에 따른 순이자마진 개선으로 수익성 직결"},
          {"name": "TIGER 금융지주 (145670)", "strategy": "우량 금융지주의 안정적인 이익 창출과 높은 배당 수익률"},
          {"name": "KODEX 보험 (091180)", "strategy": "금리 인상 시 자산 운용 수익률이 개선되어 실적 상승 기대"}
        ],
        icon: 'account_balance_wallet' 
      },
      { 
        name: '단기 채권/파킹', 
        desc: '변동 리스크는 낮추고 오르는 시장 금리를 즉각 반영하는 현금성 자산',
        products: [
          {"name": "KODEX 1년국고채액티브 (395160)", "strategy": "금리 변동 리스크를 최소화하며 고금리 이자 수익 확보"},
          {"name": "TIGER KOFR금리액티브(합성) (430690)", "strategy": "매일 이자가 복리로 쌓이는 파킹형 투자의 정석"},
          {"name": "KODEX CD금리액티브(합성) (459580)", "strategy": "금리 상승기 CD금리 수준의 수익을 안정적으로 제공"}
        ],
        icon: 'payments' 
      },
      { 
        name: '가치주/배당주', 
        desc: '고금리 환경에서도 견고한 현금 흐름을 증명하는 저평가 우량주',
        products: [
          {"name": "KODEX 가치성장 (211900)", "strategy": "현금 흐름이 풍부하고 저평가된 우량 가치주 중심 전략"},
          {"name": "TIGER 미국배당프리미엄액티브 (445680)", "strategy": "커버드콜 전략으로 고금리 환경에서 인컴 수익 극대화"},
          {"name": "KBSTAR 고배당 (266550)", "strategy": "전통적인 고금리 수혜주인 고배당 종목 위주의 포트폴리오"}
        ],
        icon: 'auto_graph' 
      },
    ],
    down: [
      { 
        name: '기술/성장주', 
        desc: '미래 이익에 대한 할인율 상승으로 주가 밸류에이션 압박을 받는 섹터',
        products: [
          {"name": "TIGER 미국나스닥100 (133690)", "strategy": "자금 조달 비용 상승 및 미래 이익에 대한 할인율 부담"},
          {"name": "KODEX 미국팡플러스(H) (314220)", "strategy": "유동성 축소 시 변동성이 커질 수 있는 기술주 집중 투자"},
          {"name": "SOL 미국테크TOP10 (451240)", "strategy": "금리에 민감한 대형 기술주 중심의 하락 압력 우려"}
        ],
        icon: 'memory' 
      }
    ],
  },
  {
    id: 'recession',
    label: '경기 침체',
    icon: 'ac_unit',
    color: '#3b82f6',
    bgGrad: 'from-blue-500/20 to-cyan-500/10',
    summary: '경제가 얼어붙어 주식시장 붕괴 우려가 있으므로, 돈 떼일 염려 없는 안전자산으로 피난합니다.',
    up: [
      { 
        name: '안전 자산(달러)', 
        desc: '전 세계적 위기 상황에서 가치가 상승하는 최후의 결제 수단',
        products: [
          {"name": "KODEX 미국달러선물 (261220)", "strategy": "글로벌 금융 시장 위기 시 수요가 몰리는 안전 자산"},
          {"name": "TIGER 미국달러단기채권액티브 (329750)", "strategy": "달러 가치 상승과 짧은 만기의 이자 수익 동시 확보"},
          {"name": "KODEX 미국달러선물레버리지 (261240)", "strategy": "급격한 경기 침체로 인한 달러 강세 가속화에 베팅"}
        ],
        icon: 'currency_exchange' 
      },
      { 
        name: '필수 소비재', 
        desc: '경기가 어려워도 반드시 소비해야 하는 음식료 및 기초 생활 용품',
        products: [
          {"name": "KODEX 필수소비재 (211210)", "strategy": "경기 둔화와 관계없이 수요가 일정한 방어적 섹터"},
          {"name": "TIGER 필수소비재 (143860)", "strategy": "불황에도 매출 타격이 적은 국내 대표 소비재 기업"},
          {"name": "KODEX 배당성장 (139280)", "strategy": "안정적인 실적을 바탕으로 꾸준히 배당을 지급하는 전략"}
        ],
        icon: 'shopping_cart' 
      },
      { 
        name: '안전 국채', 
        desc: '위험 회피 심리나 시장 금리 하락 가능성에 배팅하는 국채 투자',
        products: [
          {"name": "TIGER 미국채10년선물 (305080)", "strategy": "안전 자산 선호 심리로 국채 가격 상승 수혜 기대"},
          {"name": "KODEX 국고채3년 (114820)", "strategy": "부도 위험이 없는 국고채를 통한 안정적 자산 운용"},
          {"name": "ACE 미국채20년이상 (451240)", "strategy": "침체 시 금리 하락 가능성에 따른 자본 차익 추구"}
        ],
        icon: 'account_balance' 
      },
    ],
    down: [
      { 
        name: '경기 민감주', 
        desc: '소득 감소와 기업 실적 악화로 가장 먼저 타격을 입는 섹터',
        products: [
          {"name": "TIGER 현대차그룹+ (138540)", "strategy": "구매력 저하로 인한 자동차, 기계 등 고가 내구재 수요 급감 우려"},
          {"name": "KODEX 반도체 (091160)", "strategy": "글로벌 IT 경기 위축에 따른 업황 사이클 둔화 직격탄"},
          {"name": "TIGER 200철강커모디티 (139320)", "strategy": "산업 전반의 투자 위축으로 인한 원자재 수요 부진"}
        ],
        icon: 'directions_car' 
      }
    ],
  },
];
const INVESTMENT_DISCLAIMER = "본 정보는 시장 상황 분석에 따른 참고용 예시일 뿐, 특정 종목에 대한 투자 권고나 추천이 아닙니다. 모든 투자의 결과와 책임은 투자자 본인에게 귀속됩니다.";

// ============ Asset Details Modal ============
function AssetDetailsModal({ isOpen, onClose, asset, scenarioLabel, type, yieldDate }) {
  if (!isOpen || !asset) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div 
        className="bg-surface-container rounded-[2.5rem] w-full max-w-md border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-white/5 relative">
          <div className="flex items-center gap-3 mb-1.5">
             <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${type === 'up' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                <span className="material-symbols-outlined text-sm">{type === 'up' ? 'trending_up' : 'trending_down'}</span>
             </div>
             <span className="text-sm font-bold text-on-surface/90 uppercase tracking-tight">{scenarioLabel} 시나리오</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black font-headline text-on-surface mb-2">{asset.category || asset.name}</h2>
          {yieldDate && (
            <p className="text-[10px] md:text-xs text-primary font-bold bg-primary/10 px-3 py-1 rounded-full w-fit">
              📅 {yieldDate} 기준 수익률 TOP 3
            </p>
          )}
          <button onClick={onClose} className="absolute top-6 right-6 md:top-8 md:right-8 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-4">
          <p className="text-xs font-black text-on-surface-variant uppercase tracking-wider opacity-70">🚀 상세 추천 종목 예시 (TOP 3)</p>
          
          {(asset.products || [asset]).map((p, idx) => (
            <div key={idx} className="p-4 md:p-5 rounded-2xl bg-surface-container-highest border border-primary/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12"></div>
              <div className="flex justify-between items-start mb-1 relative z-10">
                <h3 className="text-sm md:text-base font-extrabold text-primary flex-1">{p.name || p.product_name || asset.name}</h3>
              </div>
              <p className="text-[11px] md:text-xs text-on-surface-variant leading-relaxed relative z-10">
                {p.strategy || p.desc || "해당 시장 상황에서 유리한 성과를 기대할 수 있는 대표적인 상품입니다."}
              </p>
            </div>
          ))}

          <div className="bg-surface-container-low p-4 rounded-xl border border-white/5 mt-4">
            <p className="text-[10px] text-on-surface-variant/70 leading-relaxed text-center">
              📌 {INVESTMENT_DISCLAIMER}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 pt-0">
          <button 
            onClick={onClose}
            className="w-full py-3 md:py-4 bg-primary text-on-primary text-sm font-black rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
          >
            확인 하였습니다
          </button>
        </div>
      </div>
    </div>
  );
}

function InvestmentInsights({ subTab }) {
  const [selectedScenario, setSelectedScenario] = useState(INSIGHTS_DATA[0].id);
  const [marketData, setMarketData] = useState(null);
  const [mdLoading, setMdLoading] = useState(true);
  const [detailAsset, setDetailAsset] = useState(null); // { asset, type }
  const [whaleData, setWhaleData] = useState(null);
  const scenario = INSIGHTS_DATA.find(s => s.id === selectedScenario);

  useEffect(() => {
    fetchMarketInsights().then(d => {
      if (d) {
        setMarketData(d);
        const primaryScenario = d.scenario.split(',')[0];
        setSelectedScenario(primaryScenario);
      }
      setMdLoading(false);
    }).catch(() => setMdLoading(false));

    fetch('/data/whale.json')
      .then(res => res.json())
      .then(data => setWhaleData(data))
      .catch(err => console.error("Whale data fetch error:", err));
  }, []);

  const indicators = marketData ? [
    { 
      label: '한국 기준금리', 
      value: marketData.kr_rate != null ? `${marketData.kr_rate}%` : '-', 
      icon: 'flag', 
      prev: marketData.kr_rate_prev,
      desc: '한국은행 금융통화위원회에서 결정하는 정책 금리로, 국내 모든 금리의 기준이 됩니다.'
    },
    { 
      label: '미국 기준금리', 
      value: marketData.us_rate != null ? `${marketData.us_rate}%` : '-', 
      icon: 'public', 
      prev: marketData.us_rate_prev,
      desc: '미국 연준(Fed)이 결정하는 정책 금리로, 글로벌 자산 가격과 달러 가치에 직결됩니다.'
    },
    { 
      label: '미국 CPI (전년비)', 
      value: marketData.us_cpi != null ? `${marketData.us_cpi}%` : '-', 
      icon: 'shopping_cart',
      desc: '소비자물가지수 변화율입니다. 인플레이션 수준을 나타내며 금리 인상/인하의 핵심 근거가 됩니다.'
    },
    { 
      label: '미국 GDP 성장률', 
      value: marketData.us_gdp != null ? `${marketData.us_gdp}%` : '-', 
      icon: 'bar_chart',
      desc: '미국 경제의 성장을 나타냅니다. 2분기 연속 마이너스 성장을 기록하면 경기 침체로 판단합니다.'
    },
  ] : [];

  const news = marketData?.news || [];

  if (subTab === 'dart') {
    return (
      <div className="py-6 md:py-12 animate-in fade-in slide-in-from-bottom-4">
        {/* Header & Guide */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-primary text-2xl" data-weight="fill">notifications_active</span>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tighter font-headline">고래 지분 변동</h1>
              <p className="text-on-surface-variant text-sm md:text-base">큰손들의 실시간 발자취를 추적합니다.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            <div className="p-4 rounded-2xl bg-surface-container-highest border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-sm text-primary">diversity_3</span>
                <p className="text-xs font-bold text-on-surface uppercase">5% 룰 (대량보유)</p>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                기관이나 개인이 지분 <span className="text-primary font-bold">5% 이상</span>을 보유하게 되거나, 기존 보유자의 지분이 1% 이상 변동될 때 공시합니다. 
                경영권 분쟁이나 큰손의 매집 신호일 수 있습니다.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-surface-container-highest border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-sm text-tertiary">person_search</span>
                <p className="text-xs font-bold text-on-surface uppercase">내부자 거래 (임원)</p>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                회사의 <span className="text-tertiary font-bold">임원이나 주요주주</span>가 자사주를 매매할 때 공시합니다. 
                내부 사정을 가장 잘 아는 사람들의 행동이므로 강력한 투자 힌트가 됩니다.
              </p>
            </div>
          </div>
        </div>

        {!whaleData ? (
          <div className="py-20 flex justify-center"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {whaleData.dart.map((item, i) => {
              const isInsider = item.report_nm.includes('임원') || item.report_nm.includes('주요주주');
              const isMajor = item.report_nm.includes('대량보유');
              
              return (
                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="bg-surface-container border border-white/5 rounded-2xl p-5 hover:bg-surface-container-high hover:border-primary/50 transition-all duration-300 group flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-on-surface-variant bg-white/5 px-2 py-0.5 rounded w-fit">
                          {item.date.slice(0,4)}.{item.date.slice(4,6)}.{item.date.slice(6,8)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isInsider ? (
                             <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary border border-tertiary/20">내부자</span>
                          ) : isMajor ? (
                             <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">5% 지분</span>
                          ) : (
                             <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/5 text-on-surface-variant border border-white/10">일반공시</span>
                          )}
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-primary/50 group-hover:text-primary transition-colors text-sm">open_in_new</span>
                    </div>
                    <h3 className="text-xl font-bold font-headline mb-1 text-on-surface group-hover:text-primary transition-colors line-clamp-1">{item.corp_name}</h3>
                    <p className="text-sm font-medium text-on-surface-variant mb-4 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-xs">person</span>
                      {item.filer}
                    </p>
                  </div>
                  <div className="text-[11px] text-on-surface/80 leading-relaxed p-3 bg-black/30 rounded-xl border border-white/5 line-clamp-2 mt-auto font-medium">
                    {item.report_nm}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (subTab === 'nps') {
    return (
      <div className="py-6 md:py-12 animate-in fade-in slide-in-from-bottom-4">
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tighter font-headline mb-2">국민연금 주력주</h1>
          <p className="text-on-surface-variant text-sm md:text-base">국민연금이 대량 보유한 핵심 종목과 최근 투자 동향입니다.</p>
        </div>
        {!whaleData ? (
          <div className="py-20 flex justify-center"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
        ) : (
          <div className="space-y-4">
            {whaleData.nps.map((item, i) => (
              <div key={i} className="bg-surface-container border border-white/5 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-blue-400/30 transition-all">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold font-headline">{item.corp_name}</h3>
                        {item.ticker && <span className="text-sm text-on-surface-variant font-medium">({item.ticker})</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${item.type === '해외' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                          {item.type || '국내'}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${item.trend === '비중확대' ? 'bg-red-500/10 text-red-400 border-red-500/20' : item.trend === '비중축소' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-white/5 text-on-surface-variant border-white/10'}`}>
                          {item.trend}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant">{item.reason}</p>
                </div>
                <div className="flex items-center gap-2 bg-black/20 px-4 py-2 rounded-xl shrink-0">
                  <span className="text-xs font-medium text-on-surface-variant">보유지분</span>
                  <span className="text-lg font-black text-blue-400">{item.ownership_pct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (subTab === 'legends') {
    return (
      <div className="py-6 md:py-12 animate-in fade-in slide-in-from-bottom-4">
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tighter font-headline mb-2">글로벌 투자 전설</h1>
          <p className="text-on-surface-variant text-sm md:text-base">워런 버핏, 레이 달리오 등 거인들의 13F 포트폴리오 픽입니다.</p>
        </div>
        {!whaleData ? (
          <div className="py-20 flex justify-center"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {whaleData.legends.map((item, i) => (
              <div key={i} className="bg-surface-container border border-white/5 rounded-2xl p-6 hover:border-purple-400/30 transition-all flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-purple-400 mb-2">{item.investor}</p>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold font-headline">{item.corp_name} <span className="text-sm text-on-surface-variant font-medium ml-1">({item.ticker})</span></h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${item.action === '신규매수' || item.action === '비중확대' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                      {item.action}
                    </span>
                  </div>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-on-surface-variant">포트폴리오 비중</span>
                    <span className="text-sm font-black text-on-surface">{item.portfolio_pct}%</span>
                  </div>
                  <p className="text-xs text-on-surface-variant/80 border-t border-white/5 pt-2 mt-2">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-6 md:py-12 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="mb-8 md:mb-12">
        <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tighter font-headline mb-2">투자 인사이트</h1>
        <p className="text-on-surface-variant text-sm md:text-base">거시경제 상황에 따른 자산 흐름을 한눈에 파악하세요.</p>
        {marketData?.updated_at && (
          <p className="text-[10px] text-on-surface-variant/40 mt-1">마지막 업데이트: {new Date(marketData.updated_at).toLocaleString('ko-KR')}</p>
        )}
      </div>

      {/* Indicator Cards */}
      {indicators.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          {indicators.map((ind, i) => {
            const diff = ind.prev != null && ind.value !== '-' ? (parseFloat(ind.value) - ind.prev) : null;
            return (
              <div key={i} className="bg-surface-container border border-white/5 rounded-2xl p-4 relative group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">{ind.icon}</span>
                    <span className="text-[10px] md:text-xs text-on-surface-variant font-medium truncate">{ind.label}</span>
                  </div>
                  <div className="relative flex items-center">
                    <span 
                      className="material-symbols-outlined text-[14px] text-on-surface-variant/30 cursor-help hover:text-primary transition-colors"
                      title={ind.desc}
                    >
                      info
                    </span>
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xl md:text-2xl font-extrabold font-headline leading-tight">{ind.value}</span>
                  {diff != null && diff !== 0 && (
                    <span className={`text-[10px] font-bold mb-0.5 ${diff > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                      {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(2)}%p
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Scenario Tabs */}
      <div className="flex gap-2 md:gap-3 overflow-x-auto pt-2 pb-4 mb-6 md:mb-8 scrollbar-hide">
        {INSIGHTS_DATA.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedScenario(s.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 md:px-5 md:py-3 rounded-2xl text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-300 border
              ${selectedScenario === s.id
                ? 'bg-white/10 border-white/20 text-on-surface shadow-lg scale-[1.02]'
                : 'bg-surface-container border-transparent text-on-surface-variant hover:bg-white/5 hover:border-white/10'
              }`}
            style={selectedScenario === s.id ? { borderColor: s.color + '60', boxShadow: `0 4px 20px ${s.color}15` } : {}}
          >
            <span className="material-symbols-outlined text-lg" style={selectedScenario === s.id ? { color: s.color } : {}}>{s.icon}</span>
            {s.label}
            {marketData?.scenario?.split(',').includes(s.id) && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-black text-white animate-pulse shadow-lg shadow-red-500/30">now</span>
            )}
          </button>
        ))}
      </div>


      {/* Scenario Content */}
      {scenario && (
        <div key={scenario.id} className="animate-[fadeIn_0.3s_ease-out]">
          {/* Summary Banner */}
          <div className={`bg-gradient-to-r ${scenario.bgGrad} rounded-3xl p-5 md:p-8 mb-8 border border-white/5`}>
            <div className="flex items-start gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: scenario.color + '20' }}>
                <span className="material-symbols-outlined text-2xl md:text-3xl" style={{ color: scenario.color }}>{scenario.icon}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="text-lg md:text-xl font-extrabold font-headline" style={{ color: scenario.color }}>{scenario.label}</h2>
                  {marketData?.scenario?.split(',').includes(scenario.id) && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">현재 상황</span>
                  )}
                </div>
                <p className="text-on-surface-variant text-sm md:text-base leading-relaxed">{scenario.summary}</p>
                {marketData?.scenario?.split(',').includes(scenario.id) && marketData?.analysis && (
                  <div className="mt-4 p-4 rounded-xl bg-surface-container/50 border border-white/5 backdrop-blur-sm">
                    <div className="flex items-start gap-2 text-xs md:text-sm text-on-surface leading-relaxed">
                      <span className="material-symbols-outlined text-sm md:text-base shrink-0 text-primary mt-0.5">verified</span>
                      <span className="opacity-90">{marketData.analysis}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Split View: UP & DOWN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* UP Card */}
            <div className="bg-surface-container border border-white/5 rounded-3xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg text-red-400">trending_up</span>
                </div>
                <h3 className="text-base md:text-lg font-extrabold font-headline text-red-400">상승 예상 자산</h3>
              </div>
              <div className="space-y-3">
                {(marketData?.all_scenarios_data?.[scenario.id]?.recommended?.length > 0 
                  ? marketData.all_scenarios_data[scenario.id].recommended 
                  : scenario.up
                ).map((asset, i) => {
                  // 하드코딩된 데이터에서 아이콘 찾기
                  const fallbackAsset = scenario.up.find(a => a.name === (asset.category || asset.name));
                  const icon = asset.icon || fallbackAsset?.icon || 'diamond';
                  
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 md:p-4 rounded-2xl bg-red-500/5 border border-red-500/10 hover:border-red-500/25 transition-all duration-200 group">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 transition-colors">
                        <span className="material-symbols-outlined text-red-400">{icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base font-bold text-on-surface">{asset.category || asset.name}</p>
                        <p className="text-[11px] md:text-xs text-on-surface-variant truncate mb-2">{asset.desc || asset.strategy}</p>
                        <button 
                          onClick={() => setDetailAsset({ asset, type: 'up' })}
                          className="px-3 py-1 bg-white/5 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg border border-red-500/20 transition-colors"
                        >
                          종목보기
                        </button>
                      </div>
                      <span className="material-symbols-outlined text-red-400 text-xl shrink-0">arrow_upward</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DOWN Card */}
            <div className="bg-surface-container border border-white/5 rounded-3xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg text-blue-400">trending_down</span>
                </div>
                <h3 className="text-base md:text-lg font-extrabold font-headline text-blue-400">하락 예상 자산</h3>
              </div>
              <div className="space-y-3">
                {(marketData?.all_scenarios_data?.[scenario.id]?.caution?.length > 0 
                  ? marketData.all_scenarios_data[scenario.id].caution 
                  : scenario.down
                ).map((asset, i) => {
                  const fallbackAsset = scenario.down.find(a => a.name === (asset.category || asset.name));
                  const icon = asset.icon || fallbackAsset?.icon || 'trending_down';

                  return (
                    <div key={i} className="flex items-center gap-3 p-3 md:p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/25 transition-all duration-200 group">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                        <span className="material-symbols-outlined text-blue-400">{icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base font-bold text-on-surface">{asset.category || asset.name}</p>
                        <p className="text-[11px] md:text-xs text-on-surface-variant truncate mb-2">{asset.desc || asset.strategy}</p>
                        <button 
                          onClick={() => setDetailAsset({ asset, type: 'down' })}
                          className="px-3 py-1 bg-white/5 hover:bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-lg border border-blue-500/20 transition-colors"
                        >
                          종목보기
                        </button>
                      </div>
                      <span className="material-symbols-outlined text-blue-400 text-xl shrink-0">arrow_downward</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Disclaimer */}
          <div className="mt-8 p-4 bg-surface-container border border-white/5 rounded-2xl">
            <p className="text-[10px] md:text-xs text-on-surface-variant/60 leading-relaxed text-center">
              ⚠️ {INVESTMENT_DISCLAIMER}
            </p>
          </div>

          {/* News Section */}
          {news.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">newspaper</span>
                <h3 className="text-base md:text-lg font-extrabold font-headline">오늘의 경제 뉴스</h3>
              </div>
              <div className="space-y-3">
                {news.map((n, i) => (
                  <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                    className="block bg-surface-container border border-white/5 rounded-2xl p-4 hover:border-primary/20 transition-all group">
                    <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1 mb-1">{n.title}</h4>
                    <p className="text-[11px] md:text-xs text-on-surface-variant line-clamp-2">{n.description}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-6 md:mt-8 text-[10px] md:text-xs text-on-surface-variant/50 text-center">※ 위 정보는 일반적인 거시경제 흐름에 기반한 참고 자료이며, 투자 권유가 아닙니다.</p>

          {/* Asset Detail Modal */}
          <AssetDetailsModal 
            isOpen={!!detailAsset} 
            onClose={() => setDetailAsset(null)} 
            asset={detailAsset?.asset} 
            scenarioLabel={scenario.label}
            type={detailAsset?.type}
            yieldDate={marketData?.yield_date}
          />
        </div>
      )}
    </div>
  );
}

function ParkingCmaComparison({ parkingFilter }) {
  const [subTab, setSubTab] = useState('parking'); // 'parking' or 'cma'
  const [expandedItems, setExpandedItems] = useState({}); // { [id]: boolean }
  const [ratesData, setRatesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState(5000000); // 기본 500만원
  const [usePreferential, setUsePreferential] = useState(false); // 우대금리 적용 여부

  useEffect(() => {
    fetchParkingRates()
      .then(data => {
        setRatesData(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch rates", err);
        setLoading(false);
      });
  }, []);

  const calculateInterest = useCallback((rulesJsonStr, amount, applyBonus) => {
    try {
      const parsed = JSON.parse(rulesJsonStr);
      const rules = parsed.rules || [];
      if (rules.length === 0) return { amount: 0, text: parsed.text, target: parsed.target };

      let totalInterestYearly = 0;
      const mode = parsed.mode || "tiered"; // "tiered" (누진) or "whole" (전액)

      if (mode === "whole") {
        // 전액 금리 방식: 잔액이 속한 구간의 금리를 전액에 적용
        let appliedRule = rules[0];
        for (const rule of rules) {
          if (rule.limit === null || amount <= rule.limit) {
            appliedRule = rule;
            break;
          }
        }
        const rate = applyBonus ? (appliedRule.max_rate || appliedRule.rate) : (appliedRule.base_rate || appliedRule.rate);
        totalInterestYearly = amount * (rate / 100);
      } else {
        // 누진 금리 방식 (기본)
        let remaining = amount;
        let previousLimit = 0;
        for (const rule of rules) {
          if (remaining <= 0) break;
          let chunk = 0;
          if (rule.limit === null) {
            chunk = remaining;
          } else {
            const tierSize = rule.limit - previousLimit;
            chunk = Math.min(remaining, tierSize);
            previousLimit = rule.limit;
          }
          const rate = applyBonus ? (rule.max_rate || rule.rate) : (rule.base_rate || rule.rate);
          totalInterestYearly += chunk * (rate / 100);
          remaining -= chunk;
        }
      }

      const monthlyPreTax = totalInterestYearly / 12;
      const monthlyAfterTax = Math.floor(monthlyPreTax * 0.846); // 15.4% 공제
      
      return {
         preTax: Math.round(monthlyPreTax),
         afterTax: monthlyAfterTax,
         text: parsed.text,
         target: parsed.target,
         rating: parsed.rating,
         cycle: parsed.cycle,
         preferential_conditions: parsed.preferential_conditions
      };
    } catch (e) {
      return { amount: 0, text: rulesJsonStr, target: "", rating: null, cycle: null };
    }
  }, []);

  const processedData = useMemo(() => {
    const excludeKeywords = ["적립식", "정기예금", "정기적금", "적금", "만기"];
    const filtered = ratesData.filter(item => {
      const isCorrectType = item.type === subTab;
      const isNotSavings = !excludeKeywords.some(k => item.product_name.includes(k));
      return isCorrectType && isNotSavings;
    });
    return filtered.map(item => {
      const calc = calculateInterest(item.description, depositAmount, usePreferential);
      return { ...item, calc: { ...calc, text: calc.text.replace("포털 검색 자동 분석: ", "") } };
    }).sort((a, b) => b.calc.afterTax - a.calc.afterTax);
  }, [ratesData, subTab, depositAmount, calculateInterest, usePreferential]);

  const filteredData = useMemo(() => {
    let list = [...processedData];
    
    if (parkingFilter === 'no_conditions') {
      // 텍스트 기반 정밀 필터링: 문구에 '우대', '조건', '첫 거래', '미션' 등이 있으면 탈락
      const conditionKeywords = ["우대", "조건", "미션", "첫 거래", "신규", "급여", "카드", "자동이체", "마케팅", "실적"];
      
      list = list.filter(item => {
        try {
          const parsed = JSON.parse(item.description);
          const text = (parsed.text || "").toLowerCase();
          const target = (parsed.target || "").toLowerCase();
          
          // 1. 금리 수치상 우대 금리가 없어야 함
          const isBaseMaxEqual = item.base_rate === item.max_rate;
          
          // 2. 텍스트상 조건성 키워드가 없어야 함
          const hasConditionText = conditionKeywords.some(k => text.includes(k) || target.includes(k));
          
          // 3. 계단식(tiered) 금리가 아니어야 함 (rules가 1개 이하)
          const isNotTiered = (parsed.rules || []).length <= 1;

          return isBaseMaxEqual && !hasConditionText && isNotTiered;
        } catch (e) {
          return item.base_rate === item.max_rate;
        }
      }).sort((a, b) => b.base_rate - a.base_rate);
    } else if (parkingFilter === 'high_yield') {
      // 실수령액(세후 이자) 기준으로 정렬
      list = [...processedData].sort((a, b) => b.calc.afterTax - a.calc.afterTax);
    } else if (parkingFilter === 'major') {
      const majors = ["KB", "신한", "우리", "하나", "NH", "IBK", "카카오", "케이", "토스", "SC", "씨티"];
      list = list.filter(item => majors.some(m => item.institution.includes(m)));
    }
    
    // 전체 상품(all)은 20개까지, 나머지 필터 탭은 Top 5 고정
    const limit = (parkingFilter === 'all' || !parkingFilter) ? 20 : 5;
    return list.slice(0, limit);
  }, [processedData, parkingFilter]);

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end gap-2 mb-2">
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tighter text-on-surface font-headline">금리 비교</h1>
          <span className="text-xs md:text-sm text-primary font-bold mb-1 opacity-80">※ {new Date().getFullYear()}년 {new Date().getMonth() + 1}월 기준 실시간 분석</span>
        </div>
        <p className="text-on-surface-variant max-w-xl italic">세금(15.4%)을 제외하고 내 통장에 실제로 꽂히는 진짜 이자를 확인하세요.</p>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
        <div className="flex bg-surface-container/50 p-1 rounded-2xl border border-white/5 w-full md:w-fit">
          <button 
            onClick={() => setSubTab('parking')}
            className={`flex-1 md:px-8 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${subTab === 'parking' ? 'bg-primary text-on-primary shadow-lg' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            파킹통장 (은행)
          </button>
          <button 
            onClick={() => setSubTab('cma')}
            className={`flex-1 md:px-8 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${subTab === 'cma' ? 'bg-primary text-on-primary shadow-lg' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            CMA (증권사)
          </button>
        </div>

        <div className="flex items-center gap-4 bg-surface-container-high px-6 py-3 rounded-2xl w-full md:w-auto">
          <span className="font-bold text-sm text-on-surface whitespace-nowrap">예치 금액</span>
          <div className="relative flex-1 md:w-48">
            <input 
              type="number" 
              value={depositAmount / 10000} 
              onChange={(e) => setDepositAmount(Number(e.target.value) * 10000)}
              className="w-full bg-transparent border-none outline-none text-right font-headline text-xl text-primary font-bold pr-6 py-1"
              min="0"
              step="10"
            />
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">만원</span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-xl border border-primary/20 cursor-pointer select-none hover:bg-primary/10 transition-all"
               onClick={() => setUsePreferential(!usePreferential)}>
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${usePreferential ? 'bg-primary border-primary' : 'border-white/20'}`}>
               {usePreferential && <span className="material-symbols-outlined text-on-primary text-[14px] font-bold">check</span>}
            </div>
            <span className={`text-xs font-bold whitespace-nowrap ${usePreferential ? 'text-primary' : 'text-on-surface-variant'}`}>우대금리 포함</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : processedData.length === 0 ? (
        <div className="py-20 text-center text-on-surface-variant">
           <span className="material-symbols-outlined text-5xl mb-4 opacity-50">money_off</span>
           <p>현재 제공되는 금리 정보가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {filteredData.map((item, idx) => (
          <div key={item.id} className="group bg-surface-container border border-white/5 rounded-3xl p-6 transition-all hover:bg-surface-container-high hover:-translate-y-1 hover:border-primary/50 duration-300 flex flex-col relative overflow-hidden shadow-lg">
            
            {idx === 0 && depositAmount > 0 && parkingFilter === 'all' && (
              <div className="absolute top-0 right-0 bg-primary text-on-primary text-[10px] font-black px-4 py-1 rounded-bl-xl shadow-md">
                가장 유리해요! 👑
              </div>
            )}

            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 pr-4">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">{item.institution}</p>
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold font-headline line-clamp-1">{item.product_name}</h4>
                  <a 
                    href={`https://search.naver.com/search.naver?query=${encodeURIComponent(item.institution + ' ' + item.product_name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-full bg-white/5 hover:bg-primary/20 text-on-surface-variant hover:text-primary transition-all shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">search</span>
                  </a>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex flex-col items-end">
                   <span className="text-xl font-black text-primary">{item.max_rate}%</span>
                   <span className="text-[9px] text-on-surface-variant font-bold">최고금리</span>
                </div>
                <div className="mt-1 text-[10px] text-on-surface-variant/60 font-medium">
                   기본 {item.base_rate}%
                </div>
              </div>
            </div>
            
            <div className="my-4 p-4 bg-[#0a0e17]/50 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] text-primary font-bold uppercase">예상 월 수령액 (세후)</p>
              </div>
              
              <div className="flex items-end gap-1 mb-3">
                <span className="text-4xl font-black text-[#73ffba] font-headline">
                  {item.calc.afterTax.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-[#73ffba] mb-1.5">원</span>
              </div>

              <div className={`overflow-hidden transition-all duration-300 ${expandedItems[item.id] ? 'max-h-96 opacity-100 mt-4 pt-4 border-t border-white/5' : 'max-h-0 opacity-0'}`}>
                <p className="text-[11px] text-on-surface-variant/80 leading-relaxed font-medium">
                  {item.calc.text}
                </p>
                {item.calc.cycle && (
                   <div className="flex items-center gap-1 text-[10px] text-primary/70 font-bold mt-2">
                     <span className="material-symbols-outlined text-[12px]">schedule</span>
                     이자 지급: {item.calc.cycle}
                   </div>
                )}
                {item.calc.preferential_conditions && (
                  <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="material-symbols-outlined text-[14px] text-primary">verified</span>
                      <p className="text-[10px] font-bold text-primary uppercase">우대 조건</p>
                    </div>
                    <p className="text-[11px] text-on-surface leading-relaxed whitespace-pre-wrap">
                      {item.calc.preferential_conditions}
                    </p>
                  </div>
                )}
                {item.calc.target && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-primary mt-0.5">group</span>
                    <p className="text-xs font-bold text-on-surface">{item.calc.target}</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => toggleExpand(item.id)}
                className="w-full mt-2 py-1 text-[10px] font-bold text-on-surface-variant/60 hover:text-primary transition-colors flex items-center justify-center gap-1"
              >
                {expandedItems[item.id] ? '정보 접기' : '자세한 조건 보기'}
                <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${expandedItems[item.id] ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
            </div>
          </div>
        ))}
        </div>
      )}
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
  const [activeTab, setActiveTab] = useState("insights"); // "insights" | "dashboard" | "ipo" | "apt" | "parking"
  const [insightSubTab, setInsightSubTab] = useState("macro"); // "macro", "dart", "nps", "legends"
  const [parkingFilter, setParkingFilter] = useState('all'); // 'all', 'no_conditions', 'high_yield', 'major'
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [ipoEvents, setIpoEvents] = useState([]);
  const [ipoLoading, setIpoLoading] = useState(false);
  const [selectedIpo, setSelectedIpo] = useState(null);
  const [aptEvents, setAptEvents] = useState([]);
  const [aptLoading, setAptLoading] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  const getPushSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  }, []);

  useEffect(() => {
    if (session && showSettings) {
      const checkPushStatus = async () => {
        try {
          const sub = await getPushSubscription();
          if (sub) {
            const isSubscribedInDb = await checkPushSubscription(session.user.id, sub.endpoint);
            setIsPushEnabled(isSubscribedInDb);
          } else {
            setIsPushEnabled(false);
          }
        } catch (err) {
          console.error("Push status check error", err);
        }
      };
      checkPushStatus();
    }
  }, [session, showSettings, getPushSubscription]);

  const togglePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToastMsg("이 브라우저에서는 푸시 알림을 지원하지 않습니다.", "error");
      return;
    }

    try {
      if (isPushEnabled) {
        const sub = await getPushSubscription();
        if (sub) {
          await removePushSubscription(session.user.id, sub.endpoint);
          await sub.unsubscribe();
        }
        setIsPushEnabled(false);
        showToastMsg("알림이 해제되었습니다.");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showToastMsg("푸시 알림 허용이 필요합니다. 브라우저 주소창 설정에서 권한을 허용해주세요.", "error");
          return;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_KEY
        });
        
        await savePushSubscription(session.user.id, sub);
        setIsPushEnabled(true);
        showToastMsg("해당 기기에서 알림을 설정했습니다.");
      }
    } catch (err) {
      console.error(err);
      showToastMsg("알림 설정 중 오류가 발생했습니다.", "error");
    }
  };

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

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToastMsg("비밀번호는 최소 6자 이상이어야 합니다.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToastMsg("비밀번호가 일치하지 않습니다.", "error");
      return;
    }
    setUpdateLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      showToastMsg(`비밀번호 변경 실패: ${error.message}`, "error");
    } else {
      showToastMsg("비밀번호가 성공적으로 변경되었습니다.");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    }
    setUpdateLoading(false);
  };

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

  const handleToggleIpo = async (ipoId, brokerage, aliasId, currentlyChecked) => {
    try {
      const result = await toggleIpoSubscription(ipoId, session.user.id, brokerage, aliasId, currentlyChecked);
      setIpoEvents(prev => prev.map(e => {
        if (e.id === ipoId) {
          const newChecked = { ...e.checkedSubscriptions };
          if (!newChecked[brokerage]) newChecked[brokerage] = {};
          newChecked[brokerage][aliasId] = result.checked;
          return { ...e, checkedSubscriptions: newChecked };
        }
        return e;
      }));
      setSelectedIpo(prev => {
        if (prev && prev.id === ipoId) {
          const newChecked = { ...prev.checkedSubscriptions };
          if (!newChecked[brokerage]) newChecked[brokerage] = {};
          newChecked[brokerage][aliasId] = result.checked;
          return { ...prev, checkedSubscriptions: newChecked };
        }
        return prev;
      });
    } catch (err) { showToastMsg("상태 변경 실패", "error"); }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="bg-surface-container rounded-3xl p-8 w-full max-w-sm shadow-2xl">
          <h1 className="text-2xl font-bold font-headline mb-6 text-center text-primary">ETF Event Tracker</h1>
          <Auth 
            supabaseClient={supabase} 
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#73ffba',
                    brandAccent: '#64f0ac',
                    inputText: '#ebedfb',
                    inputPlaceholder: '#727581',
                    inputLabelText: '#a7abb7',
                    inputBackground: '#202633',
                    inputBorder: '#444852',
                  }
                }
              }
            }} 
            theme="dark"
            providers={[]} 
          />
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

  // 참여 목록 탭에서 쓸 '종료 후 경과 일수' 계산 헬퍼
  const daysAfterEndOf = (e) => {
    if (!e.end_date) return null;
    const end = new Date(e.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.floor((today - end) / (1000 * 60 * 60 * 24));
  };

  let displayEvents = uniqueEvents.filter(e => {
    if (searchQuery && !e.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedProvider && e.provider !== selectedProvider) return false;
    if (selectedStatus === "참여 목록") {
      const hasAnyCheck = Object.values(e.checkedAliases || {}).some((v) => v);
      if (!hasAnyCheck) return false;
      // 진행중이거나, 종료 후 30일 이내인 것만 표시
      if (e.status !== "진행중") {
        const dae = daysAfterEndOf(e);
        if (dae === null || dae > 30) return false;
      }
    } else if (selectedStatus === "마감 임박") {
      if (e.status !== "진행중" || e.d_day === null || e.d_day === undefined || e.d_day < 0 || e.d_day > 3) return false;
    } else {
      if (e.status !== "진행중") return false;
    }
    return true;
  }).sort((a, b) => {
    // 참여 목록: 진행중 먼저, 그 다음 종료 최근 순
    if (selectedStatus === "참여 목록") {
      const aActive = a.status === "진행중" ? 0 : 1;
      const bActive = b.status === "진행중" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      // 진행중끼리는 d_day 오름차순, 종료끼리는 end_date 내림차순
      if (aActive === 0) return (a.d_day ?? 9999) - (b.d_day ?? 9999);
      return (b.end_date || '').localeCompare(a.end_date || '');
    }
    return (a.d_day ?? 9999) - (b.d_day ?? 9999);
  });

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-[#0a0e17]/80 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
        <nav className="flex justify-between items-center w-full px-4 md:px-8 h-16">
          <div className="flex items-center gap-4 md:gap-12">
            <div className="flex items-center gap-2">
              <button onClick={() => setIsDrawerOpen(!isDrawerOpen)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center">
                <span className="material-symbols-outlined text-[#ebedfb]">menu</span>
              </button>
              <span className="text-xl font-bold tracking-tighter text-[#ebedfb] font-headline cursor-pointer" onClick={() => {setActiveTab("dashboard"); setSelectedProvider(null); setSelectedStatus("전체 보기");}}>RE:MEMBER</span>
            </div>
            {/* Desktop Tabs */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <button className={`pb-1 font-headline transition-colors ${activeTab === 'insights' ? 'text-[#73ffba] border-b-2 border-[#73ffba]' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}`} onClick={() => setActiveTab("insights")}>투자 인사이트</button>
              <button className={`pb-1 font-headline transition-colors ${activeTab === 'dashboard' ? 'text-[#73ffba] border-b-2 border-[#73ffba]' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}`} onClick={() => {setActiveTab("dashboard"); setSelectedProvider(null); setSelectedStatus("전체 보기");}}>ETF 이벤트</button>
              <button className={`pb-1 font-headline transition-colors ${activeTab === 'ipo' ? 'text-[#73ffba] border-b-2 border-[#73ffba]' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}`} onClick={() => { setActiveTab("ipo"); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }}>공모주 캘린더</button>
              <button className={`pb-1 font-headline transition-colors ${activeTab === 'apt' ? 'text-[#73ffba] border-b-2 border-[#73ffba]' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}`} onClick={() => { setActiveTab("apt"); if (aptEvents.length === 0) { setAptLoading(true); fetchAptSubscriptions().then(d => { setAptEvents(d); setAptLoading(false); }).catch(() => setAptLoading(false)); } }}>아파트 청약</button>
              <button className={`pb-1 font-headline transition-colors ${activeTab === 'parking' ? 'text-[#73ffba] border-b-2 border-[#73ffba]' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}`} onClick={() => setActiveTab("parking")}>금리 비교</button>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-6">
            <div className="relative hidden lg:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input 
                className="bg-surface-container-highest border-none outline-none rounded-full pl-10 pr-4 py-1.5 text-sm focus:ring-1 focus:ring-primary w-64 text-on-surface" 
                placeholder="이벤트 검색..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSettings(!showSettings)} className={`hover:bg-[#262c3a]/50 p-2 rounded-full transition-all active:scale-95 duration-200 ${showSettings?'text-primary':'text-on-surface'}`}>
                <span className="material-symbols-outlined">settings</span>
              </button>
              {isAdmin && (
                <button className="bg-primary text-on-primary px-3 md:px-5 py-1.5 rounded-full text-[10px] md:text-sm font-bold active:scale-95 duration-200 shadow-[0_0_20px_rgba(115,255,186,0.2)]" onClick={() => triggerManualScrape(adminToken)}>
                  <span className="md:inline hidden">관리자 수집 실행</span>
                  <span className="md:hidden inline flex items-center justify-center"><span className="material-symbols-outlined text-sm">refresh</span></span>
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* No Overlay Backdrop as per request to keep it pushing content */}

      <aside className={`flex flex-col fixed left-0 top-16 bottom-0 p-4 w-64 bg-gradient-to-b from-[#0a0e17] to-[#262c3a] z-40 transition-transform duration-300 border-r border-white/5 shadow-2xl ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 mb-8 px-2 pt-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary" data-weight="fill">sensors</span>
          </div>
          <div>
            <p className="text-sm font-black text-[#73ffba] uppercase tracking-wider font-headline">FUTURE SIGNAL</p>
            <p className="text-[10px] text-on-surface-variant italic">고래들의 돈줄 추적</p>
          </div>
        </div>
        
        <div className="space-y-1 flex-1">
          {activeTab === 'insights' ? (
            <>
              <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-4">투자 인사이트</p>
              <button onClick={() => { setInsightSubTab("macro"); window.scrollTo(0,0); }} className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${insightSubTab === 'macro' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}>
                <span className="material-symbols-outlined text-xl">public</span>
                <span className="font-medium text-sm">매크로 시나리오</span>
              </button>
              <button onClick={() => { setInsightSubTab("dart"); window.scrollTo(0,0); }} className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${insightSubTab === 'dart' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}>
                <span className="material-symbols-outlined text-xl">notifications_active</span>
                <span className="font-medium text-sm">고래 지분 변동 (5%)</span>
              </button>
              <button onClick={() => { setInsightSubTab("nps"); window.scrollTo(0,0); }} className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${insightSubTab === 'nps' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:text-[#73ffba]'}`}>
                <span className="material-symbols-outlined text-xl">account_balance</span>
                <span className="font-medium text-sm">국민연금 주력주</span>
              </button>
              <button onClick={() => { setInsightSubTab("legends"); window.scrollTo(0,0); }} className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${insightSubTab === 'legends' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:text-[#73ffba]'}`}>
                <span className="material-symbols-outlined text-xl">military_tech</span>
                <span className="font-medium text-sm">글로벌 투자 전설</span>
              </button>
            </>
          ) : activeTab === 'parking' ? (
            <>
              <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-4">금리 필터</p>
              {[
                { id: 'all', label: '전체 상품', icon: 'list' },
                { id: 'no_conditions', label: '우대조건 없음', icon: 'verified_user' },
                { id: 'high_yield', label: '실수령액 순', icon: 'payments' },
                { id: 'major', label: '1금융권/대형사', icon: 'account_balance' }
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => { setParkingFilter(f.id); window.scrollTo(0,0); }} 
                  className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${parkingFilter === f.id ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}
                >
                  <span className="material-symbols-outlined text-xl">{f.icon}</span>
                  <span className="font-medium text-sm">{f.label}</span>
                </button>
              ))}
            </>
          ) : (
            <div className="text-center py-10 text-on-surface-variant/50 text-xs">
              현재 선택된 탭({activeTab})의<br/>세부 메뉴가 없습니다.
            </div>
          )}

          <div className="absolute bottom-6 left-4 right-4">
            <button onClick={() => supabase.auth.signOut()} className="w-full text-left text-[#ebedfb]/70 hover:bg-[#262c3a]/30 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:text-[#ff716c] duration-300">
              <span className="material-symbols-outlined text-xl">logout</span>
              <span className="text-sm font-medium">로그아웃</span>
            </button>
          </div>
        </div>
      </aside>

      <main className={`pt-20 pb-24 md:pb-12 px-4 md:px-12 min-h-screen transition-all duration-300 ${isDrawerOpen ? 'md:ml-64' : 'ml-0'}`}>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-8 p-6 bg-surface-container rounded-3xl border border-outline-variant/30 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-headline flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span> 내 정보
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">notifications_active</span> 알림 받기
                </span>
                <button 
                  onClick={togglePush}
                  className={`w-10 h-5 md:w-11 md:h-6 rounded-full transition-colors relative flex items-center shrink-0 ${isPushEnabled ? 'bg-primary border-primary' : 'bg-surface-container-highest border border-white/20'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 md:w-5 md:h-5 rounded-full transition-transform ${isPushEnabled ? 'translate-x-[20px] shadow-sm' : 'bg-outline-variant/60'}`} style={{width: 'calc(100% / 2 - 2px)', height: 'calc(100% - 4px)'}}></span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4 pt-6 border-t border-white/5">
              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-xs">account_balance_wallet</span>계좌 별명 목록
                </h4>
                <ul className="space-y-2 mb-4">
                  {aliases.map(a => (
                    <li key={a.id} className="flex items-center justify-between p-3 bg-surface-container-highest rounded-xl text-sm border border-white/5">
                      {a.name}
                      <button onClick={() => handleRemoveAlias(a.id)} className="text-error hover:bg-error/10 p-1.5 rounded-lg transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button>
                    </li>
                  ))}
                  {aliases.length === 0 && <li className="text-sm text-on-surface-variant">등록된 계좌가 없습니다.</li>}
                </ul>
                <form onSubmit={handleAddAlias} className="flex gap-3">
                  <input value={newAliasName} onChange={e => setNewAliasName(e.target.value)} type="text" placeholder="새로운 계좌 별명" className="flex-1 bg-surface-container-highest rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none border border-transparent focus:border-primary/50 text-on-surface placeholder:text-on-surface-variant" />
                  <button type="submit" className="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">추가</button>
                </form>
              </div>
              
              <div className="md:border-l md:border-white/5 md:pl-8 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-xs">lock_reset</span>비밀번호 변경
                  </h4>
                  {!showPasswordForm && (
                    <button 
                      onClick={() => setShowPasswordForm(true)}
                      className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      변경하기
                    </button>
                  )}
                </div>

                {showPasswordForm ? (
                   <form onSubmit={handleUpdatePassword} className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      placeholder="새 비밀번호 (6자 이상)" 
                      className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none border border-transparent focus:border-primary/50 text-on-surface"
                      required
                    />
                    <input 
                      type="password" 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="새 비밀번호 확인" 
                      className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none border border-transparent focus:border-primary/50 text-on-surface"
                      required
                    />
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setShowPasswordForm(false)}
                        className="flex-1 bg-surface-container-highest text-on-surface-variant font-bold py-3 rounded-xl hover:bg-white/5 transition-all"
                      >
                        취소
                      </button>
                      <button 
                        type="submit" 
                        disabled={updateLoading}
                        className="flex-[2] bg-primary text-on-primary font-bold py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      >
                        {updateLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <>비밀번호 업데이트</>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant py-4">계정 보안을 위해 정기적으로 비밀번호를 변경해주세요.</p>
                  </div>
                )}
                
                <div className="mt-auto pt-6">
                  <button 
                    onClick={() => supabase.auth.signOut()}
                    className="w-full py-4 border border-error/30 text-error font-bold rounded-2xl bg-error/5 hover:bg-error/10 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    로그아웃
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content Switch */}
        {activeTab === "insights" ? (
          <InvestmentInsights subTab={insightSubTab} />
        ) : activeTab === "ipo" ? (
          ipoLoading ? (
            <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
          ) : (
            <IpoCalendar ipoEvents={ipoEvents} onSelectIpo={setSelectedIpo} />
          )
        ) : activeTab === "apt" ? (
          aptLoading ? (
            <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="mb-10">
                <div className="flex items-center gap-4">
                  <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tighter text-on-surface font-headline mb-2">
                    아파트 청약
                  </h1>
                  <a 
                    href="https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancListView.do" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mb-1 w-12 h-12 rounded-2xl bg-surface-container border border-white/10 flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all shadow-xl group"
                    title="청약홈 전체 공고 보기"
                  >
                    <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">home_work</span>
                  </a>
                </div>
                <p className="text-on-surface-variant max-w-xl italic">당신의 첫 번째 보금자리를 위한 로또 청약 시그널을 확인하세요.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(() => {
                  const filteredApts = aptEvents.filter(apt => {
                    if (!apt.winner_date) return true;
                    const winner = new Date(apt.winner_date);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    winner.setHours(0,0,0,0);
                    const diffDays = Math.floor((today - winner) / (1000 * 60 * 60 * 24));
                    return diffDays <= 7;
                  });

                  if (filteredApts.length === 0) {
                    return (
                      <div className="col-span-full py-20 text-center">
                        <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">home_work</span>
                        <p className="text-on-surface-variant">현재 예정된 아파트 청약 일정이 없습니다.</p>
                      </div>
                    );
                  }

                  return filteredApts.map(apt => (
                    <AptCard key={apt.id} apt={apt} />
                  ));
                })()}
              </div>

            </div>
          )
        ) : activeTab === "parking" ? (
          <ParkingCmaComparison parkingFilter={parkingFilter} />
        ) : (
        <>
        {/* Dashboard Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tighter text-on-surface font-headline mb-2">
              {selectedProvider ? `${PROVIDERS.find(p=>p.key===selectedProvider)?.name} 이벤트` : "ETF 이벤트"}
            </h1>
            <p className="text-on-surface-variant max-w-xl italic">미래의 내가 보낸 수익 시그널을 확인하세요.</p>
          </div>
        </div>

        {/* Dashboard Stats Section */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
          {/* Registered Accounts */}
          <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group">
            <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <span className="material-symbols-outlined text-6xl md:text-8xl">account_balance_wallet</span>
            </div>
            <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">등록 계좌</p>
            <h3 className="text-2xl md:text-4xl font-extrabold text-on-surface font-headline">{aliases.length}<span className="text-xs md:text-base ml-1 opacity-50 font-medium">개</span></h3>
          </div>

          {/* Active Events */}
          <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group">
            <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <span className="material-symbols-outlined text-6xl md:text-8xl">bolt</span>
            </div>
            <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">진행중 이벤트</p>
            <h3 className="text-2xl md:text-4xl font-extrabold text-on-surface font-headline">{activeEventsCount}</h3>
            <p className="mt-1 md:mt-2 text-[9px] md:text-xs text-primary flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px] md:text-[14px]">sync</span>
              {scrapingStatus?.last_run ? new Date(scrapingStatus.last_run).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '오늘'}
            </p>
          </div>

          {/* Participation Rate */}
          <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group">
            <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <span className="material-symbols-outlined text-6xl md:text-8xl">analytics</span>
            </div>
            <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">참여율</p>
            <h3 className="text-2xl md:text-4xl font-extrabold text-primary font-headline">{checkPercent}%</h3>
            <div className="mt-2 md:mt-4 w-full bg-surface-container-highest rounded-full h-1 md:h-1.5 overflow-hidden">
              <div className="bg-primary h-full rounded-full shadow-[0_0_8px_#73ffba] transition-all duration-1000" style={{width: `${checkPercent}%`}}></div>
            </div>
          </div>

          {/* Closing Soon */}
          <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group border-primary/10">
            <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <span className="material-symbols-outlined text-6xl md:text-8xl text-tertiary">notification_important</span>
            </div>
            <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">마감 임박</p>
            <h3 className="text-2xl md:text-4xl font-extrabold text-tertiary font-headline">{upcomingEvents}</h3>
            <p className="mt-1 md:mt-2 text-[9px] md:text-xs text-tertiary/70">3일 이내 종료</p>
          </div>
        </section>

        {/* Filters Section */}
        <section className="mb-8 flex flex-col gap-4">
          {/* Row 1: Status Filters */}
          <div className="flex items-center gap-2">
            <button onClick={() => {setSelectedProvider(null); setSelectedStatus("전체 보기");}} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedProvider === null && (selectedStatus === '전체 보기' || selectedStatus === '전체 이벤트') ? 'bg-primary text-on-primary shadow-lg' : 'bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface'}`}>
              전체 보기
            </button>
            <button onClick={() => {setSelectedProvider(null); setSelectedStatus("마감 임박");}} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedStatus === '마감 임박' ? 'bg-[#ff716c] text-white shadow-lg' : 'bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface'}`}>
              마감 임박
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
              <section className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
                {PROVIDERS.map(p => {
                  const evts = uniqueEvents.filter(e => e.provider === p.key && e.status === "진행중").length;
                  return (
                    <div key={p.key} onClick={() => setSelectedProvider(p.key)} className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-3 md:p-6 transition-all hover:bg-surface-container-high hover:-translate-y-1 hover:border-primary/20 duration-300 cursor-pointer flex flex-col">
                      <div className="flex items-start justify-between mb-4 md:mb-8">
                        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl ${p.bgColor} flex items-center justify-center ${p.shadow}`}>
                          <span className={`${p.textCol || 'text-white'} font-black ${p.textSize || 'text-xs md:text-lg'}`}>{p.textLabel}</span>
                        </div>
                        {evts > 0 && <span className="hidden md:inline-block bg-surface-container-highest border border-white/10 text-on-surface-variant text-[10px] font-bold px-3 py-1 rounded-full">진행중</span>}
                      </div>
                      <h4 className="text-sm md:text-lg font-bold mb-0.5 md:mb-1 font-headline tracking-tight line-clamp-1">{p.name}</h4>
                      <p className="text-[10px] md:text-sm text-on-surface-variant mb-4 md:mb-6 flex-1 truncate">{evts}개 진행중</p>
                      <button 
                        onClick={(e) => { e.stopPropagation(); window.open(p.url, '_blank'); }}
                        className="w-full flex items-center justify-between bg-surface-container-highest hover:bg-primary hover:text-on-primary p-2 md:p-4 rounded-xl md:rounded-2xl transition-all font-bold text-[10px] md:text-sm"
                      >
                        <span className="hidden md:inline">공식 홈페이지</span>
                        <span className="md:hidden">홈페이지</span>
                        <span className="material-symbols-outlined text-[14px] md:text-[18px]">open_in_new</span>
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
                <EventCard key={e.id} event={e} aliases={aliases} onToggle={handleToggle} showToastMsg={showToastMsg} />
              )) : (

                <div className="col-span-full py-20 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-5xl mb-4 opacity-50">filter_list_off</span>
                  <p>해당 조건의 이벤트가 없습니다.</p>
                </div>
              )}
            </div>
          )
        )}
        </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-[#0a0e17]/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around z-50 px-6 pb-safe">
        <button onClick={() => { setActiveTab("insights"); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 ${activeTab === 'insights' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'insights' ? 'fill' : 'normal'}>insights</span>
          <span className="text-[10px] font-bold">인사이트</span>
        </button>
        <button onClick={() => {setActiveTab("dashboard"); setSelectedProvider(null); setSelectedStatus("전체 보기"); window.scrollTo(0,0);}} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'dashboard' ? 'fill' : 'normal'}>layers</span>
          <span className="text-[10px] font-bold">ETF 이벤트</span>
        </button>
        <button onClick={() => { setActiveTab("ipo"); window.scrollTo(0,0); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }} className={`flex flex-col items-center gap-1 ${activeTab === 'ipo' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'ipo' ? 'fill' : 'normal'}>calendar_month</span>
          <span className="text-[10px] font-bold">공모주</span>
        </button>
        <button onClick={() => { setActiveTab("apt"); window.scrollTo(0,0); if (aptEvents.length === 0) { setAptLoading(true); fetchAptSubscriptions().then(d => { setAptEvents(d); setAptLoading(false); }).catch(() => setAptLoading(false)); } }} className={`flex flex-col items-center gap-1 ${activeTab === 'apt' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'apt' ? 'fill' : 'normal'}>home_work</span>
          <span className="text-[10px] font-bold">아파트</span>
        </button>
        <button onClick={() => { setActiveTab("parking"); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 ${activeTab === 'parking' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'parking' ? 'fill' : 'normal'}>account_balance</span>
          <span className="text-[10px] font-bold">금리 비교</span>
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className={`flex flex-col items-center gap-1 ${showSettings ? 'text-primary' : 'text-on-surface-variant'}`}>

          <span className="material-symbols-outlined text-2xl" data-weight={showSettings ? 'fill' : 'normal'}>person</span>
          <span className="text-[10px] font-bold">내 정보</span>
        </button>
      </div>

      {/* 모달 렌더링 */}
      <IpoModal ipo={selectedIpo} aliases={aliases} onClose={() => setSelectedIpo(null)} onToggleIpo={handleToggleIpo} />

      {/* FAB */}
      {(selectedProvider || selectedStatus === "참여 목록" || selectedStatus === "마감 임박") && (
         <button onClick={() => {setSelectedProvider(null); setSelectedStatus("전체 보기");}} className="fixed bottom-20 md:bottom-8 right-6 md:right-8 w-14 h-14 bg-surface-container-highest text-on-surface rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-95 transition-all hover:scale-105 hover:bg-surface-bright border border-white/10">
           <span className="material-symbols-outlined">arrow_back</span>
         </button>
      )}

      {/* Global Toast */}
      {toast.visible && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-8 border border-white/10 w-[90%] md:w-auto text-center justify-center">
          <span className={`material-symbols-outlined ${toast.type==='success'?'text-primary':'text-error'}`}>
            {toast.type==='success'?'check_circle':'error'}
          </span>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </>
  );
}
