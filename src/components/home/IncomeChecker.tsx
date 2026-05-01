import { useState } from 'react';
import { INCOME_THRESHOLDS, MEDIAN_INCOME } from '@/data/site-data';

const SIZES = [1, 2, 3, 4, 5, 6] as const;

export const IncomeChecker = () => {
  const [size, setSize] = useState<number>(1);
  const [income, setIncome] = useState<number>(250); // 만원/월

  const median = MEDIAN_INCOME[size] ?? 239;
  const pct = Math.round((income / median) * 100);

  const eligible = INCOME_THRESHOLDS.filter((t) => pct <= t.pct);
  const top = eligible[0];
  const isLow = pct <= 50;
  const sliderPos = Math.min(150, Math.max(0, pct));

  let badge: { label: string; cls: string };
  if (isLow) badge = { label: '차상위 이하 — 강한 자격', cls: 'low' };
  else if (pct <= 75) badge = { label: '중위소득 자격선 안', cls: 'mid' };
  else if (pct <= 100) badge = { label: '중간층 — 일부 지원 가능', cls: 'mid2' };
  else badge = { label: '대부분 소득기준 외 — 보편 지원 가능', cls: 'high' };

  return (
    <div className="ic-board">
      <div className="ic-inputs">
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
            월소득 (세전, 만원)
          </label>
          <div className="ic-income-row">
            <input
              id="ic-income-slider"
              type="range"
              min="0"
              max="1000"
              step="10"
              value={income}
              onChange={(e) => setIncome(Number.parseInt(e.target.value, 10))}
              className="ic-slider"
              aria-label="월소득 슬라이더"
            />
            <div className="ic-income-num">
              <input
                id="ic-income"
                type="number"
                value={income}
                min="0"
                max="2000"
                onChange={(e) => setIncome(Number.parseInt(e.target.value, 10) || 0)}
                className="ic-input"
              />
              <span className="ic-unit">만원</span>
            </div>
          </div>
          <div className="ic-hint">
            {size}인 가구 중위소득 = 월 {median}만원
          </div>
        </div>
      </div>

      <div className="ic-result">
        <div className="ic-pct-block">
          <div className="ic-pct-label">중위소득 대비</div>
          <div className="ic-pct-value">
            <span className="ic-pct-num" style={{ color: top ? top.color : 'var(--text-3)' }}>
              {pct}
            </span>
            <span className="ic-pct-unit">%</span>
          </div>
          <div className="ic-status">
            <span className={`ic-badge ${badge.cls}`}>{badge.label}</span>
          </div>
        </div>

        <div className="ic-bar-wrap">
          <div className="ic-bar-track" aria-hidden="true">
            {INCOME_THRESHOLDS.map((t) => (
              <div
                key={t.pct}
                className="ic-bar-tick"
                style={{ left: `${t.pct / 1.5}%`, background: t.color }}
                title={`${t.pct}% — ${t.name}`}
              />
            ))}
            <div className="ic-bar-pin" style={{ left: `${sliderPos / 1.5}%` }}>
              <div className="ic-bar-pin-line" />
              <div className="ic-bar-pin-dot" />
            </div>
          </div>
          <div className="ic-bar-labels">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
            <span>150%</span>
          </div>
        </div>

        <div className="ic-eligible">
          <div className="ic-eligible-head">
            {eligible.length > 0 ? (
              <>
                해당 가능한 기준 <span className="ic-count">{eligible.length}</span>개
              </>
            ) : (
              <>현재 소득은 모든 소득기반 기준선 위입니다 — 보편적 지원금을 확인하세요.</>
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
                {t.link && t.linkLabel && (
                  <a className="ic-eligible-link" href={t.link}>
                    {t.linkLabel} →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="ic-disclaimer">
          ※ 실제 자격은 재산·부양가족·근로능력 등 추가 기준이 적용됩니다. 정확한 판정은
          복지로(welfare.go.kr) 모의계산을 이용하세요.
        </div>
      </div>
    </div>
  );
};

export default IncomeChecker;
