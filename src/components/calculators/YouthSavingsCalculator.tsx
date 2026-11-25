import { useState } from 'react';

// 청년미래적금 3년 만기 수령액 모의계산기
// 근거: 금융위원회·서민금융진흥원 2026년 상품 안내 기준
//   - 만기: 36개월(3년), 월 납입 한도 50만원 (총 원금 최대 1,800만원)
//   - 정부기여금: 일반형 6%(최대 108만원) / 우대형 12%(최대 216만원) / 비과세 전용(총급여 6,000만~7,500만) 0%
//   - 금리: 14개 취급 은행 기본 연 5.0%, 우대 포함 최고 연 7.0~8.0% (이자소득 비과세)
//   - 금융위 예시 검산: 월 50만원 · 연 7.0% → 일반형 약 2,110만원 / 우대형 약 2,227만원

type PlanType = 'general' | 'preferred' | 'taxfreeOnly';

const PLAN_META: Record<PlanType, { label: string; sub: string; matchRate: number }> = {
  general: {
    label: '일반형 (기여금 6%)',
    sub: '총급여 6,000만원 이하 · 중위소득 200% 이하',
    matchRate: 0.06,
  },
  preferred: {
    label: '우대형 (기여금 12%)',
    sub: '중소기업 재직·신규취업자 · 연매출 1억 이하 소상공인',
    matchRate: 0.12,
  },
  taxfreeOnly: {
    label: '비과세 전용 (0%)',
    sub: '총급여 6,000만원 초과 ~ 7,500만원 이하',
    matchRate: 0,
  },
};

const MONTHS = 36;

export const YouthSavingsCalculator = () => {
  const [plan, setPlan] = useState<PlanType>('general');
  const [monthly, setMonthly] = useState<number>(50);
  const [rate, setRate] = useState<number>(7.0);

  const meta = PLAN_META[plan];
  const principal = monthly * 10000 * MONTHS;
  // 정액 적립식 단리 이자: 월납입액 × (n(n+1)/2) × (연이율 / 12)
  const selfInterest = Math.round(
    monthly * 10000 * ((MONTHS * (MONTHS + 1)) / 2) * (rate / 100 / 12),
  );
  const govContribution = Math.round(principal * meta.matchRate);
  // 기여금에 붙는 기본금리(5%) 단리 이자 근사치 (매월 납입 연동 가정)
  const govInterest = Math.round(
    monthly * 10000 * meta.matchRate * ((MONTHS * (MONTHS + 1)) / 2) * (0.05 / 12),
  );
  const total = principal + selfInterest + govContribution + govInterest;
  const totalProfit = total - principal;

  return (
    <div className="ec-board">
      <div className="ec-inputs">
        <fieldset className="ec-field ec-fieldset">
          <legend className="ec-label">가입 유형</legend>
          <div className="ec-type-row">
            {(Object.keys(PLAN_META) as PlanType[]).map((k) => (
              <label key={k} className={`ec-type-btn ${plan === k ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="ys-plan"
                  value={k}
                  checked={plan === k}
                  onChange={() => setPlan(k)}
                  className="sr-only"
                />
                {PLAN_META[k].label}
              </label>
            ))}
          </div>
          <p className="ec-subhint">{meta.sub}</p>
        </fieldset>

        <div className="ec-field">
          <label className="ec-label" htmlFor="ys-monthly">
            월 납입 금액 (1만 ~ 50만원)
          </label>
          <div className="ec-income-row">
            <input
              id="ys-monthly"
              type="number"
              min={1}
              max={50}
              step={5}
              value={monthly}
              onChange={(e) => setMonthly(Math.min(50, Math.max(1, Number(e.target.value))))}
            />
            <span className="ec-unit">만원</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))}
            aria-label="월 납입 금액 슬라이더"
          />
        </div>

        <div className="ec-field">
          <label className="ec-label" htmlFor="ys-rate">
            예상 적용 금리 (기본 5% ~ 우대 최고 8%)
          </label>
          <div className="ec-income-row">
            <input
              id="ys-rate"
              type="number"
              min={5}
              max={8}
              step={0.5}
              value={rate}
              onChange={(e) => setRate(Math.min(8, Math.max(5, Number(e.target.value))))}
            />
            <span className="ec-unit">%</span>
          </div>
          <input
            type="range"
            min={5}
            max={8}
            step={0.5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            aria-label="예상 적용 금리 슬라이더"
          />
        </div>
      </div>

      <div className="ec-result" role="status" aria-live="polite">
        <div className="ec-zone">
          3년(36개월) 만기 · {meta.label} · 연 {rate.toFixed(1)}%
        </div>
        <div className="ec-amount">
          약 <strong>{Math.round(total / 10000).toLocaleString('ko-KR')}만원</strong>
        </div>
        <dl className="ec-breakdown">
          <div>
            <dt>내 납입 원금</dt>
            <dd>{Math.round(principal / 10000).toLocaleString('ko-KR')}만원</dd>
          </div>
          <div>
            <dt>정부 기여금</dt>
            <dd>{Math.round(govContribution / 10000).toLocaleString('ko-KR')}만원</dd>
          </div>
          <div>
            <dt>비과세 이자 합계</dt>
            <dd>
              약 {Math.round((selfInterest + govInterest) / 10000).toLocaleString('ko-KR')}만원
            </dd>
          </div>
          <div>
            <dt>원금 대비 순수익</dt>
            <dd>+약 {Math.round(totalProfit / 10000).toLocaleString('ko-KR')}만원</dd>
          </div>
        </dl>
        <p className="ec-note">
          매월 일정 금액을 36개월 납입한 비과세 만기 기준 추정치입니다. 중도해지 시 특별중도해지
          사유가 아니면 정부기여금과 비과세 혜택이 제외됩니다.
        </p>
      </div>
    </div>
  );
};
