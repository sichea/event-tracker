import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchEvents, toggleEventChecked, fetchAliases, addAlias, removeAlias, fetchScrapingStatus, triggerManualScrape, fetchAdminSecret, saveAdminSecret, fetchIpoEvents, toggleIpoSubscription, savePushSubscription, removePushSubscription, checkPushSubscription, fetchMarketInsights, fetchAptSubscriptions, fetchParkingRates, fetchVisitorCount, incrementVisitor } from "./api";
import { supabase } from "./supabaseClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import LandingPage from "./LandingPage";
import AptCalendar from "./AptCalendar";
import IpoCalendar from "./IpoCalendar";
import InvestmentInsights from "./InvestmentInsights";
import ParkingCmaComparison from "./ParkingCmaComparison";
import "./index.css";

const PROVIDERS = [
  { key: "TIGER", label: "TIGER", name: "Mirae Asset TIGER", bgColor: "bg-orange-600", textLabel: "TIGER", shadow: "shadow-orange-900/20", url: "https://investments.miraeasset.com/tigeretf/ko/customer/event/list.do" },
  { key: "KODEX", label: "KODEX", name: "Samsung KODEX", bgColor: "bg-blue-700", textLabel: "KODEX", shadow: "shadow-blue-900/20", url: "https://m.samsungfund.com/etf/lounge/event.do" },
  { key: "ACE", label: "ACE", name: "Korea Invest ACE", bgColor: "bg-yellow-500", textLabel: "ACE", textCol: "text-black", shadow: "shadow-yellow-900/20", url: "https://www.aceetf.co.kr/cs/notice" },
  { key: "SOL", label: "SOL", name: "Shinhan SOL", bgColor: "bg-cyan-600", textLabel: "SOL", shadow: "shadow-cyan-900/20", url: "https://m.blog.naver.com/soletf" },
  { key: "RISE", label: "RISE", name: "KB RISE", bgColor: "bg-red-600", textLabel: "RISE", shadow: "shadow-red-900/20", url: "https://www.riseetf.co.kr/cust/event" },
  { key: "AMUNDI", label: "AMUNDI", name: "NH-Amundi", bgColor: "bg-emerald-800", textLabel: "AMUNDI", textSize: "text-[10px]", shadow: "", url: "https://m.blog.naver.com/nh_amundi" },
  { key: "1Q", label: "1Q", name: "Hana 1Q", bgColor: "bg-green-500", textLabel: "1Q", shadow: "", url: "https://m.blog.naver.com/1qetf" },
  { key: "PLUS", label: "PLUS", name: "Hanwha PLUS", bgColor: "bg-indigo-600", textLabel: "PLUS", textSize: "text-xs", shadow: "", url: "https://m.blog.naver.com/hanwhaasset" },
  { key: "KIWOOM", label: "KIWOOM", name: "Kiwoom KOSETF", bgColor: "bg-pink-600", textLabel: "KIWOOM", textSize: "text-[10px]", shadow: "", url: "https://m.blog.naver.com/kiwoomammkt" },
  { key: "FUN", label: "FUN", name: "Woori FUN", bgColor: "bg-indigo-400", textLabel: "FUN", shadow: "", url: "https://www.funetf.co.kr/membersLounge/event" },
];

function formatDday(dday) {
  if (dday === null || dday === undefined) return null;
  if (dday > 7) return { text: `D-${dday}`, classes: "text-primary bg-primary/10 border-primary/20" };
  if (dday >= 0) return { text: dday === 0 ? "D-Day" : `D-${dday}`, classes: "text-orange-400 bg-orange-400/10 border-orange-400/20 animate-pulse" };
  return { text: `D+${Math.abs(dday)}`, classes: "text-outline border-outline/20 opacity-60" };
}

function formatDateRange(start, end) {
  if (!start && !end) return "기간 미정";
  const s = start ? start.replace(/-/g, ".") : "?";
  const e = end ? end.replace(/-/g, ".") : "?";
  return `${s} ~ ${e}`;
}

// Event Card using Tailwind
function EventCard({ event, aliases, onToggle, showToastMsg }) {
  const dday = formatDday(event.d_day);
  const isActive = event.status === "진행중";
  const hasAnyCheck = Object.values(event.checkedAliases || {}).some((v) => v);
  const pConf = PROVIDERS.find(p => p.key === event.provider) || PROVIDERS[0];

  // 종료 후 남은 열람 가능 일수 계산 (참여 목록용)
  const daysAfterEnd = (() => {
    if (isActive || !event.end_date) return null;
    const end = new Date(event.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.floor((today - end) / (1000 * 60 * 60 * 24));
  })();

  const handleShare = async (e) => {
    e.preventDefault();
    const shareData = {
      title: `[ETF 이벤트] ${event.title}`,
      text: `${event.provider}에서 진행하는 ETF 이벤트를 확인해보세요!`,
      url: event.link || window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(event.link || window.location.href);
        if (typeof showToastMsg === 'function') {
           showToastMsg("링크가 클립보드에 복사되었습니다.", "success");
        } else {
           alert("링크가 복사되었습니다.");
        }
      }
    } catch (err) {
      console.error("공유 실패:", err);
    }
  };

  return (
    <div className={`bg-surface-container rounded-3xl p-4 md:p-6 transition-all duration-300 border flex flex-col
      ${!isActive
        ? 'border-outline-variant/10 opacity-70 grayscale-[30%]'
        : hasAnyCheck
          ? 'border-transparent ring-1 ring-primary/30 shadow-[0_0_15px_rgba(115,255,186,0.05)] hover:border-outline-variant/30'
          : 'border-transparent hover:border-outline-variant/30'
      }`}>
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl ${pConf.bgColor} flex items-center justify-center ${pConf.shadow}`}>
            <span className={`${pConf.textCol || 'text-white'} font-black ${pConf.textSize || 'text-[10px] md:text-xs'}`}>{pConf.textLabel}</span>
          </div>
          <div>
            <p className="text-[10px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">{event.provider}</p>
            {isActive && dday && <span className={`inline-block mt-0.5 text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full border ${dday.classes}`}>{dday.text}</span>}
            {!isActive && (
              <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full border border-outline-variant/30 bg-outline-variant/10 text-outline">
                <span className="material-symbols-outlined text-[10px]">event_busy</span>
                종료 {daysAfterEnd !== null ? `D+${daysAfterEnd}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          {!isActive && daysAfterEnd !== null && (
            <span className="text-[9px] text-outline/60 font-medium">{30 - daysAfterEnd}일 후 목록에서 제거</span>
          )}
          <button 
            onClick={handleShare}
            className="w-8 h-8 rounded-full bg-surface-container-highest hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors group/share"
            title="이벤트 공유하기"
          >
            <span className="material-symbols-outlined text-sm">share</span>
          </button>
          {event.link && (
            <a href={event.link} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-surface-container-highest hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors" title="이벤트 페이지 열기">
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
          )}
        </div>
      </div>

      <h4 className="text-sm md:text-base font-bold font-headline mb-2 md:mb-3 line-clamp-2 min-h-[2.5rem] md:min-h-[3rem] leading-snug">{event.title}</h4>
      <div className="text-[11px] md:text-xs text-on-surface-variant mb-4 md:mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
        {formatDateRange(event.start_date, event.end_date)}
      </div>
      <div className="mt-auto pt-3 md:pt-4 border-t border-outline-variant/20 flex flex-wrap gap-x-3 md:gap-x-4 gap-y-2">
        {!isActive ? (
          <div className="w-full flex flex-col gap-2">
            <p className="text-[10px] text-outline w-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">lock</span>
              종료된 이벤트입니다. 참여 기록은 {30 - (daysAfterEnd ?? 0)}일간 보관됩니다.
            </p>
            {hasAnyCheck && (
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {aliases.map((alias) => {
                  if (event.checkedAliases?.[alias.id]) {
                    return (
                      <span key={alias.id} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20 font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">check</span>
                        {alias.name}
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        ) : aliases.length === 0 ? (
          <p className="text-[10px] text-outline text-center w-full">계좌를 추가해야 참여 여부를 체크할 수 있습니다.</p>
        ) : (
          aliases.map((alias) => {
            const isChecked = event.checkedAliases?.[alias.id] || false;
            return (
              <label key={alias.id} className="flex items-center gap-2 md:gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    className="peer sr-only"
                    checked={isChecked} 
                    onChange={() => onToggle(event.id, alias.id, isChecked)} 
                    disabled={!isActive}
                  />
                  <div className="w-4 h-4 md:w-5 md:h-5 rounded border border-outline-variant group-hover:border-primary peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                    {isChecked && <span className="material-symbols-outlined text-[10px] md:text-[14px] text-on-primary font-bold">check</span>}
                  </div>
                </div>
                <span className={`text-xs md:text-sm font-medium transition-colors ${isChecked ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}`}>{alias.name}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============ Ipo Modal Component ============
function IpoModal({ ipo, aliases, onClose, onToggleIpo }) {
  if (!ipo) return null;

  const brokerages = (ipo.lead_manager || '알 수 없음')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const statusColor = (status) => {
    if (status === '청약예정') return 'bg-tertiary/20 text-tertiary border-tertiary/30';
    if (status === '청약중') return 'bg-primary/20 text-primary border-primary/30 animate-pulse';
    return 'bg-outline-variant/20 text-outline border-outline-variant/30';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="bg-surface-container rounded-3xl w-full max-w-lg border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold font-headline truncate flex-1 pr-4">{ipo.company_name}</h2>
          <button onClick={onClose} className="p-2 -mr-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors shrink-0">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto scrollbar-hide flex-1 space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(ipo.status)}`}>{ipo.status}</span>
            {ipo.listing_date && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-400/30 bg-purple-400/10 text-purple-400">상장예정: {ipo.listing_date}</span>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm bg-surface-container-highest p-4 rounded-2xl border border-white/5">
            <div>
              <p className="text-[10px] text-on-surface-variant font-bold mb-1">청약일정</p>
              <p className="font-medium text-on-surface">{ipo.subscription_start?.replace(/-/g,'.')} ~ {ipo.subscription_end?.replace(/-/g,'.')}</p>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant font-bold mb-1">확정/희망공모가</p>
              <p className="font-medium text-on-surface">{ipo.confirmed_price || ipo.desired_price || '-'}</p>
            </div>
            {ipo.min_subscription_amount && (
              <div className="col-span-2 border-t border-white/5 pt-3">
                <p className="text-[10px] text-primary font-bold mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">payments</span> 균등 청약 최소 증거금 (10주 기준)
                </p>
                <p className="text-lg font-black text-primary font-headline">
                  {new Intl.NumberFormat('ko-KR').format(ipo.min_subscription_amount)}원
                </p>
              </div>
            )}
            {ipo.competition_rate && ipo.competition_rate !== '-' && (
              <div className="col-span-2 border-t border-white/5 pt-3 mt-1">
                <p className="text-[10px] text-on-surface-variant font-bold mb-1">기관경쟁률</p>
                <p className="font-medium text-on-surface">{ipo.competition_rate}</p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <h3 className="text-sm font-bold font-headline mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">domain</span> 주관사 및 청약 기록
            </h3>
            {brokerages.map(brk => (
              <div key={brk} className="mb-4 bg-surface-container-high rounded-xl p-4 border border-white/5">
                <p className="text-xs font-bold text-on-surface mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  {brk}
                </p>
                <div className="flex flex-wrap gap-2">
                  {aliases.length === 0 ? (
                    <p className="text-[10px] text-outline">등록된 계좌가 없습니다. 창을 닫고 계좌관리를 이용해주세요.</p>
                  ) : (
                    aliases.map(alias => {
                      const isChecked = ipo.checkedSubscriptions?.[brk]?.[alias.id] || false;
                      return (
                        <button 
                          key={alias.id}
                          onClick={() => onToggleIpo(ipo.id, brk, alias.id, isChecked)}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5
                            ${isChecked ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(115,255,186,0.1)] text-primary' 
                                        : 'bg-surface-container-highest border-transparent text-on-surface-variant hover:border-white/10 hover:text-on-surface'}`}
                        >
                          {isChecked && <span className="material-symbols-outlined text-[12px]">check</span>}
                          {alias.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PUBLIC_HOLIDAYS_2026 = {
  "2026-01-01": "신정",
  "2026-02-16": "설연휴", "2026-02-17": "설날", "2026-02-18": "설연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석연휴", "2026-09-25": "추석", "2026-09-26": "추석연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절"
};

// ============ IPO Calendar Component ============
function App() {
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null); 
  const [selectedStatus, setSelectedStatus] = useState("전체 보기"); 
  const [toast, setToast] = useState({ message: "", visible: false, type: "success" });
  const [showSettings, setShowSettings] = useState(false);
  const [newAliasName, setNewAliasName] = useState("");
  const [scrapingStatus, setScrapingStatus] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(null);
  const [activeTab, setActiveTab] = useState("landing");
  const [subscriptionSubTab, setSubscriptionSubTab] = useState("ipo"); // "ipo" or "apt" // "landing" | "insights" | "dashboard" | "ipo" | "apt" | "parking"
  const [insightSubTab, setInsightSubTab] = useState("macro"); // "macro", "dart", "nps", "legends"
  const [parkingFilter, setParkingFilter] = useState('all'); // 'all', 'no_conditions', 'high_yield', 'major'
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [ipoEvents, setIpoEvents] = useState([]);
  const [ipoLoading, setIpoLoading] = useState(false);
  const [selectedIpo, setSelectedIpo] = useState(null);
  const [aptEvents, setAptEvents] = useState([]);
  const [aptLoading, setAptLoading] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [whaleData, setWhaleData] = useState(null); // 투자 인사이트용 데이터
  const [marketData, setMarketData] = useState(null);
  const [visitorCount, setVisitorCount] = useState({ today: 0, total: 0 });
  const [showAbout, setShowAbout] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const INFO_CONTENT = {
    about: {
      title: 'About RE:MEMBER',
      icon: 'info',
      content: `RE:MEMBER는 복잡한 데이터의 홍수 속에서 유의미한 '투자 시그널'을 포착하고 기록하는 스마트한 투자자들을 위한 공간입니다. 
      우리는 AI 기반의 시나리오 분석 엔진과 실시간 데이터 수집 기술을 결합하여, 거시경제의 흐름부터 세부적인 청약 일정까지 한눈에 파악할 수 있는 통합 인사이트를 제공합니다. 
      당신의 투자가 단순한 기억을 넘어 기록이 되고, 기록이 곧 수익이 되는 여정을 함께합니다.`
    },
    contact: {
      title: 'Contact Us',
      icon: 'mail',
      content: `서비스 이용 중 불편한 점이나 제휴 제안, 기능 건의사항이 있으시면 언제든 연락주세요. 
      가장 빠른 답변을 드릴 수 있도록 노력하겠습니다.
      
      • Email: support@remember.invest
      • 운영시간: 평일 10:00 - 18:00 (주말/공휴일 제외)`
    },
    privacy: {
      title: 'Privacy Policy',
      icon: 'shield_lock',
      content: `RE:MEMBER는 사용자의 개인정보를 소중히 보호하며 투명하게 운영합니다.
      
      1. 수집 항목: 방문자 통계 분석을 위한 익명의 접속 로그 (IP 등 개인 식별 정보는 별도로 저장하지 않습니다.)
      2. 수집 목적: 서비스 이용량 분석 및 안정적인 서버 운영
      3. 보유 및 파기: 서비스 제공 기간 동안 보유하며, 통계 목적 달성 시 안전하게 파기됩니다.
      
      우리는 사용자의 명시적인 동의 없이 어떠한 개인식별정보도 수집하거나 제3자에게 제공하지 않습니다.`
    }
  };

  function InfoModal({ isOpen, onClose, type }) {
    if (!isOpen || !type) return null;
    const data = INFO_CONTENT[type];
    
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in" onClick={onClose}>
        <div className="bg-surface-container rounded-[2.5rem] w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden p-8 md:p-10 relative" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-8 right-8 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-8">
            <span className="material-symbols-outlined text-primary text-3xl">{data.icon}</span>
          </div>
          <h2 className="text-3xl font-black font-headline mb-6">{data.title}</h2>
          <div className="text-on-surface-variant leading-relaxed space-y-4 whitespace-pre-wrap font-medium">
            {data.content}
          </div>
          <button onClick={onClose} className="w-full mt-10 py-4 bg-primary text-on-primary font-black rounded-2xl hover:opacity-90 active:scale-95 transition-all">
            확인했습니다
          </button>
        </div>
      </div>
    );
  }

  const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  const getPushSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  }, []);

  useEffect(() => {
    if (session && showSettings) {
      const checkPushStatus = async () => {
        try {
          const sub = await getPushSubscription();
          if (sub) {
            const isSubscribedInDb = await checkPushSubscription(session.user.id, sub.endpoint);
            setIsPushEnabled(isSubscribedInDb);
          } else {
            setIsPushEnabled(false);
          }
        } catch (err) {
          console.error("Push status check error", err);
        }
      };
      checkPushStatus();
    }
  }, [session, showSettings, getPushSubscription]);

  const togglePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToastMsg("이 브라우저에서는 푸시 알림을 지원하지 않습니다.", "error");
      return;
    }

    try {
      if (isPushEnabled) {
        const sub = await getPushSubscription();
        if (sub) {
          await removePushSubscription(session.user.id, sub.endpoint);
          await sub.unsubscribe();
        }
        setIsPushEnabled(false);
        showToastMsg("알림이 해제되었습니다.");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showToastMsg("푸시 알림 허용이 필요합니다. 브라우저 주소창 설정에서 권한을 허용해주세요.", "error");
          return;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_KEY
        });
        
        await savePushSubscription(session.user.id, sub);
        setIsPushEnabled(true);
        showToastMsg("해당 기기에서 알림을 설정했습니다.");
      }
    } catch (err) {
      console.error(err);
      showToastMsg("알림 설정 중 오류가 발생했습니다.", "error");
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAdmin(session?.user?.email === 'aikks3782@gmail.com');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setIsAdmin(s?.user?.email === 'aikks3782@gmail.com');
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const visited = sessionStorage.getItem('visited');
    if (!visited) {
      incrementVisitor().then(() => {
        sessionStorage.setItem('visited', 'true');
        fetchVisitorCount().then(setVisitorCount);
      });
    } else {
      fetchVisitorCount().then(setVisitorCount);
    }
  }, []);

  const showToastMsg = useCallback((message, type="success") => {
    setToast({ message, visible: true, type });
    setTimeout(() => setToast({ message: "", visible: false, type: "success" }), 3000);
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToastMsg("비밀번호는 최소 6자 이상이어야 합니다.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToastMsg("비밀번호가 일치하지 않습니다.", "error");
      return;
    }
    setUpdateLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      showToastMsg(`비밀번호 변경 실패: ${error.message}`, "error");
    } else {
      showToastMsg("비밀번호가 성공적으로 변경되었습니다.");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    }
    setUpdateLoading(false);
  };

  const loadData = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    try {
      const [fetchedAliases, eventsData, statusUpdate, mData, wData, ipoData, aptData] = await Promise.all([
        fetchAliases(session.user.id),
        fetchEvents(session.user.id),
        fetchScrapingStatus(),
        fetchMarketInsights(),
        fetch('/data/whale.json').then(r => r.json()).catch(() => null),
        fetchIpoEvents(session.user.id).catch(() => []),
        fetchAptSubscriptions().catch(() => [])
      ]);
      setAliases(fetchedAliases || []);
      setEvents(eventsData.events || []);
      setScrapingStatus(statusUpdate);
      setMarketData(mData);
      setWhaleData(wData);
      setIpoEvents(ipoData || []);
      setAptEvents(aptData || []);
      
      if (isAdmin) {
        const token = await fetchAdminSecret('GITHUB_PAT');
        setAdminToken(token);
      }
    } catch (err) {
      console.error("Data load error:", err);
      showToastMsg("데이터 연동 실패", "error");
    } finally {
      setLoading(false);
    }
  }, [session, isAdmin, showToastMsg]);

  useEffect(() => { if (session) loadData(); }, [loadData, session]);

  const handleToggle = async (eventId, aliasId, currentlyChecked) => {
    try {
      const result = await toggleEventChecked(eventId, session.user.id, aliasId, currentlyChecked);
      setEvents(prev => prev.map(e => {
        if (e.id === eventId) return { ...e, checkedAliases: { ...e.checkedAliases, [aliasId]: result.checked } };
        return e;
      }));
      showToastMsg(result.checked ? "참여 상태가 업데이트되었습니다." : "참여 취소됨");
    } catch (err) { showToastMsg("상태 변경 실패", "error"); }
  };

  const handleAddAlias = async (e) => {
    e.preventDefault();
    if (!newAliasName.trim()) return;
    try {
      const added = await addAlias(session.user.id, newAliasName.trim());
      setAliases([...aliases, added]);
      setNewAliasName("");
      showToastMsg("새 계좌가 등록되었습니다.");
    } catch (err) { showToastMsg("등록 실패", "error"); }
  };

  const handleRemoveAlias = async (aliasId) => {
    if (!window.confirm("삭제하시겠습니까?")) return;
    try {
      await removeAlias(aliasId, session.user.id);
      setAliases(aliases.filter((a) => a.id !== aliasId));
      loadData();
      showToastMsg("계좌 삭제됨");
    } catch (err) { showToastMsg("삭제 실패", "error"); }
  };

  const handleToggleIpo = async (ipoId, brokerage, aliasId, currentlyChecked) => {
    try {
      const result = await toggleIpoSubscription(ipoId, session.user.id, brokerage, aliasId, currentlyChecked);
      setIpoEvents(prev => prev.map(e => {
        if (e.id === ipoId) {
          const newChecked = { ...e.checkedSubscriptions };
          if (!newChecked[brokerage]) newChecked[brokerage] = {};
          newChecked[brokerage][aliasId] = result.checked;
          return { ...e, checkedSubscriptions: newChecked };
        }
        return e;
      }));
      setSelectedIpo(prev => {
        if (prev && prev.id === ipoId) {
          const newChecked = { ...prev.checkedSubscriptions };
          if (!newChecked[brokerage]) newChecked[brokerage] = {};
          newChecked[brokerage][aliasId] = result.checked;
          return { ...prev, checkedSubscriptions: newChecked };
        }
        return prev;
      });
    } catch (err) { showToastMsg("상태 변경 실패", "error"); }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="bg-surface-container rounded-3xl p-8 w-full max-w-sm shadow-2xl">
          <h1 className="text-2xl font-bold font-headline mb-6 text-center text-primary">ETF Event Tracker</h1>
          <Auth 
            supabaseClient={supabase} 
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#73ffba',
                    brandAccent: '#64f0ac',
                    inputText: '#ebedfb',
                    inputPlaceholder: '#727581',
                    inputLabelText: '#a7abb7',
                    inputBackground: '#202633',
                    inputBorder: '#444852',
                  }
                }
              }
            }} 
            theme="dark"
            providers={[]} 
          />
        </div>
      </div>
    );
  }

  // 데이터 필터링 계산
  const uniqueEventsMap = new Map();
  events.forEach(e => { if (!uniqueEventsMap.has(e.id)) uniqueEventsMap.set(e.id, e); });
  const uniqueEvents = Array.from(uniqueEventsMap.values());

  const activeEventsCount = uniqueEvents.filter(e => e.status === "진행중").length;
  const participatedCount = uniqueEvents.filter(e => Object.values(e.checkedAliases || {}).some(Boolean)).length;
  const totalChecks = events.reduce((acc, e) => acc + Object.values(e.checkedAliases || {}).filter(Boolean).length, 0);
  const maxPossibleChecks = events.length * Math.max(aliases.length, 1);
  const checkPercent = maxPossibleChecks > 0 ? Math.round((totalChecks / maxPossibleChecks) * 100) : 0;
  
  const upcomingEvents = uniqueEvents.filter(e => e.status === "진행중" && e.d_day >= 0 && e.d_day <= 3).length;

  // 참여 목록 탭에서 쓸 '종료 후 경과 일수' 계산 헬퍼
  const daysAfterEndOf = (e) => {
    if (!e.end_date) return null;
    const end = new Date(e.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.floor((today - end) / (1000 * 60 * 60 * 24));
  };

  let displayEvents = uniqueEvents.filter(e => {
    if (selectedProvider && e.provider !== selectedProvider) return false;
    if (selectedStatus === "참여 목록") {
      const hasAnyCheck = Object.values(e.checkedAliases || {}).some((v) => v);
      if (!hasAnyCheck) return false;
      // 진행중이거나, 종료 후 30일 이내인 것만 표시
      if (e.status !== "진행중") {
        const dae = daysAfterEndOf(e);
        if (dae === null || dae > 30) return false;
      }
    } else if (selectedStatus === "마감 임박") {
      if (e.status !== "진행중" || e.d_day === null || e.d_day === undefined || e.d_day < 0 || e.d_day > 3) return false;
    } else {
      if (e.status !== "진행중") return false;
    }
    return true;
  }).sort((a, b) => {
    // 참여 목록: 진행중 먼저, 그 다음 종료 최근 순
    if (selectedStatus === "참여 목록") {
      const aActive = a.status === "진행중" ? 0 : 1;
      const bActive = b.status === "진행중" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      // 진행중끼리는 d_day 오름차순, 종료끼리는 end_date 내림차순
      if (aActive === 0) return (a.d_day ?? 9999) - (b.d_day ?? 9999);
      return (b.end_date || '').localeCompare(a.end_date || '');
    }
    return (a.d_day ?? 9999) - (b.d_day ?? 9999);
  });

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-[#0a0e17]/80 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
        <nav className="flex justify-between items-center w-full px-4 md:px-8 h-16">
          <div className="flex items-center gap-4 md:gap-12">
            <div className="flex items-center gap-2">
              <button onClick={() => setIsDrawerOpen(!isDrawerOpen)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center">
                <span className="material-symbols-outlined text-[#ebedfb]">menu</span>
              </button>
              <span className="text-xl font-bold tracking-tighter text-[#ebedfb] font-headline cursor-pointer" onClick={() => {setActiveTab("landing"); setAnalysisResult(null);}}>RE:MEMBER</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
                            <button className={`pb-1 font-headline transition-colors ${activeTab === 'landing' ? 'text-primary border-b-2 border-primary' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}`} onClick={() => {setActiveTab("landing"); setAnalysisResult(null);}}>투자 인사이트</button>
              <button className={`pb-1 font-headline transition-colors ${activeTab === 'dashboard' ? 'text-primary border-b-2 border-primary' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}`} onClick={() => {setActiveTab("dashboard"); setSelectedProvider(null); setSelectedStatus("전체 보기");}}>이벤트</button>
              <button className={`pb-1 font-headline transition-colors ${activeTab === 'subscription' ? 'text-primary border-b-2 border-primary' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}`} onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }}>청약</button>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSettings(!showSettings)} className={`hover:bg-[#262c3a]/50 p-2 rounded-full transition-all active:scale-95 duration-200 ${showSettings?'text-primary':'text-on-surface'}`}>
                <span className="material-symbols-outlined">settings</span>
              </button>
              {isAdmin && (
                <button className="bg-primary text-on-primary px-3 md:px-5 py-1.5 rounded-full text-[10px] md:text-sm font-bold active:scale-95 duration-200 shadow-[0_0_20px_rgba(115,255,186,0.2)]" onClick={() => triggerManualScrape(adminToken)}>
                  <span className="md:inline hidden">관리자 수집 실행</span>
                  <span className="md:hidden inline flex items-center justify-center"><span className="material-symbols-outlined text-sm">refresh</span></span>
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* No Overlay Backdrop as per request to keep it pushing content */}

      <aside className={`flex flex-col fixed left-0 top-16 bottom-0 p-4 w-64 bg-gradient-to-b from-[#0a0e17] to-[#262c3a] z-40 transition-transform duration-300 border-r border-white/5 shadow-2xl overflow-y-auto scrollbar-hide ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 mb-8 px-2 pt-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary" data-weight="fill">sensors</span>
          </div>
          <div>
            <p className="text-sm font-black text-[#73ffba] uppercase tracking-wider font-headline">FUTURE SIGNAL</p>
            <p className="text-[10px] text-on-surface-variant italic">고래들의 돈줄 추적</p>
          </div>
        </div>
        
        <div className="space-y-1 flex-1">
          { (activeTab === 'insights' || activeTab === 'landing') ? (
            <>
              <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-4">투자 인사이트</p>
              <button onClick={() => { setActiveTab("insights"); setInsightSubTab("macro"); window.scrollTo(0,0); }} className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${insightSubTab === 'macro' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}>
                <span className="material-symbols-outlined text-xl">public</span>
                <span className="font-medium text-sm">매크로 시나리오</span>
              </button>
              <button onClick={() => { setActiveTab("insights"); setInsightSubTab("dart"); window.scrollTo(0,0); }} className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${insightSubTab === 'dart' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}>
                <span className="material-symbols-outlined text-xl">notifications_active</span>
                <span className="font-medium text-sm">고래 지분 변동 (5%)</span>
              </button>
              <button onClick={() => { setActiveTab("insights"); setInsightSubTab("nps"); window.scrollTo(0,0); }} className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${insightSubTab === 'nps' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:text-[#73ffba]'}`}>
                <span className="material-symbols-outlined text-xl">account_balance</span>
                <span className="font-medium text-sm">국민연금 주력주</span>
              </button>
              <button onClick={() => { setActiveTab("insights"); setInsightSubTab("legends"); window.scrollTo(0,0); }} className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${insightSubTab === 'legends' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:text-[#73ffba]'}`}>
                <span className="material-symbols-outlined text-xl">military_tech</span>
                <span className="font-medium text-sm">글로벌 투자 전설</span>
              </button>
            </>
          ) : activeTab === 'subscription' ? (
            <>
              <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-4">청약 종류</p>
              <button 
                onClick={() => { setSubscriptionSubTab("ipo"); window.scrollTo(0,0); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }} 
                className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${subscriptionSubTab === 'ipo' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}
              >
                <span className="material-symbols-outlined text-xl">calendar_month</span>
                <span className="font-medium text-sm">공모주 일정</span>
              </button>
              <button 
                onClick={() => { setSubscriptionSubTab("apt"); window.scrollTo(0,0); if (aptEvents.length === 0) { setAptLoading(true); fetchAptSubscriptions().then(d => { setAptEvents(d); setAptLoading(false); }).catch(() => setAptLoading(false)); } }} 
                className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${subscriptionSubTab === 'apt' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}
              >
                <span className="material-symbols-outlined text-xl">home_work</span>
                <span className="font-medium text-sm">아파트 청약</span>
              </button>
            </>
          ) : activeTab === 'dashboard' ? (
            <>
              <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-6">운용사별</p>
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                {PROVIDERS.map(p => (
                  <button 
                    key={p.key}
                    onClick={() => { setSelectedProvider(p.key); setSelectedStatus("전체 보기"); window.scrollTo(0,0); }} 
                    className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2 transition-all duration-300 ${selectedProvider === p.key ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold ${p.bgColor} ${p.textCol || 'text-white'}`}>
                      {p.textLabel}
                    </div>
                    <span className="font-medium text-xs">{p.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : activeTab === 'parking' ? (
            <>
              <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-4">금리 필터</p>
              {[
                { id: 'all', label: '전체 상품', icon: 'list' },
                { id: 'no_conditions', label: '우대조건 없음', icon: 'verified_user' },
                { id: 'high_yield', label: '실수령액 순', icon: 'payments' },
                { id: 'major', label: '1금융권/대형사', icon: 'account_balance' }
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => { setParkingFilter(f.id); window.scrollTo(0,0); }} 
                  className={`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${parkingFilter === f.id ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}`}
                >
                  <span className="material-symbols-outlined text-xl">{f.icon}</span>
                  <span className="font-medium text-sm">{f.label}</span>
                </button>
              ))}
            </>
          ) : (
            <div className="text-center py-10 text-on-surface-variant/50 text-xs">
              현재 선택된 탭({activeTab})의<br/>세부 메뉴가 없습니다.
            </div>
          )}

          <div className="absolute bottom-6 left-4 right-4">
            <button onClick={() => supabase.auth.signOut()} className="w-full text-left text-[#ebedfb]/70 hover:bg-[#262c3a]/30 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:text-[#ff716c] duration-300">
              <span className="material-symbols-outlined text-xl">logout</span>
              <span className="text-sm font-medium">로그아웃</span>
            </button>
          </div>
        </div>
      </aside>

      <main className={`pt-20 ${activeTab === 'landing' ? 'pb-0 scrollbar-hide' : 'pb-24 md:pb-12 min-h-[calc(100vh-80px)]'} px-3 md:px-12 transition-all duration-300 ${isDrawerOpen ? 'md:ml-64' : 'ml-0'}`}>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-8 p-6 bg-surface-container rounded-3xl border border-outline-variant/30 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-headline flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span> 내 정보
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">notifications_active</span> 알림 받기
                </span>
                <button 
                  onClick={togglePush}
                  className={`w-10 h-5 md:w-11 md:h-6 rounded-full transition-colors relative flex items-center shrink-0 ${isPushEnabled ? 'bg-primary border-primary' : 'bg-surface-container-highest border border-white/20'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 md:w-5 md:h-5 rounded-full transition-transform ${isPushEnabled ? 'translate-x-[20px] shadow-sm' : 'bg-outline-variant/60'}`} style={{width: 'calc(100% / 2 - 2px)', height: 'calc(100% - 4px)'}}></span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4 pt-6 border-t border-white/5">
              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-xs">account_balance_wallet</span>계좌 별명 목록
                </h4>
                <ul className="space-y-2 mb-4">
                  {aliases.map(a => (
                    <li key={a.id} className="flex items-center justify-between p-3 bg-surface-container-highest rounded-xl text-sm border border-white/5">
                      {a.name}
                      <button onClick={() => handleRemoveAlias(a.id)} className="text-error hover:bg-error/10 p-1.5 rounded-lg transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button>
                    </li>
                  ))}
                  {aliases.length === 0 && <li className="text-sm text-on-surface-variant">등록된 계좌가 없습니다.</li>}
                </ul>
                <form onSubmit={handleAddAlias} className="flex gap-3">
                  <input value={newAliasName} onChange={e => setNewAliasName(e.target.value)} type="text" placeholder="새로운 계좌 별명" className="flex-1 bg-surface-container-highest rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none border border-transparent focus:border-primary/50 text-on-surface placeholder:text-on-surface-variant" />
                  <button type="submit" className="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">추가</button>
                </form>
              </div>
              
              <div className="md:border-l md:border-white/5 md:pl-8 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-xs">lock_reset</span>비밀번호 변경
                  </h4>
                  {!showPasswordForm && (
                    <button 
                      onClick={() => setShowPasswordForm(true)}
                      className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      변경하기
                    </button>
                  )}
                </div>

                {showPasswordForm ? (
                   <form onSubmit={handleUpdatePassword} className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      placeholder="새 비밀번호 (6자 이상)" 
                      className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none border border-transparent focus:border-primary/50 text-on-surface"
                      required
                    />
                    <input 
                      type="password" 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="새 비밀번호 확인" 
                      className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none border border-transparent focus:border-primary/50 text-on-surface"
                      required
                    />
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setShowPasswordForm(false)}
                        className="flex-1 bg-surface-container-highest text-on-surface-variant font-bold py-3 rounded-xl hover:bg-white/5 transition-all"
                      >
                        취소
                      </button>
                      <button 
                        type="submit" 
                        disabled={updateLoading}
                        className="flex-[2] bg-primary text-on-primary font-bold py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      >
                        {updateLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <>비밀번호 업데이트</>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant py-4">계정 보안을 위해 정기적으로 비밀번호를 변경해주세요.</p>
                  </div>
                )}
                
                <div className="mt-auto pt-6">
                  <button 
                    onClick={() => supabase.auth.signOut()}
                    className="w-full py-4 border border-error/30 text-error font-bold rounded-2xl bg-error/5 hover:bg-error/10 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    로그아웃
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content Switch */}
        {activeTab === "landing" ? (
          <LandingPage 
            onAnalyze={async (input) => {
              if (!input) {
                setActiveTab("dashboard");
                return;
              }
              setIsAnalyzing(true);
              try {
                // Cloudflare Serverless Function 호출
                const res = await fetch('/api/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scenario: input })
                });
                
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({}));
                  throw new Error(errorData.details || errorData.error || '분석 서버 응답 오류');
                }
                
                const data = await res.json();
                setAnalysisResult(data);
              } catch (e) {
                console.error("Analysis error:", e);
                // 상세 에러 메시지를 토스트로 표시하여 디버깅 지원
                showToastMsg(`오류: ${e.message}`, "error");
              } finally {
                setIsAnalyzing(false);
              }
            }}
            isAnalyzing={isAnalyzing}
            analysisResult={analysisResult}
            onReset={() => setAnalysisResult(null)}
          />
        ) : activeTab === "insights" ? (
          <InvestmentInsights subTab={insightSubTab} />
        ) : activeTab === "subscription" ? (
          subscriptionSubTab === "ipo" ? (
            ipoLoading ? (
              <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
            ) : (
              <IpoCalendar 
                ipoEvents={ipoEvents} 
                onSelectIpo={setSelectedIpo} 
                aliases={aliases}
                onToggleIpo={handleToggleIpo}
              />
            )
          ) : (
            aptLoading ? (
              <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
            ) : (
              <AptCalendar aptEvents={aptEvents} />
            )
          )
        ) : activeTab === "parking" ? (
          <ParkingCmaComparison parkingFilter={parkingFilter} />
        ) : (
          <>
            {/* Dashboard Header */}
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tighter text-on-surface font-headline mb-2">
                  {selectedProvider ? `${PROVIDERS.find(p=>p.key===selectedProvider)?.name} 이벤트` : "이벤트"}
                </h1>
                <p className="text-on-surface-variant max-w-xl italic">미래의 내가 보낸 수익 시그널을 확인하세요.</p>
              </div>
            </div>

            {/* Status Filters - Main View */}
            <div className="flex flex-wrap items-center gap-3 mb-10 bg-surface-container/30 p-4 rounded-3xl border border-white/5">
              {[
                { id: '전체 보기', label: '전체 보기', icon: 'list' },
                { id: '마감 임박', label: '마감 임박', icon: 'schedule' },
                { id: '참여 목록', label: '참여 목록', icon: 'task_alt' }
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => { setSelectedStatus(f.id); setSelectedProvider(null); }} 
                  className={`px-6 py-2.5 rounded-2xl flex items-center gap-2 transition-all duration-300 font-bold text-sm ${selectedStatus === f.id ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 border border-primary/20' : 'bg-surface-container border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-lg">{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
              {/* Registered Accounts */}
              <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  <span className="material-symbols-outlined text-6xl md:text-8xl">account_balance_wallet</span>
                </div>
                <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">등록 계좌</p>
                <h3 className="text-2xl md:text-4xl font-extrabold text-on-surface font-headline">{aliases.length}<span className="text-xs md:text-base ml-1 opacity-50 font-medium">개</span></h3>
              </div>

              {/* Active Events */}
              <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  <span className="material-symbols-outlined text-6xl md:text-8xl">bolt</span>
                </div>
                <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">진행중 이벤트</p>
                <h3 className="text-2xl md:text-4xl font-extrabold text-on-surface font-headline">{activeEventsCount}</h3>
                <p className="mt-1 md:mt-2 text-[9px] md:text-xs text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] md:text-[14px]">sync</span>
                  {scrapingStatus?.last_run ? new Date(scrapingStatus.last_run).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '오늘'}
                </p>
              </div>

              {/* Participation Rate */}
              <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  <span className="material-symbols-outlined text-6xl md:text-8xl">analytics</span>
                </div>
                <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">참여율</p>
                <h3 className="text-2xl md:text-4xl font-extrabold text-primary font-headline">{checkPercent}%</h3>
                <div className="mt-2 md:mt-4 w-full bg-surface-container-highest rounded-full h-1 md:h-1.5 overflow-hidden">
                  <div className="bg-primary h-full rounded-full shadow-[0_0_8px_#73ffba] transition-all duration-1000" style={{width: `${checkPercent}%`}}></div>
                </div>
              </div>

              {/* Closing Soon */}
              <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group border-primary/10">
                <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  <span className="material-symbols-outlined text-6xl md:text-8xl text-tertiary">notification_important</span>
                </div>
                <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">마감 임박</p>
                <h3 className="text-2xl md:text-4xl font-extrabold text-tertiary font-headline">{upcomingEvents}</h3>
                <p className="mt-1 md:mt-2 text-[9px] md:text-xs text-tertiary/70">3일 이내 종료</p>
              </div>
            </section>

            {loading && events.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
            ) : (
              (selectedProvider === null && (selectedStatus === "전체 보기" || selectedStatus === "전체 이벤트")) ? (
                <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-surface-container border border-white/5 rounded-3xl p-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <h3 className="text-2xl font-bold mb-6 font-headline flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary" data-weight="fill">bolt</span> 최근 활동 알림
                    </h3>
                    <div className="space-y-6">
                      {uniqueEvents.slice(0,3).map((ev, i) => (
                        <div key={ev.id} className="flex gap-4 items-start">
                          <div className={`w-2 h-2 rounded-full mt-2 ${i===0?'bg-primary shadow-[0_0_8px_#73ffba]':'bg-outline-variant'}`}></div>
                          <div className="flex-1 cursor-pointer hover:underline" onClick={() => {if(ev.link) window.open(ev.link, '_blank')}}>
                            <p className="text-on-surface font-medium line-clamp-1">{i===0?'신규':'발견'} {ev.provider} 이벤트: '{ev.title}'</p>
                            <p className="text-xs text-on-surface-variant mt-1">{formatDateRange(ev.start_date, ev.end_date)} • {ev.provider} ETF</p>
                          </div>
                          {i === 0 && <span className="text-[10px] uppercase font-bold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded">NEW</span>}
                          {i === 2 && <span className="material-symbols-outlined text-primary text-sm">verified</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-surface-container border border-white/5 rounded-3xl p-8 flex flex-col justify-between">
                    <div>
                      <h3 className="text-2xl font-bold mb-2 font-headline">시스템 건전성</h3>
                      <p className="text-sm text-on-surface-variant mb-8">안전한 데이터 수집 및 보안 상태입니다.</p>
                      <div className="flex items-center justify-center py-10 relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-32 h-32 rounded-full border-4 border-primary/10 border-t-primary border-l-primary/50 animate-[spin:5s_linear_infinite]"></div>
                        </div>
                        <div className="text-center z-10">
                          <p className="text-4xl font-black text-on-surface font-headline">{scrapingStatus?.status === 'success' || scrapingStatus?.status === '성공' ? '99.8%' : '90.2%'}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">안전함</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-surface-container-highest p-4 rounded-2xl text-center">
                        <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">API 상태</p>
                        <p className="text-sm font-bold text-primary">{scrapingStatus?.status === 'failed' ? '오류' : '안정'}</p>
                      </div>
                      <div className="bg-surface-container-highest p-4 rounded-2xl text-center">
                        <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">응답 속도</p>
                        <p className="text-sm font-bold text-on-surface">최적</p>
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
                  {displayEvents.length > 0 ? displayEvents.map(e => (
                    <EventCard key={e.id} event={e} aliases={aliases} onToggle={handleToggle} showToastMsg={showToastMsg} />
                  )) : (
                    <div className="col-span-full py-20 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-5xl mb-4 opacity-50">filter_list_off</span>
                      <p>해당 조건의 이벤트가 없습니다.</p>
                    </div>
                  )}
                </div>
              )
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className={`border-t border-white/5 bg-[#0a0e17] ${activeTab === 'landing' ? 'py-4' : 'py-10'} px-6 md:px-12 transition-all duration-300 ${isDrawerOpen ? 'md:ml-64' : 'ml-0'}`}>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <span className="text-lg font-black text-primary tracking-tighter font-headline">RE:MEMBER</span>
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">수익 시그널을 포착하고 기록하는 모두의 공간입니다.</p>
          </div>
          
          <div className="flex items-center gap-3 mb-6 text-base">
            <span className="text-primary font-black">오늘 <span className="text-xl">{visitorCount.today}</span>명</span>
            <span className="text-white/20">|</span>
            <span className="text-on-surface-variant font-bold">누적 <span className="text-xl text-white">{visitorCount.total.toLocaleString()}</span>명</span>
          </div>

          <div className="flex items-center gap-6 mb-6 text-sm font-bold text-on-surface-variant">
            <button className="hover:text-primary transition-colors" onClick={() => setShowAbout(true)}>About</button>
            <button className="hover:text-primary transition-colors" onClick={() => setShowContact(true)}>Contact</button>
            <button className="hover:text-primary transition-colors" onClick={() => setShowPrivacy(true)}>Privacy</button>
          </div>

          <p className="text-xs text-white/20 font-medium">© 2026 RE:MEMBER. All rights reserved.</p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-[#0a0e17]/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around z-50 px-6 pb-safe">
        <button onClick={() => { setActiveTab("landing"); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 ${activeTab === 'landing' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'landing' ? 'fill' : 'normal'}>insights</span>
          <span className="text-[10px] font-bold text-center">투자 인사이트</span>
        </button>
        <button onClick={() => {setActiveTab("dashboard"); setSelectedProvider(null); setSelectedStatus("전체 보기"); window.scrollTo(0,0);}} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'dashboard' ? 'fill' : 'normal'}>layers</span>
          <span className="text-[10px] font-bold text-center">이벤트</span>
        </button>
        <button onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); window.scrollTo(0,0); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }} className={`flex flex-col items-center gap-1 ${activeTab === 'subscription' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'subscription' ? 'fill' : 'normal'}>assignment</span>
          <span className="text-[10px] font-bold text-center">청약</span>
        </button>
        <button onClick={() => { setActiveTab("parking"); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 ${activeTab === 'parking' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'parking' ? 'fill' : 'normal'}>account_balance</span>
          <span className="text-[10px] font-bold text-center">금리 비교</span>
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className={`flex flex-col items-center gap-1 ${showSettings ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-2xl" data-weight={showSettings ? 'fill' : 'normal'}>person</span>
          <span className="text-[10px] font-bold text-center">내 정보</span>
        </button>
      </div>

      {/* Modal Rendering */}
      <IpoModal ipo={selectedIpo} aliases={aliases} onClose={() => setSelectedIpo(null)} onToggleIpo={handleToggleIpo} />
      
      {/* Footer Info Modals */}
      <InfoModal isOpen={showAbout} onClose={() => setShowAbout(false)} type="about" />
      <InfoModal isOpen={showContact} onClose={() => setShowContact(false)} type="contact" />
      <InfoModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} type="privacy" />

      {/* FAB */}
      {(selectedProvider || selectedStatus === "참여 목록" || selectedStatus === "마감 임박") && (
         <button onClick={() => {setSelectedProvider(null); setSelectedStatus("전체 보기");}} className="fixed bottom-20 md:bottom-8 right-6 md:right-8 w-14 h-14 bg-surface-container-highest text-on-surface rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-95 transition-all hover:scale-105 hover:bg-surface-bright border border-white/10">
           <span className="material-symbols-outlined">arrow_back</span>
         </button>
      )}

      {/* Global Toast */}
      {toast.visible && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-8 border border-white/10 w-[90%] md:w-auto text-center justify-center">
          <span className={`material-symbols-outlined ${toast.type==='success'?'text-primary':'text-error'}`}>
            {toast.type==='success'?'check_circle':'error'}
          </span>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </>
  );
}



export default App;
