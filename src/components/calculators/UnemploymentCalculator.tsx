import { useState } from 'react';
import '@/styles/calculators.css';

// 2026·2027년 구직급여(실업급여) 모의계산기 — 고용보험법 제45조·제46조·제50조 기준
// 2026년: 1일 상한액 68,100원 / 1일 하한액(8시간) 66,048원 (최저임금 10,320원 × 80% × 8시간)
// 2027년: 1일 하한액(8시간) 68,480원 확정 (고용노동부고시 제2026-60호, 최저임금 10,700원 × 80% × 8시간)
//         1일 상한액은 하한액 103% 연동 개편 추진안(약 70,534원) 기준 추정치
// 소정급여일수(고용보험법 별표1):
//   50세 미만:         <1년 120일 | 1~3년 150일 | 3~5년 180일 | 5~10년 210일 | 10년+ 240일
//   50세 이상·장애인:  <1년 120일 | 1~3년 180일 | 3~5년 210일 | 5~10년 240일 | 10년+ 270일

type RetireYear = '2027' | '2026';
type AgeGroup = 'under50' | 'over50';
type TenureKey = 'lt1' | '1to3' | '3to5' | '5to10' | 'ge10';

const TENURE_OPTIONS: Array<{ key: TenureKey; label: string; under50: number; over50: number }> = [
  { key: 'lt1', label: '1년 미만 (180일 이상)', under50: 120, over50: 120 },
  { key: '1to3', label: '1년 이상 ~ 3년 미만', under50: 150, over50: 180 },
  { key: '3to5', label: '3년 이상 ~ 5년 미만', under50: 180, over50: 210 },
  { key: '5to10', label: '5년 이상 ~ 10년 미만', under50: 210, over50: 240 },
  { key: 'ge10', label: '10년 이상', under50: 240, over50: 270 },
];

const YEAR_RATES: Record<RetireYear, { cap: number; floor8h: number }> = {
  '2026': { cap: 68100, floor8h: 66048 },
  '2027': { cap: 70534, floor8h: 68480 },
};

export const UnemploymentCalculator = () => {
  const [retireYear, setRetireYear] = useState<RetireYear>('2027');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('under50');
  const [tenure, setTenure] = useState<TenureKey>('3to5');
  const [monthlyWage, setMonthlyWage] = useState<number>(350);
  const [dailyHours, setDailyHours] = useState<number>(8);

  const { cap: dailyCap, floor8h } = YEAR_RATES[retireYear];

  const tenureInfo = TENURE_OPTIONS.find((t) => t.key === tenure) ?? {
    key: '3to5',
    label: '3년 이상 ~ 5년 미만',
    under50: 180,
    over50: 210,
  };
  const days = ageGroup === 'over50' ? tenureInfo.over50 : tenureInfo.under50;

  // 1일 평균임금 추정 = 세전 월급 × 3개월 ÷ 91일
  const avgDailyWage = Math.round((monthlyWage * 10000 * 3) / 91);
  const rawDaily = Math.round(avgDailyWage * 0.6);
  // 1일 소정근로시간 비례 하한액 (4시간 이하는 4시간 기준)
  const effectiveHours = Math.min(8, Math.max(4, dailyHours));
  const floorDaily = Math.round((floor8h * effectiveHours) / 8);

  const dailyBenefit = Math.min(dailyCap, Math.max(floorDaily, rawDaily));
  const totalBenefit = dailyBenefit * days;
  const monthlyApprox = dailyBenefit * 30;
  const tierLabel =
    rawDaily >= dailyCap
      ? retireYear === '2027'
        ? `2027 예상 상한액 적용 (1일 약 ${dailyCap.toLocaleString('ko-KR')}원)`
        : `2026 상한액 적용 (1일 ${dailyCap.toLocaleString('ko-KR')}원)`
      : rawDaily <= floorDaily
        ? `${retireYear} 확정 하한액 적용 (${effectiveHours}시간 기준 1일 ${floorDaily.toLocaleString('ko-KR')}원)`
        : `${retireYear} 평균임금 60% 구간`;

  return (
    <div className="ec-board">
      <div className="ec-inputs">
        <fieldset className="ec-field ec-fieldset">
          <legend className="ec-label">퇴사 예정 연도</legend>
          <div className="ec-type-row">
            <label className={`ec-type-btn ${retireYear === '2027' ? 'active' : ''}`}>
              <input
                type="radio"
                name="ub-year"
                value="2027"
                checked={retireYear === '2027'}
                onChange={() => setRetireYear('2027')}
                className="sr-only"
              />
              2027년 퇴사 (1월 이후)
            </label>
            <label className={`ec-type-btn ${retireYear === '2026' ? 'active' : ''}`}>
              <input
                type="radio"
                name="ub-year"
                value="2026"
                checked={retireYear === '2026'}
                onChange={() => setRetireYear('2026')}
                className="sr-only"
              />
              2026년 퇴사
            </label>
          </div>
        </fieldset>

        <fieldset className="ec-field ec-fieldset">
          <legend className="ec-label">퇴사일 기준 연령 · 장애인 여부</legend>
          <div className="ec-type-row">
            <label className={`ec-type-btn ${ageGroup === 'under50' ? 'active' : ''}`}>
              <input
                type="radio"
                name="ub-age"
                value="under50"
                checked={ageGroup === 'under50'}
                onChange={() => setAgeGroup('under50')}
                className="sr-only"
              />
              만 50세 미만
            </label>
            <label className={`ec-type-btn ${ageGroup === 'over50' ? 'active' : ''}`}>
              <input
                type="radio"
                name="ub-age"
                value="over50"
                checked={ageGroup === 'over50'}
                onChange={() => setAgeGroup('over50')}
                className="sr-only"
              />
              만 50세 이상 · 장애인
            </label>
          </div>
        </fieldset>

        <div className="ec-field">
          <label className="ec-label" htmlFor="ub-tenure">
            고용보험 가입기간
          </label>
          <select
            id="ub-tenure"
            className="ec-select"
            value={tenure}
            onChange={(e) => setTenure(e.target.value as TenureKey)}
          >
            {TENURE_OPTIONS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ec-field">
          <label className="ec-label" htmlFor="ub-wage">
            퇴사 직전 3개월 평균 세전 월급 (만원)
          </label>
          <div className="ec-income-row">
            <input
              id="ub-wage"
              type="number"
              min={50}
              max={1500}
              step={10}
              value={monthlyWage}
              onChange={(e) => setMonthlyWage(Math.max(0, Number(e.target.value)))}
            />
            <span className="ec-unit">만원</span>
          </div>
          <input
            type="range"
            min={100}
            max={600}
            step={10}
            value={Math.min(600, Math.max(100, monthlyWage))}
            onChange={(e) => setMonthlyWage(Number(e.target.value))}
            aria-label="세전 월급 슬라이더"
          />
        </div>

        <div className="ec-field">
          <label className="ec-label" htmlFor="ub-hours">
            1일 소정근로시간 (시간)
          </label>
          <select
            id="ub-hours"
            className="ec-select"
            value={dailyHours}
            onChange={(e) => setDailyHours(Number(e.target.value))}
          >
            <option value={8}>8시간 (주 40시간 풀타임)</option>
            <option value={7}>7시간 (주 35시간)</option>
            <option value={6}>6시간 (주 30시간)</option>
            <option value={5}>5시간 (주 25시간)</option>
            <option value={4}>4시간 이하 (단시간 근로)</option>
          </select>
        </div>
      </div>

      <div className="ec-result" role="status" aria-live="polite">
        <div className="ec-zone">{tierLabel}</div>
        <div className="ec-amount">
          총 <strong>{Math.round(totalBenefit / 10000).toLocaleString('ko-KR')}만원</strong>
        </div>
        <dl className="ec-breakdown">
          <div>
            <dt>1일 구직급여액</dt>
            <dd>{dailyBenefit.toLocaleString('ko-KR')}원</dd>
          </div>
          <div>
            <dt>예상 수급일수</dt>
            <dd>
              {days}일 (약 {Math.round((days / 30) * 10) / 10}개월)
            </dd>
          </div>
          <div>
            <dt>월 환산액 (30일)</dt>
            <dd>약 {Math.round(monthlyApprox / 10000).toLocaleString('ko-KR')}만원</dd>
          </div>
        </dl>
        <p className="ec-note">
          {retireYear === '2027'
            ? '2027년 퇴사자 기준 추정치(8시간 확정 하한액 68,480원 · 상한액은 정부 103% 연동 추진안 약 70,534원 반영)입니다. 최종 상한액과 지급 방식은 고용보험법 시행령 확정 고시에 따라 달라질 수 있습니다.'
            : '2026년 퇴사자 기준 추정치(상한 68,100원 · 8시간 하한 66,048원)입니다. 실제 지급액은 고용센터 이직확인서의 평균임금과 피보험 단위기간(180일 이상) 심사로 확정됩니다.'}
        </p>
      </div>
    </div>
  );
};
