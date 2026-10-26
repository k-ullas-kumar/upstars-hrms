import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

interface CursorAuraProps {
  className?: string;
}

/**
 * One soft glow under the cursor (with a slight lag), and parallax vars for the background mesh.
 */
export function CursorAura({ className }: CursorAuraProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0.5, y: 0.4 });
  const current = useRef({ x: 0.5, y: 0.4 });
  const raf = useRef<number | null>(null);
  const [spot, setSpot] = useState({ x: 50, y: 40 });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnabled(fine && !reduce);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const parent = () => rootRef.current?.parentElement ?? null;

    const onMove = (event: PointerEvent) => {
      const el = parent();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      target.current = {
        x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      };
    };

    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.1;
      current.current.y += (target.current.y - current.current.y) * 0.1;

      const x = current.current.x;
      const y = current.current.y;
      setSpot({ x: x * 100, y: y * 100 });

      const el = parent();
      if (el) {
        el.style.setProperty('--parallax-x', `${((x - 0.5) * 48).toFixed(2)}px`);
        el.style.setProperty('--parallax-y', `${((y - 0.5) * 36).toFixed(2)}px`);
      }

      raf.current = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    raf.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf.current != null) cancelAnimationFrame(raf.current);
      const el = parent();
      if (el) {
        el.style.removeProperty('--parallax-x');
        el.style.removeProperty('--parallax-y');
      }
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div ref={rootRef} className={cn('pointer-events-none absolute inset-0 z-10 overflow-hidden', className)} aria-hidden>
      <div
        className="absolute h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${spot.x}%`,
          top: `${spot.y}%`,
          background: 'radial-gradient(circle, rgba(201,162,39,0.45) 0%, rgba(201,162,39,0.12) 45%, transparent 72%)',
        }}
      />
    </div>
  );
}
