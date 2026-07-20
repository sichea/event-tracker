import { useState } from "react";

// ---- 영업일 계산 헬퍼 ----
const HOLIDAYS_KR = new Set([
  "2025-01-01","2025-01-28","2025-01-29","2025-01-30",
  "2025-03-01","2025-05-05","2025-05-06","2025-06-06",
  "2025-08-15","2025-10-03","2025-10-06","2025-10-07","2025-10-08","2025-10-09",
  "2025-12-25",
  "2026-01-01","2026-01-28","2026-01-29","2026-01-30",
  "2026-03-01","2026-03-02","2026-05-05","2026-06-06",
  "2026-08-17","2026-10-03","2026-10-05","2026-10-06","2026-10-07","2026-10-09",
  "2026-12-25",
]);

function isBusinessDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const key = date.toISOString().slice(0, 10);
  if (HOLIDAYS_KR.has(key)) return false;
  return true;
}

function addBusinessDays(date, n) {
  const d = new Date(date);
  let count = 0;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) count++;
  }
  return d;
}

function subtractBusinessDays(date, n) {
  const d = new Date(date);
  let count = 0;
  while (count < n) {
    d.setDate(d.getDate() - 1);
    if (isBusinessDay(d)) count++;
  }
  return d;
}

function getLatestBusinessDayOnOrBefore(date) {
  const d = new Date(date);
  while (!isBusinessDay(d)) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function getFirstBusinessDayOnOrAfter(date) {
  const d = new Date(date);
  while (!isBusinessDay(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateKR(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function getDayLabel(date) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[date.getDay()] + "요일";
}

export default function KBEventCalculator() {
  const today = new Date();
  const todayStr = formatDate(today);

  const [inputDate, setInputDate] = useState(todayStr);
  const [result, setResult] = useState(null);
  const [animating, setAnimating] = useState(false);

  function calculate() {
    if (!inputDate) return;
    const base = new Date(inputDate + "T00:00:00");

    const eventEnd = new Date(base);
    eventEnd.setDate(eventEnd.getDate() + 30);

    const settlementDate = getLatestBusinessDayOnOrBefore(eventEnd);
    const naildreamBuy = subtractBusinessDays(settlementDate, 1);
    const naildreamSell = getFirstBusinessDayOnOrAfter(eventEnd);
    const couponDate = addBusinessDays(eventEnd, 2);

    setAnimating(true);
    setTimeout(() => {
      setResult({ base, eventEnd, naildreamBuy, naildreamSell, couponDate });
      setAnimating(false);
    }, 200);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") calculate();
  }

  const todayMid = new Date(todayStr + "T00:00:00");
  const diff = result ? Math.ceil((result.eventEnd - todayMid) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="flex flex-col gap-3 max-w-2xl mx-auto w-full">

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-[#FFD700] text-xl" data-weight="fill">calculate</span>
        </div>
        <div>
          <h2 className="text-base font-black font-headline text-on-surface tracking-tight leading-tight">
            KB공모주 청약환불금 +30일 계산기
          </h2>
          <p className="text-on-surface-variant text-xs mt-0.5">
            문자 수신일 입력 → 이벤트 종료일 · 내일드림 매수/매도일 자동 계산
          </p>
        </div>
      </div>

      {/* 이벤트 조건 요약 - 가로 배치 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { icon: "calendar_month", label: "기간", value: "30일 (수신일 포함)" },
          { icon: "payments",       label: "조건", value: "100만원 이상 순매수" },
          { icon: "redeem",         label: "혜택", value: "국내주식쿠폰 1만원" },
          { icon: "send",           label: "쿠폰", value: "종료 후 2영업일" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2 bg-surface-container/30 border border-white/5 rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-[#73ffba] text-sm flex-shrink-0">{item.icon}</span>
            <div className="min-w-0">
              <span className="text-on-surface-variant text-[9px] font-bold uppercase tracking-wider block">{item.label}</span>
              <span className="text-on-surface text-[10px] leading-tight block truncate">{item.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 입력 영역 */}
      <div className="flex gap-2">
        <input
          id="kb-calc-date-input"
          type="date"
          value={inputDate}
          onChange={e => setInputDate(e.target.value)}
          onKeyDown={handleKeyDown}
          max={formatDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()))}
          className="flex-1 bg-surface-container border border-white/10 rounded-xl px-4 py-3 text-on-surface text-sm font-medium focus:outline-none focus:border-[#73ffba]/50 focus:ring-1 focus:ring-[#73ffba]/20 transition-all cursor-pointer appearance-none [color-scheme:dark]"
        />
        <button
          id="kb-calc-btn"
          onClick={calculate}
          className="px-5 py-3 rounded-xl bg-[#73ffba] text-[#0a0e17] font-black text-sm hover:bg-[#5ef5a8] active:scale-95 transition-all duration-200 shadow-lg shadow-[#73ffba]/20 flex items-center gap-1.5 whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-base">calculate</span>
          계산
        </button>
      </div>

      {/* 결과 영역 */}
      {result && (
        <div className={`transition-all duration-200 ${animating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>

          {/* D-day 배지 */}
          {diff < 0 ? (
            <div className="flex items-center gap-2 bg-[#ff716c]/10 border border-[#ff716c]/20 rounded-xl px-3 py-2 mb-2">
              <span className="material-symbols-outlined text-[#ff716c] text-sm">warning</span>
              <span className="text-[#ff716c] text-xs font-bold">이벤트가 {Math.abs(diff)}일 전에 종료되었습니다.</span>
            </div>
          ) : diff === 0 ? (
            <div className="flex items-center gap-2 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-xl px-3 py-2 mb-2">
              <span className="material-symbols-outlined text-[#FFD700] text-sm" data-weight="fill">alarm</span>
              <span className="text-[#FFD700] text-xs font-bold">오늘이 이벤트 마지막 날입니다! (D-day)</span>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-[#73ffba]/10 border border-[#73ffba]/20 rounded-xl px-3 py-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#73ffba] text-sm" data-weight="fill">timer</span>
                <span className="text-on-surface text-xs font-medium">이벤트 종료까지</span>
              </div>
              <span className="text-[#73ffba] font-black text-base">D-{diff}</span>
            </div>
          )}

          {/* 날짜 결과 카드 */}
          <div className="bg-gradient-to-br from-[#73ffba]/10 to-[#73ffba]/5 border border-[#73ffba]/20 rounded-2xl p-4 space-y-0">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[#73ffba] text-base" data-weight="fill">event_available</span>
              <span className="text-[9px] font-bold text-[#73ffba] uppercase tracking-wider">계산 결과</span>
            </div>

            {[
              {
                emoji: "📅", label: "문자 수신일 (기준)",
                date: result.base,
                color: "text-on-surface",
                badge: null,
              },
              {
                emoji: "📌", label: "이벤트 종료일",
                date: result.eventEnd,
                color: "text-[#73ffba]",
                badge: { text: "D-day · +30일", cls: "bg-[#73ffba]/15 text-[#73ffba]" },
              },
              {
                emoji: "📈", label: "내일드림 펀드 매수",
                date: result.naildreamBuy,
                color: "text-[#a78bfa]",
                badge: { text: "D-1일", cls: "bg-[#a78bfa]/15 text-[#a78bfa]" },
              },
              {
                emoji: "📉", label: "내일드림 펀드 매도",
                date: result.naildreamSell,
                color: "text-[#fb923c]",
                badge: { text: "D-day", cls: "bg-[#fb923c]/15 text-[#fb923c]" },
              },
              {
                emoji: "🎁", label: "쿠폰 발송 예정일",
                date: result.couponDate,
                color: "text-[#FFD700]",
                badge: null,
              },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className={`flex justify-between items-center py-2 ${i < arr.length - 1 ? "border-b border-white/5" : ""}`}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm">{row.emoji}</span>
                  <span className="text-on-surface-variant text-xs">{row.label}</span>
                  {row.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${row.badge.cls}`}>
                      {row.badge.text}
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className={`font-black text-sm ${row.color}`}>{formatDateKR(row.date)}</span>
                  <span className="text-on-surface-variant text-[10px] ml-1.5">({getDayLabel(row.date)})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
