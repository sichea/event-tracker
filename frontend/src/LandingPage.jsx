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

  // 고정된 단계 명칭 제거
  const getPhaseLabel = (index) => {
    const labels = ["현상의 본질", "자본의 의도", "시장의 변곡점", "전략적 판단", "최종 제언"];
    return labels[index] || "심층 분석";
  };
  // 어떤 데이터가 오든 강제로 문자열로 변환하여 에러 방지
  const safeText = String(text || "");
  const cleanText = safeText
    .replace(/^\d+[\.\s단계:]+\s*/, '') // 시작 부분의 숫자/단계 표시 제거
    .replace(/\*\*/g, ''); // 굵은 글씨 제거

  return (
    <div className={`relative flex flex-col items-center transition-all duration-1000 transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'} mx-auto mb-10 w-full max-w-2xl`}>
      <div className={`relative z-10 w-full bg-[#1e2533]/40 backdrop-blur-3xl border border-white/5 p-6 md:p-8 rounded-[32px] shadow-2xl ${isFinal ? 'border-primary/40 bg-primary/5' : ''}`}>
        {isTyping && show ? (
          <div className="flex gap-1 py-2">
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        ) : (
          <p className={`text-[16px] md:text-[18px] font-medium leading-relaxed tracking-tight ${isFinal ? 'text-primary' : 'text-white/90'}`}>
            {cleanText}
          </p>
        )}
      </div>
      
      {show && !isFinal && (
        <div className="absolute top-full left-1/2 w-px h-8 bg-gradient-to-b from-primary/20 to-transparent -translate-x-1/2" />
      )}
    </div>
  );
};

export default function LandingPage({ onAnalyze, isAnalyzing, analysisResult, onReset }) {
  const [scenario, setScenario] = useState('');
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [remainingQuota, setRemainingQuota] = useState(500);
  const [userRemaining, setUserRemaining] = useState(50);

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
      const timers = analysisResult.steps.map((_, i) => setTimeout(() => setVisibleSteps(i + 1), i * 1200));
      return () => timers.forEach(clearTimeout);
    } else {
      setVisibleSteps(0);
    }
  }, [analysisResult]);

  const steps = analysisResult?.steps?.map(text => ({ text })) || [];

  return (
    <div className="relative flex-1 flex flex-col bg-[#0a0e17] overflow-x-hidden min-h-[calc(100vh-280px)]">
      <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

      <main className="flex-1 flex flex-col items-center py-8 md:py-16 px-6 relative z-10 max-w-6xl mx-auto w-full">
        {/* THE KICK: Thinking Robot Background - Refined & Blended */}
        {!analysisResult && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.1] animate-in fade-in duration-1000">
            <img 
              src="/images/thinking_robot.png" 
              alt="" 
              className="w-full max-w-5xl h-[80vh] object-contain filter invert grayscale brightness-150 contrast-125"
            />
          </div>
        )}
        {!analysisResult ? (
          <div className="w-full max-w-2xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 mt-20">
            <div className="flex flex-col items-center text-center space-y-4">
              <h1 className="text-white/90 text-2xl md:text-3xl font-black tracking-tight">통찰력을 기르는 한 문장을 적어보세요.</h1>
              <p className="text-white/40 text-sm md:text-base font-medium max-w-lg leading-relaxed">
                글로벌 전설적 투자자들의 포트폴리오와 월스트리트 리서치 데이터를<br/> 
                학습한 AI가 <span className="text-primary/80 font-bold">자금의 이동 경로</span>를 정밀 추적합니다.
              </p>
            </div>

            {/* Google Search Style Single-Line Input */}
            <div className="w-full max-w-xl mx-auto relative group px-4">
              <div className={`
                relative flex items-center transition-all duration-500 rounded-full border border-white/10
                bg-transparent group-hover:bg-white/[0.05] group-hover:backdrop-blur-3xl group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]
                ${scenario.trim() ? 'bg-white/[0.03] backdrop-blur-xl' : ''}
                focus-within:bg-white/[0.08] focus-within:backdrop-blur-3xl focus-within:outline-none focus-within:shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]
              `}>
                <div className="pl-4 md:pl-6 text-primary/60">
                  <span className="material-symbols-outlined text-2xl">psychology</span>
                </div>
                
                <div className="flex-1 flex items-center h-14 md:h-16 relative">
                  <input 
                    type="text"
                    id="scenario-input"
                    value={scenario} 
                    onChange={(e) => setScenario(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && scenario.trim() && !isAnalyzing) {
                        e.target.blur();
                        onAnalyze(scenario);
                      }
                    }}
                    className="flex-1 bg-transparent border-none pl-2 pr-20 md:pl-4 md:pr-28 text-white text-base md:text-xl !outline-none focus:!outline-none focus:ring-0 placeholder:text-white/20 font-medium appearance-none" 
                    style={{ WebkitTapHighlightColor: 'transparent', outline: 'none', boxShadow: 'none' }}
                  />
                </div>
              </div>

                <button 
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (scenario.trim() && !isAnalyzing && userRemaining > 0) {
                      document.getElementById('scenario-input')?.blur();
                      onAnalyze(scenario);
                    }
                  }}
                  disabled={isAnalyzing || !scenario.trim() || userRemaining <= 0} 
                  className={`
                    absolute right-6 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all duration-300 z-[9999]
                    ${scenario.trim() && userRemaining > 0 ? 'bg-primary text-[#0a0e17] scale-110 shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]' : 'bg-white/5 text-white/20 scale-90'}
                    active:scale-95 touch-manipulation cursor-pointer
                  `}
                >
                  {isAnalyzing ? (
                    <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined text-xl md:text-2xl">arrow_forward</span>
                  )}
                </button>
            </div>

            <div className="flex flex-col items-center gap-6 pt-4">
              <div className="flex gap-1.5">{[...Array(10)].map((_, i) => <div key={i} className={`w-1 h-1 rounded-full ${i < (userRemaining / 5) ? 'bg-primary/60 shadow-[0_0_8px_rgba(115,255,186,0.3)]' : 'bg-white/10'}`} />)}</div>
              <div className="text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">Available Energy: {userRemaining} / 50</div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl flex flex-col relative animate-in fade-in duration-700">
            <div className="w-full space-y-6 mb-16">
              {steps.map((step, i) => <ThoughtBubble key={i} index={i} text={step.text} show={visibleSteps > i} isFinal={i === steps.length - 1} />)}
            </div>
            
            {visibleSteps >= steps.length && steps.length > 0 && (
              <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                {/* Sector Hero Card - Refined with Safety */}
                <div className="bg-[#1e2533]/40 backdrop-blur-3xl p-8 md:p-10 rounded-[32px] border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[80px] -mr-24 -mt-24" />
                  <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                    <div className="flex-1 space-y-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Investment Recommendation</p>
                        <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                          {analysisResult?.sector || "잠재적 수혜 섹터 분석 중"}
                        </h3>
                      </div>
                      <p className="text-[14px] md:text-[15px] text-white/60 leading-relaxed max-w-2xl">
                        {analysisResult?.advice || "데이터에 기반한 심층 제언을 도출하고 있습니다."}
                      </p>
                    </div>
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-primary text-3xl md:text-4xl">insights</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Stocks Column with Safety */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analysisResult?.stocks?.map((s, i) => {
                        // 데이터가 객체인지 문자열인지 확인하여 안전하게 처리
                        const sName = (typeof s === 'string' ? s : s?.name) || "분석된 종목";
                        const sReason = (typeof s === 'string' ? "상세 투자 포인트 분석 중" : s?.reason) || "시장 변곡점 수혜가 기대되는 종목입니다.";
                        
                        const krMatch = sName.match(/\((\d{6})\)/);
                        const globalMatch = sName.match(/\(([A-Z]+)\)/);
                        const cleanName = sName.split('(')[0].trim();
                        const link = krMatch ? `https://finance.naver.com/item/main.naver?code=${krMatch[1]}` : globalMatch ? `https://finance.naver.com/world/search.naver?query=${globalMatch[1]}` : `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanName + ' 주가')}`;

                        return (
                          <div key={i} onClick={() => window.open(link, '_blank')} className="group p-6 bg-[#1e2533]/30 hover:bg-white/[0.04] rounded-3xl border border-white/5 hover:border-primary/30 transition-all cursor-pointer">
                            <div className="flex justify-between items-start mb-4">
                              <span className="text-[10px] font-black text-white/30 uppercase tracking-wider group-hover:text-primary transition-colors">{krMatch || globalMatch ? (krMatch ? krMatch[1] : globalMatch[1]) : 'Stock'}</span>
                              <span className="material-symbols-outlined text-white/20 group-hover:text-primary transition-all text-lg group-hover:translate-x-1 group-hover:-translate-y-1">arrow_outward</span>
                            </div>
                            <h4 className="font-bold text-white text-lg mb-2 group-hover:text-primary transition-colors">{sName}</h4>
                            <p className="text-xs text-white/40 leading-relaxed line-clamp-3 group-hover:text-white/60">{sReason}</p>
                          </div>
                        );
                      }) || (
                        <div className="col-span-2 p-10 text-center text-white/20 border border-dashed border-white/10 rounded-3xl">
                          종목 추천 정보를 불러올 수 없습니다.
                        </div>
                      )}
                      {/* Reset Card */}
                      <button onClick={onReset} className="p-6 md:p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-all flex flex-col items-center justify-center gap-3 group">
                        <span className="material-symbols-outlined text-white/20 group-hover:rotate-180 transition-transform duration-700 text-3xl">refresh</span>
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest group-hover:text-primary">New Analysis</span>
                      </button>
                    </div>
                  </div>

                  {/* Risk Column with Safety */}
                  <div className="bg-[#1e2533]/20 p-6 md:p-8 rounded-[32px] border border-white/5 space-y-6">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-orange-400 text-lg">warning</span>
                      <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Risk Management</h4>
                    </div>
                    <div className="space-y-6">
                      {analysisResult?.caution?.map((c, i) => (
                        <div key={i} className="space-y-1.5">
                          <p className="text-[9px] font-black text-white/20 uppercase tracking-tighter">Issue 0{i+1}</p>
                          <p className="text-[13px] text-white/50 leading-relaxed">{c || "주의사항 분석 중"}</p>
                        </div>
                      )) || <p className="text-xs text-white/20">리스크 분석 정보를 불러올 수 없습니다.</p>}
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
