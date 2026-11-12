import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SectorWeekly } from '../types';
import { Skeleton } from './ui';

/** ETF display names to GICS sector names used on trades (only XLK differs). */
function gicsName(etfName: string): string {
  return etfName === 'Technology' ? 'Information Technology' : etfName;
}

const AUTO_SPEED = 0.035; // px per ms (~35px/s)
const COPIES = 3; // enough repeats that the ring never shows a gap

/**
 * Weekly sector performance as a continuously rotating "ring": tiles drift from right to left,
 * curving away on a virtual cylinder at the edges. Drag (mouse or touch) to spin it either way;
 * it coasts with momentum, then resumes rotating. Hovering pauses it.
 */
export function SectorWeeklyStrip({ sectors, loading }: { sectors: SectorWeekly[]; loading: boolean }) {
  const navigate = useNavigate();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const state = useRef({
    offset: 0,
    velocity: 0, // px/ms from drag release, decays to 0
    dragging: false,
    hovered: false,
    startX: 0,
    startOffset: 0,
    lastX: 0,
    lastT: 0,
    moved: 0,
    pointerId: -1,
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || sectors.length === 0) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let prev = performance.now();

    const frame = (now: number) => {
      const s = state.current;
      const dt = Math.min(now - prev, 50);
      prev = now;
      const items = track.children as HTMLCollectionOf<HTMLElement>;
      const perSet = items.length / COPIES;
      const loop = items[perSet]?.offsetLeft - items[0]?.offsetLeft || 1;

      if (!s.dragging) {
        if (Math.abs(s.velocity) > 0.005) {
          s.offset += s.velocity * dt;
          s.velocity *= Math.pow(0.995, dt); // friction
        } else if (!s.hovered && !reduceMotion) {
          s.velocity = 0;
          s.offset += AUTO_SPEED * dt;
        }
      }
      s.offset = ((s.offset % loop) + loop) % loop;
      // Start one full set in so dragging right never runs out of tiles.
      const x = -(s.offset + loop);
      track.style.transform = `translate3d(${x}px,0,0)`;

      // Ring curvature: tiles bend away and fade toward the edges.
      const half = viewport.clientWidth / 2;
      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        const center = el.offsetLeft + x + el.offsetWidth / 2 - half;
        const d = Math.max(-1.3, Math.min(1.3, center / half));
        el.style.transform = `rotateY(${(-d * 32).toFixed(2)}deg) scale(${(1 - 0.16 * d * d).toFixed(3)})`;
        el.style.opacity = Math.max(0, 1 - 0.6 * d * d).toFixed(3);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sectors]);

  const onPointerDown = (e: React.PointerEvent) => {
    const s = state.current;
    s.dragging = true;
    s.velocity = 0;
    s.startX = s.lastX = e.clientX;
    s.startOffset = s.offset;
    s.lastT = performance.now();
    s.moved = 0;
    s.pointerId = e.pointerId;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.dragging) return;
    const now = performance.now();
    const dx = e.clientX - s.startX;
    s.moved = Math.max(s.moved, Math.abs(dx));
    if (s.moved > 4 && !viewportRef.current?.hasPointerCapture(e.pointerId)) {
      viewportRef.current?.setPointerCapture(e.pointerId);
    }
    s.offset = s.startOffset - dx;
    const dtMove = now - s.lastT;
    if (dtMove > 0) s.velocity = -(e.clientX - s.lastX) / dtMove;
    s.lastX = e.clientX;
    s.lastT = now;
  };
  const endDrag = () => {
    const s = state.current;
    if (!s.dragging) return;
    s.dragging = false;
    if (performance.now() - s.lastT > 80) s.velocity = 0; // held still before release
    s.velocity = Math.max(-2.5, Math.min(2.5, s.velocity));
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-44 shrink-0" />
        ))}
      </div>
    );
  }

  if (sectors.length === 0) {
    return null;
  }

  const tiles = Array.from({ length: COPIES }).flatMap((_, copy) =>
    sectors.map((s) => ({ s, key: `${copy}-${s.symbol}` })),
  );

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-400">
          Sector performance, last trading week
        </h2>
        <span className="hidden text-xs text-ink-600 sm:inline">Drag to spin</span>
      </div>
      <div
        ref={viewportRef}
        className="relative cursor-grab select-none overflow-hidden py-2 active:cursor-grabbing"
        style={{
          perspective: '1100px',
          touchAction: 'pan-y',
          maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={() => (state.current.hovered = true)}
        onPointerLeave={() => {
          state.current.hovered = false;
          endDrag();
        }}
        onClickCapture={(e) => {
          // A drag is not a click.
          if (state.current.moved > 4) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <div ref={trackRef} className="flex w-max gap-3 will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
          {tiles.map(({ s, key }) => {
            const up = s.weeklyChangePercent >= 0;
            return (
              <button
                key={key}
                draggable={false}
                onClick={() => navigate(`/insiders/sector/${encodeURIComponent(gicsName(s.name))}`)}
                title={`${s.symbol}: $${s.weekAgoClose.toFixed(2)} to $${s.lastClose.toFixed(2)}. Click for congress trades in ${s.name}`}
                className={`w-44 shrink-0 px-4 py-3 text-left will-change-transform hover:brightness-125 ${
                  up ? 'bg-up-500/10' : 'bg-down-500/10'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-ink-300">{s.symbol}</span>
                  <span className={`text-sm font-semibold ${up ? 'text-up-400' : 'text-down-400'}`}>
                    {up ? '+' : ''}
                    {s.weeklyChangePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-ink-400">{s.name}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
