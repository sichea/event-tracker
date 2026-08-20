import React, { useState, useEffect, useMemo } from 'react';
import { uploadCardImage } from '../api';

// 초기 카드 데이터 (이미지 엑셀 100% 반영)
const INITIAL_CARDS = [
  // --- 신용카드 (Credit Cards) ---
  // 유지중 (Active)
  {
    id: 'c1',
    type: 'credit',
    cardCompany: '삼성',
    name: 'skt통신비',
    status: 'active',
    createdAt: '24.02.27',
    cancelledAt: '',
    rewardInfo: '21,000원(~26.02까지)',
    minSpend: '30만원',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c2',
    type: 'credit',
    cardCompany: '국민',
    name: '톡마포',
    status: 'active',
    createdAt: '23.12.18',
    cancelledAt: '',
    rewardInfo: '20만 사용시 / 1만원 적립 (적립율5%)',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c3',
    type: 'credit',
    cardCompany: '신한',
    name: '짭모아',
    status: 'active',
    createdAt: '23.05.02',
    cancelledAt: '',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c4',
    type: 'credit',
    cardCompany: '신한',
    name: 'kt통신비',
    status: 'active',
    createdAt: '25.10.10',
    cancelledAt: '',
    rewardInfo: '',
    minSpend: '30만원',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c5',
    type: 'credit',
    cardCompany: 'BC',
    name: '고트',
    status: 'active',
    createdAt: '24.05.13',
    cancelledAt: '',
    rewardInfo: '실적초기화 매 월 11일',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c6',
    type: 'credit',
    cardCompany: '하나',
    name: '카테크(제이드)',
    status: 'active',
    createdAt: '25.10.01',
    cancelledAt: '',
    rewardInfo: '갤러리 확인!',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c7',
    type: 'credit',
    cardCompany: '하나',
    name: 'mg+',
    status: 'active',
    createdAt: '25.10.15',
    cancelledAt: '',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c8',
    type: 'credit',
    cardCompany: '롯데',
    name: 'skt통신비/텔로se',
    status: 'active',
    createdAt: '26.07.21',
    cancelledAt: '',
    rewardInfo: '25,000원(~28.07까지)',
    minSpend: '40만원',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  // 탈퇴 (Cancelled)
  {
    id: 'c9',
    type: 'credit',
    cardCompany: '농협',
    name: '카테크(올바른FLEX)',
    status: 'cancelled',
    createdAt: '25.01.02',
    cancelledAt: '26.01.26',
    rewardInfo: '리워드 12만(1차: 10만 / 2차 5만) 25년12월 2차 리워드 확인 후 해지',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c10',
    type: 'credit',
    cardCompany: '우리',
    name: 'kt통신비(NU)',
    status: 'cancelled',
    createdAt: '23.05.01',
    cancelledAt: '25.11.14',
    rewardInfo: '26,000원(~25.05까지)',
    minSpend: '40만원',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c11',
    type: 'credit',
    cardCompany: 'bc im스카이패스',
    name: '이벤트',
    status: 'cancelled',
    createdAt: '24.11.08',
    cancelledAt: '25.09.29',
    rewardInfo: '15만원 사용시 9.5 캐시백',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c12',
    type: 'credit',
    cardCompany: '넥슨현대',
    name: '카테크',
    status: 'cancelled',
    createdAt: '23.12.16',
    cancelledAt: '25.04.07',
    rewardInfo: '25.3월 해지(1년 유지 후 해지/추가혜택 후 해지)',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c13',
    type: 'credit',
    cardCompany: '롯데',
    name: '카테크',
    status: 'cancelled',
    createdAt: '24.08.02',
    cancelledAt: '24.10.04',
    rewardInfo: '15만 캐시백+네페5만',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c14',
    type: 'credit',
    cardCompany: '삼성',
    name: '알뜰u+통신비',
    status: 'cancelled',
    createdAt: '',
    cancelledAt: '23.03.03',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c15',
    type: 'credit',
    cardCompany: '국민',
    name: '알뜰kt통신비',
    status: 'cancelled',
    createdAt: '',
    cancelledAt: '24.03.26',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c16',
    type: 'credit',
    cardCompany: 'IBK',
    name: '카테크(카픽)',
    status: 'cancelled',
    createdAt: '23.11.13',
    cancelledAt: '24.02.06',
    rewardInfo: '카페9만원, 신상3만원',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c17',
    type: 'credit',
    cardCompany: '현대',
    name: '카테크(부스터)',
    status: 'cancelled',
    createdAt: '23.11.29',
    cancelledAt: '24.02.01',
    rewardInfo: '15만원',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },
  {
    id: 'c18',
    type: 'credit',
    cardCompany: 'bc바로카드',
    name: '카테크(bc바로 클클)',
    status: 'cancelled',
    createdAt: '24.01.16',
    cancelledAt: '24.08.02',
    rewardInfo: '페이북머니12만원',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 12,
    images: []
  },

  // --- 체크카드 (Check Cards) ---
  // 유지중 (Active)
  {
    id: 'k1',
    type: 'check',
    cardCompany: '하나',
    name: '복지',
    status: 'active',
    createdAt: '',
    cancelledAt: '',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k2',
    type: 'check',
    cardCompany: '우체국',
    name: '넷플릭스할인',
    status: 'active',
    createdAt: '24.09.04',
    cancelledAt: '',
    rewardInfo: '넷플이용료(0.3%) 캐시백(최대 1만)',
    minSpend: '10만원',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k3',
    type: 'check',
    cardCompany: '미래에셋',
    name: '실사',
    status: 'active',
    createdAt: '24.09.24',
    cancelledAt: '',
    rewardInfo: '0.5캐시백(최대1만)',
    minSpend: '30만원',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k4',
    type: 'check',
    cardCompany: '케이뱅크',
    name: '실사',
    status: 'active',
    createdAt: '25.02.01',
    cancelledAt: '',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k5',
    type: 'check',
    cardCompany: '신한은행(나라사랑)',
    name: '실사',
    status: 'active',
    createdAt: '26.03.01',
    cancelledAt: '',
    rewardInfo: '월1회 올리브영 3000원 캐시백',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k6',
    type: 'check',
    cardCompany: '신한은행(트래블)',
    name: '실사',
    status: 'active',
    createdAt: '26.05.01',
    cancelledAt: '',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k7',
    type: 'check',
    cardCompany: '우리(트래블)',
    name: '실사',
    status: 'active',
    createdAt: '',
    cancelledAt: '',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k8',
    type: 'check',
    cardCompany: '신협',
    name: '실사',
    status: 'active',
    createdAt: '',
    cancelledAt: '',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  // 탈퇴 (Cancelled)
  {
    id: 'k9',
    type: 'check',
    cardCompany: '우리',
    name: '이벤트',
    status: 'cancelled',
    createdAt: '24.10.01',
    cancelledAt: '24.11.07',
    rewardInfo: 'cu 5,000(11월중순)',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k10',
    type: 'check',
    cardCompany: '하나',
    name: '실사',
    status: 'cancelled',
    createdAt: '',
    cancelledAt: '24.09.24',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k11',
    type: 'check',
    cardCompany: '010pay',
    name: '이벤트',
    status: 'cancelled',
    createdAt: '',
    cancelledAt: '24.09.24',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k12',
    type: 'check',
    cardCompany: '카뱅',
    name: '이벤트',
    status: 'cancelled',
    createdAt: '',
    cancelledAt: '23.11.30',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k13',
    type: 'check',
    cardCompany: '국민',
    name: '카테크(트래블)',
    status: 'cancelled',
    createdAt: '24.04.26',
    cancelledAt: '24.08.02',
    rewardInfo: '2만 캐시백',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  },
  {
    id: 'k14',
    type: 'check',
    cardCompany: '국민',
    name: '카테크',
    status: 'cancelled',
    createdAt: '',
    cancelledAt: '23.11.30',
    rewardInfo: '',
    minSpend: '',
    isSpendCompleted: false,
    coolPeriodMonths: 6,
    images: []
  }
];

// 카드사 브랜드 규격화
const getBaseCompany = (companyName) => {
  if (!companyName) return '기타';
  const name = companyName.trim();
  if (name.includes('삼성')) return '삼성';
  if (name.includes('국민')) return '국민';
  if (name.includes('신한')) return '신한';
  if (name.includes('하나')) return '하나';
  if (name.includes('우리')) return '우리';
  if (name.includes('롯데')) return '롯데';
  if (name.includes('현대')) return '현대';
  if (name.includes('농협')) return '농협';
  if (name.includes('BC') || name.includes('bc')) return 'BC';
  if (name.includes('IBK')) return 'IBK';
  if (name.includes('우체국')) return '우체국';
  if (name.includes('케이뱅크')) return '케이뱅크';
  if (name.includes('카뱅')) return '카카오뱅크';
  return name;
};

// 날짜 파싱 헬퍼 함수
const parseDateStr = (dateStr) => {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/경|\./g, '-').replace(/-+/g, '-').replace(/-$/, '').trim();
  const parts = cleaned.split('-');
  if (parts.length < 2) return null;

  let year = parseInt(parts[0], 10);
  if (year < 100) year += 2000;
  const month = parseInt(parts[1], 10) - 1;
  const day = parts[2] ? parseInt(parts[2], 10) : 1;

  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
};

// 재발급 가능 여부 계산
const calculateCoolDown = (cancelledAtStr, coolMonths = 12) => {
  const cancelDate = parseDateStr(cancelledAtStr);
  if (!cancelDate) return { isReady: false, daysLeft: null, targetDateStr: '-' };

  const targetDate = new Date(cancelDate);
  targetDate.setMonth(targetDate.getMonth() + coolMonths);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const targetDateStr = `${yyyy}.${mm}.${dd}`;

  if (diffDays <= 0) {
    return { isReady: true, daysLeft: 0, targetDateStr };
  } else {
    return { isReady: false, daysLeft: diffDays, targetDateStr };
  }
};

export default function CardTechTab({ userId }) {
  const storageKey = userId ? `cardtech_data_${userId}` : 'cardtech_data_guest';

  const [cards, setCards] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map(c => ({ ...c, images: c.images || [] }));
      } catch (e) {
        console.error('Failed to parse cardtech localstorage', e);
      }
    }
    return INITIAL_CARDS;
  });

  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'credit', 'check'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'cancelled', 'ready'
  const [searchTerm, setSearchTerm] = useState('');

  // 갤러리 팝업 모달 상태
  const [galleryModal, setGalleryModal] = useState({
    isOpen: false,
    images: [],
    currentIndex: 0,
    title: ''
  });

  // 카드 추가/수정 모달
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'credit',
    cardCompany: '',
    name: '',
    status: 'active',
    createdAt: '',
    cancelledAt: '',
    rewardInfo: '',
    minSpend: '',
    coolPeriodMonths: 12,
    images: []
  });

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(cards));
    }
  }, [cards, storageKey]);

  // [카드사 + 카드구분(신용/체크)] 독립 분리 혜택 자격 계산
  const companyEligibilityMap = useMemo(() => {
    const map = {};

    cards.forEach((c) => {
      const baseCompany = getBaseCompany(c.cardCompany);
      const cardType = c.type || 'credit';
      const key = `${baseCompany}_${cardType}`;

      if (!map[key]) {
        map[key] = {
          key,
          company: baseCompany,
          type: cardType,
          typeLabel: cardType === 'credit' ? '신용' : '체크',
          activeCount: 0,
          cancelledCards: [],
          latestCancelledAtStr: null,
          latestCancelledDate: null,
          coolMonths: c.coolPeriodMonths || (cardType === 'credit' ? 12 : 6)
        };
      }

      if (c.status === 'active') {
        map[key].activeCount += 1;
      } else {
        map[key].cancelledCards.push(c);
        const cDate = parseDateStr(c.cancelledAt);
        if (cDate) {
          if (!map[key].latestCancelledDate || cDate > map[key].latestCancelledDate) {
            map[key].latestCancelledDate = cDate;
            map[key].latestCancelledAtStr = c.cancelledAt;
          }
        }
      }
    });

    Object.keys(map).forEach((compKey) => {
      const item = map[compKey];
      if (item.activeCount > 0) {
        item.status = 'active_holding';
      } else if (item.latestCancelledAtStr) {
        const cool = calculateCoolDown(item.latestCancelledAtStr, item.coolMonths);
        if (cool.isReady) {
          item.status = 'ready';
          item.cool = cool;
        } else {
          item.status = 'cooling';
          item.cool = cool;
        }
      } else {
        item.status = 'unknown';
      }
    });

    return map;
  }, [cards]);

  // 특정 카드의 카드사 + 동일타입(신용/체크) 기준 신규 자격 정보 구하기
  const getCompanyEligibilityForCard = (card) => {
    const baseComp = getBaseCompany(card.cardCompany);
    const cardType = card.type || 'credit';
    const key = `${baseComp}_${cardType}`;
    const compData = companyEligibilityMap[key];

    if (!compData) return { isReady: false, label: '정보 없음' };

    if (card.status === 'active') {
      return { isReady: false, label: '보유중' };
    }

    if (compData.activeCount > 0) {
      return {
        isReady: false,
        label: `⚠️ 카드사 보유중`,
        subText: `${baseComp} ${cardType === 'credit' ? '신용' : '체크'}카드를 보유 중이라 신규 자격 미충족`
      };
    }

    if (compData.status === 'ready') {
      return { isReady: true, label: `✨ ${baseComp} 신규 가능!` };
    } else if (compData.status === 'cooling') {
      return {
        isReady: false,
        label: `D-${compData.cool?.daysLeft}일 (${compData.cool?.targetDateStr})`,
        subText: `${baseComp} ${cardType === 'credit' ? '신용' : '체크'} 탈퇴일: ${compData.latestCancelledAtStr}`
      };
    }

    return { isReady: false, label: '대기 중' };
  };

  // 데이터 리셋
  const handleResetData = () => {
    if (window.confirm('기본 카드 데이터로 초기화하시겠습니까?')) {
      setCards(INITIAL_CARDS);
    }
  };

  // 실적 달성 체크 toggle
  const toggleSpendCompleted = (id) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isSpendCompleted: !c.isSpendCompleted } : c))
    );
  };

  // 카드 해지/탈퇴 처리
  const handleCancelCard = (id) => {
    const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '.');
    const inputDate = window.prompt('탈퇴(해지) 일자를 입력하세요 (YY.MM.DD):', todayStr);
    if (inputDate !== null) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: 'cancelled',
                cancelledAt: inputDate.trim()
              }
            : c
        )
      );
    }
  };

  // 카드 재발급/복구 처리
  const handleReactivateCard = (id) => {
    if (window.confirm('이 카드를 다시 보유(유지 중) 상태로 변경하시겠습니까?')) {
      const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '.');
      setCards((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: 'active',
                createdAt: todayStr,
                cancelledAt: ''
              }
            : c
        )
      );
    }
  };

  // 📸 이미지 업로드 핸들러 (최대 2장 제한)
  const handleImageFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const currentImages = formData.images || [];
    if (currentImages.length >= 2) {
      alert('카드당 이미지는 최대 2장까지만 첨부할 수 있습니다.');
      return;
    }

    const availableSlots = 2 - currentImages.length;
    const uploadTargets = files.slice(0, availableSlots);

    setIsUploading(true);
    try {
      const uploadPromises = uploadTargets.map(file => uploadCardImage(userId || 'guest', file));
      const uploadedUrls = await Promise.all(uploadPromises);

      setFormData((prev) => ({
        ...prev,
        images: [...(prev.images || []), ...uploadedUrls].slice(0, 2)
      }));
    } catch (err) {
      console.error('Image upload error:', err);
      alert('이미지 업로드에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // 📸 이미지 삭제
  const handleRemoveImage = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, idx) => idx !== indexToRemove)
    }));
  };

  // 갤러리 확대 모달 열기
  const openGalleryModal = (images, initialIndex = 0, title = '이미지 미리보기') => {
    if (!images || images.length === 0) return;
    setGalleryModal({
      isOpen: true,
      images,
      currentIndex: initialIndex,
      title
    });
  };

  // 모달 열기 (신규/수정)
  const openModal = (card = null) => {
    if (card) {
      setEditingCard(card);
      setFormData({ ...card, images: card.images || [] });
    } else {
      setEditingCard(null);
      setFormData({
        type: 'credit',
        cardCompany: '',
        name: '',
        status: 'active',
        createdAt: '',
        cancelledAt: '',
        rewardInfo: '',
        minSpend: '',
        coolPeriodMonths: 12,
        images: []
      });
    }
    setIsModalOpen(true);
  };

  // 모달 저장
  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!formData.cardCompany.trim()) {
      alert('카드사를 입력해 주세요.');
      return;
    }

    if (editingCard) {
      setCards((prev) =>
        prev.map((c) => (c.id === editingCard.id ? { ...formData, id: editingCard.id } : c))
      );
    } else {
      const newId = 'card_' + Date.now();
      setCards((prev) => [...prev, { ...formData, id: newId, isSpendCompleted: false }]);
    }
    setIsModalOpen(false);
  };

  // 카드 삭제
  const handleDeleteCard = (id) => {
    if (window.confirm('이 카드를 삭제하시겠습니까?')) {
      setCards((prev) => prev.filter((c) => c.id !== id));
    }
  };

  // 필터링 계산
  const filteredCards = cards.filter((card) => {
    if (typeFilter !== 'all' && card.type !== typeFilter) return false;
    if (statusFilter === 'active' && card.status !== 'active') return false;
    if (statusFilter === 'cancelled' && card.status !== 'cancelled') return false;
    if (statusFilter === 'ready') {
      if (card.status !== 'cancelled') return false;
      const el = getCompanyEligibilityForCard(card);
      if (!el.isReady) return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchCompany = card.cardCompany.toLowerCase().includes(term);
      const matchName = card.name.toLowerCase().includes(term);
      const matchReward = (card.rewardInfo || '').toLowerCase().includes(term);
      if (!matchCompany && !matchName && !matchReward) return false;
    }

    return true;
  });

  // 요약 카운터
  const companyReadyList = Object.values(companyEligibilityMap).filter((item) => item.status === 'ready');
  const companyHoldingCount = Object.values(companyEligibilityMap).filter((item) => item.status === 'active_holding').length;
  const companyCoolingCount = Object.values(companyEligibilityMap).filter((item) => item.status === 'cooling').length;

  return (
    <div className="space-y-3 pb-12">
      {/* 슬림 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-md border border-slate-800">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-1.5 whitespace-nowrap">
            <span className="material-symbols-outlined text-emerald-400 text-lg sm:text-xl">credit_card</span>
            카테크 관리
          </h2>

          {/* 요약 칩 */}
          <div className="flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap">
            <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
              🟢 이용중 {companyHoldingCount}
            </span>
            <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
              ✨ 신규 {companyReadyList.length}
            </span>
            <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
              🔴 쿨다운 {companyCoolingCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto whitespace-nowrap">
          <button
            onClick={() => openModal()}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition-all flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            카드 추가
          </button>
          <button
            onClick={handleResetData}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium transition-all"
            title="기본 카드 데이터로 리셋"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 카드사별 현황 */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-2.5 border border-slate-200 dark:border-slate-700/80">
        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-emerald-500">domain</span>
            <span>카드사별 현황:</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          {Object.values(companyEligibilityMap)
            .filter((comp) => typeFilter === 'all' || comp.type === typeFilter)
            .map((comp) => {
              const typeSuffix = typeFilter === 'all' ? `(${comp.typeLabel})` : '';

              return (
                <div
                  key={comp.key}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 ${
                    comp.status === 'ready'
                      ? 'bg-blue-500 text-white border-blue-600 shadow-sm animate-pulse'
                      : comp.status === 'active_holding'
                      ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <span>{comp.company}{typeSuffix}</span>
                  {comp.status === 'ready' ? (
                    <span className="text-[10px]">✨ 신규!</span>
                  ) : comp.status === 'active_holding' ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                      🟢 {comp.activeCount}개
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono">
                      D-{comp.cool?.daysLeft}일
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* 필터 및 검색바 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 sm:p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 타입 선택 */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
            {['all', 'credit', 'check'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                  typeFilter === t
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t === 'all' ? '전체' : t === 'credit' ? '신용' : '체크'}
              </button>
            ))}
          </div>

          {/* 상태 선택 */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
            {[
              { key: 'all', label: '전체' },
              { key: 'active', label: '🟢유지' },
              { key: 'cancelled', label: '🔴탈퇴' },
              { key: 'ready', label: `✨신규가능(${companyReadyList.length})` }
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                  statusFilter === s.key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 검색 */}
        <div className="relative w-full sm:w-44">
          <input
            type="text"
            placeholder="카드사/이름/혜택 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white text-xs"
          />
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
            search
          </span>
        </div>
      </div>

      {/* 📱 1. 모바일 뷰 */}
      <div className="block sm:hidden space-y-2">
        {filteredCards.map((card) => {
          const isActive = card.status === 'active';
          const companyEl = getCompanyEligibilityForCard(card);
          const hasImages = card.images && card.images.length > 0;

          return (
            <div
              key={card.id}
              className={`p-3 rounded-2xl border text-xs flex flex-col gap-2 transition-all ${
                isActive
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                  : companyEl.isReady
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 shadow-sm'
                  : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                      card.type === 'credit'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-teal-600 text-white'
                    }`}
                  >
                    {card.type === 'credit' ? '신용' : '체크'}
                  </span>
                  <span className="text-sm font-black tracking-tight whitespace-nowrap">{card.cardCompany}</span>
                  <span className="text-slate-600 dark:text-slate-300 text-xs font-semibold whitespace-nowrap">
                    {card.name ? `(${card.name})` : ''}
                  </span>
                </div>

                {isActive ? (
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 whitespace-nowrap">
                    보유중
                  </span>
                ) : companyEl.isReady ? (
                  <span className="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full shadow-sm animate-pulse whitespace-nowrap">
                    ✨ 신규 가능!
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full font-mono whitespace-nowrap">
                    {companyEl.label}
                  </span>
                )}
              </div>

              {/* 혜택 메모 & 첨부 이미지 썸네일 */}
              {(card.rewardInfo || hasImages) && (
                <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70 p-2 rounded-xl border border-slate-100 dark:border-slate-800 font-medium space-y-1.5">
                  {card.rewardInfo && <div>🎁 {card.rewardInfo}</div>}

                  {hasImages && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                      <span className="text-[10px] text-slate-400 font-semibold mr-1">📸 이미지:</span>
                      {card.images.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          onClick={() => openGalleryModal(card.images, idx, `${card.cardCompany} ${card.name || ''}`)}
                          className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 hover:scale-105 transition-transform"
                        >
                          <img src={imgUrl} alt={`첨부이미지 ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                {isActive ? (
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={!!card.isSpendCompleted}
                      onChange={() => toggleSpendCompleted(card.id)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span className={card.isSpendCompleted ? 'line-through text-slate-400' : ''}>
                      실적 완료 {card.minSpend ? `(${card.minSpend})` : ''}
                    </span>
                  </label>
                ) : (
                  <span className="text-slate-500 font-mono text-[10px] whitespace-nowrap">
                    {card.cancelledAt ? `탈퇴: ${card.cancelledAt}` : ''}
                  </span>
                )}

                <div className="flex items-center gap-1 whitespace-nowrap">
                  {isActive ? (
                    <button
                      onClick={() => handleCancelCard(card.id)}
                      className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded text-[11px]"
                    >
                      탈퇴
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivateCard(card.id)}
                      className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[11px]"
                    >
                      재발급
                    </button>
                  )}
                  <button
                    onClick={() => openModal(card)}
                    className="p-1 text-slate-400 hover:text-slate-700"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 💻 2. 데스크탑 뷰 */}
      <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[780px]">
          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
            <tr>
              <th className="py-2.5 px-3 text-center whitespace-nowrap w-16">구분</th>
              <th className="py-2.5 px-3 whitespace-nowrap min-w-[80px]">카드사</th>
              <th className="py-2.5 px-3 whitespace-nowrap min-w-[120px]">용도 (카드명)</th>
              <th className="py-2.5 px-3 whitespace-nowrap min-w-[140px]">신규자격 / 대기</th>
              <th className="py-2.5 px-3 whitespace-nowrap min-w-[120px]">만든날 / 탈퇴일</th>
              <th className="py-2.5 px-3 whitespace-nowrap min-w-[160px]">받은 혜택 · 메모</th>
              <th className="py-2.5 px-3 text-center whitespace-nowrap w-24">전월 실적</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap w-24">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {filteredCards.map((card) => {
              const isActive = card.status === 'active';
              const companyEl = getCompanyEligibilityForCard(card);
              const hasImages = card.images && card.images.length > 0;

              return (
                <tr
                  key={card.id}
                  className={`transition-colors ${
                    isActive
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/70'
                      : companyEl.isReady
                      ? 'bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100/60'
                      : 'bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-50/60'
                  }`}
                >
                  {/* 구분 (신용/체크) */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                        card.type === 'credit'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300'
                      }`}
                    >
                      {card.type === 'credit' ? '신용' : '체크'}
                    </span>
                  </td>

                  {/* 카드사 */}
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {card.cardCompany}
                  </td>

                  {/* 용도 (카드명) */}
                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {card.name || '-'}
                  </td>

                  {/* 신규자격 / 대기 */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        보유중
                      </span>
                    ) : companyEl.isReady ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white font-bold text-[10px] animate-pulse whitespace-nowrap">
                        ✨ 신규 가능!
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap" title={companyEl.subText}>
                        {companyEl.label}
                      </span>
                    )}
                  </td>

                  {/* 만든날 / 탈퇴일 */}
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    {isActive ? (
                      <span>{card.createdAt || '-'}</span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">
                        {card.cancelledAt ? `탈퇴: ${card.cancelledAt}` : '-'}
                      </span>
                    )}
                  </td>

                  {/* 혜택 및 메모 + 📸 썸네일 */}
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-xs whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="truncate" title={card.rewardInfo}>{card.rewardInfo || '-'}</span>
                      {hasImages && (
                        <div className="flex items-center gap-1 shrink-0">
                          {card.images.map((imgUrl, idx) => (
                            <button
                              key={idx}
                              onClick={() => openGalleryModal(card.images, idx, `${card.cardCompany} ${card.name || ''}`)}
                              className="w-6 h-6 rounded overflow-hidden border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform shadow-xs"
                              title="이미지 보기"
                            >
                              <img src={imgUrl} alt="첨부 썸네일" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 전월 실적 */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {isActive ? (
                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={!!card.isSpendCompleted}
                          onChange={() => toggleSpendCompleted(card.id)}
                          className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                        />
                        <span className={card.minSpend ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-400'}>
                          {card.minSpend || '실적없음'}
                        </span>
                      </label>
                    ) : (
                      <span className="text-slate-400 text-[11px]">-</span>
                    )}
                  </td>

                  {/* 관리 버튼 */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      {isActive ? (
                        <button
                          onClick={() => handleCancelCard(card.id)}
                          className="px-2 py-0.5 text-[11px] font-semibold rounded bg-rose-100 text-rose-700 hover:bg-rose-200 transition-all"
                          title="카드 탈퇴 처리"
                        >
                          탈퇴
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivateCard(card.id)}
                          className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-all"
                          title="재발급 등록"
                        >
                          재발급
                        </button>
                      )}
                      <button
                        onClick={() => openModal(card)}
                        className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="수정"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="p-0.5 text-slate-400 hover:text-rose-500"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 카드 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-sm shadow-xl border border-slate-200 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              {editingCard ? '카드 수정' : '신규 카드 추가'}
            </h3>

            <form onSubmit={handleSaveModal} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">종류</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                  >
                    <option value="credit">신용카드</option>
                    <option value="check">체크카드</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">상태</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                  >
                    <option value="active">보유/유지 (초록)</option>
                    <option value="cancelled">탈퇴 (빨강)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">카드사 *</label>
                  <input
                    type="text"
                    required
                    placeholder="삼성, 국민, 신한 등"
                    value={formData.cardCompany}
                    onChange={(e) => setFormData({ ...formData, cardCompany: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">용도(이름)</label>
                  <input
                    type="text"
                    placeholder="skt통신비, 톡마포 등"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">만든날짜</label>
                  <input
                    type="text"
                    placeholder="24.02.27"
                    value={formData.createdAt}
                    onChange={(e) => setFormData({ ...formData, createdAt: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">탈퇴일</label>
                  <input
                    type="text"
                    placeholder="25.01.26"
                    value={formData.cancelledAt}
                    onChange={(e) => setFormData({ ...formData, cancelledAt: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">전월 실적</label>
                  <input
                    type="text"
                    placeholder="30만원"
                    value={formData.minSpend}
                    onChange={(e) => setFormData({ ...formData, minSpend: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">쿨다운 주기</label>
                  <select
                    value={formData.coolPeriodMonths}
                    onChange={(e) => setFormData({ ...formData, coolPeriodMonths: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                  >
                    <option value={12}>12개월 (1년)</option>
                    <option value={6}>6개월</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">혜택 · 메모</label>
                <input
                  type="text"
                  placeholder="리워드 15만원 캐시백 등"
                  value={formData.rewardInfo}
                  onChange={(e) => setFormData({ ...formData, rewardInfo: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                />
              </div>

              {/* 📸 이미지 첨부 (최대 2장) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-500">
                    혜택/이벤트 캡처 이미지 (최대 2장)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {(formData.images || []).length}/2장
                  </span>
                </div>

                {/* 이미지 미리보기 썸네일 & 삭제 */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {(formData.images || []).map((imgUrl, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 group">
                      <img src={imgUrl} alt={`미리보기 ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full p-0.5 shadow hover:bg-rose-700"
                        title="이미지 삭제"
                      >
                        <span className="material-symbols-outlined text-xs block">close</span>
                      </button>
                    </div>
                  ))}

                  {/* 파일 추가 버튼 */}
                  {(formData.images || []).length < 2 && (
                    <label className={`w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <span className="material-symbols-outlined text-slate-400 text-lg">add_a_photo</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">
                        {isUploading ? '업로드...' : '사진 추가'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageFileChange}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-sm disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🖼️ 전면 갤러리 팝업 모달 */}
      {galleryModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
            {/* 헤더 */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">photo_library</span>
                {galleryModal.title} ({galleryModal.currentIndex + 1}/{galleryModal.images.length})
              </h4>
              <button
                onClick={() => setGalleryModal({ ...galleryModal, isOpen: false })}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* 이미지 보기 메인 */}
            <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[70vh] p-2">
              <img
                src={galleryModal.images[galleryModal.currentIndex]}
                alt="확대 이미지"
                className="max-h-[68vh] w-auto object-contain rounded-lg"
              />

              {/* 이전/다음 버튼 (이미지가 2장일 때) */}
              {galleryModal.images.length > 1 && (
                <>
                  <button
                    onClick={() => setGalleryModal(prev => ({
                      ...prev,
                      currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length
                    }))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/70 text-white hover:bg-slate-800 transition-all border border-slate-700"
                  >
                    <span className="material-symbols-outlined text-xl block">chevron_left</span>
                  </button>

                  <button
                    onClick={() => setGalleryModal(prev => ({
                      ...prev,
                      currentIndex: (prev.currentIndex + 1) % prev.images.length
                    }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/70 text-white hover:bg-slate-800 transition-all border border-slate-700"
                  >
                    <span className="material-symbols-outlined text-xl block">chevron_right</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
