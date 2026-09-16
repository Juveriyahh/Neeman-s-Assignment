import React from 'react';

/* ===========================================================================
   Small inline-SVG chart primitives.
   Deliberately not a charting library: these are five fixed shapes, and a
   dependency would cost more than it saves.
   Colour is signal here, never decoration.
   =========================================================================== */

export const C = {
  danger: '#E32C2B',
  warn: '#C4973A',
  good: '#175615',
  gold: '#B78742',
  ink: '#1C1C1C',
  line: '#DDDDDD',
  surface: '#F3F2F2',
  muted: '#6B6B6B',
};

/** Readiness as an arc. One number, read at a glance. */
export function ScoreDial({ score, verdict }) {
  const r = 62;
  const circ = Math.PI * r; // half circle
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const colour = verdict === 'NOT_READY' ? C.danger : verdict === 'READY_WITH_FIXES' ? C.warn : C.good;

  return (
    <svg viewBox="0 0 160 96" className="w-full max-w-[220px]" role="img" aria-label={`Readiness ${score} out of 100`}>
      <path d="M 18 84 A 62 62 0 0 1 142 84" fill="none" stroke={C.line} strokeWidth="13" strokeLinecap="round" />
      <path
        d="M 18 84 A 62 62 0 0 1 142 84"
        fill="none"
        stroke={colour}
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray={`${circ * pct} ${circ}`}
      />
      <text x="80" y="74" textAnchor="middle" className="font-display" fontSize="40" fill={C.ink} letterSpacing="2">
        {score}
      </text>
      <text x="80" y="90" textAnchor="middle" className="font-sans" fontSize="9" fill={C.muted} letterSpacing="2">
        OUT OF 100
      </text>
    </svg>
  );
}

/** Arrived vs lost. A donut, because it's a part-of-whole with two parts. */
export function DeliveryDonut({ total, failed }) {
  const ok = Math.max(0, total - failed);
  const pct = total ? failed / total : 0;
  const r = 46;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-[118px] w-[118px] shrink-0" role="img" aria-label={`${ok} of ${total} requests arrived`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke={C.good} strokeWidth="16" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={C.danger}
          strokeWidth="16"
          strokeDasharray={`${circ * pct} ${circ}`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="58" textAnchor="middle" className="font-display" fontSize="24" fill={C.ink}>
          {total ? Math.round((ok / total) * 100) : 0}%
        </text>
        <text x="60" y="72" textAnchor="middle" className="font-sans" fontSize="8" fill={C.muted} letterSpacing="1.5">
          ARRIVED
        </text>
      </svg>
      <dl className="space-y-2">
        <Legend colour={C.good} label={`${ok} arrived`} />
        <Legend colour={C.danger} label={`${failed} never made it`} />
      </dl>
    </div>
  );
}

function Legend({ colour, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
      <span className="text-[13px] text-ink2">{label}</span>
    </div>
  );
}

/** Horizontal bars. Used for per-vendor request volume. */
export function BarList({ items, max, unit = '' }) {
  const top = max || Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <span className="w-[140px] shrink-0 truncate text-[13px] text-ink2">{i.label}</span>
          <div className="h-[18px] flex-1 rounded-pill bg-surface">
            <div
              className="h-full rounded-pill"
              style={{ width: `${Math.max((i.value / top) * 100, 2)}%`, background: i.colour || C.ink }}
            />
          </div>
          <span className="w-[62px] shrink-0 text-right font-mono text-[11px] text-muted">
            {i.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The most business-critical chart in the report: for each ad platform you
 * are paying, can it actually see a sale signal from this page?
 */
export function SignalMatrix({ rows }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-surface">
            <th className="kicker px-4 py-2.5 font-medium">Platform</th>
            <th className="kicker px-4 py-2.5 font-medium">Sees the page</th>
            <th className="kicker px-4 py-2.5 font-medium">Sees an add to cart</th>
            <th className="kicker px-4 py-2.5 font-medium">What that means</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line align-middle">
              <td className="px-4 py-3 text-[14px] font-medium text-ink">{r.label}</td>
              <td className="px-4 py-3">
                <Tick ok={r.seesPage} />
              </td>
              <td className="px-4 py-3">
                <Tick ok={r.seesConversion} />
              </td>
              <td className="px-4 py-3 text-[13px] leading-snug text-muted">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tick({ ok }) {
  return ok ? (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-good/10 px-2.5 py-1 text-[11px] font-medium text-good">
      ✓ Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-danger/10 px-2.5 py-1 text-[11px] font-medium text-danger">
      ✕ No
    </span>
  );
}

/** A single headline number with a caption. */
export function Stat({ value, label, caption, tone = 'ink' }) {
  const tones = { ink: 'text-ink', danger: 'text-danger', warn: 'text-warn', good: 'text-good' };
  return (
    <div className="card p-5">
      <div className={`display text-[34px] leading-none ${tones[tone]}`}>{value}</div>
      <div className="mt-2 text-[13px] font-medium text-ink2">{label}</div>
      {caption && <div className="mt-1 text-[12px] leading-snug text-muted">{caption}</div>}
    </div>
  );
}

/** Stacked severity bar with definitions beneath. */
export function SeverityBar({ high, medium, low }) {
  const total = high + medium + low || 1;
  const seg = [
    [high, C.danger],
    [medium, C.warn],
    [low, C.good],
  ];
  return (
    <div className="flex h-[12px] w-full overflow-hidden rounded-pill bg-surface">
      {high + medium + low === 0 ? (
        <div className="w-full" style={{ background: C.good }} />
      ) : (
        seg.map(([n, c], i) => n > 0 && <div key={i} style={{ width: `${(n / total) * 100}%`, background: c }} />)
      )}
    </div>
  );
}
