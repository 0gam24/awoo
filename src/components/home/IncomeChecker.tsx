import { useState } from 'react';
import {
  formatMedianWon,
  INCOME_THRESHOLDS,
  MEDIAN_INCOME,
  MEDIAN_INCOME_2027,
} from '@/data/site-data';
import '@/styles/calculators.css';

const SIZES = [1, 2, 3, 4, 5, 6] as const;
const QUICK_AMOUNTS = [150, 250, 350, 500] as const;
type BaseYear = '2027' | '2026';

export const IncomeChecker = () => {
  const [year, setYear] = useState<BaseYear>('2027');
  const [size, setSize] = useState<number>(1);
  const [income, setIncome] = useState<number>(250); // 만원/월

  const table = year === '2027' ? MEDIAN_INCOME_2027 : MEDIAN_INCOME;
  const median = table[size] ?? Number(table[1]);
  const pct = Math.round((income / median) * 100);

  // 2026 vs 2027 비교 델타 (2027 선택 시 얼마나 유리해졌는지 즉시 표시)
  const median2026 = MEDIAN_INCOME[size] ?? Number(MEDIAN_INCOME[1]);
  const pct2026 = Math.round((income / median2026) * 100);
  const delta2027 = pct2026 - pct;

  const eligible = INCOME_THRESHOLDS.filter((t) => pct <= t.pct);
  const top = eligible[0];
  const isLow = pct <= 50;
  const sliderPos = Math.min(150, Math.max(0, pct));
  const fillWidthPct = Math.min(100, Math.max(2, (sliderPos / 150) * 100));

  let badge: { label: string; cls: string };
  if (isLow) badge = { label: '차상위 이하 — 핵심 지원 대상', cls: 'low' };
  else if (pct <= 75) badge = { label: '중위소득 75% 이하 — 주요 자격권', cls: 'mid' };
  else if (pct <= 100) badge = { label: '중위소득 100% 이하 — 일반 지원권', cls: 'mid2' };
  else badge = { label: '중위소득 100% 초과 — 보편·특공 확인', cls: 'high' };

  return (
    <div className="ic-board">
      <div className="ic-inputs">
        <fieldset className="ic-field ic-fieldset">
          <legend className="ic-label">적용 연도</legend>
          <div className="ic-seg-row">
            <label className={`ic-seg-btn ${year === '2027' ? 'active' : ''}`}>
              <input
                type="radio"
                name="median-year"
                value="2027"
                checked={year === '2027'}
                onChange={() => setYear('2027')}
                className="sr-only"
              />
              2027년 (+6.7%)
            </label>
            <label className={`ic-seg-btn ${year === '2026' ? 'active' : ''}`}>
              <input
                type="radio"
                name="median-year"
                value="2026"
                checked={year === '2026'}
                onChange={() => setYear('2026')}
                className="sr-only"
              />
              2026년 비교
            </label>
          </div>
        </fieldset>

        <fieldset className="ic-field ic-fieldset">
          <legend className="ic-label">가구원 수</legend>
          <div className="ic-size-row">
            {SIZES.map((n) => (
              <label key={n} className={`ic-size-btn ${size === n ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="household-size"
                  value={n}
                  checked={size === n}
                  onChange={() => setSize(n)}
                  className="sr-only"
                />
                {n}인
              </label>
            ))}
          </div>
        </fieldset>

        <div className="ic-field">
          <label className="ic-label" htmlFor="ic-income">
            가구 월소득 합계 (세전)
          </label>
          <div className="ic-amount-box">
            <input
              id="ic-income"
              type="number"
              value={income}
              min="0"
              max="2000"
              step="10"
              onChange={(e) => setIncome(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
              className="ic-input"
            />
            <span className="ic-unit">만원</span>
          </div>
          <div className="ic-presets">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                className="ic-preset-btn"
                onClick={() => setIncome(amt)}
              >
                {amt}만원
              </button>
            ))}
            <button
              type="button"
              className="ic-preset-btn"
              onClick={() => setIncome((prev) => Math.min(2000, prev + 50))}
            >
              +50만
            </button>
          </div>
          <input
            id="ic-income-slider"
            type="range"
            min="0"
            max="1000"
            step="10"
            value={Math.min(1000, income)}
            onChange={(e) => setIncome(Number.parseInt(e.target.value, 10))}
            className="ic-slider"
            aria-label="월소득 슬라이더"
          />
          <div className="ic-hint">
            {year}년 {size}인 가구 중위소득 100% = 월 <strong>{formatMedianWon(median)}</strong>
          </div>
        </div>
      </div>

      <div className="ic-result" role="status" aria-live="polite">
        <div className="ic-pct-block">
          <div className="ic-pct-label">{year}년 기준중위소득 대비</div>
          <div className="ic-pct-value">
            <span className="ic-pct-num" style={{ color: top ? top.color : 'var(--accent)' }}>
              {pct}
            </span>
            <span className="ic-pct-unit">%</span>
          </div>
          <div className="ic-status">
            <span className={`ic-badge ${badge.cls}`}>{badge.label}</span>
            {year === '2027' && delta2027 > 0 && (
              <span className="ic-delta-pill">
                2026년 {pct2026}% → {delta2027}%p 유리
              </span>
            )}
          </div>
        </div>

        <div className="ic-bar-wrap">
          <div className="ic-bar-track" aria-hidden="true">
            <div className="ic-bar-fill" style={{ width: `${fillWidthPct}%` }} />
            {INCOME_THRESHOLDS.filter((t) => [32, 50, 100].includes(t.pct)).map((t) => (
              <div
                key={t.pct}
                className="ic-bar-tick"
                style={{ left: `${(t.pct / 150) * 100}%`, background: t.color }}
                title={`${t.pct}% — ${t.name}`}
              />
            ))}
            <div className="ic-bar-pin" style={{ left: `${(sliderPos / 150) * 100}%` }}>
              <div className="ic-bar-pin-dot" />
            </div>
          </div>
          <div className="ic-bar-labels">
            <span>0%</span>
            <span>50% 차상위</span>
            <span>100% 중위</span>
            <span>150%</span>
          </div>
        </div>

        <div className="ic-eligible">
          <div className="ic-eligible-head">
            {eligible.length > 0 ? (
              <>
                해당 가능한 지원 기준 <span className="ic-count">{eligible.length}개</span>
              </>
            ) : (
              <>현재 소득은 150% 초과 구간입니다 — 보편적 지원금을 확인해 보세요.</>
            )}
          </div>
          {eligible.slice(0, 4).map((t) => (
            <div key={t.pct} className="ic-eligible-row">
              <span className="ic-eligible-pct" style={{ background: t.color }}>
                {t.pct}%
              </span>
              <div className="ic-eligible-body">
                <div className="ic-eligible-name">{t.name}</div>
                <div className="ic-eligible-desc">{t.desc}</div>
              </div>
              {t.link && t.linkLabel && (
                <a className="ic-eligible-link" href={t.link}>
                  보기 →
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="ic-disclaimer">
          ※ 실제 수급 자격은 재산의 소득환산액이 포함됩니다. 최종 판정은 복지로(bokjiro.go.kr)
          모의계산을 이용하세요.
        </div>
      </div>
    </div>
  );
};

export default IncomeChecker;
