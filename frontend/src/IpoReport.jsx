import React, { useState, useMemo } from 'react';

export default function IpoReport({ reports, onAddReport, onDeleteReport }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    stock_name: '',
    profit: '',
    return_rate: '',
    sell_date: new Date().toISOString().split('T')[0]
  });

  const summary = useMemo(() => {
    if (!Array.isArray(reports)) return { totalProfit: 0, yearProfit: 0, currentYear: new Date().getFullYear() };
    
    const totalProfit = reports.reduce((acc, r) => acc + Number(r?.profit || 0), 0);
    const currentYear = new Date().getFullYear();
    const yearProfit = reports
      .filter(r => r && r.sell_date && new Date(r.sell_date).getFullYear() === currentYear)
      .reduce((acc, r) => acc + Number(r?.profit || 0), 0);
    
    return { totalProfit, yearProfit, currentYear };
  }, [reports]);

  const groupedReports = useMemo(() => {
    if (!Array.isArray(reports)) return [];
    
    const groups = {};
    reports.forEach(r => {
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
  }, [reports]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddReport({
      ...formData,
      profit: Number(formData.profit),
      return_rate: Number(formData.return_rate)
    });
    setShowAddModal(false);
    setFormData({
      stock_name: '',
      profit: '',
      return_rate: '',
      sell_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto pb-32">
      {/* Header Summary */}
      <div className="bg-surface-container rounded-[32px] p-8 md:p-10 border border-white/5 shadow-2xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-black tracking-tighter text-on-surface font-headline">내 공모주 리포트</h1>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-white/5 pb-4">
              <span className="text-sm font-bold text-on-surface-variant opacity-60">전체 누적 수익</span>
              <span className="text-3xl font-black font-headline text-primary">
                {new Intl.NumberFormat('ko-KR').format(summary.totalProfit || 0)}<span className="text-lg ml-1">원</span>
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-sm font-bold text-on-surface-variant opacity-60">{summary.currentYear}년 총 수익</span>
              <span className="text-2xl font-black font-headline text-on-surface">
                {new Intl.NumberFormat('ko-KR').format(summary.yearProfit || 0)}<span className="text-base ml-1 opacity-60">원</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-10 right-6 md:right-10 w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-2xl shadow-primary/40 hover:scale-110 active:scale-90 transition-all z-[100] group"
      >
        <span className="material-symbols-outlined text-3xl font-bold">add</span>
        <span className="absolute right-full mr-4 px-3 py-1.5 bg-surface-container border border-white/10 rounded-xl text-xs font-bold text-on-surface opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">수익 기록하기</span>
      </button>

      {/* Grouped List */}
      <div className="space-y-10">
        {groupedReports.length > 0 ? (
          groupedReports.map(group => (
            <div key={`${group.year}-${group.month}`} className="animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-xl font-black font-headline tracking-tight">{group.month}월</h3>
                <span className="text-sm font-black text-primary">
                  {new Intl.NumberFormat('ko-KR').format(group.monthlyTotal)}원
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
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                          ▲ {item.return_rate}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <span className="text-lg font-black font-headline text-primary">
                        {new Intl.NumberFormat('ko-KR').format(item.profit)}원
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
          <div className="py-32 text-center">
            <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6 opacity-20">
              <span className="material-symbols-outlined text-4xl">analytics</span>
            </div>
            <p className="text-on-surface-variant font-bold opacity-40">아직 등록된 리포트가 없습니다.</p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="mt-6 text-primary font-black text-sm underline underline-offset-8"
            >
              첫 투자 수익 기록하기
            </button>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in" onClick={() => setShowAddModal(false)}>
          <div className="bg-surface-container rounded-[2.5rem] w-full max-w-md border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-8 pb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black font-headline tracking-tighter">수익 기록하기</h2>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-primary uppercase tracking-widest mb-2 ml-1">종목명</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.stock_name}
                    onChange={e => setFormData({...formData, stock_name: e.target.value})}
                    placeholder="예: 아이엠바이오로직스"
                    className="w-full bg-surface-container-highest border-white/5 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-primary uppercase tracking-widest mb-2 ml-1">수익금 (원)</label>
                    <input 
                      type="number" 
                      required 
                      value={formData.profit}
                      onChange={e => setFormData({...formData, profit: e.target.value})}
                      placeholder="0"
                      className="w-full bg-surface-container-highest border-white/5 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-primary uppercase tracking-widest mb-2 ml-1">수익률 (%)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required 
                      value={formData.return_rate}
                      onChange={e => setFormData({...formData, return_rate: e.target.value})}
                      placeholder="0.00"
                      className="w-full bg-surface-container-highest border-white/5 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-primary uppercase tracking-widest mb-2 ml-1">매도일</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.sell_date}
                    onChange={e => setFormData({...formData, sell_date: e.target.value})}
                    className="w-full bg-surface-container-highest border-white/5 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="w-full py-5 bg-primary text-on-primary rounded-2xl font-black text-base shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                기록 완료
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
