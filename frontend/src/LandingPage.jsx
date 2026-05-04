import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const ThoughtBubble = ({ text, show, isFinal, index }) => {
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setIsTyping(false), 800);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const phases = [
    { label: "거시경제 시그널 감지", icon: "sensors" },
    { label: "투자 논리 인과 관계 분석", icon: "account_tree" },
    { label: "시장 역학 및 변동성 진단", icon: "query_stats" },
    { label: "기관 자본 순환 경로 추적", icon: "currency_exchange" },
    { label: "최종 투자 전략 리포트 도출", icon: "description" }
  ];
  const currentPhase = phases[index] || { label: "데이터 심층 분석", icon: "psychology" };

  return (
    <div className={`relative flex flex-col items-center transition-all duration-1000 transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'} mx-auto mb-10 w-full max-w-sm md:max-w-lg`}>
      <div className={`relative z-10 w-full bg-[#1e2533]/60 backdrop-blur-3xl border border-white/10 p-5 md:p-7 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${isFinal ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary text-[16px] animate-pulse">{currentPhase.icon}</span>
          </div>
          <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest">{currentPhase.label}</span>
        </div>
        
        {isTyping && show ? (
          <div className="flex gap-1.5 py-2 px-1">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        ) : (
          <p className={`text-sm md:text-base font-bold leading-relaxed tracking-tight ${isFinal ? 'text-primary' : 'text-[#ebedfb]'}`}>
            {text}
          </p>
        )}
      </div>
      
      {show && !isFinal && (
        <div className="absolute top-full left-1/2 w-px h-10 bg-gradient-to-b from-primary/30 to-transparent flex items-center justify-center -translate-x-1/2">
          <div className="w-1 h-1 bg-primary/30 rounded-full" />
        </div>
      )}
    </div>
  );
};

export default function LandingPage({ onAnalyze, isAnalyzing, analysisResult, onReset }) {
  const [scenario, setScenario] = useState('');
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [remainingQuota, setRemainingQuota] = useState(500);
  const [userRemaining, setUserRemaining] = useState(5);

  useEffect(() => {
    async function fetchQuota() {
      try {
        const res = await fetch('/api/quota');
        const data = await res.json();
        setRemainingQuota(data.global_remaining);
        setUserRemaining(data.user_remaining);
      } catch (err) {
        console.error("Failed to fetch quota:", err);
      }
    }
    fetchQuota();
  }, []);

  useEffect(() => {
    if (analysisResult) {
      if (analysisResult.remaining !== undefined) setRemainingQuota(analysisResult.remaining);
      if (analysisResult.user_remaining !== undefined) setUserRemaining(analysisResult.user_remaining);
    }
  }, [analysisResult]);

  useEffect(() => {
    if (analysisResult && analysisResult.steps) {
      const timers = analysisResult.steps.map((_, i) => setTimeout(() => setVisibleSteps(i + 1), i * 1500));
      return () => timers.forEach(clearTimeout);
    } else {
      setVisibleSteps(0);
    }
  }, [analysisResult]);

  const steps = analysisResult?.steps?.map(text => ({ text })) || [];

  return (
    <div className="relative flex-1 flex flex-col bg-[#0a0e17] overflow-x-hidden min-h-[calc(100vh-280px)]">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <main className="flex-1 flex flex-col items-center justify-center py-6 md:py-10 px-6 relative z-10 max-w-5xl mx-auto w-full overflow-hidden">
        {!analysisResult && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.12]">
            <img src="/images/thinking_robot.png" alt="" className="w-full max-w-5xl h-full object-contain filter invert grayscale brightness-125 contrast-110" />
          </div>
        )}

        {!analysisResult ? (
          <div className="w-full space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 relative z-10">
            <div className="flex flex-col items-center text-center space-y-4">
              <p className="text-white/90 text-xl md:text-2xl font-black tracking-tight drop-shadow-2xl">
                통찰력을 기르는 한 문장을 적어보세요.
              </p>
              <p className="text-white/40 text-sm md:text-base font-medium max-w-xl leading-relaxed">
                글로벌 전설적 투자자들의 포트폴리오와 월스트리트 리서치 데이터를<br/> 
                학습한 AI가 <span className="text-primary/80 font-bold">자금의 이동 경로</span>를 정밀 추적합니다.
              </p>
            </div>

            <div className="w-full max-w-xl mx-auto relative group px-4">
              <div className={`relative flex items-center transition-all duration-500 rounded-full border border-white/10 bg-transparent group-hover:bg-white/[0.05] group-hover:backdrop-blur-3xl group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${scenario.trim() ? 'bg-white/[0.03] backdrop-blur-xl' : ''} focus-within:bg-white/[0.08] focus-within:backdrop-blur-3xl focus-within:outline-none focus-within:shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]`}>
                <div className="pl-4 md:pl-6 text-primary/60">
                  <span className="material-symbols-outlined text-2xl">psychology</span>
                </div>
                <div className="flex-1 flex items-center h-14 md:h-16 relative">
                  <input type="text" id="scenario-input" value={scenario} onChange={(e) => setScenario(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && scenario.trim() && !isAnalyzing) { e.target.blur(); onAnalyze(scenario); } }} className="flex-1 bg-transparent border-none pl-2 pr-20 md:pl-4 md:pr-28 text-white text-base md:text-xl !outline-none focus:!outline-none focus:ring-0 placeholder:text-white/20 font-medium appearance-none" style={{ WebkitTapHighlightColor: 'transparent', outline: 'none', boxShadow: 'none' }} />
                </div>
              </div>

              <button type="button" onMouseDown={(e) => e.preventDefault()} onTouchStart={() => { if (scenario.trim() && !isAnalyzing && userRemaining > 0) { document.getElementById('scenario-input')?.blur(); onAnalyze(scenario); } }} onClick={() => { if (scenario.trim() && !isAnalyzing && userRemaining > 0) { document.getElementById('scenario-input')?.blur(); onAnalyze(scenario); } }} disabled={isAnalyzing || !scenario.trim() || userRemaining <= 0} className={`absolute right-6 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all duration-300 z-[9999] ${scenario.trim() && userRemaining > 0 ? 'bg-primary text-on-primary scale-110 shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]' : 'bg-white/5 text-white/20 scale-90'} active:scale-95 touch-manipulation cursor-pointer`}>
                {isAnalyzing ? <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></div> : userRemaining <= 0 ? <span className="material-symbols-outlined text-xl md:text-2xl text-error">lock</span> : <span className="material-symbols-outlined text-xl md:text-2xl">arrow_forward</span>}
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 mt-8">
              <div className="flex items-center justify-center gap-4 text-[9px] md:text-xs font-black text-white/20 uppercase tracking-[0.2em]">
                <span className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary/40" /> AI Scenario Analysis</span>
                <span className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-blue-500/40" /> Real-time Insight</span>
              </div>
              <div className="flex flex-col items-center gap-2.5 opacity-40 hover:opacity-100 transition-all duration-500">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.2em] uppercase text-white/60">My Energy</div>
                  <div className="flex gap-1">{[...Array(10)].map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${i < (userRemaining / 5) ? 'bg-primary shadow-[0_0_8px_rgba(115,255,186,0.6)]' : 'bg-white/10'}`} />)}</div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase">
                    <span className="text-white/30">System Energy</span>
                    <span className="text-primary/60">{remainingQuota !== null ? remainingQuota.toLocaleString() : '---'} / 500</span>
                  </div>
                  <div className="w-32 h-0.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/40 transition-all duration-1000 ease-out" style={{ width: `${(remainingQuota / 500) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl flex flex-col relative pt-8">
            <div className="flex flex-col w-full min-h-[400px] mb-12">
              {steps.map((step, i) => <ThoughtBubble key={i} index={i} text={step.text} show={visibleSteps > i} isFinal={i === steps.length - 1} />)}
            </div>
            
            {visibleSteps >= steps.length && steps.length > 0 && (
              <div className="w-full max-w-4xl mx-auto mt-4 animate-in fade-in slide-in-from-bottom-12 duration-1000">
                <div className="bg-gradient-to-br from-[#1e2533]/90 to-[#0a0e17] backdrop-blur-3xl p-8 md:p-12 rounded-[40px] border border-primary/20 shadow-2xl relative overflow-hidden mb-8">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Recommended Sector</span>
                      </div>
                      <h3 className="text-3xl md:text-5xl font-black text-[#ebedfb] tracking-tighter leading-tight italic">{analysisResult.sector}</h3>
                      <p className="text-on-surface-variant text-base md:text-lg max-w-lg leading-relaxed opacity-80">{analysisResult.advice}</p>
                    </div>
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-primary/5 rounded-3xl border border-primary/10 flex items-center justify-center rotate-3 transition-transform duration-500">
                      <span className="material-symbols-outlined text-primary text-5xl md:text-7xl">trending_up</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                  <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysisResult.stocks?.map((s, i) => {
                      const name = s.name;
                      const krCodeMatch = name.match(/\((\d{6})\)/);
                      const globalCodeMatch = name.match(/\(([A-Z]{1,5})\)/);
                      let link = krCodeMatch ? `https://finance.naver.com/item/main.naver?code=${krCodeMatch[1]}` : globalCodeMatch ? `https://finance.naver.com/world/search.naver?query=${globalCodeMatch[1]}` : `https://search.naver.com/search.naver?query=${encodeURIComponent(name.split('(')[0].trim() + ' 주가')}`;
                      return (
                        <div key={i} onClick={() => window.open(link, '_blank')} className="group p-6 bg-[#1e2533]/40 hover:bg-primary/5 rounded-[32px] border border-white/5 hover:border-primary/30 transition-all cursor-pointer active:scale-[0.98] flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <div className="px-2 py-1 bg-white/5 rounded text-[9px] font-bold text-on-surface-variant/60 group-hover:bg-primary/20 group-hover:text-primary">{krCodeMatch || globalCodeMatch ? (krCodeMatch ? krCodeMatch[1] : globalCodeMatch[1]) : 'EQUITY'}</div>
                              <span className="material-symbols-outlined text-primary/40 group-hover:text-primary transition-colors text-lg">north_east</span>
                            </div>
                            <h4 className="font-black text-[#ebedfb] text-xl mb-3 group-hover:text-primary transition-colors tracking-tight">{name}</h4>
                            <p className="text-xs text-on-surface-variant leading-relaxed opacity-70 group-hover:opacity-100 line-clamp-3">{s.reason}</p>
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={onReset} className="p-6 md:p-8 rounded-[32px] bg-[#0a0e17] border border-white/5 hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-3 group text-on-surface-variant hover:text-primary">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <span className="material-symbols-outlined text-2xl group-hover:rotate-180 transition-transform duration-500">refresh</span>
                      </div>
                      <span className="font-black text-sm tracking-widest uppercase">New Analysis</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-orange-500/5 p-8 rounded-[32px] border border-orange-500/20 h-full">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center"><span className="material-symbols-outlined text-orange-500 text-[18px]">warning</span></div>
                        <h4 className="text-xs font-black text-orange-500 uppercase tracking-widest">Risk Warning</h4>
                      </div>
                      <div className="space-y-5">
                        {analysisResult.caution?.map((c, i) => (
                          <div key={i} className="space-y-1">
                            <p className="text-[10px] font-black text-orange-500/50 uppercase tracking-tighter">Signal {i+1}</p>
                            <p className="text-sm text-on-surface-variant leading-relaxed opacity-80">{c}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
