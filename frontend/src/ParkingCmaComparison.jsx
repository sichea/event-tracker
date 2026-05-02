import React, { useState, useEffect, useMemo } from 'react';
import { fetchParkingRates } from './api';

export default function ParkingCmaComparison({ parkingFilter }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayAmount, setDisplayAmount] = useState("5,000,000");
  const [amount, setAmount] = useState(5000000);

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

  const handleAmountChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (val === "") {
      setDisplayAmount("");
      setAmount(0);
      return;
    }
    const num = parseInt(val, 10);
    setAmount(num);
    setDisplayAmount(num.toLocaleString());
  };

  const calculateMonthlyInterest = (deposit, product) => {
    const name = product.product_name;
    let annualInterest = 0;
    if (name.includes("OK짠테크")) {
      if (deposit <= 500000) annualInterest = deposit * 0.07;
      else if (deposit <= 5000000) annualInterest = (500000 * 0.07) + ((deposit - 500000) * 0.008);
      else if (deposit <= 50000000) annualInterest = (500000 * 0.07) + (4500000 * 0.008) + ((deposit - 5000000) * 0.001);
      else annualInterest = (500000 * 0.07) + (4500000 * 0.008) + (45000000 * 0.001) + ((deposit - 50000000) * 0.01);
    } else if (name.includes("Fi 쌈짓돈")) {
      if (deposit <= 1000000) annualInterest = deposit * 0.05;
      else if (deposit <= 5000000) annualInterest = (1000000 * 0.05) + ((deposit - 1000000) * 0.03);
      else if (deposit <= 50000000) annualInterest = (1000000 * 0.05) + (4000000 * 0.03) + ((deposit - 5000000) * 0.02);
      else annualInterest = (1000000 * 0.05) + (4000000 * 0.03) + (45000000 * 0.02) + ((deposit - 50000000) * 0.01);
    } else if (name.includes("SOL통장")) {
      annualInterest = (Math.min(deposit, 2000000) * 0.045) + (Math.max(0, deposit - 2000000) * 0.001);
    } else if (name.includes("DB행복파킹")) {
      if (deposit <= 5000000) annualInterest = deposit * 0.035;
      else if (deposit <= 30000000) annualInterest = (5000000 * 0.035) + ((deposit - 5000000) * 0.015);
      else annualInterest = (5000000 * 0.035) + (25000000 * 0.015) + ((deposit - 30000000) * 0.008);
    } else if (name.includes("비상금박스")) {
      annualInterest = deposit * 0.03;
    } else if (name.includes("머니모으기")) {
      annualInterest = (Math.min(deposit, 2000000) * 0.05) + (Math.max(0, deposit - 2000000) * 0.02);
    } else if (name.includes("스마트박스")) {
      const effectiveRate = deposit >= 200000000 ? 0.05 : 0.03;
      annualInterest = deposit * effectiveRate;
    } else if (name.includes("플러스박스")) {
      if (deposit <= 50000000) annualInterest = deposit * 0.017;
      else annualInterest = (50000000 * 0.017) + ((deposit - 50000000) * 0.022);
    } else if (name.includes("파킹플렉스")) {
      if (deposit <= 5000000) annualInterest = deposit * 0.0301;
      else annualInterest = (5000000 * 0.0301) + ((deposit - 5000000) * 0.024);
    } else {
      annualInterest = deposit * (product.max_rate / 100);
    }
    return Math.floor((annualInterest / 12) * 0.846);
  };

  const sortedRates = useMemo(() => {
    return [...rates].sort((a, b) => {
      return calculateMonthlyInterest(amount, b) - calculateMonthlyInterest(amount, a);
    });
  }, [rates, amount]);

  if (loading) return (
    <div className="py-20 flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
      <p className="text-on-surface-variant animate-pulse font-medium text-center">최신 금리 데이터를<br/>정밀 분석 중...</p>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl lg:text-5xl font-black tracking-tighter text-on-surface font-headline mb-3">
          프리미엄 <span className="text-primary">파킹 계산기</span> 💰
        </h1>
        
        <div className="max-w-md mx-auto bg-surface-container p-1 rounded-full border border-white/10 shadow-xl flex items-center group focus-within:border-primary/50 transition-all mb-4">
          <div className="pl-4 pr-2 py-2 text-primary">
             <span className="material-symbols-outlined text-xl">payments</span>
          </div>
          <input 
            type="text" 
            value={displayAmount}
            onChange={handleAmountChange}
            placeholder="금액 입력"
            className="w-full bg-transparent border-none outline-none text-xl font-black text-on-surface placeholder:text-on-surface-variant/30 py-2"
          />
          <div className="pr-4 text-on-surface-variant font-bold text-sm">원</div>
        </div>
        
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[11px] text-on-surface-variant flex items-center justify-center gap-1.5">
             <span className="material-symbols-outlined text-[14px]">info</span>
             입력하신 금액에 따른 <b>세후 월 예상 수령액</b>입니다.
          </p>
          <p className="text-[11px] text-tertiary/80 flex items-center justify-center gap-1.5 font-bold animate-pulse">
             <span className="material-symbols-outlined text-[14px]">warning</span>
             금리는 수시로 변동될 수 있습니다. 개설 전 <b>돋보기 아이콘</b>을 눌러 최신 정보를 확인하세요!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedRates.map((r, i) => {
          const monthlyMoney = calculateMonthlyInterest(amount, r);
          let descriptionText = "";
          try {
            const descObj = typeof r.description === 'string' ? JSON.parse(r.description) : r.description;
            descriptionText = descObj.text || "";
            descriptionText = descriptionText.replace(/멘토리 추천:/g, "").trim();
          } catch(e) { 
            descriptionText = r.description ? r.description.toString().replace(/멘토리 추천:/g, "").trim() : ""; 
          }

          return (
            <div key={i} className="bg-surface-container p-5 rounded-[2rem] border border-white/5 hover:border-primary/30 transition-all group flex flex-col relative overflow-hidden">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center border border-white/5">
                      <span className="material-symbols-outlined text-primary text-base">account_balance</span>
                    </div>
                    <span className="text-[10px] font-bold text-on-surface-variant">{r.institution}</span>
                  </div>
                  <div className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[9px] font-black border border-primary/20">
                    최신
                  </div>
               </div>
               
               <div className="flex items-center justify-between gap-2 mb-4">
                 <h4 className="text-base font-bold group-hover:text-primary transition-colors leading-tight line-clamp-1 flex-1">{r.product_name}</h4>
                 <button 
                   onClick={() => window.open('https://www.google.com/search?q=' + encodeURIComponent(r.institution + ' ' + r.product_name), '_blank')}
                   className="w-7 h-7 rounded-full bg-surface-container-highest hover:bg-primary hover:text-on-primary flex items-center justify-center transition-all shrink-0"
                   title="상세 정보 확인"
                 >
                   <span className="material-symbols-outlined text-sm">search</span>
                 </button>
               </div>
               
               <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-surface-container-highest/40 p-3 rounded-xl flex flex-col justify-center">
                    <span className="text-[9px] font-bold text-on-surface-variant mb-0.5">최대 금리</span>
                    <span className="text-base font-black text-on-surface">{r.max_rate}%</span>
                  </div>
                  <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex flex-col justify-center">
                    <span className="text-[9px] font-black text-primary uppercase mb-0.5">예상 월 이자</span>
                    <span className="text-base font-black text-primary">
                      +{monthlyMoney.toLocaleString()}원
                    </span>
                  </div>
               </div>

               <div className="pt-3 border-t border-white/5">
                  <p className="text-[10px] text-on-surface-variant leading-relaxed line-clamp-1 opacity-70">
                    {r.tag ? `[${r.tag}] ` : ''}{descriptionText}
                  </p>
               </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-12 p-4 bg-surface-container-highest/20 rounded-2xl border border-dashed border-white/10 text-center">
        <p className="text-on-surface-variant text-[10px] flex items-center justify-center gap-1.5 opacity-60">
          <span className="material-symbols-outlined text-primary text-xs">verified</span>
          본 자료는 2026년 4월 시장 데이터를 기반으로 엄선되었습니다.
        </p>
      </div>
    </div>
  );
}
