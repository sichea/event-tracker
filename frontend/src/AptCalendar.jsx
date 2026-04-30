import React, { useState, useMemo } from 'react';
import AptCard from './AptCard';

const PUBLIC_HOLIDAYS_2026 = {
  '2026-01-01': '신정', '2026-02-16': '설날', '2026-02-17': '설날', '2026-02-18': '설날',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날',
  '2026-06-06': '현충일', '2026-08-15': '광복절', '2026-09-24': '추석', '2026-09-25': '추석',
  '2026-09-26': '추석', '2026-10-03': '개천절', '2026-10-09': '한글날', '2026-12-25': '성탄절'
};

export default function AptCalendar({ aptEvents, searchQuery }) {
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
    (aptEvents || []).forEach(apt => {
      if (apt.subscription_start) {
        if (!map[apt.subscription_start]) map[apt.subscription_start] = [];
        map[apt.subscription_start].push({ ...apt, dateType: 'start' });
      }
      if (apt.subscription_end) {
        if (!map[apt.subscription_end]) map[apt.subscription_end] = [];
        map[apt.subscription_end].push({ ...apt, dateType: 'end' });
      }
      if (apt.winner_date) {
        if (!map[apt.winner_date]) map[apt.winner_date] = [];
        map[apt.winner_date].push({ ...apt, dateType: 'winner' });
      }
    });
    return map;
  }, [aptEvents]);

  const upcomingApts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (aptEvents || [])
      .filter(ev => (ev.subscription_start || '') >= today || (ev.subscription_end || '') >= today)
      .sort((a, b) => (a.subscription_start || '').localeCompare(b.subscription_start || ''));
  }, [aptEvents]);

  const getTagStyle = (dateType) => {
    if (dateType === 'start') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (dateType === 'end') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (dateType === 'winner') return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    return 'bg-outline-variant/20 text-outline border-outline-variant/30';
  };

  const selectedDateEvents = dateEventMap[selectedDate] || [];

  return (
    <div className="animate-in fade-in duration-700 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-on-surface font-headline mb-1">아파트 청약 캘린더</h1>
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
                          className={`text-[7px] md:text-[9px] leading-tight px-1 md:px-1.5 py-0.5 md:py-1 rounded truncate border font-bold ${getTagStyle(ev.dateType)}`}
                        >
                          {ev.house_name || ev.name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Area - Upcoming Apts */}
        <div className="w-full xl:w-[380px] xl:sticky xl:top-24">
          <div className="bg-[#121826]/60 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-2xl flex flex-col max-h-[calc(100vh-140px)]">
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <span className="material-symbols-outlined text-primary text-2xl">home_work</span>
              <h3 className="text-lg font-black font-headline tracking-tight">예정된 아파트 청약</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2 min-h-[300px]">
              {selectedDateEvents.length > 0 && (
                <div className="mb-8 space-y-4">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest px-2">{selectedDate.split('-')[2]}일의 상세 일정</p>
                  {selectedDateEvents.map(apt => (
                    <AptCard key={`${apt.id}-selected`} apt={apt} />
                  ))}
                  <div className="border-b border-white/5 mx-2 pb-4"></div>
                </div>
              )}

              {upcomingApts.length > 0 ? (
                <>
                  <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-2 mb-2">전체 예정 일정</p>
                  {upcomingApts.map(apt => (
                    <AptCard key={apt.id} apt={apt} />
                  ))}
                </>
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
