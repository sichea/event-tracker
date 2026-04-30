import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchMarketInsights, fetchParkingRates, fetchWhaleInsights } from './api';

// --- Investment Insight Constants ---
const INSIGHTS_DATA = [
  {
    id: 'war',
    label: '전쟁/위기',
    icon: 'local_fire_department',
    color: '#ef4444',
    bgGrad: 'from-red-500/20 to-orange-500/10',
    summary: '불확실성 극대화로 실물 자산과 안전 자산으로 돈이 이동합니다.',
    up: [
      { 
        name: '방산주', 
        desc: '지정학적 리스크 심화로 인한 국방 수요 및 수출 증가',
        products: [
          {"name": "TIGER 현대로템 (064350)", "strategy": "지정학적 분쟁 상황에서 지상 무기 체계 수요 급증 수혜"},
          {"name": "KODEX iSelect방산테마 (456310)", "strategy": "국내 주요 방산업체에 분산 투자하여 안보 위기 상황 대비"},
          {"name": "TIGER 우주방산 (441900)", "strategy": "우주 항공 및 첨단 무기 체계 모멘텀을 동시에 보유한 기업군"}
        ],
        icon: 'shield' 
      },
      { 
        name: '금 현물', 
        desc: '불확실성 속에서 가치가 오르는 최고의 안전 자산',
        products: [
          {"name": "ACE KRX금현물 (411060)", "strategy": "화폐 가치 하락 및 위기 상황에서 실물 금을 통한 가치 보존"},
          {"name": "TIGER 금은선물(H) (139310)", "strategy": "장내 선물을 통해 비용 효율적으로 금과 은에 동시에 투자"},
          {"name": "KODEX 골드선물(H) (132030)", "strategy": "환율 변동 위험 없이 국제 금 시세 수익을 추구하는 전략"}
        ],
        icon: 'diamond' 
      },
      { 
        name: '에너지 ETF', 
        desc: '전쟁으로 인한 공급망 차질 및 에너지 가격 급등 수혜',
        products: [
          {"name": "TIGER 미국S&P500에너지 (414210)", "strategy": "글로벌 정유사에 투자하여 원유 가격 상승분을 수익화"},
          {"name": "KODEX 미국S&P500에너지 (414260)", "strategy": "엑손모빌 등 거대 에너지 기업 중심의 안정적인 에너지 섹터 투자"},
          {"name": "TIGER 구리선물 (160580)", "strategy": "공급망 위축 상황에서 산업 전반의 기초가 되는 구리 가격 상승 수혜"}
        ],
        icon: 'local_gas_station' 
      },
    ],
    down: [
      { 
        name: '글로벌 증시 전반', 
        desc: '리스크 회피 심리 확산으로 인한 위험 자산 매도 압력',
        products: [
          {"name": "TIGER 나스닥100 (133690)", "strategy": "글로벌 유동성 위축 시 변동성이 커질 수 있는 대형 기술주 섹터"},
          {"name": "KODEX 200 (069500)", "strategy": "지정학적 리스크로 인한 국내 코스피 지수의 단기 하락 압력"},
          {"name": "SOL 미국S&P500 (433330)", "strategy": "전 세계적 위기 상황에서 주식형 자산의 전반적인 가치 하락 우려"}
        ],
        icon: 'public' 
      },
      { 
        name: '금융/항공/여행', 
        desc: '이동 제한 및 경기 위축으로 인한 실적 악화 직격탄',
        products: [
          {"name": "KODEX 은행 (091170)", "strategy": "경제 위기 시 대출 건전성 악화 및 금융 시장 경색 우려"},
          {"name": "TIGER 현대차그룹+ (138540)", "strategy": "물류 마비 및 소비 심리 위축으로 인한 대형 내구재 수요 급감"},
          {"name": "ACE 베트남VN30(합성) (245100)", "strategy": "지정학적 리스크에 민감한 신흥국 시장의 자금 유출 우려"}
        ],
        icon: 'flight' 
      }
    ],
  },
  {
    id: 'rate_cut',
    label: '금리 인하',
    icon: 'south',
    color: '#22c55e',
    bgGrad: 'from-green-500/20 to-emerald-500/10',
    summary: '중앙은행이 금리를 인하하면 이자 부담이 완화되고 기업 성장이 가속화됩니다.',
    up: [
      { 
        name: '기술주', 
        desc: '저금리 수혜를 직접적으로 받는 나스닥 및 혁신 기술주',
        products: [
          {"name": "TIGER 미국나스닥100 (133690)", "strategy": "저금리 환경에서 밸류에이션 매력이 높아지는 빅테크 중심 투자"},
          {"name": "ACE 미국S&P500 (360200)", "strategy": "시장 전반의 완만한 상승세에 투자하는 가장 안정적인 선택"},
          {"name": "KODEX 미국나스닥100선물(H) (304660)", "strategy": "환율 변동 위험 없이 지수 수익에 집중하는 환헤지형 기술주"}
        ],
        icon: 'memory' 
      },
      { 
        name: '장기 채권', 
        desc: '금리 하락에 따른 자본 차익을 극대화하는 장기 국채',
        products: [
          {"name": "KODEX 미국채울트라30년선물(H) (304660)", "strategy": "금리 하락 시 채권 가격 상승폭이 가장 큰 장기물 타겟"},
          {"name": "TIGER 미국채30년스트립액티브(합성H) (458730)", "strategy": "이표를 제거한 무이익채권을 활용하여 수익률 변동성 극대화"},
          {"name": "ACE 미국채30년액티브 (451240)", "strategy": "안정적인 미국 장기 국채에 직접 투자하는 대표 상품"}
        ],
        icon: 'account_balance' 
      },
      { 
        name: '리츠(부동산)', 
        desc: '금리 하락으로 조달 비용이 감소하는 수익형 부동산',
        products: [
          {"name": "TIGER 리츠부동산인프라 (329200)", "strategy": "조달 비용 감소로 인한 배당 수익률 및 자산 가치 상승"},
          {"name": "KODEX 미국부동산리츠(합성H) (225060)", "strategy": "전 세계 부동산 시장의 핵심인 미국 리츠에 투자"},
          {"name": "TIGER 미국MSCI리츠(합성H) (182480)", "strategy": "글로벌 상업용 부동산 투자의 정석적인 선택"}
        ],
        icon: 'apartment' 
      },
    ],
    down: [
      { 
        name: '은행/보험', 
        desc: '금리 하락으로 예대마진 및 운용 수익성이 약화되는 섹터',
        products: [
          {"name": "TIGER 은행 (091170)", "strategy": "예대금리차 축소로 인한 금융권의 수익성 악화 우려"},
          {"name": "KODEX 보험 (091180)", "strategy": "금리 하락으로 인한 신규 자금 운용 수익률 저하"}
        ],
        icon: 'account_balance_wallet' 
      }
    ],
  },
  {
    id: 'inflation',
    label: '인플레이션',
    icon: 'local_fire_department',
    color: '#f59e0b',
    bgGrad: 'from-amber-500/20 to-yellow-500/10',
    summary: '수요 폭발로 물건값이 오르고 화폐 가치가 떨어지면 실물 자산의 몸값이 오릅니다.',
    up: [
      { 
        name: '실물 자산(금)', 
        desc: '화폐 가치 하락에 대비하는 영원한 안전 자산',
        products: [
          {"name": "ACE KRX금현물 (411060)", "strategy": "화폐 가치 하락 시 실물 자산으로서의 가치 보존 수단 활용"},
          {"name": "TIGER 금은선물(H) (139310)", "strategy": "금과 함께 물가 상승기에 강세를 보이는 원자재 분산 투자"},
          {"name": "KODEX 골드선물(H) (132030)", "strategy": "장내 선물을 통해 비용 효율적으로 금에 투자"}
        ],
        icon: 'diamond' 
      },
      { 
        name: '원자재/에너지', 
        desc: '물가 상승을 직접적으로 견인하는 에너지 및 산업용 금속',
        products: [
          {"name": "TIGER 미국S&P500에너지 (414210)", "strategy": "에너지 가격 상승 수혜를 직접적으로 받는 글로벌 정유사 투자"},
          {"name": "KODEX 미국S&P500에너지 (414260)", "strategy": "엑손모빌, 쉐브론 등 글로벌 에너지 대기업 중심 포트폴리오"},
          {"name": "TIGER 구리선물 (160580)", "strategy": "실물 경기 회복과 인플레 상황에서 수요가 급증하는 구리 투자"}
        ],
        icon: 'local_gas_station' 
      },
      { 
        name: '고배당주', 
        desc: '물가 상승분을 이익에 반영할 수 있는 방어적 섹터',
        products: [
          {"name": "KODEX 고배당 (211900)", "strategy": "물가 상승기에도 견고한 이익을 바탕으로 고배당을 유지하는 기업"},
          {"name": "TIGER 미국배당다우존스 (451150)", "strategy": "미국의 우량 배당 성장주에 투자하여 안정적인 현금 흐름 확보"},
          {"name": "ARIRANG 고배당주 (161510)", "strategy": "국내 고배당 섹터인 금융, 통신주 중심의 분산 투자"}
        ],
        icon: 'payments' 
      },
    ],
    down: [
      { 
        name: '현금/장기채', 
        desc: '물가 상승으로 인해 구매력과 상대적 가치가 급락하는 자산',
        products: [
          {"name": "KODEX 국고채30년액티브 (403990)", "strategy": "물가 상승에 따른 시장 금리 급등 시 채권 가격 폭락 위험"},
          {"name": "TIGER 미국채30년선물 (305080)", "strategy": "인플레 장기화 시 장기 국채 가격 하락 압력 가중"},
          {"name": "KODEX 단기채권 (153130)", "strategy": "실질 금리 마이너스 구간에서 현금성 자산의 구매력 손실"}
        ],
        icon: 'money_off' 
      }
    ],
  },
  {
    id: 'rate_hike',
    label: '금리 인상',
    icon: 'trending_up',
    color: '#6366f1',
    bgGrad: 'from-indigo-500/20 to-violet-500/10',
    summary: '물가를 잡기 위해 금리를 올리고 돈줄을 조이면 현금성 자산을 쥐고 관망하는 것이 최선입니다.',
    up: [
      { 
        name: '대형 금융', 
        desc: '금리 상승에 따른 예대마진(NIM) 확대로 수익성이 직접 개선되는 섹터',
        products: [
          {"name": "KODEX 은행 (091170)", "strategy": "금리 상승에 따른 순이자마진 개선으로 수익성 직결"},
          {"name": "TIGER 금융지주 (145670)", "strategy": "우량 금융지주의 안정적인 이익 창출과 높은 배당 수익률"},
          {"name": "KODEX 보험 (091180)", "strategy": "금리 인상 시 자산 운용 수익률이 개선되어 실적 상승 기대"}
        ],
        icon: 'account_balance_wallet' 
      },
      { 
        name: '단기 채권/파킹', 
        desc: '변동성 리스크는 낮추고 오르는 시장 금리를 즉각 반영하는 현금성 자산',
        products: [
          {"name": "KODEX 1년국고채액티브 (395160)", "strategy": "금리 변동 리스크를 최소화하며 고금리 이자 수익 확보"},
          {"name": "TIGER KOFR금리액티브(합성) (430690)", "strategy": "매일 이자가 복리로 쌓이는 파킹형 투자의 정석"},
          {"name": "KODEX CD금리액티브(합성) (459580)", "strategy": "금리 상승기 CD금리 수준의 수익을 안정적으로 제공"}
        ],
        icon: 'payments' 
      },
      { 
        name: '가치주/배당주', 
        desc: '고금리 환경에서도 견고한 현금 흐름을 증명하는 저평가 우량주',
        products: [
          {"name": "KODEX 가치성장 (211900)", "strategy": "현금 흐름이 풍부하고 저평가된 우량 가치주 중심 전략"},
          {"name": "TIGER 미국배당프리미엄액티브 (445680)", "strategy": "커버드콜 전략으로 고금리 환경에서 인컴 수익 극대화"},
          {"name": "KBSTAR 고배당 (266550)", "strategy": "전통적인 고금리 수혜주인 고배당 종목 위주 포트폴리오"}
        ],
        icon: 'auto_graph' 
      },
    ],
    down: [
      { 
        name: '기술/성장주', 
        desc: '미래 이익에 대한 할인율 상승으로 주가 밸류에이션이 압박을 받는 섹터',
        products: [
          {"name": "TIGER 미국나스닥100 (133690)", "strategy": "자금 조달 비용 상승 및 미래 이익에 대한 할인율 부담"},
          {"name": "KODEX 미국FANG플러스(H) (314220)", "strategy": "유동성 축소 시 변동성이 커질 수 있는 기술주 집중 투자"},
          {"name": "SOL 미국테크TOP10 (451240)", "strategy": "금리에 민감한 대형 기술주 중심의 하락 압력 우려"}
        ],
        icon: 'memory' 
      }
    ],
  },
  {
    id: 'recession',
    label: '경기 침체',
    icon: 'ac_unit',
    color: '#3b82f6',
    bgGrad: 'from-blue-500/20 to-cyan-500/10',
    summary: '경제가 얼어붙어 주식시장 붕괴 우려가 있으므로 한시라도 빨리 발 뻗고 잘 수 있는 안전자산으로 피난합니다.',
    up: [
      { 
        name: '안전 자산(달러)', 
        desc: '전 세계적 위기 상황에서 가치가 상승하는 최후의 결제 수단',
        products: [
          {"name": "KODEX 미국달러선물 (261220)", "strategy": "글로벌 금융 시장 위기 시 수요가 몰리는 안전 자산"},
          {"name": "TIGER 미국달러단기채권액티브 (329750)", "strategy": "달러 가치 상승과 짧은 만기의 이자 수익 동시 확보"},
          {"name": "KODEX 미국달러선물레버리지 (261240)", "strategy": "급격한 경기 침체로 인한 달러 강세 가속화에 베팅"}
        ],
        icon: 'currency_exchange' 
      },
      { 
        name: '필수 소비재', 
        desc: '경기가 어려워도 반드시 소비해야 하는 음식료 및 기초 생활 용품',
        products: [
          {"name": "KODEX 필수소비재 (211210)", "strategy": "경기 변화와 관계없이 수요가 일정한 방어적 섹터"},
          {"name": "TIGER 필수소비재 (143860)", "strategy": "불황에도 매출 타격이 적은 국내 대표 소비재 기업"},
          {"name": "KODEX 배당성장 (139280)", "strategy": "안정적인 실적을 바탕으로 꾸준히 배당을 지급하는 전략"}
        ],
        icon: 'shopping_cart' 
      },
      { 
        name: '안전 채권', 
        desc: '위험 회피 심리와 시장 금리 하락 가능성에 배팅하는 국채 투자',
        products: [
          {"name": "TIGER 미국채10년선물 (305080)", "strategy": "안전 자산 선호 심리로 국채 가격 상승 수혜 기대"},
          {"name": "KODEX 국고채3년 (114820)", "strategy": "부도 위험이 없는 국고채를 통한 안정적인 자산 운용"},
          {"name": "ACE 미국채10년리트 (451240)", "strategy": "침체 시 금리 하락 가능성에 따른 자본 차익 추구"}
        ],
        icon: 'account_balance' 
      },
    ],
    down: [
      { 
        name: '경기 민감주', 
        desc: '소득 감소와 기업 실적 악화로 가장 먼저 타격을 입는 섹터',
        products: [
          {"name": "TIGER 현대차그룹+ (138540)", "strategy": "구매력 저하로 인한 자동차, 기계 등 고가 내구재 수요 급감 우려"},
          {"name": "KODEX 반도체 (091160)", "strategy": "글로벌 IT 경기 위축에 따른 업황 사이클 둔화 직격탄"},
          {"name": "TIGER 200철강커모디티 (139320)", "strategy": "산업 전반의 투자 위축으로 인한 원자재 수요 부진"}
        ],
        icon: 'directions_car' 
      }
    ],
  },
];

const INVESTMENT_DISCLAIMER = "본 정보는 시장 상황 분석에 따른 참고용 예시일 뿐, 특정 종목에 대한 투자 권고나 추천이 아닙니다. 모든 투자의 결과와 책임은 투자자 본인에게 귀속됩니다.";

// ============ Asset Details Modal ============
function AssetDetailsModal({ isOpen, onClose, asset, scenarioLabel, type, yieldDate }) {
  if (!isOpen || !asset) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div 
        className="bg-surface-container rounded-[2.5rem] w-full max-w-md border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-white/5 relative">
          <div className="flex items-center gap-3 mb-1.5">
             <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${type === 'up' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                <span className="material-symbols-outlined text-sm">{type === 'up' ? 'trending_up' : 'trending_down'}</span>
             </div>
             <span className="text-sm font-bold text-on-surface/90 uppercase tracking-tight">{scenarioLabel} 시나리오</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black font-headline text-on-surface mb-2">{asset.category || asset.name}</h2>
          {yieldDate && (
            <p className="text-[10px] md:text-xs text-primary font-bold bg-primary/10 px-3 py-1 rounded-full w-fit">
              최근 {yieldDate} 기준 수익률 TOP 3
            </p>
          )}
          <button onClick={onClose} className="absolute top-6 right-6 md:top-8 md:right-8 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-4">
          <p className="text-xs font-black text-on-surface-variant uppercase tracking-wider opacity-70">실제 상세 추천 종목 예시 (TOP 3)</p>
          
          {(asset.products || [asset]).map((p, idx) => (
            <div key={idx} className="p-4 md:p-5 rounded-2xl bg-surface-container-highest border border-primary/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12"></div>
              <div className="flex justify-between items-start mb-1 relative z-10">
                <h3 className="text-sm md:text-base font-extrabold text-primary flex-1">{p.name || p.product_name || asset.name}</h3>
              </div>
              <p className="text-[11px] md:text-xs text-on-surface-variant leading-relaxed relative z-10">
                {p.strategy || p.desc || "해당 시장 상황에서 유리한 성과를 기대할 수 있는 대표적인 상품입니다."}
              </p>
            </div>
          ))}

          <div className="bg-surface-container-low p-4 rounded-xl border border-white/5 mt-4">
            <p className="text-[10px] text-on-surface-variant/70 leading-relaxed text-center">
              알림: {INVESTMENT_DISCLAIMER}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 pt-0">
          <button 
            onClick={onClose}
            className="w-full py-3 md:py-4 bg-primary text-on-primary text-sm font-black rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
          >
            확인 하였습니다
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvestmentInsights({ subTab }) {
  const [selectedScenario, setSelectedScenario] = useState(INSIGHTS_DATA[0].id);
  const [marketData, setMarketData] = useState(null);
  const [mdLoading, setMdLoading] = useState(true);
  const [detailAsset, setDetailAsset] = useState(null); // { asset, type }
  const [whaleData, setWhaleData] = useState(null);
  const [selectedLegend, setSelectedLegend] = useState(null);
  const scenario = INSIGHTS_DATA.find(s => s.id === selectedScenario);

  useEffect(() => {
    fetchMarketInsights().then(d => {
      if (d) {
        setMarketData(d);
        const primaryScenario = d.scenario.split(',')[0];
        setSelectedScenario(primaryScenario);
      }
      setMdLoading(false);
    }).catch(() => setMdLoading(false));

    fetchWhaleInsights().then(data => {
      if (data) setWhaleData(data);
    }).catch(err => console.error("Whale data fetch error:", err));
  }, []);

  const getInvestorAvatar = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('buffett') || lower.includes('버핏')) return '/avatars/buffett.png';
    if (lower.includes('dalio') || lower.includes('달리오')) return '/avatars/dalio.png';
    if (lower.includes('burry') || lower.includes('버리')) return '/avatars/burry.png';
    if (lower.includes('ackman') || lower.includes('애크먼')) return '/avatars/ackman.png';
    if (lower.includes('griffin') || lower.includes('그리핀')) return '/avatars/griffin.png';
    if (lower.includes('wood') || lower.includes('우드')) return '/avatars/wood.png';
    return null;
  };

  const indicators = marketData ? [
    { 
      label: '한국 기준금리', 
      value: marketData.kr_rate != null ? `${marketData.kr_rate}%` : '-', 
      icon: 'flag', 
      prev: marketData.kr_rate_prev,
      desc: '국내 금리의 나침반입니다. 금리가 낮아지면 대출 부담이 줄고 시장에 돈이 풀리며 주가 상승의 원동력이 됩니다.'
    },
    { 
      label: '미국 기준금리', 
      value: marketData.us_rate != null ? `${marketData.us_rate}%` : '-', 
      icon: 'public', 
      prev: marketData.us_rate_prev,
      desc: '전 세계 돈의 흐름을 결정합니다. 미국 금리가 내리면 달러 가치가 안정되고 전 세계 주식 시장으로 자금이 유입됩니다.'
    },
    { 
      label: '미국 CPI (전년비)', 
      value: marketData.us_cpi != null ? `${marketData.us_cpi}%` : '-', 
      icon: 'shopping_cart',
      desc: '물가 성적표입니다. 물가가 안정(CPI 하락)되어야 중앙은행이 안심하고 금리를 내릴 수 있는 환경이 조성됩니다.'
    },
    { 
      label: '미국 GDP 성장률', 
      value: marketData.us_gdp != null ? `${marketData.us_gdp}%` : '-', 
      icon: 'bar_chart',
      desc: '경제 건강 상태입니다. 적당한 성장은 기업 실적에 좋지만, 과열되면 금리 인상 압박으로 이어질 수 있습니다.'
    },
  ] : [];

  const news = marketData?.news || [];

  if (subTab === 'dart') {
    return (
      <div className="py-6 md:py-12 animate-in fade-in slide-in-from-bottom-4">
        {/* Header & Guide */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-primary text-2xl" data-weight="fill">notifications_active</span>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tighter font-headline">고래 지분 변동</h1>
              <p className="text-on-surface-variant text-sm md:text-base">큰손들의 실시간 발자취를 추적합니다.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="p-5 rounded-3xl bg-surface-container-highest border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12 transition-all group-hover:bg-primary/10"></div>
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <span className="material-symbols-outlined text-sm text-primary">diversity_3</span>
                <p className="text-xs font-black text-on-surface uppercase tracking-tight">5% 룰: "큰손들의 중장기 베팅"</p>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed relative z-10">
                기관이나 자산가가 지분 <span className="text-primary font-bold">5% 이상</span>을 확보했다는 것은 단순 단타가 아닌 기업의 미래 가치에 크게 승부를 걸었다는 뜻입니다. 
                <span className="block mt-1 text-on-surface/60 italic">"전문가들이 분석하기에 지금 가격이 저렴하거나, 강력한 호재를 미리 포착했을 가능성이 높습니다."</span>
              </p>
            </div>
            <div className="p-5 rounded-3xl bg-surface-container-highest border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-tertiary/5 rounded-full blur-3xl -mr-12 -mt-12 transition-all group-hover:bg-tertiary/10"></div>
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <span className="material-symbols-outlined text-sm text-tertiary">person_search</span>
                <p className="text-xs font-black text-on-surface uppercase tracking-tight">내부자 거래: "가장 확실한 자신감"</p>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed relative z-10">
                회사의 <span className="text-tertiary font-bold">임원이나 주요주주</span>가 자기 돈으로 주식을 사는 것은 세상 그 어떤 리포트보다 강력한 상승 신호입니다. 
                <span className="block mt-1 text-on-surface/60 italic">"속사정을 가장 잘 아는 사람들이 주식을 산다면, 우리가 모르는 진짜 호재가 가까이 있을 확률이 큽니다."</span>
              </p>
            </div>
          </div>
        </div>

        {!whaleData ? (
          <div className="py-20 flex justify-center"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {whaleData.dart.map((item, i) => {
              const isInsider = item.report_nm.includes('임원') || item.report_nm.includes('주요주주');
              const isMajor = item.report_nm.includes('대량보유');
              
              return (
                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="bg-surface-container border border-white/5 rounded-2xl p-5 hover:bg-surface-container-high hover:border-primary/50 transition-all duration-300 group flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-on-surface-variant bg-white/5 px-2 py-0.5 rounded w-fit">
                          {item.date.slice(0,4)}.{item.date.slice(4,6)}.{item.date.slice(6,8)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isInsider ? (
                             <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary border border-tertiary/20">내부자</span>
                          ) : isMajor ? (
                             <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">5% 지분</span>
                          ) : (
                             <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/5 text-on-surface-variant border border-white/10">일반공시</span>
                          )}
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-primary/50 group-hover:text-primary transition-colors text-sm">open_in_new</span>
                    </div>
                    <h3 className="text-xl font-bold font-headline mb-1 text-on-surface group-hover:text-primary transition-colors line-clamp-1">{item.corp_name}</h3>
                    <p className="text-sm font-medium text-on-surface-variant mb-4 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-xs">person</span>
                      {item.filer}
                    </p>
                  </div>
                  <div className="text-[11px] text-on-surface/80 leading-relaxed p-3 bg-black/30 rounded-xl border border-white/5 line-clamp-2 mt-auto font-medium">
                    {item.report_nm}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (subTab === 'nps') {
    return (
      <div className="py-6 md:py-12 animate-in fade-in slide-in-from-bottom-4">
        <div className="mb-8 md:mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <span className="material-symbols-outlined text-blue-400 text-2xl" data-weight="fill">account_balance</span>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tighter font-headline">국민연금 주력주</h1>
              <p className="text-on-surface-variant text-sm md:text-base">대한민국 최대 고래, 국민연금이 선택한 핵심 우량주입니다.</p>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-surface-container-highest border border-white/5 relative overflow-hidden group mt-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-blue-500/10"></div>
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <span className="material-symbols-outlined text-sm text-blue-400">verified</span>
              <p className="text-xs font-black text-on-surface uppercase tracking-tight">국민연금의 선택: "장기 우량주의 공인인증서"</p>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed relative z-10">
              국민연금은 국민의 노후 자금을 굴리기 때문에 매우 보수적이고 신중하게 종목을 고릅니다. 
              <span className="text-blue-400 font-bold ml-1">"그들이 비중을 늘리는 종목은 기업의 펀더멘탈이 탄탄하고 장기 성장이 담보된 '국가대표급 우량주'라는 증거입니다."</span>
            </p>
          </div>
        </div>
        {!whaleData ? (
          <div className="py-20 flex justify-center"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 국내 주력주 컬럼 */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <span className="material-symbols-outlined text-blue-400 text-xl">flag</span>
                </div>
                <div>
                  <h2 className="text-xl font-black font-headline">국내 주력주</h2>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Domestic Top Holdings</p>
                </div>
              </div>
              <div className="space-y-3">
                {whaleData.nps.filter(item => item.type !== '해외').map((item, i) => (
                  <div key={i} className="bg-surface-container border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-blue-400/40 hover:bg-surface-container-high transition-all group shadow-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-base font-extrabold font-headline truncate group-hover:text-blue-400 transition-colors">{item.corp_name}</h3>
                        {item.ticker && <span className="text-[10px] text-on-surface-variant font-medium bg-white/5 px-1.5 py-0.5 rounded">#{item.ticker}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${item.trend === '비중확대' ? 'bg-red-500/10 text-red-400 border-red-500/20' : item.trend === '비중축소' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-white/5 text-on-surface-variant border-white/10'}`}>
                          {item.trend}
                        </span>
                        <p className="text-[11px] text-on-surface-variant truncate opacity-70 group-hover:opacity-100 transition-opacity">{item.reason}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 bg-black/20 px-3.5 py-2 rounded-xl border border-white/5 group-hover:border-blue-400/20 transition-colors">
                      <span className="text-[9px] font-bold text-on-surface-variant opacity-60 uppercase tracking-tighter">Ownership</span>
                      <span className="text-base font-black text-blue-400">{item.ownership_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 해외 주력주 컬럼 */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                  <span className="material-symbols-outlined text-purple-400 text-xl">public</span>
                </div>
                <div>
                  <h2 className="text-xl font-black font-headline">해외 주력주</h2>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Global Top Holdings</p>
                </div>
              </div>
              <div className="space-y-3">
                {whaleData.nps.filter(item => item.type === '해외').map((item, i) => (
                  <div key={i} className="bg-surface-container border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-purple-400/40 hover:bg-surface-container-high transition-all group shadow-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-base font-extrabold font-headline truncate group-hover:text-purple-400 transition-colors">{item.corp_name}</h3>
                        {item.ticker && <span className="text-[10px] text-on-surface-variant font-medium bg-white/5 px-1.5 py-0.5 rounded">#{item.ticker}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${item.trend === '비중확대' ? 'bg-red-500/10 text-red-400 border-red-500/20' : item.trend === '비중축소' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-white/5 text-on-surface-variant border-white/10'}`}>
                          {item.trend}
                        </span>
                        <p className="text-[11px] text-on-surface-variant truncate opacity-70 group-hover:opacity-100 transition-opacity">{item.reason}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 bg-black/20 px-3.5 py-2 rounded-xl border border-white/5 group-hover:border-purple-400/20 transition-colors">
                      <span className="text-[9px] font-bold text-on-surface-variant opacity-60 uppercase tracking-tighter">Ownership</span>
                      <span className="text-base font-black text-purple-400">{item.ownership_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (subTab === 'legends') {
    return (
      <div className="py-6 md:py-12 animate-in fade-in slide-in-from-bottom-4">
        {/* ... (existing header code) */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <span className="material-symbols-outlined text-purple-400 text-2xl" data-weight="fill">workspace_premium</span>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tighter font-headline">글로벌 투자 전설</h1>
              <p className="text-on-surface-variant text-sm md:text-base">워런 버핏, 레이 달리오 등 '거인'들의 포트폴리오 전략을 훔쳐보세요.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="p-5 rounded-3xl bg-surface-container-highest border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-3xl -mr-12 -mt-12 transition-all group-hover:bg-red-500/10"></div>
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <span className="material-symbols-outlined text-sm text-red-400">rocket_launch</span>
                <p className="text-xs font-black text-on-surface uppercase tracking-tight">신규매수/비중확대: "거인의 자신감"</p>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed relative z-10">
                대가들이 새 종목을 사거나 비중을 늘렸다면, 여전히 <span className="text-red-400 font-bold">주가 상승 여력</span>이 충분하다고 판단한 것입니다. 
                <span className="block mt-1 text-on-surface/60 italic">"거인이 발견한 새로운 금광이거나, 현재 가격이 여전히 저평가되어 있다는 강력한 신호입니다."</span>
              </p>
            </div>
            <div className="p-5 rounded-3xl bg-surface-container-highest border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-3xl -mr-12 -mt-12 transition-all group-hover:bg-blue-500/10"></div>
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <span className="material-symbols-outlined text-sm text-blue-400">shield_with_heart</span>
                <p className="text-xs font-black text-on-surface uppercase tracking-tight">비중축소/매도: "현명한 리스크 관리"</p>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed relative z-10">
                대가들의 매도는 단순히 나쁜 소식이 아니라, <span className="text-blue-400 font-bold">수익 실현</span>이나 포트폴리오 리스크를 관리하기 위한 전략입니다. 
                <span className="block mt-1 text-on-surface/60 italic">"기업 가치가 고점에 도달했거나, 다음 기회를 위해 실탄(현금)을 준비하고 있다는 뜻일 수 있습니다."</span>
              </p>
            </div>
          </div>
        </div>

        {!whaleData ? (
          <div className="py-20 flex justify-center"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {whaleData.legends.map((item, i) => {
              const avatar = getInvestorAvatar(item.investor);
              return (
                <div key={i} className="bg-surface-container border border-white/5 rounded-3xl p-6 hover:border-purple-400/30 transition-all flex flex-col justify-between relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="relative z-10">
                    <div 
                      className="flex items-center gap-3 mb-4 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedLegend(item)}
                    >
                      {avatar ? (
                        <img src={avatar} alt={item.investor} className="w-12 h-12 rounded-full border-2 border-purple-400/30 object-cover shadow-xl" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center border-2 border-purple-500/30">
                          <span className="material-symbols-outlined text-purple-400 text-2xl">person</span>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{item.investor}</p>
                        <h3 className="text-xl font-bold font-headline">{item.corp_name} <span className="text-xs text-on-surface-variant font-medium ml-1">({item.ticker})</span></h3>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-4">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        item.action.includes('매수') || item.action.includes('확대') 
                          ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {item.action}
                      </span>
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-2xl p-4 border border-white/5 relative z-10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">Portfolio Weight</span>
                      <span className="text-lg font-black text-on-surface">{item.portfolio_pct}%</span>
                    </div>
                    <p className="text-xs text-on-surface-variant/80 border-t border-white/5 pt-2 mt-2 leading-relaxed">{item.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend Detail Modal */}
        {selectedLegend && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-surface-container-highest border border-white/10 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="relative p-8 pb-4">
                <button 
                  onClick={() => setSelectedLegend(null)}
                  className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-on-surface text-xl">close</span>
                </button>

                <div className="flex flex-col items-center text-center mb-8">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full scale-150"></div>
                    {getInvestorAvatar(selectedLegend.investor) ? (
                      <img src={getInvestorAvatar(selectedLegend.investor)} alt="" className="w-24 h-24 rounded-full border-4 border-purple-400/30 shadow-2xl relative z-10" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center border-4 border-purple-500/30 relative z-10">
                        <span className="material-symbols-outlined text-purple-400 text-4xl">person</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-black text-purple-400 uppercase tracking-[0.3em] mb-1">{selectedLegend.investor}</p>
                  <h2 className="text-3xl font-black font-headline tracking-tight text-on-surface">Portfolio Insight</h2>
                </div>

                <div className="space-y-6">
                  {/* Recent Action */}
                  <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-sm text-red-400">trending_up</span>
                      <p className="text-[10px] font-black text-on-surface-variant uppercase">Recent Major Move</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-bold">{selectedLegend.corp_name} <span className="text-xs text-on-surface-variant">({selectedLegend.ticker})</span></h4>
                        <p className="text-xs text-on-surface-variant/80 mt-1">{selectedLegend.reason}</p>
                      </div>
                      <span className="bg-red-500/20 text-red-400 text-[10px] font-black px-3 py-1 rounded-full border border-red-500/20">
                        {selectedLegend.action}
                      </span>
                    </div>
                  </div>

                  {/* Top 5 Holdings */}
                  <div>
                    <div className="flex items-center gap-2 mb-4 px-2">
                      <span className="material-symbols-outlined text-sm text-purple-400">list_alt</span>
                      <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Top 5 Holdings (Current Assets)</p>
                    </div>
                    <div className="space-y-2">
                      {selectedLegend.top_holdings && selectedLegend.top_holdings.map((h, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-on-surface-variant border border-white/10">
                              {h.ticker}
                            </div>
                            <span className="text-sm font-bold text-on-surface">{h.name}</span>
                          </div>
                          <span className="text-sm font-black text-purple-400">{h.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 pt-4">
                <button 
                  onClick={() => setSelectedLegend(null)}
                  className="w-full py-4 bg-purple-500 text-white text-sm font-black rounded-2xl hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/20"
                >
                  확인 완료
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-6 md:py-12 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="mb-8 md:mb-12">
        <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tighter font-headline mb-2">투자 인사이트</h1>
        <p className="text-on-surface-variant text-sm md:text-base">거시경제 상황에 따른 자산 흐름을 한눈에 파악하세요.</p>
        {marketData?.updated_at && (
          <p className="text-[10px] text-on-surface-variant/40 mt-1">마지막 업데이트: {new Date(marketData.updated_at).toLocaleString('ko-KR')}</p>
        )}
      </div>

      {/* Indicator Cards */}
      {indicators.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          {indicators.map((ind, i) => {
            const diff = ind.prev != null && ind.value !== '-' ? (parseFloat(ind.value) - ind.prev) : null;
            return (
              <div key={i} className="bg-surface-container border border-white/5 rounded-2xl p-4 relative group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">{ind.icon}</span>
                    <span className="text-[10px] md:text-xs text-on-surface-variant font-medium truncate">{ind.label}</span>
                  </div>
                  <div className="relative flex items-center">
                    <span 
                      className="material-symbols-outlined text-[14px] text-on-surface-variant/30 cursor-help hover:text-primary transition-colors"
                      title={ind.desc}
                    >
                      info
                    </span>
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xl md:text-2xl font-extrabold font-headline leading-tight">{ind.value}</span>
                  {diff != null && diff !== 0 && (
                    <span className={`text-[10px] font-bold mb-0.5 ${diff > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                      {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(2)}%p
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Scenario Tabs */}
      <div className="flex gap-2 md:gap-3 overflow-x-auto pt-2 pb-4 mb-6 md:mb-8 scrollbar-hide">
        {INSIGHTS_DATA.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedScenario(s.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 md:px-5 md:py-3 rounded-2xl text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-300 border
              ${selectedScenario === s.id
                ? 'bg-white/10 border-white/20 text-on-surface shadow-lg scale-[1.02]'
                : 'bg-surface-container border-transparent text-on-surface-variant hover:bg-white/5 hover:border-white/10'
              }`}
            style={selectedScenario === s.id ? { borderColor: s.color + '60', boxShadow: `0 4px 20px ${s.color}15` } : {}}
          >
            <span className="material-symbols-outlined text-lg" style={selectedScenario === s.id ? { color: s.color } : {}}>{s.icon}</span>
            {s.label}
            {marketData?.scenario?.split(',').includes(s.id) && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-black text-white animate-pulse shadow-lg shadow-red-500/30">now</span>
            )}
          </button>
        ))}
      </div>


      {/* Scenario Content */}
      {scenario && (
        <div key={scenario.id} className="animate-[fadeIn_0.3s_ease-out]">
          {/* Summary Banner */}
          <div className={`bg-gradient-to-r ${scenario.bgGrad} rounded-3xl p-5 md:p-8 mb-8 border border-white/5`}>
            <div className="flex items-start gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: scenario.color + '20' }}>
                <span className="material-symbols-outlined text-2xl md:text-3xl" style={{ color: scenario.color }}>{scenario.icon}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="text-lg md:text-xl font-extrabold font-headline" style={{ color: scenario.color }}>{scenario.label}</h2>
                  {marketData?.scenario?.split(',').includes(scenario.id) && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">현재 상황</span>
                  )}
                </div>
                <p className="text-on-surface-variant text-sm md:text-base leading-relaxed">{scenario.summary}</p>
                {marketData?.scenario?.split(',').includes(scenario.id) && marketData?.analysis && (
                  <div className="mt-4 p-4 rounded-xl bg-surface-container/50 border border-white/5 backdrop-blur-sm">
                    <div className="flex items-start gap-2 text-xs md:text-sm text-on-surface leading-relaxed">
                      <span className="material-symbols-outlined text-sm md:text-base shrink-0 text-primary mt-0.5">verified</span>
                      <span className="opacity-90">{marketData.analysis}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Split View: UP & DOWN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* UP Card */}
            <div className="bg-surface-container border border-white/5 rounded-3xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg text-red-400">trending_up</span>
                </div>
                <h3 className="text-base md:text-lg font-extrabold font-headline text-red-400">상승 예상 자산</h3>
              </div>
              <div className="space-y-3">
                {(marketData?.all_scenarios_data?.[scenario.id]?.recommended?.length > 0 
                  ? marketData.all_scenarios_data[scenario.id].recommended 
                  : scenario.up
                ).map((asset, i) => {
                  const fallbackAsset = scenario.up.find(a => a.name === (asset.category || asset.name));
                  const icon = asset.icon || fallbackAsset?.icon || 'diamond';
                  
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 md:p-4 rounded-2xl bg-red-500/5 border border-red-500/10 hover:border-red-500/25 transition-all duration-200 group">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 transition-colors">
                        <span className="material-symbols-outlined text-red-400">{icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base font-bold text-on-surface">{asset.category || asset.name}</p>
                        <p className="text-[11px] md:text-xs text-on-surface-variant truncate mb-2">{asset.desc || asset.strategy}</p>
                        <button 
                          onClick={() => setDetailAsset({ asset, type: 'up' })}
                          className="px-3 py-1 bg-white/5 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg border border-red-500/20 transition-colors"
                        >
                          종목보기
                        </button>
                      </div>
                      <span className="material-symbols-outlined text-red-400 text-xl shrink-0">arrow_upward</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DOWN Card */}
            <div className="bg-surface-container border border-white/5 rounded-3xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg text-blue-400">trending_down</span>
                </div>
                <h3 className="text-base md:text-lg font-extrabold font-headline text-blue-400">하락 예상 자산</h3>
              </div>
              <div className="space-y-3">
                {(marketData?.all_scenarios_data?.[scenario.id]?.caution?.length > 0 
                  ? marketData.all_scenarios_data[scenario.id].caution 
                  : scenario.down
                ).map((asset, i) => {
                  const fallbackAsset = scenario.down.find(a => a.name === (asset.category || asset.name));
                  const icon = asset.icon || fallbackAsset?.icon || 'trending_down';

                  return (
                    <div key={i} className="flex items-center gap-3 p-3 md:p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/25 transition-all duration-200 group">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                        <span className="material-symbols-outlined text-blue-400">{icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base font-bold text-on-surface">{asset.category || asset.name}</p>
                        <p className="text-[11px] md:text-xs text-on-surface-variant truncate mb-2">{asset.desc || asset.strategy}</p>
                        <button 
                          onClick={() => setDetailAsset({ asset, type: 'down' })}
                          className="px-3 py-1 bg-white/5 hover:bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-lg border border-blue-500/20 transition-colors"
                        >
                          종목보기
                        </button>
                      </div>
                      <span className="material-symbols-outlined text-blue-400 text-xl shrink-0">arrow_downward</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Disclaimer */}
          <div className="mt-8 p-4 bg-surface-container border border-white/5 rounded-2xl">
            <p className="text-[10px] md:text-xs text-on-surface-variant/60 leading-relaxed text-center">
              참고: {INVESTMENT_DISCLAIMER}
            </p>
          </div>

          {/* News Section */}
          {news.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">newspaper</span>
                <h3 className="text-base md:text-lg font-extrabold font-headline">오늘의 경제 뉴스</h3>
              </div>
              <div className="space-y-3">
                {news.map((n, i) => (
                  <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                    className="block bg-surface-container border border-white/5 rounded-2xl p-4 hover:border-primary/20 transition-all group">
                    <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1 mb-1">{n.title}</h4>
                    <p className="text-[11px] md:text-xs text-on-surface-variant line-clamp-2">{n.description}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Asset Detail Modal */}
          <AssetDetailsModal 
            isOpen={!!detailAsset} 
            onClose={() => setDetailAsset(null)} 
            asset={detailAsset?.asset} 
            scenarioLabel={scenario.label}
            type={detailAsset?.type}
            yieldDate={marketData?.yield_date}
          />
        </div>
      )}
    </div>
  );
}
