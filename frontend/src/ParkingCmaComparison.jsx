import React, { useState, useEffect } from 'react';
import { fetchParkingRates } from './api';

export default function ParkingCmaComparison({ parkingFilter }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchParkingRates();
        setRates(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredRates = rates.filter(r => {
    if (parkingFilter === 'all') return true;
    if (parkingFilter === 'no_conditions') return r.has_conditions === false;
    if (parkingFilter === 'high_yield') return r.max_rate >= 3.5;
    if (parkingFilter === 'major') return ['삼성증권', '미래에셋증권', '한국투자증권', 'NH투자증권', 'KB증권'].includes(r.bank_name);
    return true;
  });

  if (loading) return <div className="py-20 flex justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>;

  return (
    <div className="animate-in fade-in duration-700">
      <div className="mb-10">
        <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-on-surface font-headline mb-2">파킹통장 & CMA 비교</h1>
        <p className="text-on-surface-variant italic">잠자는 돈을 깨우는 가장 스마트한 방법.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredRates.map((r, i) => (
          <div key={i} className="bg-surface-container p-8 rounded-[40px] border border-white/5 hover:border-primary/20 transition-all group flex flex-col h-full relative overflow-hidden">
             <div className="flex justify-between items-start mb-6">
                <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full border border-primary/20 uppercase tracking-widest">{r.product_type || 'CMA'}</span>
                <span className="text-[10px] font-bold text-on-surface-variant opacity-40">{r.bank_name}</span>
             </div>
             <h4 className="text-xl font-bold mb-6 group-hover:text-primary transition-colors leading-tight">{r.product_name}</h4>
             <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">최대 금리</p>
                  <p className="text-3xl font-black text-primary font-headline">{r.max_rate}%</p>
                </div>
                <button onClick={() => window.open(r.link || 'https://www.google.com/search?q=' + encodeURIComponent(r.bank_name + ' ' + r.product_name), '_blank')} className="w-12 h-12 rounded-2xl bg-surface-container-highest hover:bg-primary hover:text-on-primary flex items-center justify-center transition-all">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
