import { Link } from 'react-router-dom';
import { CountUp } from './ui';

/**
 * Decorative illustration: the Capitol in line art, volume bars growing out of the ground,
 * and a trend line that draws itself up to an amber arrow.
 */
function HeroIllustration() {
  const columns = [178, 202, 226, 250, 274, 298, 322, 346, 370];
  const bars = [
    { x: 92, h: 46 },
    { x: 126, h: 70 },
    { x: 160, h: 58 },
    { x: 404, h: 96 },
    { x: 438, h: 124 },
    { x: 472, h: 150 },
  ];
  return (
    <svg viewBox="0 0 560 330" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="hero-trend" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#7472F8" stopOpacity="0.2" />
          <stop offset="0.6" stopColor="#B1B4FF" />
          <stop offset="1" stopColor="#F6BD4F" />
        </linearGradient>
        <linearGradient id="hero-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7472F8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#5B57E8" stopOpacity="0.15" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="0.5" cy="0.45" r="0.5">
          <stop offset="0" stopColor="#5B57E8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#5B57E8" stopOpacity="0" />
        </radialGradient>
        <pattern id="hero-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="#343C55" strokeWidth="0.6" />
        </pattern>
      </defs>

      <rect width="560" height="330" fill="url(#hero-grid)" opacity="0.35" />
      <ellipse cx="280" cy="170" rx="260" ry="150" fill="url(#hero-glow)" className="hero-pulse" />

      {/* Capitol, line art */}
      <g fill="none" stroke="#B1B4FF" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M274 52 V30 M274 30 l10 4 -10 4" />
        <path d="M232 112 C232 74 316 74 316 112" />
        <path d="M244 112 V100 M304 112 V100 M252 86 h44" strokeOpacity="0.35" />
        <path d="M212 126 H336 M206 112 H342 V126 H206 Z" />
        <path d="M160 150 L274 132 L388 150 Z" />
        <path d="M156 150 H392 M156 160 H392" />
        {columns.map((x) => (
          <path key={x} d={`M${x} 166 V250`} strokeOpacity="0.45" />
        ))}
        <path d="M146 250 H402 M136 262 H412" />
      </g>

      {/* Volume bars */}
      {bars.map((b, i) => (
        <rect
          key={b.x}
          x={b.x}
          y={300 - b.h}
          width="22"
          height={b.h}
          fill="url(#hero-bar)"
          className="hero-bar"
          style={{ animationDelay: `${300 + i * 90}ms` }}
        />
      ))}
      <path d="M40 300 H520" stroke="#343C55" strokeWidth="1.5" />

      {/* Trend line drawing up to the arrow */}
      <path
        d="M40 268 C110 250, 150 262, 210 236 S 300 214, 350 186 S 440 132, 498 82"
        fill="none"
        stroke="url(#hero-trend)"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={1}
        className="hero-draw"
      />
      <path d="M512 66 L486 74 L504 94 Z" fill="#E9A323" className="hero-arrow" />
      {[
        [210, 236],
        [350, 186],
      ].map(([cx, cy], i) => (
        <circle key={cx} cx={cx} cy={cy} r="5" fill="#0C111D" stroke="#B1B4FF" strokeWidth="2.5" className="hero-dot" style={{ animationDelay: `${900 + i * 300}ms` }} />
      ))}
    </svg>
  );
}

export function InsidersHero({
  totalTrades,
  members,
  sectors,
}: {
  totalTrades: number | null;
  members: number;
  sectors: number;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-700/25 via-ink-900/70 to-ink-900/40">
      <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
            Congressional and corporate insider trading
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-ink-50 sm:text-5xl">
            Follow the money
            <br />
            <span className="bg-gradient-to-r from-brand-400 via-brand-300 to-accent-400 bg-clip-text text-transparent">
              in Washington.
            </span>
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-300 sm:text-base">
            Every stock trade disclosed by members of Congress and the President, flagged for late
            filings, committee conflicts and trades right before earnings.
          </p>

          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <div className="text-3xl font-bold text-ink-50">
                {totalTrades != null ? <CountUp value={totalTrades} /> : '—'}
              </div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-ink-500">Trades tracked</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-ink-50">{members ? <CountUp value={members} /> : '—'}</div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-ink-500">Members</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-ink-50">{sectors ? <CountUp value={sectors} /> : '—'}</div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-ink-500">Sectors</div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/leaderboard" className="bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500">
              See top traders
            </Link>
            <Link to="/signals" className="bg-ink-800/80 px-5 py-2.5 text-sm font-semibold text-ink-100 transition-colors hover:bg-ink-700">
              Late filers and clusters
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-full opacity-40 lg:static lg:h-full lg:w-auto lg:opacity-100">
          <HeroIllustration />
        </div>
      </div>
    </section>
  );
}
