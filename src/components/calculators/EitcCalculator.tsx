import { useState } from 'react';

// 근로장려금 예상 수령액 계산기 — 조세특례제한법 제100조의5 제1항 법정 산식 (2026-08-09 law.go.kr 원문 확인)
// 단독:  <400 → 총급여×165/400 | 400~900 → 165만 | 900~2200 → 165만−(총급여−900)×165/1300
// 홑벌이: <700 → ×285/700     | 700~1400 → 285만 | 1400~3200 → 285만−(총급여−1400)×285/1800
// 맞벌이: <800 → ×330/800     | 800~1700 → 330만 | 1700~4400 → 330만−(총급여−1700)×330/2700
// 같은 조 제4항: 재산 합계 1억 7천만원 이상이면 산정액의 50%.
// 같은 조 제5항: 실제 지급은 시행령 산정표 적용 — 이 결과는 법정 산식 기준 추정치다.

type HouseholdType = 'single' | 'oneEarner' | 'dualEarner';

const PARAMS: Record<
  HouseholdType,
  { label: string; phaseIn: number; flatEnd: number; cutoff: number; max: number }
> = {
  single: { label: '단독가구', phaseIn: 400, flatEnd: 900, cutoff: 2200, max: 165 },
  oneEarner: { label: '홑벌이가구', phaseIn: 700, flatEnd: 1400, cutoff: 3200, max: 285 },
  dualEarner: { label: '맞벌이가구', phaseIn: 800, flatEnd: 1700, cutoff: 4400, max: 330 },
};

/** 총급여액 등(만원) → 법정 산식 산정액(만원) */
function calcEitc(type: HouseholdType, income: number): number {
  const p = PARAMS[type];
  if (income < 0) return 0;
  if (income < p.phaseIn) return (income * p.max) / p.phaseIn;
  if (income < p.flatEnd) return p.max;
  if (income < p.cutoff) return p.max - ((income - p.flatEnd) * p.max) / (p.cutoff - p.flatEnd);
  return 0;
}

export const EitcCalculator = () => {
  const [type, setType] = useState<HouseholdType>('single');
  const [income, setIncome] = useState<number>(1200);
  const [highAsset, setHighAsset] = useState<boolean>(false);

  const p = PARAMS[type];
  const base = calcEitc(type, income);
  const result = highAsset ? base * 0.5 : base;
  const resultRounded = Math.floor(result * 10) / 10; // 만원 단위 소수 1자리 절사

  const zone =
    income >= p.cutoff
      ? '소득 상한 초과'
      : income >= p.flatEnd
        ? '점감 구간'
        : income >= p.phaseIn
          ? '최대 지급 구간'
          : '점증 구간';

  return (
    <div className="ec-board">
      <div className="ec-inputs">
        <fieldset className="ec-field ec-fieldset">
          <legend className="ec-label">가구 유형</legend>
          <div className="ec-type-row">
            {(Object.keys(PARAMS) as HouseholdType[]).map((k) => (
              <label key={k} className={`ec-type-btn ${type === k ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="eitc-household"
                  value={k}
                  checked={type === k}
                  onChange={() => setType(k)}
                  className="sr-only"
                />
                {PARAMS[k].label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="ec-field">
          <label className="ec-label" htmlFor="ec-income">
            연간 총급여액 등 (만원)
          </label>
          <div className="ec-income-row">
            <input
              id="ec-income"
              type="number"
              min={0}
              max={5000}
              step={10}
              value={income}
              onChange={(e) => setIncome(Math.max(0, Number(e.target.value)))}
            />
            <span className="ec-unit">만원</span>
          </div>
          <input
            type="range"
            min={0}
            max={p.cutoff}
            step={10}
            value={Math.min(income, p.cutoff)}
            onChange={(e) => setIncome(Number(e.target.value))}
            aria-label="연간 총급여액 슬라이더"
          />
        </div>

        <label className="ec-asset">
          <input
            type="checkbox"
            checked={highAsset}
            onChange={(e) => setHighAsset(e.target.checked)}
          />
          가구 재산 합계가 1억 7천만원 이상 (산정액의 50%만 지급)
        </label>
      </div>

      <div className="ec-result" role="status" aria-live="polite">
        <div className="ec-zone">
          {p.label} · {zone}
        </div>
        <div className="ec-amount">
          {result > 0 ? (
            <>
              약 <strong>{resultRounded.toLocaleString('ko-KR')}만원</strong>
            </>
          ) : (
            <strong>지급 대상 아님</strong>
          )}
        </div>
        <p className="ec-note">
          조세특례제한법 제100조의5 법정 산식 기준 추정치입니다. 실제 지급액은 시행령
          근로장려금산정표와 소득·재산 심사, 국세 체납 충당에 따라 달라질 수 있습니다.
        </p>
      </div>
    </div>
  );
};
