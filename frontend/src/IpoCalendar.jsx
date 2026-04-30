import React, { useState, useMemo, useEffect } from 'react';

const PUBLIC_HOLIDAYS_2026 = {
  '2026-01-01': '신정', '2026-02-16': '설날', '2026-02-17': '설날', '2026-02-18': '설날',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날',
  '2026-06-06': '현충일', '2026-08-15': '광복절', '2026-09-24': '추석', '2026-09-25': '추석',
  '2026-09-26': '추석', '2026-10-03': '개천절', '2026-10-09': '한글날', '2026-12-25': '성탄절'
};

export default function IpoCalendar({ ipoEvents, onSelectIpo, aliases, onToggleIpo }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = new Date().toISOString().split('T')[0];

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  
  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const d = [];
    for (let i = 0; i < firstDay; i++) d.push(null);
    for (let i = 1; i <= lastDate; i++) d.push(i);
    return d;
  }, [year, month]);

  const dateEventMap = useMemo(() => {
    const map = {};
    (ipoEvents || []).forEach(ev => {
      if (ev.subscription_start) {
        if (!map[ev.subscription_start]) map[ev.subscription_start] = [];
        map[ev.subscription_start].push({ ...ev, dateType: 'start' });
      }
      if (ev.subscription_end) {
        if (!map[ev.subscription_end]) map[ev.subscription_end] = [];
        map[ev.subscription_end].push({ ...ev, dateType: 'end' });
      }
      if (ev.listing_date) {
        if (!map[ev.listing_date]) map[ev.listing_date] = [];
        map[ev.listing_date].push({ ...ev, dateType: 'listing' });
      }
    });
    return map;
  }, [ipoEvents]);

  const upcomingIpos = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (ipoEvents || [])
      .filter(ev => (ev.subscription_start || '') >= today || (ev.subscription_end || '') >= today)
      .sort((a, b) => (a.subscription_start || '').localeCompare(b.subscription_start || ''));
  }, [ipoEvents]);

  const getTagStyle = (type) => {
    if (type === 'start') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (type === 'end') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (type === 'listing') return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    return 'bg-surface-container-highest text-on-surface-variant border-white/5';
  };

  const selectedDateEvents = dateEventMap[selectedDate] || [];

  return (
    <div className="animate-in fade-in duration-700 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-on-surface font-headline mb-1">공모주 캘린더</h1>
        </div>
        <div className="flex items-center gap-4 bg-surface-container p-1.5 rounded-2xl border border-white/5 shadow-lg">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl bg-surface-container-highest hover:bg-primary hover:text-on-primary flex items-center justify-center transition-all">
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <span className="text-base font-black font-headline min-w-[100px] text-center">{year}년 {month + 1}월</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl bg-surface-container-highest hover:bg-primary hover:text-on-primary flex items-center justify-center transition-all">
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-8 items-start">
        {/* Calendar Area */}
        <div className="w-full xl:flex-1">
          <div className="bg-[#121826]/40 backdrop-blur-md border border-white/5 rounded-[32px] p-4 md:p-8 shadow-2xl overflow-hidden">
            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-4">
              {weekDays.map(wd => (
                <div key={wd} className={`text-center text-[10px] md:text-xs font-black py-2 ${wd === '일' ? 'text-error' : wd === '토' ? 'text-tertiary' : 'text-on-surface-variant/40'}`}>{wd}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {days.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="aspect-square opacity-0" />;
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
                    className={`min-h-[70px] md:min-h-[100px] rounded-xl p-1 md:p-2 relative group cursor-pointer transition-all border flex flex-col
                      ${isSelected ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(115,255,186,0.1)] z-10' : 'border-transparent hover:bg-white/5'}
                      ${isToday && !isSelected ? 'border-primary/30 bg-primary/5' : ''}
                    `}
                  >
                    <span className={`text-[10px] md:text-xs font-black block text-center mb-1 ${isToday ? 'text-primary underline' : (dayOfWeek === 0 || holiday) ? 'text-error' : dayOfWeek === 6 ? 'text-tertiary' : 'text-on-surface-variant/60'}`}>
                      {day}
                    </span>
                    <div className="space-y-1 overflow-hidden flex-1">
                      {eventsForDay.map((ev, ei) => (
                        <div 
                          key={`${ev.id}-${ei}`} 
                          onClick={(e) => { e.stopPropagation(); onSelectIpo(ev); }} 
                          className={`text-[7px] md:text-[9px] leading-tight px-1 md:px-1.5 py-0.5 md:py-1 rounded truncate border cursor-pointer hover:opacity-80 transition-opacity font-bold ${getTagStyle(ev.dateType)}`}
                        >
                          {ev.company_name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Area - Upcoming IPOs */}
        <div className="w-full xl:w-[380px] xl:sticky xl:top-24">
          <div className="bg-[#121826]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-2xl flex flex-col max-h-[calc(100vh-140px)]">
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <span className="material-symbols-outlined text-primary text-2xl">rocket_launch</span>
              <h3 className="text-lg font-black font-headline tracking-tight">예정된 공모주</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2 min-h-[300px]">
              {upcomingIpos.length > 0 ? (
                upcomingIpos.map(ipo => {
                  const isOngoing = ipo.status === '청약중';
                  return (
                    <div 
                      key={ipo.id} 
                      onClick={() => onSelectIpo(ipo)}
                      className="bg-surface-container-high/40 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all group cursor-pointer relative"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-xs md:text-sm font-bold group-hover:text-primary transition-colors line-clamp-1 flex-1 pr-2">{ipo.company_name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shrink-0 ${isOngoing ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                          {ipo.status}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-on-surface-variant font-medium">
                          <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                          <span>{ipo.subscription_start?.replace(/-/g, '.')} ~ {ipo.subscription_end?.replace(/-/g, '.')}</span>
                        </div>
                        
                        {ipo.listing_date && (
                          <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-purple-400 font-bold">
                            <span className="material-symbols-outlined text-[16px]">event_upcoming</span>
                            <span>상장일: {ipo.listing_date.replace(/-/g, '.')}</span>
                          </div>
                        )}
                        
                        {ipo.min_subscription_amount && (
                          <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-emerald-400 font-black">
                            <span className="material-symbols-outlined text-[16px]">payments</span>
                            <span>균등 최소: {new Intl.NumberFormat('ko-KR').format(ipo.min_subscription_amount)}원</span>
                          </div>
                        )}
                        
                        <div className="flex items-start gap-1.5 text-[10px] md:text-xs text-on-surface-variant/60 pt-1 border-t border-white/5">
                          <span className="material-symbols-outlined text-[16px]">domain</span>
                          <span className="truncate">{ipo.lead_manager || '-'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center opacity-30">
                  <p className="text-sm font-bold">예정된 일정이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
