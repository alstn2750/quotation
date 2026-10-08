export function totals(items, vat = true) {
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.quantity * item.price), 0);
  const tax = vat ? Math.round(subtotal * 0.1) : 0;
  return { subtotal, tax, total: subtotal + tax };
}

export function validateDocument(input) {
  const string = (value, max, fallback = '') => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
  if (!string(input.title, 150) || !string(input.client, 100)) throw new Error('프로젝트명과 고객사를 입력해주세요.');
  if (!['proposal', 'quote'].includes(input.type)) throw new Error('문서 종류가 올바르지 않습니다.');
  if (!['draft', 'review', 'won'].includes(input.status)) throw new Error('문서 상태가 올바르지 않습니다.');
  if (!Array.isArray(input.items) || input.items.length > 50) throw new Error('견적 항목은 최대 50개까지 가능합니다.');
  const items = input.items.map(item => {
    const quantity = Number(item.quantity), price = Number(item.price);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || !Number.isSafeInteger(price) || price < 0 || price > 1e10) throw new Error('수량은 0보다 커야 하며 단가는 0 이상의 정수여야 합니다.');
    const name = string(item.name, 200);
    if (!name) throw new Error('견적 항목명을 입력해주세요.');
    return { name, quantity, price };
  });
  if (totals(items).total > 1e14) throw new Error('견적 총액이 허용 범위를 초과했습니다.');
  const sections = (Array.isArray(input.sections) ? input.sections : []).slice(0, 12).map(s => ({ title: string(s.title, 100), content: string(s.content, 10000) }));
  const due = string(input.due, 10);
  if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(due)))) throw new Error('마감일이 올바르지 않습니다.');
  return { title: string(input.title, 150), client: string(input.client, 100), type: input.type, status: input.status, template: string(input.template, 40, 'branding'), brief: string(input.brief, 10000), due, vat: input.vat !== false, items, sections, notes: string(input.notes, 3000) };
}

export const templates = [
  { id: 'branding', name: '브랜드의 다음 챕터', category: '브랜딩 · 디자인', tag: '인기', color: 'peach', en: 'A new perspective.', description: '브랜드 전략부터 비주얼 아이덴티티까지', title: '브랜드 아이덴티티 리뉴얼', items: ['브랜드 리서치 및 전략 수립', '비주얼 아이덴티티 디자인', '브랜드 가이드라인 제작'], weights: [0.3, 0.5, 0.2] },
  { id: 'website', name: '경험을 바꾸는 웹사이트', category: '웹 · 앱 개발', tag: '', color: 'sage', en: 'Built for what’s next.', description: '목표와 범위가 명확한 디지털 프로젝트', title: '기업 웹사이트 구축', items: ['서비스 기획 및 UX 설계', 'UI 디자인 및 프론트엔드 개발', '백엔드 개발 및 품질 검증'], weights: [0.2, 0.4, 0.4] },
  { id: 'marketing', name: '성장을 만드는 캠페인', category: '마케팅 · 광고', tag: '', color: 'lavender', en: 'Make an impact.', description: '전략에서 실행까지, 성과 중심의 제안', title: '디지털 마케팅 캠페인', items: ['시장 분석 및 캠페인 전략', '크리에이티브 콘텐츠 제작', '캠페인 운영 및 리포팅'], weights: [0.25, 0.4, 0.35] },
  { id: 'consulting', name: '명확한 전략, 새로운 가능성', category: '컨설팅 · 기획', tag: 'NEW', color: 'sand', en: 'Clarity comes first.', description: '비즈니스의 문제를 실행 가능한 계획으로', title: '비즈니스 전략 컨설팅', items: ['현황 진단 및 이해관계자 인터뷰', '전략 수립 및 실행 로드맵', '최종 보고서 및 워크숍'], weights: [0.3, 0.45, 0.25] }
];

export function makeDraft(input) {
  const template = templates.find(t => t.id === input.template) || templates[0];
  const budget = input.budget === '' || input.budget == null ? 10000000 : Math.round(Number(input.budget));
  if (!Number.isFinite(budget) || budget < 0 || budget > 1e10) throw new Error('예산은 0원 이상 100억 원 이하로 입력해주세요.');
  const amounts = template.weights.map(w => Math.round(budget * w));
  amounts[amounts.length - 1] += budget - amounts.reduce((a,b) => a + b, 0);
  return validateDocument({
    title: input.title || template.title, client: input.client, template: template.id,
    type: input.type || 'proposal', status: 'draft', brief: input.brief || '', due: input.due || '', vat: true,
    sections: [
      { title: '프로젝트 개요', content: `${input.client}의 ${input.title || template.title} 프로젝트를 위한 제안입니다.\n\n${input.brief || '고객의 비즈니스 목표와 현재 과제를 확인하고, 실행 가능한 해결 방안을 함께 설계합니다.'}\n\n본 문서는 입력한 정보를 바탕으로 작성한 샘플 초안입니다. 세부 범위와 일정은 고객 협의 후 확정합니다.` },
      { title: '목표와 추진 방향', content: '01. 현황과 요구사항을 정리하여 프로젝트의 우선순위를 합의합니다.\n02. 단계별 결과물을 공유하고 피드백을 반영합니다.\n03. 합의한 기준에 따라 최종 결과물을 검수하고 전달합니다.' },
      { title: '업무 범위 및 산출물', content: template.items.map((item, i) => `${String(i + 1).padStart(2, '0')}. ${item}\n각 단계별 결과물과 검수 기준은 착수 미팅에서 구체화합니다.`).join('\n\n') },
      { title: '진행 일정', content: '1단계 · 킥오프 및 요구사항 정의\n2단계 · 기획안 제안 및 방향성 확정\n3단계 · 제작 및 중간 검토\n4단계 · 최종 검수 및 결과물 전달\n\n상세 일정은 업무 범위 확정 후 협의합니다.' }
    ],
    items: template.items.map((name, i) => ({ name, quantity: 1, price: amounts[i] })),
    notes: '본 견적의 유효기간은 발행일로부터 30일입니다.\n세부 범위, 수정 횟수 및 대금 지급 조건은 별도 협의합니다.'
  });
}
