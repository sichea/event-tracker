import React, { useState, useEffect } from 'react';

const ThoughtBubble = ({ text, delay, show, isFinal, index }) => {
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setIsTyping(false), 800);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const getAlignment = () => {
    if (index % 2 === 0) return 'self-start ml-12 md:ml-24';
    return 'self-end mr-12 md:mr-24';
  };

  return (
    <div className={`relative flex flex-col max-w-xs md:max-w-md transition-all duration-1000 transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'} ${getAlignment()} mb-8`}>
      <div className={`relative z-10 bg-[#1e2533]/80 backdrop-blur-2xl border border-white/10 p-5 md:p-6 rounded-[28px] shadow-2xl ${isFinal ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/20' : ''}`}>
        <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#1e2533] rotate-45 border-white/10 ${index % 2 === 0 ? '-left-2 border-l border-b' : '-right-2 border-r border-t'}`}></div>
        {isTyping && show ? (
          <div className="flex gap-1 py-2 px-4">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        ) : (
          <p className={`text-sm md:text-base font-bold leading-relaxed tracking-tight ${isFinal ? 'text-primary' : 'text-[#ebedfb]'}`}>{text}</p>
        )}
      </div>
      {show && !isFinal && (
        <div className={`absolute -bottom-8 ${index % 2 === 0 ? 'left-1/2' : 'right-1/2'} w-px h-8 bg-gradient-to-b from-primary/40 to-transparent animate-pulse`}></div>
      )}
    </div>
  );
};

export default function LandingPage({ onAnalyze, isAnalyzing, analysisResult, onReset }) {
  const [scenario, setScenario] = useState('');
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    if (analysisResult && analysisResult.steps) {
      const timers = analysisResult.steps.map((_, i) => setTimeout(() => setVisibleSteps(i + 1), i * 1500));
      return () => timers.forEach(clearTimeout);
    } else {
      setVisibleSteps(0);
    }
  }, [analysisResult]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (scenario.trim() && onAnalyze) onAnalyze(scenario);
  };

  const steps = analysisResult?.steps?.map(text => ({ text })) || [];

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex flex-col bg-[#0a0e17] overflow-x-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <main className="flex-1 flex flex-col items-center justify-center py-10 md:py-16 px-6 relative z-10 max-w-3xl mx-auto w-full">
        {!analysisResult ? (
          <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            
            {/* Centered Headline */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-1">
                <span className="material-symbols-outlined text-2xl text-primary">psychology_alt</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl md:text-4xl font-black text-white leading-tight tracking-tighter">
                  시장 전반의 흐름을<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">꿰뚫는 통찰</span>을 빌려드립니다.
                </h2>
                <p className="text-on-surface-variant text-sm md:text-base opacity-60 max-w-xl leading-relaxed mx-auto">
                  지금 가장 뜨거운 시장의 한 문장을 적어주세요.<br />
                  AI가 복잡한 자금의 흐름을 추적하여 시나리오를 설계합니다.
                </p>
              </div>
            </div>

            {/* Centered Input Card */}
            <div className="w-full max-w-xl mx-auto">
              <div className="glass-card p-6 md:p-10 rounded-[32px] relative overflow-hidden group">
                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-primary/80 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                      Market Scenario Analysis
                    </label>
                    <textarea 
                      value={scenario} 
                      onChange={(e) => setScenario(e.target.value)} 
                      placeholder="예: 미국-이란 협상 무산으로 인한 유가 급등 뉴스..." 
                      rows={3} 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-[#ebedfb] text-base md:text-lg focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all resize-none shadow-inner placeholder:opacity-20" 
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isAnalyzing || !scenario.trim()} 
                    className="w-full relative group overflow-hidden bg-primary text-on-primary font-black py-4 md:py-5 rounded-2xl shadow-xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-2 text-base md:text-lg"
                  >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    {isAnalyzing ? (
                      <div className="w-6 h-6 border-3 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl">insights</span>
                        <span>사고 체인 분석 시작하기</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl flex flex-col relative pt-8">
            <div className="fixed bottom-12 left-8 md:left-24 opacity-10 pointer-events-none hidden lg:block">
              <span className="material-symbols-outlined text-[320px] text-white">psychology</span>
            </div>
            <div className="flex flex-col w-full min-h-[600px] mb-12">
              {steps.map((step, i) => <ThoughtBubble key={i} index={i} text={step.text} show={visibleSteps > i} isFinal={i === steps.length - 1} />)}
            </div>
            {visibleSteps >= steps.length && steps.length > 0 && (
              <div className="w-full max-w-4xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-12 duration-1000">
                <div className="bg-[#1e2533]/90 backdrop-blur-3xl p-10 rounded-[48px] border border-primary/20 shadow-2xl relative overflow-hidden">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
                    <div className="space-y-8">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                          <span className="material-symbols-outlined text-primary text-3xl">target</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-primary uppercase tracking-widest">Recommended</p>
                          <h3 className="text-2xl md:text-3xl font-black text-[#ebedfb]">추천 섹터: {analysisResult.sector}</h3>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {analysisResult.stocks?.map((s, i) => (
                          <div key={i} className="group p-5 bg-white/5 rounded-3xl border border-white/5 hover:border-primary/30 transition-all">
                            <div className="flex justify-between items-center mb-1">
                              <p className="font-black text-[#ebedfb] text-lg">{s.name}</p>
                              <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                            </div>
                            <p className="text-sm text-on-surface-variant leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">{s.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col justify-between space-y-8">
                      <div className="bg-orange-500/5 p-8 rounded-3xl border border-orange-500/10">
                        <h4 className="text-sm font-black text-orange-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                          <span className="material-symbols-outlined text-lg">error</span> RISK WARNING
                        </h4>
                        <div className="space-y-3">
                          {analysisResult.caution?.map((c, i) => (
                            <div key={i} className="flex gap-3 items-start">
                              <div className="w-1 h-1 rounded-full bg-orange-500 mt-2 flex-shrink-0"></div>
                              <p className="text-sm text-on-surface-variant leading-relaxed opacity-80">{c}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={onReset} className="w-full flex items-center justify-center gap-3 py-5 rounded-[24px] bg-[#0a0e17] text-on-surface-variant hover:text-primary hover:bg-white/5 border border-white/10 transition-all font-bold text-lg">
                        <span className="material-symbols-outlined">refresh</span>
                        <span>새로운 사고 체인 시작하기</span>
                      </button>
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
