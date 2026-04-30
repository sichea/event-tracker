import React, { useState, useEffect } from 'react';

const ThoughtBubble = ({ text, show, isFinal, index }) => {
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setIsTyping(false), 800);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <div className={`relative flex flex-col items-center transition-all duration-1000 transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'} mx-auto mb-10 w-full max-w-sm md:max-w-lg`}>
      <div className={`relative z-10 w-full bg-[#1e2533]/80 backdrop-blur-3xl border border-white/10 p-5 md:p-6 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.4)] ${isFinal ? 'border-primary/50 bg-primary/5 ring-4 ring-primary/10' : ''}`}>
        <div className="absolute -top-3 left-6 px-3 py-1 bg-black/40 backdrop-blur-xl border border-white/5 rounded-full text-[10px] font-black text-primary uppercase tracking-widest">
          Step {index + 1}
        </div>
        
        {isTyping && show ? (
          <div className="flex gap-1.5 py-2 px-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        ) : (
          <p className={`text-sm md:text-base font-bold leading-relaxed tracking-tight ${isFinal ? 'text-primary' : 'text-[#ebedfb]'}`}>
            {text}
          </p>
        )}
      </div>
      
      {show && !isFinal && (
        <div className="absolute top-full left-1/2 w-px h-10 bg-gradient-to-b from-primary/40 to-transparent flex items-center justify-center -translate-x-1/2">
          <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-pulse" />
        </div>
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
    <div className="relative flex-1 flex flex-col bg-[#0a0e17] overflow-hidden min-h-[calc(100vh-280px)]">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <main className="flex-1 flex flex-col items-center justify-center py-6 md:py-10 px-6 relative z-10 max-w-4xl mx-auto w-full overflow-hidden">
        
        {/* Large Background Robot - Styled for Dark Theme */}
        {!analysisResult && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.12]">
            <img 
              src="/images/thinking_robot.png" 
              alt="" 
              className="w-full max-w-5xl h-full object-contain filter invert grayscale brightness-125 contrast-110"
            />
          </div>
        )}

        {!analysisResult ? (
          <div className="w-full space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 relative z-10">
            
            {/* Description Text */}
            <div className="flex flex-col items-center text-center space-y-4">
              <p className="text-white/90 text-xl md:text-2xl font-black tracking-tight drop-shadow-2xl">
                통찰력을 기르는 한 문장을 적어보세요.
              </p>
              <p className="text-white/40 text-sm md:text-base font-medium max-w-lg leading-relaxed">
                AI가 복잡한 자금의 흐름을 추적하여 최적의 시나리오를 설계합니다.
              </p>
            </div>

            {/* Google Search Style Single-Line Input */}
            <div className="w-full max-w-xl mx-auto relative group px-4">
              <div className={`
                relative flex items-center transition-all duration-500 rounded-full border border-white/10
                bg-transparent group-hover:bg-white/[0.05] group-hover:backdrop-blur-3xl group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]
                ${scenario.trim() ? 'bg-white/[0.03] backdrop-blur-xl' : ''}
                focus-within:bg-white/[0.08] focus-within:backdrop-blur-3xl focus-within:border-primary/30 focus-within:shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]
              `}>
                <div className="pl-6 text-primary/60">
                  <span className="material-symbols-outlined text-2xl">psychology</span>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 flex items-center h-14 md:h-16">
                  <input 
                    type="text"
                    value={scenario} 
                    onChange={(e) => setScenario(e.target.value)} 
                    placeholder="시장의 흐름을 바꿀 소식을 입력하세요..." 
                    className="flex-1 bg-transparent border-none px-4 text-white text-lg md:text-xl focus:outline-none placeholder:text-white/10 font-medium" 
                  />
                  
                  <button 
                    type="submit" 
                    disabled={isAnalyzing || !scenario.trim()} 
                    className={`
                      mr-2 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300
                      ${scenario.trim() ? 'bg-primary text-on-primary scale-100' : 'bg-white/5 text-white/20 scale-90'}
                    `}
                  >
                    {isAnalyzing ? (
                      <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></div>
                    ) : (
                      <span className="material-symbols-outlined text-xl md:text-2xl">arrow_forward</span>
                    )}
                  </button>
                </form>
              </div>

              {/* Minimalist Description below the bar */}
              <div className="mt-6 flex justify-center gap-6 text-[10px] md:text-xs font-bold text-white/20 uppercase tracking-[0.2em]">
                <span className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary/40" /> AI Scenario Analysis</span>
                <span className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-blue-500/40" /> Real-time Insight</span>
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
              <div className="w-full max-w-2xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-12 duration-1000">
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
