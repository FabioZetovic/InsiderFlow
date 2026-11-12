import { useId } from 'react';

/**
 * InsiderFlow mark: a magnifying glass over the Capitol dome, with a rising
 * trend arrow and volume bars. Pure SVG so it stays crisp from 16px to hero size.
 */
export function LogoMark({ className = 'h-8 w-8', tile = false }: { className?: string; tile?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const clip = `lm-clip-${uid}`;
  const arrow = `lm-arrow-${uid}`;
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="InsiderFlow">
      <defs>
        <clipPath id={clip}>
          <circle cx="28" cy="28" r="17.6" />
        </clipPath>
        <linearGradient id={arrow} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#B1B4FF" />
          <stop offset="0.55" stopColor="#F4F6FB" />
          <stop offset="1" stopColor="#F6BD4F" />
        </linearGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="14" fill="#161C2D" />}
      <g clipPath={`url(#${clip})`}>
        {/* Capitol: spire, dome, entablature, columns */}
        <rect x="27.2" y="10.5" width="1.6" height="4.5" rx="0.8" fill="#B1B4FF" />
        <path d="M20.5 21 A7.5 6.5 0 0 1 35.5 21 Z" fill="#B1B4FF" />
        <rect x="19.5" y="21.6" width="17" height="1.8" rx="0.9" fill="#B1B4FF" />
        {[21.4, 24.6, 27.8, 31, 34.2].map((x) => (
          <rect key={x} x={x - 0.8} y="24.4" width="1.6" height="6.4" rx="0.8" fill="#9294FF" />
        ))}
        {/* Volume bars rising to the right */}
        <rect x="22" y="38" width="3.4" height="9" rx="0.6" fill="#7472F8" />
        <rect x="27.6" y="35" width="3.4" height="12" rx="0.6" fill="#7472F8" />
        <rect x="33.2" y="31.5" width="3.4" height="16" rx="0.6" fill="#7472F8" />
        {/* Trend line */}
        <path
          d="M11 37.5 C17 34, 23 34.5, 29 31.5 S 37.5 24.5, 40.5 21.8"
          fill="none"
          stroke={`url(#${arrow})`}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
      {/* Arrow head sits on the lens rim */}
      <path d="M44.2 18.2 L37.9 19.3 L43.1 24.5 Z" fill="#E9A323" />
      {/* Lens ring + handle */}
      <circle cx="28" cy="28" r="19.6" fill="none" stroke="#5B57E8" strokeWidth="4.4" />
      <path d="M42.6 42.6 L53 53" stroke="#5B57E8" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + wordmark lockup. */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const mark = size === 'lg' ? 'h-11 w-11' : 'h-8 w-8';
  const text = size === 'lg' ? 'text-3xl' : 'text-lg';
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className={mark} />
      <span className={`${text} font-bold tracking-tight text-ink-50`}>
        Insider<span className="text-brand-500">Flow</span>
      </span>
    </span>
  );
}
