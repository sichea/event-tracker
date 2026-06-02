import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';

// Polymarket Referral Code (Affiliate ID)
// Set this to your referral code (e.g. 'YOURCODE') to automatically append it to all Polymarket links
const POLYMARKET_REFERRAL_CODE = '';

const ThoughtBubble = ({ text, show, isFinal, index }) => {
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setIsTyping(false), 800);
      return () => clearTimeout(timer);
    }
  }, [show]);

  // 사용자 요청 소제목으로 복구 (아이콘 제외)
  const getPhaseLabel = (index) => {
    const labels = [
      "거시경제 시그널 감지",
      "투자 논리 인과 관계 분석",
      "시장 역학 및 변동성 진단",
      "기관 자본 순환 경로 추적",
      "최종 투자 전략 제언"
    ];
    return labels[index] || "심층 분석 인사이트";
  };
  // 어떤 데이터가 오든 강제로 문자열로 변환하여 에러 방지
  const safeText = String(text || "");
  const cleanText = safeText
    .replace(/^\d+[\.\s단계:]+\s*/, '') // 시작 부분의 숫자/단계 표시 제거
    .replace(/\*\*/g, ''); // 굵은 글씨 제거

  return (
    <div className={`relative flex flex-col items-center transition-all duration-1000 transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'} mx-auto mb-10 w-full max-w-2xl`}>
      <div className={`relative z-10 w-full bg-[#1e2533]/40 backdrop-blur-3xl border border-white/5 p-6 md:p-8 rounded-[32px] shadow-2xl ${isFinal ? 'border-primary/40 bg-primary/5' : ''}`}>
        <div className="mb-3">
          <span className="text-[11px] font-black text-primary/70 uppercase tracking-widest">{getPhaseLabel(index)}</span>
        </div>
        
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

const LivePredictionsDashboard = ({ onSelectMarket }) => {
  const [activeCategory, setActiveCategory] = useState('trending');
  const [rawMarkets, setRawMarkets] = useState([]);
  const [sortBy, setSortBy] = useState('volume'); // 'volume' or 'endDate'
  const [loading, setLoading] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [error, setError] = useState(null);

  const CATEGORIES = [
    { id: 'trending', name: '⚡ 전체 인기', tagId: null },
    { id: 'spacex', name: '🚀 SpaceX', tagId: '63' },
    { id: 'openai', name: '🤖 OpenAI', tagId: '537' },
    { id: 'tech', name: '💻 AI & 테크', tagId: '1401' },
    { id: 'macro', name: '📈 거시경제', tagId: '100328' },
    { id: 'crypto', name: '🪙 크립토', tagId: '21' },
    { id: 'politics', name: '⚖️ 한국 정치·선거', tagId: '166' },
  ];

  const fetchPredictions = async (categorySlug) => {
    setLoading(true);
    setError(null);
    const catObj = CATEGORIES.find(c => c.id === categorySlug);
    const tagId = catObj ? catObj.tagId : null;

    try {
      const res = await fetch(`/api/predictions?category=${categorySlug}&limit=20`);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const text = await res.text();
      if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<!DOCTYPE')) {
        throw new Error("Local Vite HTML fallback received");
      }
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error);
      setRawMarkets(data);
    } catch (err) {
      console.warn("Proxy fetch failed, using fallback:", err.message);
      try {
        let directUrl = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volumeNum&ascending=false&limit=20';
        if (tagId) {
          directUrl += `&tag_id=${tagId}`;
        }
        const rawRes = await fetch(directUrl, { headers: { 'Accept': 'application/json' } });
        if (!rawRes.ok) throw new Error(`Direct API returned ${rawRes.status}`);
        const rawData = await rawRes.json();
        
        const translateText = async (text) => {
          if (!text) return '';
          try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (!res.ok) return text;
            const data = await res.json();
            if (data && data[0] && data[0][0] && data[0][0][0]) {
              return data[0][0][0];
            }
            return text;
          } catch (e) {
            return text;
          }
        };

        const formatted = await Promise.all(rawData.map(async item => {
          const safeParseArray = (val) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') {
              try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : [];
              } catch (e) {
                return [];
              }
            }
            return [];
          };

          const outcomes = safeParseArray(item.outcomes);
          const outcomePrices = safeParseArray(item.outcomePrices);
          
          const translatedQuestion = await translateText(item.question);
          
          const formattedOutcomes = await Promise.all(outcomes.map(async (name, idx) => {
            const priceStr = outcomePrices[idx];
            const price = priceStr ? parseFloat(priceStr) : 0.0;
            const probability = Math.round(price * 100);
            
            let translatedName = name;
            if (name === 'Yes') translatedName = '예';
            else if (name === 'No') translatedName = '아니오';
            else if (name === 'Over') translatedName = '초과';
            else if (name === 'Under') translatedName = '미만';
            else {
              translatedName = await translateText(name);
            }
            return { name: translatedName, price, probability };
          }));

          return {
            id: item.id,
            question: translatedQuestion,
            slug: item.slug,
            eventSlug: (item.events && item.events[0]) ? item.events[0].slug : null,
            category: item.category,
            volume: item.volume ? parseFloat(item.volume) : 0.0,
            volume24h: item.volume24hr ? parseFloat(item.volume24hr) : 0.0,
            endDate: item.endDate,
            outcomes: formattedOutcomes,
            image: item.image || null
          };
        }));
        setRawMarkets(formatted);
      } catch (directErr) {
        console.error("Direct fetch failed:", directErr);
        setError("실시간 예측 정보를 불러올 수 없습니다.");
      }
    } finally {
      setLoading(false);
      setRefreshCountdown(60);
    }
  };

  const markets = useMemo(() => {
    if (!rawMarkets || rawMarkets.length === 0) return [];
    let processed = [...rawMarkets];
    if (sortBy === 'volume') {
      processed.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } else if (sortBy === 'endDate') {
      processed.sort((a, b) => {
        const dateA = a.endDateIso ? new Date(a.endDateIso).getTime() : (a.endDate ? new Date(a.endDate).getTime() : Infinity);
        const dateB = b.endDateIso ? new Date(b.endDateIso).getTime() : (b.endDate ? new Date(b.endDate).getTime() : Infinity);
        return dateA - dateB;
      });
    }
    return processed.slice(0, 15);
  }, [rawMarkets, sortBy]);

  useEffect(() => {
    fetchPredictions(activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          fetchPredictions(activeCategory);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCategory]);

  const formatVolume = (val) => {
    if (!val || isNaN(val)) return '$0';
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const formatEndDateKst = (dateStr) => {
    if (!dateStr) return '종료일 미정';
    try {
      const date = new Date(dateStr);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${yyyy}.${mm}.${dd} ${hh}:${min} 종료`;
    } catch (e) {
      return `${dateStr.split('T')[0]} 종료`;
    }
  };

  const getCardCategoryName = (item) => {
    if (activeCategory !== 'trending') {
      const matched = CATEGORIES.find(c => c.id === activeCategory);
      return matched ? matched.name.split(' ')[1] : (item.category || '기타');
    }
    return item.category || '실시간 이슈';
  };

  const renderProbabilities = (outcomes) => {
    if (!outcomes || outcomes.length === 0) return null;
    
    if (outcomes.length === 2) {
      const first = outcomes[0];
      const second = outcomes[1];
      return (
        <div className="space-y-2 w-full my-3">
          <div className="flex justify-between text-xs font-extrabold select-none">
            <span className="text-emerald-400 flex items-center gap-1.5 transition-colors duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              {first.name}: <span className="font-black text-sm">{first.probability}%</span>
            </span>
            <span className="text-rose-400 flex items-center gap-1.5 transition-colors duration-300">
              {second.name}: <span className="font-black text-sm">{second.probability}%</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            </span>
          </div>
          <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden flex border border-white/5 p-[1px] relative">
            <div 
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-l-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(16,185,129,0.4)]" 
              style={{ width: `${first.probability}%` }} 
            />
            <div 
              className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-r-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(244,63,94,0.4)]" 
              style={{ width: `${second.probability}%` }} 
            />
            {first.probability > 0 && first.probability < 100 && (
              <div 
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_6px_#fff] transition-all duration-700 ease-out z-10"
                style={{ left: `${first.probability}%`, transform: 'translateX(-50%)' }}
              />
            )}
          </div>
        </div>
      );
    }
    
    const sorted = [...outcomes].sort((a, b) => b.probability - a.probability);
    const top2 = sorted.slice(0, 2);
    
    return (
      <div className="space-y-2 w-full my-3">
        {top2.map((out, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span className={idx === 0 ? 'text-primary' : 'text-white/50'}>
                {out.name}
              </span>
              <span className={idx === 0 ? 'text-primary' : 'text-white/40'}>
                {out.probability}%
              </span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${idx === 0 ? 'bg-primary' : 'bg-white/20'}`} 
                style={{ width: `${out.probability}%` }} 
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const circleRadius = 8;
  const strokeCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = strokeCircumference * (1 - refreshCountdown / 60);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-4 border-b border-white/5 pb-6">
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[11px] font-black text-primary uppercase tracking-widest">LIVE PREDICTIONS BOARD</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            실시간 예측 시장 인기 토픽
          </h2>
          <p className="text-xs text-white/40 font-medium">
            폴리마켓의 누적 거래량을 정밀 분석하여 전 세계 자금이 몰리는 핫이슈의 실시간 승률을 추적합니다.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 justify-start md:justify-end">
          {/* Sorting Toggle Segmented Control */}
          <div className="flex bg-[#1e2533]/60 border border-white/5 p-1 rounded-full backdrop-blur-md select-none">
            <button
              onClick={() => setSortBy('volume')}
              className={`px-3 py-1.5 text-[10px] md:text-[11px] font-black rounded-full transition-all cursor-pointer ${
                sortBy === 'volume'
                  ? 'bg-primary text-[#0a0e17] shadow-[0_0_10px_rgba(115,255,186,0.2)]'
                  : 'text-white/45 hover:text-white'
              }`}
            >
              🔥 인기순
            </button>
            <button
              onClick={() => setSortBy('endDate')}
              className={`px-3 py-1.5 text-[10px] md:text-[11px] font-black rounded-full transition-all cursor-pointer ${
                sortBy === 'endDate'
                  ? 'bg-primary text-[#0a0e17] shadow-[0_0_10px_rgba(115,255,186,0.2)]'
                  : 'text-white/45 hover:text-white'
              }`}
            >
              ⏰ 마감임박순
            </button>
          </div>

          {/* Refresh Timer */}
          <div className="flex items-center gap-3 bg-[#1e2533]/40 border border-white/5 px-4 py-2 rounded-full backdrop-blur-md">
            <div 
              className="relative flex items-center justify-center cursor-pointer group w-6 h-6"
              onClick={() => fetchPredictions(activeCategory)}
              title="실시간 갱신"
            >
              <svg className="w-6 h-6 transform -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r={circleRadius}
                  className="stroke-white/10 fill-transparent"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={circleRadius}
                  className="stroke-primary fill-transparent transition-all duration-1000"
                  strokeWidth="2"
                  strokeDasharray={strokeCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="material-symbols-outlined text-xs absolute opacity-0 group-hover:opacity-100 text-primary transition-all font-bold">
                refresh
              </span>
              <span className="text-[9px] font-black text-white/50 absolute group-hover:opacity-0 transition-opacity">
                {refreshCountdown}
              </span>
            </div>
            <span className="text-[10px] font-black text-white/40 tracking-widest uppercase select-none">Auto Refresh</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 w-full px-4 justify-center">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 text-xs md:text-sm font-bold rounded-full border transition-all duration-300 whitespace-nowrap cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-primary text-[#0a0e17] border-primary shadow-[0_0_15px_rgba(115,255,186,0.3)] scale-105'
                : 'bg-white/[0.02] border-white/5 text-white/50 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-4 mt-6">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="p-6 bg-[#1e2533]/10 border border-white/5 rounded-3xl space-y-4 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="w-16 h-4 bg-white/5 rounded" />
                <div className="w-20 h-3 bg-white/5 rounded" />
              </div>
              <div className="space-y-2">
                <div className="w-full h-4 bg-white/5 rounded" />
                <div className="w-5/6 h-4 bg-white/5 rounded" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="flex justify-between">
                  <div className="w-12 h-3 bg-white/5 rounded" />
                  <div className="w-8 h-3 bg-white/5 rounded" />
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full" />
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-white/5">
                <div className="w-20 h-4 bg-white/5 rounded" />
                <div className="w-6 h-6 bg-white/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="w-full max-w-md mx-auto p-8 rounded-3xl border border-white/5 bg-[#1e2533]/20 text-center space-y-4">
          <span className="material-symbols-outlined text-orange-400 text-4xl animate-bounce">warning</span>
          <p className="text-white/60 text-sm font-medium">{error}</p>
          <button 
            onClick={() => fetchPredictions(activeCategory)}
            className="px-6 py-2 bg-primary text-[#0a0e17] font-bold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer"
          >
            다시 시도
          </button>
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-20 text-white/30 text-sm font-bold border border-dashed border-white/5 rounded-3xl mx-4">
          현재 활성화된 예측 항목이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-4 mt-6">
          {markets.map((item, idx) => (
            <div 
              key={item.id || idx} 
              className="relative p-6 bg-[#1e2533]/20 hover:bg-white/[0.03] rounded-3xl border border-white/5 hover:border-primary/30 transition-all duration-500 flex flex-col justify-between group overflow-hidden"
            >
              {/* Glow overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 pointer-events-none rounded-3xl" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black text-white/30 uppercase tracking-wider">
                  <span className="px-2 py-0.5 rounded bg-white/5 text-primary/70">{getCardCategoryName(item)}</span>
                  <span>{formatEndDateKst(item.endDateIso || item.endDate)}</span>
                </div>
                
                <h3 className="font-bold text-white text-base leading-snug group-hover:text-primary transition-colors min-h-[48px] line-clamp-3 text-left">
                  {item.question}
                </h3>
                
                {renderProbabilities(item.outcomes)}
              </div>
              
              <div className="relative z-10 flex justify-between items-center pt-4 border-t border-white/5 mt-4">
                <div className="text-left">
                  <p className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Cumulative Volume</p>
                  <p className="text-[13px] font-black text-white/80 group-hover:text-white transition-colors">{formatVolume(item.volume)}</p>
                </div>
                
                <div className="flex gap-2">
                  {onSelectMarket && (
                    <button
                      onClick={() => onSelectMarket(item.question)}
                      className="px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-[#0a0e17] border border-primary/20 text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_10px_rgba(115,255,186,0.1)]"
                      title="AI 심층 통찰력 분석 실행"
                    >
                      <span className="material-symbols-outlined text-xs">psychology</span>
                      AI 분석
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      const referralSuffix = POLYMARKET_REFERRAL_CODE ? `?r=${POLYMARKET_REFERRAL_CODE}` : '';
                      const url = item.eventSlug
                        ? `https://polymarket.com/event/${item.eventSlug}/${item.slug}${referralSuffix}`
                        : `https://polymarket.com/en/market/${item.slug}${referralSuffix}`;
                      window.open(url, '_blank');
                    }}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-primary hover:text-[#0a0e17] text-white/40 flex items-center justify-center transition-all cursor-pointer"
                    title="폴리마켓에서 상세 보기"
                  >
                    <span className="material-symbols-outlined text-lg">arrow_outward</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function LandingPage({ onAnalyze, isAnalyzing, analysisResult, onReset, session, setAnalysisResult }) {
  const [scenario, setScenario] = useState('');
  const [landingTab, setLandingTab] = useState('predictions'); // 'predictions', 'insights', or 'archive'
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [remainingQuota, setRemainingQuota] = useState(500);
  const [userRemaining, setUserRemaining] = useState(50);

  useEffect(() => {
    async function fetchQuota() {
      try {
        const res = await fetch(`/api/quota?userId=${session?.user?.id || ''}`);
        const data = await res.json();
        setRemainingQuota(data.global_remaining);
        setUserRemaining(data.user_remaining);
      } catch (err) {
        console.error("Failed to fetch quota:", err);
      }
    }
    fetchQuota();
  }, [session]);

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
        {!analysisResult && landingTab === 'insights' && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.1] animate-in fade-in duration-1000">
            <img 
              src="/images/thinking_robot.png" 
              alt="" 
              className="w-full max-w-5xl h-[80vh] object-contain filter invert grayscale brightness-150 contrast-125"
            />
          </div>
        )}
        {/* Prediction Market Robot Background (User custom image) */}
        {!analysisResult && landingTab === 'predictions' && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.1] animate-in fade-in duration-1000">
            <img 
              src="/images/predictions_bg.jpg" 
              alt="" 
              className="w-full max-w-5xl h-[80vh] object-contain filter invert grayscale brightness-150 contrast-125"
            />
          </div>
        )}

        {/* Main Landing Tabs */}
        {!analysisResult && (
          <div className="flex bg-[#1e2533]/60 border border-white/5 p-1 rounded-2xl backdrop-blur-md select-none mb-10 relative z-20">
            <button
              onClick={() => setLandingTab('predictions')}
              className={`px-5 py-2.5 text-xs md:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                landingTab === 'predictions'
                  ? 'bg-primary text-[#0a0e17] shadow-[0_0_15px_rgba(115,255,186,0.3)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base md:text-lg">equalizer</span>
              실시간 예측 시장
            </button>
            <button
              onClick={() => setLandingTab('insights')}
              className={`px-5 py-2.5 text-xs md:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                landingTab === 'insights'
                  ? 'bg-primary text-[#0a0e17] shadow-[0_0_15px_rgba(115,255,186,0.3)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base md:text-lg">psychology</span>
              AI 투자 통찰
            </button>
            <button
              onClick={() => setLandingTab('archive')}
              className={`px-5 py-2.5 text-xs md:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                landingTab === 'archive'
                  ? 'bg-primary text-[#0a0e17] shadow-[0_0_15px_rgba(115,255,186,0.3)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base md:text-lg">library_books</span>
              투자 가이드 & 리포트
            </button>
          </div>
        )}

        {!analysisResult ? (
          <div className="w-full flex flex-col items-center">
            {/* AI 투자 통찰 Tab Panel */}
            <div className={`w-full flex flex-col items-center mt-4 ${landingTab === 'insights' ? 'block' : 'hidden'}`}>
              <div className="w-full max-w-2xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
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
                        onAnalyze(scenario, session?.user?.id);
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
                    ) : userRemaining <= 0 ? (
                      <span className="material-symbols-outlined text-xl md:text-2xl opacity-40">lock</span>
                    ) : (
                      <span className="material-symbols-outlined text-xl md:text-2xl">arrow_forward</span>
                    )}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-4 pt-6">
                  {/* My Energy Area */}
                  <div className="flex items-center gap-5">
                    <span className="text-[10px] font-black text-primary/50 uppercase tracking-[0.2em]">My Energy</span>
                    <div className="flex gap-1.5">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-700 ${i < userRemaining ? 'bg-primary/60 shadow-[0_0_10px_rgba(115,255,186,0.3)]' : 'bg-white/5'}`} />
                      ))}
                    </div>
                    <span className="text-[10px] font-bold text-white/40 tracking-widest">{Math.max(0, userRemaining)} / 5</span>
                  </div>

                  {/* Total Energy Pool */}
                  <div className="flex items-center gap-3 opacity-30 group hover:opacity-50 transition-opacity">
                    <div className="h-px w-8 bg-gradient-to-r from-transparent to-white/20" />
                    <div className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] flex gap-2">
                      <span>Total Energy Pool</span>
                      <span className="text-white/40">{remainingQuota?.toLocaleString()} / 500</span>
                    </div>
                    <div className="h-px w-8 bg-gradient-to-l from-transparent to-white/20" />
                  </div>
                </div>
              </div>
            </div>

            {/* 투자 가이드 & 리포트 Tab Panel (Always in DOM for AdSense SEO Crawler) */}
            <div className={`w-full flex flex-col items-center mt-4 ${landingTab === 'archive' ? 'block' : 'hidden'}`}>
              <div className="w-full max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 px-4">
                {/* Header */}
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">library_books</span>
                    <span className="text-[11px] font-black text-primary uppercase tracking-widest">INSIGHT ARCHIVE</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight text-center">
                    투자 가이드 & AI 시나리오 리포트
                  </h2>
                  <p className="text-xs md:text-sm text-white/40 font-medium leading-relaxed text-center">
                    초불확실성 시대의 거시경제 흐름을 분석하는 가이드북과, 검증된 AI 시나리오 분석 샘플 리포트를 자유롭게 열람해 보세요.
                  </p>
                </div>

                {/* Section 1: Investment Guides (Articles) */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                    <span className="material-symbols-outlined text-primary/70 text-lg">menu_book</span>
                    <h3 className="text-lg font-bold text-white tracking-tight">심층 투자 가이드</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {ARTICLES_DATA.map((article) => (
                      <div 
                        key={article.id}
                        className="p-6 bg-[#1e2533]/20 hover:bg-white/[0.03] rounded-3xl border border-white/5 hover:border-primary/30 transition-all duration-500 flex flex-col justify-between group relative overflow-hidden text-left"
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 pointer-events-none rounded-3xl" />
                        
                        <div className="space-y-4 relative z-10">
                          <div className="flex justify-between items-center text-[10px] font-black text-white/30 uppercase tracking-wider">
                            <span className="px-2 py-0.5 rounded bg-white/5 text-primary/70">{article.category}</span>
                            <span>{article.readTime}분 분량</span>
                          </div>
                          <h4 className="font-bold text-white text-lg group-hover:text-primary transition-colors text-left line-clamp-1">
                            {article.title}
                          </h4>
                          <p className="text-xs text-white/40 leading-relaxed text-left line-clamp-3">
                            {article.summary}
                          </p>
                        </div>

                        <div className="flex justify-end items-center pt-6 mt-6 border-t border-white/5 relative z-10">
                          <button
                            onClick={() => setSelectedArticle(article)}
                            className="px-4 py-2 bg-white/5 group-hover:bg-primary group-hover:text-[#0a0e17] text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            가이드 읽기
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: AI Scenario Sample Reports */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                    <span className="material-symbols-outlined text-primary/70 text-lg">analytics</span>
                    <h3 className="text-lg font-bold text-white tracking-tight">AI 시나리오 분석 샘플 리포트</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {SAMPLE_REPORTS_DATA.map((report) => (
                      <div 
                        key={report.id}
                        className="p-6 bg-[#1e2533]/20 hover:bg-white/[0.03] rounded-3xl border border-white/5 hover:border-primary/30 transition-all duration-500 flex flex-col justify-between group relative overflow-hidden text-left"
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 pointer-events-none rounded-3xl" />
                        
                        <div className="space-y-4 relative z-10">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-primary/70 uppercase tracking-wider">
                            <span className="material-symbols-outlined text-xs">psychology</span>
                            <span>SAMPLE REPORT</span>
                          </div>
                          <h4 className="font-bold text-white text-base group-hover:text-primary transition-colors line-clamp-2 min-h-[44px]">
                            {report.title}
                          </h4>
                          <p className="text-[11px] text-white/40 leading-relaxed line-clamp-4">
                            {report.summary}
                          </p>
                        </div>

                        <div className="flex justify-end items-center pt-6 mt-6 border-t border-white/5 relative z-10">
                          <button
                            onClick={() => {
                              setScenario(report.scenario);
                              setAnalysisResult(report);
                            }}
                            className="w-full py-2.5 bg-primary/10 border border-primary/20 hover:bg-primary text-primary hover:text-[#0a0e17] rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(115,255,186,0.1)]"
                          >
                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                            시나리오 분석 체험
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 실시간 예측 시장 Tab Panel */}
            <div className={`w-full flex flex-col items-center mt-4 ${landingTab === 'predictions' ? 'block' : 'hidden'}`}>
              <LivePredictionsDashboard 
                onSelectMarket={(question) => {
                  setScenario(question);
                  setLandingTab('insights');
                  
                  // Focus the input and scroll to the end to prevent text clipping
                  setTimeout(() => {
                    const inputEl = document.getElementById('scenario-input');
                    if (inputEl) {
                      inputEl.focus();
                      const len = inputEl.value.length;
                      inputEl.setSelectionRange(len, len);
                      inputEl.scrollLeft = inputEl.scrollWidth;
                    }
                  }, 80);

                  onAnalyze(question, session?.user?.id);
                }} 
              />
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
                      <button onClick={() => { setScenario(''); onReset(); }} className="p-6 md:p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-all flex flex-col items-center justify-center gap-3 group">
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

                {/* Share Section */}
                <div className="flex flex-col items-center gap-6 pt-10 pb-20 border-t border-white/5 mt-10">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Share Insights</p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        const sectorName = analysisResult?.sector || '시장 분석';
                        const text = `🎯 AI가 포착한 유망 섹터: ${sectorName}\n\nRE:MEMBER의 AI 투자 통찰로 확인해보세요.\n\n#리멤버 #AI투자 #투자인사이트`;
                        const url = 'https://event-tracker-74j.pages.dev';
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                      }}
                      className="flex items-center gap-3 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.08] rounded-2xl border border-white/10 transition-all group"
                    >
                      <svg className="w-4 h-4 fill-white/40 group-hover:fill-white" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      <span className="text-xs font-bold text-white/40 group-hover:text-white">Share on X</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        const text = `[RE:MEMBER AI 투자 리포트]\n\n■ 분석 시나리오: ${scenario}\n■ 유망 섹터: ${analysisResult?.sector}\n■ 핵심 제언: ${analysisResult?.advice}\n\n추천 종목:\n${analysisResult?.stocks?.map(s => `- ${typeof s === 'string' ? s : s.name}: ${typeof s === 'string' ? '' : s.reason}`).join('\n')}\n\n🔗 자세히 보기: https://event-tracker-74j.pages.dev`;
                        navigator.clipboard.writeText(text);
                        alert("분석 결과가 클립보드에 복사되었습니다.");
                      }}
                      className="flex items-center gap-3 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.08] rounded-2xl border border-white/10 transition-all group"
                    >
                      <span className="material-symbols-outlined text-white/40 group-hover:text-white text-lg">content_copy</span>
                      <span className="text-xs font-bold text-white/40 group-hover:text-white">Copy Report</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-[9999] bg-[#0a0e17]/85 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          <div className="bg-[#131924] border border-white/10 rounded-[32px] max-w-3xl w-full p-6 md:p-10 shadow-2xl relative max-h-[85vh] overflow-y-auto flex flex-col scrollbar-hide text-left">
            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">{selectedArticle.category}</span>
                <h2 className="text-xl md:text-2xl font-black text-white leading-tight">{selectedArticle.title}</h2>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/5 flex-shrink-0"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
              {selectedArticle.content}
            </div>

            <div className="border-t border-white/5 pt-6 mt-8 flex justify-end">
              <button
                onClick={() => setSelectedArticle(null)}
                className="px-6 py-2.5 bg-primary text-[#0a0e17] hover:opacity-90 rounded-xl text-xs font-black transition-all cursor-pointer shadow-[0_0_15px_rgba(115,255,186,0.3)]"
              >
                가이드 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ARTICLES_DATA = [
  {
    id: 1,
    title: '예측 시장(Prediction Market)의 개념과 현대 투자 전략',
    category: '금융 혁신',
    summary: '대중의 지혜를 이용해 집단지성을 가격으로 나타내는 예측 시장의 원리와, 현대 포트폴리오 헤징 및 알파 투자 전략을 알아봅니다.',
    readTime: '5',
    content: (
      <div className="space-y-6 text-white/80 leading-relaxed text-sm md:text-base">
        <p>
          예측 시장(Prediction Market)은 미래에 발생할 특정 사건의 결과를 주식처럼 거래하는 가상의 금융 시장입니다. 대표적인 예로 글로벌 분산형 예측 시장 플랫폼인 폴리마켓(Polymarket)이 있으며, 이곳에서는 정치 선거 결과부터 기술적 이정표 달성 여부, 거시경제 지표 발표 결과까지 다양한 주제가 실시간으로 거래됩니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">1. 예측 시장의 원리: 대중의 지혜와 집단지성</h2>
        <p>
          이 시장의 핵심 원리는 \'대중의 지혜(Wisdom of Crowds)\'에 기반합니다. 개별 참여자는 편향되거나 불완전한 정보를 가질 수 있지만, 자본을 걸고 거래하는 다수 참여자의 의사결정이 모여 형성된 가격은 기존 여론조사나 전문가 예측보다 높은 정확도를 보이는 경향이 있습니다. 각 결과의 거래 가격은 해당 사건이 발생할 확률(0% ~ 100%)을 직접적으로 대변합니다.
        </p>
        <p>
          예를 들어, "2026년 내 미국 기준금리가 3.0% 미만으로 인하될 것인가?"라는 질문에 대한 \'예\' 계약이 45센트에 거래된다면, 시장은 이 사건의 발생 확률을 45%로 평가하고 있음을 의미합니다. 정보의 가치가 즉각 가격에 반영되는 효율적 시장 가설이 예측 시장에서 극대화되는 것입니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">2. 현대 포트폴리오의 리스크 헤징(Hedging) 전략</h2>
        <p>
          현대 투자 전략에서 예측 시장은 단순한 베팅처를 넘어 중요한 선행 지표이자 위험 헤징 수단으로 활용됩니다. 예를 들어 특정 규제 정책의 통과 확률에 따라 수혜를 입거나 타격을 입을 주식을 보유한 펀드매니저는 예측 시장에서 반대 시나리오에 베팅함으로써 포트폴리오의 하방 위험을 헤지할 수 있습니다.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>정책 리스크 헤징:</strong> 특정 세제 개편안이나 친환경 보조금 법안 통과 여부에 직접 연계된 주식의 위험을 예측 시장 계약으로 상쇄합니다.</li>
          <li><strong>지정학적 위험 분산:</strong> 돌발적인 국가 간 분쟁이나 선거 결과로 인한 자산 가격 변동에 대해 하방 보호막을 구축합니다.</li>
          <li><strong>이벤트 드리븐 헤징:</strong> 상장 심사 통과 여부, 특허 소송 결과 등 개별 기업의 중대 이벤트 리스크를 상쇄하는 헤징 계약을 매수합니다.</li>
        </ul>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">3. 초과 수익(Alpha) 창출과 거시경제 지표 선행성</h2>
        <p>
          또한, 통상적인 금융 자산 대비 예측 시장은 정보의 투명성과 시장 반응 속도가 매우 빠릅니다. 새로운 뉴스나 경제 데이터가 발표될 때, 예측 시장의 확률 변동을 관찰함으로써 실제 금융 시장(주식, 채권, 가상자산)에 미칠 파급 효과를 미리 가늠하는 \'알파 창출\' 전략도 가능합니다. 투자자들은 예측 시장의 집단지성을 정밀 분석하여 시장의 과도한 낙관이나 비관을 역이용하는 역발상 투자 기회를 포착할 수 있습니다.
        </p>
      </div>
    )
  },
  {
    id: 2,
    title: 'AI와 시나리오 플래닝: 투자 불확실성을 극복하는 법',
    category: 'AI 투자공학',
    summary: '초불확실성 시대에 발생 가능한 여러 상황을 구성하고 대응하는 시나리오 플래닝 전략과 AI가 정밀 분석하는 자본 순환 경로를 제시합니다.',
    readTime: '6',
    content: (
      <div className="space-y-6 text-white/80 leading-relaxed text-sm md:text-base">
        <p>
          현대 글로벌 경제는 지정학적 긴장, 파괴적 기술 혁신, 통화 정책의 급격한 변화 등 예측하기 어려운 변수들로 가득 차 있습니다. 이러한 초불확실성의 시대에 투자자들이 생존하고 초과 수익을 달성하기 위한 핵심 도구가 바로 \'시나리오 플래닝(Scenario Planning)\'입니다. 이는 미래를 단일한 방향으로 예측하는 대신, 발생 가능한 여러 시나리오를 구성하고 각 상황에 따른 최선의 대응책을 선제적으로 수립하는 기법입니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">1. 전통적 시나리오 기법의 한계와 AI 혁신</h2>
        <p>
          최근 인공지능(AI) 기술의 발전은 시나리오 플래닝의 질적 패러다임을 완전히 바꾸어 놓았습니다. 기존의 인간 분석가들은 개인의 경험적 한계와 인지적 편향에 갇히기 쉬웠으나, 대규모 언어 모델(LLM)과 금융 데이터 처리 기술이 융합된 AI는 방대한 글로벌 뉴스, 학술 리서치, 역사적 거시경제 데이터, 규제 동향 등을 실시간으로 종합 분석할 수 있습니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">2. 게임 이론과 디시전 트리(Decision Tree) 기반 분석</h2>
        <p>
          AI를 활용한 시나리오 구성은 주로 게임 이론과 논리적 의사결정 나무(Logic Tree)를 기반으로 합니다. 예를 들어 \'AGI의 조기 도래\'라는 시나리오가 제기되었을 때, AI는 단순히 기술적 타당성만 보는 것이 아니라 반도체 공급망 병목현상, 전력 인프라 확충 속도, 각국 정부의 규제 입법 추이 등을 다각도로 교차 분석합니다.
        </p>
        <p>
          이를 통해 발생 확률을 동적으로 추적하고, 각 분기점마다 자본이 어디로 유입되고 이탈할 것인지 구체적인 자금 순환 경로를 추적하여 제언합니다. 투자자는 AI가 생성한 시나리오 맵을 통해 감정에 치우치지 않고 객관적인 포트폴리오 다변화 및 리스크 관리 전략을 세울 수 있으며, 예상치 못한 거시경제 충격이 발생했을 때 기민하게 대응할 수 있는 강력한 무기를 얻게 됩니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">3. 투자 포트폴리오 다변화를 위한 시나리오 적용 가이드</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>핵심 가설 설정:</strong> 시장을 변화시킬 수 있는 가장 강력한 변수(예: 미 연준의 금리 변곡점, 주요 대선 결과 등)를 정의합니다.</li>
          <li><strong>시나리오 매트릭스 구축:</strong> 변수들의 조합을 바탕으로 상이한 3~4가지의 미래 상태(기본 시나리오, 낙관 시나리오, 비관 시나리오)를 정의합니다.</li>
          <li><strong>자산 배분 맵핑:</strong> 각 시나리오별로 수혜를 받는 자산군과 피해야 할 자산군을 정의하여 포트폴리오의 비중을 유동적으로 조정합니다.</li>
        </ul>
      </div>
    )
  },
  {
    id: 3,
    title: '공모주(IPO) 청약 전략과 시장 변동성 대응 기본 가이드',
    category: '공모주 투자',
    summary: '기업공개(IPO) 수요예측 분석법부터 상장 당일 변동성에 대응하여 안정적으로 수익을 확정 짓는 핵심 청약 전략 가이드입니다.',
    readTime: '5',
    content: (
      <div className="space-y-6 text-white/80 leading-relaxed text-sm md:text-base">
        <p>
          기업공개(IPO)는 비상장 기업이 최초로 외부 투자자들에게 주식을 공개하고 증권시장에 상장하는 과정입니다. 개인 투자자들에게 공모주 청약은 적은 위험으로 안정적인 수익을 기대할 수 있는 대표적인 재테크 수단으로 널리 인식되어 왔습니다. 그러나 최근 IPO 시장은 기관 투자자의 의무보유확약 비율, 수요예측 경쟁률, 상장 당일의 급격한 변동성 등으로 인해 보다 고도화된 전략적 접근이 요구되고 있습니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">1. 기관 수요예측 정밀 분석: 성공의 핵심 나침반</h2>
        <p>
          성공적인 공모주 투자를 위한 첫 단계는 \'기관 수요예측 결과\'의 정밀 분석입니다. 단순한 청약 경쟁률뿐만 아니라 기관 참여 건수, 신청 가격 분포(대다수 기관이 공모가 희망 밴드 상단을 초과하여 제시했는지 여부), 그리고 상장 후 일정 기간 주식을 팔지 않겠다고 약속하는 \'의무보유확약 비율\'을 꼼꼼히 확인해야 합니다. 의무보유확약 비율이 높을수록 상장 직후 유통 가능한 물량이 적어 주가 흐름에 긍정적인 영향을 미칠 가능성이 큽니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">2. 상장 당일 수급 모니터링과 엑시트(Exit) 전략</h2>
        <p>
          두 번째는 상장 당일의 변동성 제어 전략입니다. 주식시장의 상장일 주가 변동 폭이 확대 적용되면서 개장 직후 시초가 형성 과정과 거래량 추이를 면밀히 모니터링해야 합니다.
        </p>
        <p>
          상장 당일 오버행(잠재적 대량 매도 물량) 이슈가 존재하는지 체크하고, 기업의 본질적 가치 대비 단기 테마성 수급으로 주가가 왜곡될 경우 기계적인 분할 매도로 수익을 확정 짓는 것이 현명합니다. 공모주 청약은 장기 투자보다는 단기 모멘텀 플레이 관점으로 접근하는 것이 안전하며, 시장 전체의 유동성 환경과 금리 기조를 고려하여 청약 증거금 배분 계획을 철저히 설계해야 합니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">3. 공모주 투자 시 필수 점검 리스트</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>보호예수 해제 물량 확인:</strong> 상장 후 1개월, 3개월 단위로 시장에 풀릴 수 있는 기관의 의무보유 물량 일정을 파악합니다.</li>
          <li><strong>공모가 산정의 적정성 평가:</strong> 유사 비교 기업들의 주가수익비율(PER) 등 지표와 비교하여 지나치게 높은 밸류에이션으로 상장되는지 점검합니다.</li>
          <li><strong>자금 용도의 구체성:</strong> 공모 자금이 채무 상환에 쓰이는지, 연구 개발 및 설비 확장 등 생산적인 시설 투자에 사용되는지 파악합니다.</li>
        </ul>
      </div>
    )
  },
  {
    id: 4,
    title: '금리 주기와 글로벌 자산 배분의 상관관계',
    category: '거시 경제',
    summary: '중앙은행의 통화 정책 주기에 맞춰 위험자산과 안전자산의 비중을 정교하게 조율하는 포트폴리오 설계 노하우를 공개합니다.',
    readTime: '6',
    content: (
      <div className="space-y-6 text-white/80 leading-relaxed text-sm md:text-base">
        <p>
          모든 금융 자산의 가격 책정에서 가장 기본적이면서도 강력한 중력 역할을 하는 변수는 바로 \'금리(Interest Rate)\'입니다. 미국의 연방준비제도(Fed)를 비롯한 주요국 중앙은행의 기준금리 결정은 글로벌 유동성의 흐름을 결정짓는 밸브와 같습니다. 따라서 금리가 인상되거나 인하되는 경기 주기(Cycle)를 정확히 이해하고 이에 맞춰 자산을 배분하는 것은 장기 자산 증식의 성패를 가르는 기초 체력입니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">1. 금리 인상기와 금리 인하기의 자산 로테이션</h2>
        <p>
          금리 주기 인상기에는 시중의 유동성이 회수되고 차입 비용이 증가합니다. 이 시기에는 성장주나 고위험 가상자산보다 현금 흐름이 우수하고 부채 비율이 낮은 가치주, 단기 채권, 원자재 등의 방어적 자산이 유리합니다. 반면, 금리 인하기(완화 주기)가 시작되면 자금 조달 비용이 낮아지면서 미래 성장 가치를 조기에 반영하는 테크 기업, 바이오, 고위험 금융 상품으로 자금이 대거 이동합니다. 채권의 경우 금리 인하 국면에서 가격이 상승하므로 장기 국채를 선제적으로 매입해 자본 이득을 취하는 전략이 효과적입니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">2. 글로벌 매크로 자산 배분과 환율 변동성 관리</h2>
        <p>
          글로벌 자산 배분 관점에서는 환율 변동성 또한 핵심 고려 사항입니다. 미 연준의 금리 주기와 타국 중앙은행의 행보 차이에 따라 발생하는 금리차는 환율의 향방을 결정짓고, 이는 다국적 자본의 대규모 이동을 유발합니다.
        </p>
        <p>
          따라서 투자자는 단순히 국내 자산에만 머무르는 것이 아니라 미국 달러화 자산, 글로벌 성장주, 국채 및 금과 같은 안전자산의 비중을 정교하게 조율해야 합니다. 금리 주기의 변곡점(Pivot) 신호를 거시경제 지표(소비자물가지수, 고용보고서 등) 분석을 통해 미세 조정함으로써 최적의 위험 대비 수익률을 달성하는 다각적 포트폴리오 구축이 필수적입니다.
        </p>
        <h2 className="text-lg md:text-xl font-bold text-white mt-8 mb-4">3. 주기별 최적 자산 조합 모델</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>긴축기 (Tightening Phase):</strong> 가치주/고배당주 비중 상향, 원자재/현금 비중 증가, 장기 채권 비중 축소.</li>
          <li><strong>동결 및 피벗기 (Pivot Window):</strong> 장기 국채 비중 최대화, 초우량 테크 독점 기업 매수 개시, 안전자산(금) 매집.</li>
          <li><strong>완화기 (Easing Phase):</strong> 소형 혁신 기업/성장주 비중 확대, 가상자산/고위험 채권 편입, 경기 민감주 비중 증가.</li>
        </ul>
      </div>
    )
  }
];

const SAMPLE_REPORTS_DATA = [
  {
    id: 1,
    title: 'AGI(인공지능) 도래 시나리오와 수혜 섹터',
    summary: '2027년 이전 인공지능(AGI)의 출현 가능성과 데이터센터, 송배전 그리드, 소형 원자로 등 물리적 인프라의 공급 병목에 대응하는 핵심 수혜주 분석 리포트입니다.',
    scenario: '2027년 이전 인공지능(AGI) 도래 시나리오와 글로벌 시장 파급 효과',
    steps: [
      "글로벌 테크 대기업의 인프라 투자 규모(Capex) 및 대규모 대형언어모델(LLM) 훈련 사이클 추적",
      "AGI 도래 확률에 따른 지적 재산권(IP), AI 에이전트 서비스, 전력망 확보 경쟁의 인과관계 모델링",
      "초대형 데이터센터 증설에 따른 전력 소비 급증과 구리, 천연가스, 소형원자로(SMR) 수급 불균형 진단",
      "빅테크 기업의 AI 서비스 유료화 침투율 및 엔터프라이즈 도입 속도 기반 자본 순환 경로 분석",
      "추론 비용 하락에 따른 소프트웨어 생산성 혁신 수혜주 및 글로벌 하드웨어 독점 공급망 포트폴리오 도출"
    ],
    sector: '차세대 AI 전력 인프라 및 핵심 가속기 벨트',
    advice: '인공지능(AGI)이 2027년 이전에 도달할 경우, 가장 병목이 심각한 부문은 소프트웨어가 아니라 물리적인 인프라입니다. 초고성능 AI 칩셋 제조용 장비 및 설계 자산과 더불어 데이터센터 가동을 위한 고전압 송배전, 청정에너지(SMR), 차세대 냉각 기술(액체 냉각) 기업들이 최우선 수혜를 입을 것입니다. 소프트웨어 부문에서는 고비용 자체 모델 개발사보다 저비용 추론 인프라를 활용해 비즈니스 로직을 구축하는 에이전트 서비스 제공사가 마진율 측면에서 유리합니다.',
    stocks: [
      { name: 'NVIDIA (NVDA)', reason: 'AI 가속기 시장 점유율 90% 이상을 유지 중이며, Blackwell 칩 공급 부족이 최소 2026년까지 이어질 전망으로 강력한 프라이싱 파워 보유.' },
      { name: 'Vertiv Holdings (VRT)', reason: '초대형 AI 데이터센터 가동에 필수적인 액체 냉각 및 열관리 솔루션 글로벌 1위 기업으로 가파른 실적 개선 기대.' },
      { name: 'Constellation Energy (CEG)', reason: '빅테크 데이터센터 전력 공급을 위한 무탄소 원자력 발전 공급 계약을 주도하며 전력 공급난의 핵심 수혜주로 부각.' },
      { name: 'TSMC (TSM)', reason: 'NVIDIA 등 주요 팹리스의 첨단 미세공정(3nm 이하) 및 CoWoS 패키징을 독점 위탁 생산하여 안정적인 성장성 유지.' }
    ],
    caution: [
      '미국 정부의 첨단 반도체 수출 규제 강화로 인한 대중국 매출 감소 위험',
      '소형원자로(SMR) 개발 지연 및 전력 인프라 건설 규제 장벽으로 인한 가동 지연 가능성',
      '성장주 밸류에이션 부담에 따른 고금리 환경 장기화 시 단기 변동성 증가'
    ]
  },
  {
    id: 2,
    title: '미국 연방준비제도(Fed) 금리 인하와 글로벌 자금 흐름',
    summary: '미 연준의 기준금리 피벗에 맞춰 가치 평가 기준이 완화되는 고성장 테크 기업 및 장기 채권 자본 차익을 극대화하는 매크로 시나리오 대응 리포트입니다.',
    scenario: '미국 연방준비제도(Fed) 기준금리 피벗 시나리오와 글로벌 자산 배분',
    steps: [
      "미국 소비자물가지수(CPI), 고용보고서(NFP) 및 기대인플레이션 추이 분석을 통한 피벗 타이밍 예측",
      "기준금리 인하가 실질 금리, 달러 인덱스, 장단기 채권 스프레드에 미치는 경로 분석",
      "고금리 부담이 완화되는 중소형 성장주, 리츠(REITs), 이머징 마켓 자금 유입 속도 진단",
      "글로벌 캐리트레이드 청산 가능성 및 엔화 환율 변동에 따른 아시아 자본 회수 경로 추적",
      "안전자산(금)과 위험자산(성장주/가상자산)의 상대 강도 시나리오별 포트폴리오 최적화 제언"
    ],
    sector: '금리 민감형 성장 자산 및 배당형 리츠 포트폴리오',
    advice: '미 연준의 기준금리 인하 주기가 본격화되면, 할인율 하락으로 인해 성장 테크 기업들의 미래 가치가 높게 평가받기 시작합니다. 그동안 고금리로 조달 비용 부담이 컸던 혁신 성장주와 리파이낸싱 리스크에 노출되었던 대형 배당 리츠 자산이 가장 먼저 반등할 것입니다. 장기 채권의 경우 금리 하락에 따른 자본 차익을 극대화할 수 있는 기회입니다. 단, 경기 침체를 동반한 급격한 인하(하드 랜딩)일 경우 방어적 성격의 헬스케어 및 유틸리티 섹터를 병행 보유해야 합니다.',
    stocks: [
      { name: 'Tesla (TSLA)', reason: '금리 인하에 따른 자동차 할부 금융 비용 감소로 판매량 촉진 및 AI 자율주행 부문 장기 투자 조달 원활화 수혜.' },
      { name: 'Realty Income (O)', reason: '시중 금리 하락으로 배당 매력도가 재부각되며 포트폴리오 조달 비용 감소로 배당 여력 확대 기대.' },
      { name: 'iShares 20+ Year Treasury Bond ETF (TLT)', reason: '미국 장기 국채 가격 상승을 추종하며, 금리 하락 국면에서 확실한 자본 이득 및 월배당 안정성 제공.' },
      { name: 'Eli Lilly (LLY)', reason: '경기 상황과 무관하게 비만 치료제 등 혁신 의약품 수요 독점으로 지속적인 실적 성장이 보장된 초우량 헬스케어 기업.' }
    ],
    caution: [
      '기대인플레이션의 불확실한 재반등으로 인한 연준의 긴축 장기화 가능성',
      '미국 경기 침체(Hard Landing) 진입 시 위험자산 선호 심리의 단기 위축 위험',
      '환율 하락에 따른 해외 투자 자산의 원화 환산 평가손실 가능성'
    ]
  },
  {
    id: 3,
    title: 'SpaceX 스타십 프로젝트와 위성 통신 네트워크 생태계',
    summary: '스타십 발사체의 성공으로 kg당 궤도 수송 비용이 격감함에 따라 폭발하는 저궤도 위성망 서비스 및 평면 안테나, 탑재체 부품 벨트 수혜 리포트입니다.',
    scenario: 'SpaceX 스타십 성공과 글로벌 저궤도 우주 통신 네트워크 생태계 팽창 시나리오',
    steps: [
      "스타십 완전 재사용 발사체 성공 주기와 kg당 우주 수송 비용(Launch Cost) 절감 폭 예측",
      "저궤도(LEO) 군집위성 발사 가속화가 전 세계 광대역 인터넷 서비스 커버리지에 미치는 영향 분석",
      "위성 통신 하드웨어(안테나, RF 모듈, 수신기) 시장 및 통신 서비스 시장 규모 진단",
      "위성 간 레이저 통신(ISL) 도입에 따른 글로벌 지연시간 혁신 및 방산/항공/해양 통신 시장 침투 경로 분석",
      "우주 인프라 팽창에 따른 지상 우주국 장비사 및 지구 관측 데이터 분석 솔루션 기업 수혜 전망 수립"
    ],
    sector: '저궤도 위성 통신 부품 및 지상 우주 인프라 장비 섹터',
    advice: 'SpaceX의 스타십 프로젝트가 궤도 비행 성공 및 1단/2단 완전 재사용을 달성하면 우주 발사 비용이 기존 대비 1/10 이하로 떨어져 저궤도 위성 통신망 구축이 폭발적으로 증가합니다. 스타링크 서비스의 폭증은 전 세계 지상 단말기 안테나 공급사, 위성용 고주파 반도체 칩셋 제조사, 우주 지상국 통신 장비 기업들에게 거대한 신규 시장을 제공합니다. 또한 초고속 저지연 인터넷망이 방위 산업과 무인 자율 이동체(자율주행차, UAM)에 결합되며 산업 생태계가 재편될 것입니다.',
    stocks: [
      { name: '인텔리안테크 (189300)', reason: '글로벌 저궤도 위성 통신 사업자(원웹 등)들을 고객사로 확보한 평면 위성 안테나 및 해상 통신 안테나 제조 분야의 글로벌 강자.' },
      { name: 'Heico Corp (HEI)', reason: '항공 우주 및 방위 산업용 특수 전자기기 및 부품 공급업체로 우주 인프라 팽창에 따른 교체 부품 수요 급증 수혜.' },
      { name: 'AP위성 (211000)', reason: '위성 통신 단말기 및 탑재체 시스템 전문 설계 기업으로 정부의 우주 개발 로드맵 및 민간 위성 확대 수혜 기대.' },
      { name: 'L3Harris Technologies (LHX)', reason: '미국 국방부의 차세대 군사 위성 네트워크 구축 사업의 핵심 파트너로 고성능 통신 탑재체 공급 주도.' }
    ],
    caution: [
      'SpaceX 등 독점적 민간 기업의 정책 변화 및 자체 수직 계열화 비중 확대 위험',
      '우주 쓰레기 이슈 및 궤도 혼잡으로 인한 다국적 우주 규제 도입 장벽',
      '초기 대규모 설비 투자(CAPEX) 대비 회수 기간 장기화에 따른 재무적 불안정성'
    ]
  }
];
