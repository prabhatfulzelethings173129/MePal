"use client";

const GRADE_COLOR: Record<string, string> = {
  A: "#22c7a0",
  B: "#60a5fa",
  C: "#f5a524",
  D: "#ef4b5f",
  F: "#ef4b5f",
};

export function HonestyRing({ score, grade }: { score: number; grade: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, score));
  const color = GRADE_COLOR[grade] ?? "#8da2c8";
  return (
    <div className="flex items-center gap-2">
      <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={`Honesty score ${score} of 100, grade ${grade}`}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1f2b46" strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(filled / 100) * c} ${c}`}
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="38" textAnchor="middle" fill="#e8eefc" fontSize="18" fontWeight="700">
          {grade}
        </text>
        <text x="36" y="51" textAnchor="middle" fill="#8da2c8" fontSize="9">
          {score}/100
        </text>
      </svg>
      <span className="text-[11px] leading-tight text-[#8da2c8]">
        Fee
        <br />
        Honesty
      </span>
    </div>
  );
}
