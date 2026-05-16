import React, { useMemo } from 'react';

export default function IpoReport({ reports, onDeleteReport }) {
  const safeReports = Array.isArray(reports) ? reports : [];
  
  const summary = useMemo(() => {
    const totalProfit = safeReports.reduce((acc, r) => acc + Number(r?.profit || 0), 0);
    const currentYear = new Date().getFullYear();
    const yearProfit = safeReports
      .filter(r => r && r.sell_date && new Date(r.sell_date).getFullYear() === currentYear)
      .reduce((acc, r) => acc + Number(r?.profit || 0), 0);
    const avgRate = safeReports.length > 0 
      ? (safeReports.reduce((acc, r) => acc + Number(r?.return_rate || 0), 0) / safeReports.length).toFixed(1)
      : 0;
    return { totalProfit, yearProfit, currentYear, avgRate, totalCount: safeReports.length };
  }, [safeReports]);

  const groupedReports = useMemo(() => {
    const groups = {};
    safeReports.forEach(r => {
      if (!r || !r.sell_date) return;
      const date = new Date(r.sell_date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      if (isNaN(year) || isNaN(month)) return;
      const key = `${year}-${month}`;
      if (!groups[key]) groups[key] = { year, month, items: [], monthlyTotal: 0 };
      groups[key].items.push(r);
      groups[key].monthlyTotal += Number(r.profit || 0);
    });
    return Object.values(groups).sort((a, b) => b.year - a.year || b.month - a.month);
  }, [safeReports]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto pb-20">
      {/* Header Summary */}
      <div className="bg-surface-container rounded-[32px] p-8 md:p-10 border border-white/5 shadow-2xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black tracking-tighter text-on-surface font-headline mb-8">내 공모주 리포트</h1>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-surface-container-highest rounded-2xl p-4 border border-white/5 text-center">
              <p className="text-[9px] font-bold text-on-surface-variant opacity-50 uppercase tracking-widest mb-2">총 거래</p>
              <p className="text-2xl font-black font-headline text-on-surface">{summary.totalCount}<span className="text-xs ml-0.5 opacity-40">건</span></p>
            </div>
            <div className="bg-surface-container-highest rounded-2xl p-4 border border-white/5 text-center">
              <p className="text-[9px] font-bold text-on-surface-variant opacity-50 uppercase tracking-widest mb-2">평균 수익률</p>
              <p className={`text-2xl font-black font-headline ${Number(summary.avgRate) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {summary.avgRate}<span className="text-xs ml-0.5">%</span>
              </p>
            </div>
            <div className="bg-surface-container-highest rounded-2xl p-4 border border-white/5 text-center">
              <p className="text-[9px] font-bold text-on-surface-variant opacity-50 uppercase tracking-widest mb-2">{summary.currentYear}년</p>
              <p className="text-2xl font-black font-headline text-on-surface">
                {new Intl.NumberFormat('ko-KR', {notation: 'compact'}).format(summary.yearProfit)}<span className="text-xs ml-0.5 opacity-40">원</span>
              </p>
            </div>
          </div>

          <div className="flex justify-between items-end border-t border-white/5 pt-6">
            <span className="text-sm font-bold text-on-surface-variant opacity-60">전체 누적 수익</span>
            <span className={`text-3xl font-black font-headline ${summary.totalProfit >= 0 ? 'text-primary' : 'text-red-400'}`}>
              {summary.totalProfit >= 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(summary.totalProfit)}<span className="text-lg ml-1">원</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tip */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 mb-8 flex items-start gap-3">
        <span className="material-symbols-outlined text-primary mt-0.5 text-lg">tips_and_updates</span>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          <strong className="text-primary">수익 기록 방법:</strong> 공모주 캘린더에서 상장 완료된 종목을 클릭하면 "투자 수익 기록하기" 버튼이 나타납니다. 투자금과 수익금을 입력하면 수익률이 자동 계산됩니다.
        </p>
      </div>

      {/* Grouped List */}
      <div className="space-y-10">
        {groupedReports.length > 0 ? (
          groupedReports.map(group => (
            <div key={`${group.year}-${group.month}`} className="animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-xl font-black font-headline tracking-tight">{group.year}년 {group.month}월</h3>
                <span className={`text-sm font-black ${group.monthlyTotal >= 0 ? 'text-primary' : 'text-red-400'}`}>
                  {group.monthlyTotal >= 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(group.monthlyTotal)}원
                </span>
              </div>
              <div className="space-y-3">
                {group.items.map(item => (
                  <div key={item.id} className="bg-surface-container-high/40 backdrop-blur-sm border border-white/5 rounded-2xl p-5 flex items-center justify-between group hover:border-white/10 transition-all">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base font-bold text-on-surface">{item.stock_name}</h4>
                        <span className="text-[10px] text-on-surface-variant opacity-40 font-medium">{item.sell_date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${Number(item.return_rate) >= 0 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {Number(item.return_rate) >= 0 ? '▲' : '▼'} {Math.abs(item.return_rate)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <span className={`text-lg font-black font-headline ${Number(item.profit) >= 0 ? 'text-primary' : 'text-red-400'}`}>
                        {Number(item.profit) >= 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(item.profit)}원
                      </span>
                      <button 
                        onClick={() => { if(window.confirm('삭제하시겠습니까?')) onDeleteReport(item.id); }}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-error/20 hover:text-error transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6 opacity-20">
              <span className="material-symbols-outlined text-4xl">analytics</span>
            </div>
            <p className="text-on-surface-variant font-bold opacity-40 mb-2">아직 등록된 수익 기록이 없습니다.</p>
            <p className="text-on-surface-variant text-xs opacity-30">공모주 캘린더에서 상장 완료된 종목을 눌러 기록을 시작하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
