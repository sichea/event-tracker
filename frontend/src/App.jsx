import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchEvents, toggleEventChecked, fetchAliases, addAlias, removeAlias, fetchScrapingStatus, triggerManualScrape, fetchAdminSecret, saveAdminSecret, fetchIpoEvents, toggleIpoSubscription, savePushSubscription, removePushSubscription, checkPushSubscription } from "./api";
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

  // 종료 후 남은 열람 가능 일수 계산 (참여 목록용)
  const daysAfterEnd = (() => {
    if (isActive || !event.end_date) return null;
    const end = new Date(event.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.floor((today - end) / (1000 * 60 * 60 * 24));
  })();

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
        <div className="flex items-center gap-1">
          {!isActive && daysAfterEnd !== null && (
            <span className="text-[9px] text-outline/60 font-medium">{30 - daysAfterEnd}일 후 목록에서 제거</span>
          )}
          {event.link && (
            <a href={event.link} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-surface-container-highest hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors">
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
                return (
                  <div key={day} className={`aspect-square rounded-xl p-1 relative group transition-colors ${isToday ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-surface-container-highest'}`}>
                    <span className={`text-xs font-bold block text-center ${isToday ? 'text-primary' : dayOfWeek === 0 ? 'text-error/70' : dayOfWeek === 6 ? 'text-tertiary/70' : 'text-on-surface-variant'}`}>{day}</span>
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
                
                return (
                  <div 
                    key={dateStr} 
                    onClick={() => setSelectedDate(dateStr)}
                    className={`aspect-square relative flex flex-col items-center justify-center gap-1 transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/10 rounded-lg z-10' : ''}`}
                  >
                    <span className={`text-sm font-bold ${isToday ? 'text-primary underline underline-offset-4 decoration-2' : isSelected ? 'text-on-surface' : 'text-on-surface/80'}`}>{day}</span>
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
                        <span className="text-sm font-bold text-on-surface">{ev.company_name}</span>
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
                          <span>{ipo.confirmed_price}</span>
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
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "ipo"
  const [ipoEvents, setIpoEvents] = useState([]);
  const [ipoLoading, setIpoLoading] = useState(false);
  const [selectedIpo, setSelectedIpo] = useState(null);
  const [isPushEnabled, setIsPushEnabled] = useState(false);

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
            <span className="text-xl font-bold tracking-tighter text-[#ebedfb] font-headline cursor-pointer" onClick={() => {setActiveTab("dashboard"); setSelectedProvider(null); setSelectedStatus("전체 보기");}}>RE:MEMBER</span>
            {/* Desktop Tabs */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <button className={`pb-1 font-headline transition-colors ${activeTab === 'dashboard' ? 'text-[#73ffba] border-b-2 border-[#73ffba]' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}`} onClick={() => {setActiveTab("dashboard"); setSelectedProvider(null); setSelectedStatus("전체 보기");}}>ETF 이벤트</button>
              <button className={`pb-1 font-headline transition-colors ${activeTab === 'ipo' ? 'text-[#73ffba] border-b-2 border-[#73ffba]' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}`} onClick={() => { setActiveTab("ipo"); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }}>공모주 캘린더</button>
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

      <aside className="flex flex-col fixed left-0 top-16 bottom-0 p-4 h-[calc(100vh-64px)] w-64 bg-gradient-to-b from-[#0a0e17] to-[#262c3a] z-40 hidden xl:flex border-r border-white/5">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary" data-weight="fill">sensors</span>
          </div>
          <div>
            <p className="text-sm font-black text-[#73ffba] uppercase tracking-wider font-headline font-italic">FUTURE SIGNAL</p>
            <p className="text-xs text-on-surface-variant italic">"절대 놓치지 마, 기억해!"</p>
          </div>
        </div>
        <div className="space-y-1 flex-1">
          <button onClick={() => {setSelectedProvider(null); setSelectedStatus("전체 보기");}} className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${selectedProvider === null ? 'bg-[#262c3a] text-[#73ffba]' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}>
            <span className="material-symbols-outlined text-xl">layers</span>
            <span className="font-medium">ETF 이벤트</span>
          </button>
          <button onClick={() => supabase.auth.signOut()} className="w-full text-left text-[#ebedfb]/70 hover:bg-[#262c3a]/30 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:text-[#ff716c] duration-300">
            <span className="material-symbols-outlined text-xl">logout</span>
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      <main className="pt-20 pb-24 md:pb-12 px-4 md:px-12 xl:ml-64 min-h-screen">
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-8 p-6 bg-surface-container rounded-3xl border border-outline-variant/30 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-headline flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">group</span> 내 계좌 관리
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

        {/* Tab Content Switch */}
        {activeTab === "ipo" ? (
          ipoLoading ? (
            <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
          ) : (
            <IpoCalendar ipoEvents={ipoEvents} onSelectIpo={setSelectedIpo} />
          )
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
        </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-[#0a0e17]/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around z-50 px-6 pb-safe">
        <button onClick={() => {setActiveTab("dashboard"); setSelectedProvider(null); setSelectedStatus("전체 보기"); window.scrollTo(0,0);}} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'dashboard' ? 'fill' : 'normal'}>layers</span>
          <span className="text-[10px] font-bold">ETF 이벤트</span>
        </button>
        <button onClick={() => { setActiveTab("ipo"); window.scrollTo(0,0); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }} className={`flex flex-col items-center gap-1 ${activeTab === 'ipo' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'ipo' ? 'fill' : 'normal'}>calendar_month</span>
          <span className="text-[10px] font-bold">공모주</span>
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className={`flex flex-col items-center gap-1 ${showSettings ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={showSettings ? 'fill' : 'normal'}>person</span>
          <span className="text-[10px] font-bold">계좌관리</span>
        </button>
        <button onClick={() => supabase.auth.signOut()} className="flex flex-col items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined text-2xl">logout</span>
          <span className="text-[10px] font-bold">로그아웃</span>
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
