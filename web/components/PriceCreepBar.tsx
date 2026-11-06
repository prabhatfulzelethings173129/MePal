"use client";

import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";

export interface CreepSegment {
  key: string;
  label: string;
  cents: number;
  color: string;
}

// Stacked SVG bar of how the sticker price creeps up to the full total,
// with a dashed marker at the advertised/sticker price.
export function PriceCreepBar({
  segments,
  markerCents,
  markerLabel,
  currency,
}: {
  segments: CreepSegment[];
  markerCents: number;
  markerLabel: string;
  currency: Currency;
}) {
  const total = segments.reduce((a, s) => a + s.cents, 0);
  if (total <= 0) return null;
  const W = 320;
  const H = 44;
  const BY = 14;
  const BH = 16;
  const rects: { key: string; x: number; w: number; color: string }[] = [];
  let x = 0;
  for (const s of segments) {
    if (s.cents <= 0) continue;
    const w = (s.cents / total) * W;
    rects.push({ key: s.key, x, w, color: s.color });
    x += w;
  }
  const mx = markerCents > 0 && markerCents < total ? (markerCents / total) * W : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Price build-up, full total ${formatMoney(total, currency)}`}>
        {rects.map(r => (
          <rect key={r.key} x={r.x} y={BY} width={Math.max(r.w - 0.5, 1)} height={BH} fill={r.color} rx="1.5" />
        ))}
        {mx !== null && (
          <g>
            <line x1={mx} x2={mx} y1={BY - 5} y2={BY + BH + 5} stroke="#e8eefc" strokeDasharray="3 3" strokeWidth="1.5" />
            <text x={mx + 3} y={BY - 8} fontSize="8" fill="#8da2c8">
              {markerLabel}
            </text>
          </g>
        )}
      </svg>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8da2c8]">
        {rects.map(r => {
          const seg = segments.find(s => s.key === r.key);
          if (!seg) return null;
          return (
            <span key={r.key} className="inline-flex items-center gap-1">
              <span aria-hidden className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: seg.color }} />
              {seg.label} <span className="num text-[#cdd9f2]">{formatMoney(seg.cents, currency)}</span>
            </span>
          );
        })}
        <span className="num ml-auto text-[#e8eefc]">full total {formatMoney(total, currency)}</span>
      </div>
    </div>
  );
}
