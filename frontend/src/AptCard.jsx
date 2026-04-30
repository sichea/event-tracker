import React from 'react';

// ============ Apt Card Component ============
export default function AptCard({ apt }) {
  const statusColors = {
    '청약중': 'text-primary bg-primary/10 border-primary/20',
    '청약예정': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    '청약마감': 'text-outline border-outline/20 opacity-60'
  };

  const formatDateRange = (start, end) => {
    if (!start && !end) return "기간 미정";
    const s = start ? start.replace(/-/g, ".") : "?";
    const e = end ? end.replace(/-/g, ".") : "?";
    return `${s} ~ ${e}`;
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
