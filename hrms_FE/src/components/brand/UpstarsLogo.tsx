import { cn } from '../../lib/cn';

const LOGO_SRC = '/upstars-logo.png';

interface UpstarsLogoProps {
  /** Visual size of the mark. */
  size?: 'sm' | 'md' | 'lg' | 'hero';
  /** Show wordmark beside the logo. */
  withWordmark?: boolean;
  /** Light subtitle text for dark backgrounds (sidebar / auth panel). */
  light?: boolean;
  className?: string;
  imgClassName?: string;
}

/** Height-based sizes; width stays natural so the mark isn’t forced into a circle. */
const SIZE = {
  sm: 'h-8 w-auto',
  md: 'h-10 w-auto',
  lg: 'h-14 w-auto',
  hero: 'h-28 w-auto sm:h-36',
} as const;

/** Official UPSTARS mark — shown free, no circular crop or ring. */
export function UpstarsLogo({
  size = 'md',
  withWordmark = false,
  light = false,
  className,
  imgClassName,
}: UpstarsLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src={LOGO_SRC}
        alt="UPSTARS"
        className={cn(SIZE[size], 'shrink-0 object-contain', imgClassName)}
        draggable={false}
      />
      {withWordmark && (
        <div className="leading-tight">
          <p
            className={cn(
              'font-bold uppercase tracking-[0.14em] text-gold',
              size === 'sm' ? 'text-sm' : 'text-base',
            )}
          >
            UPSTARS
          </p>
          <p
            className={cn(
              'max-w-[12rem] text-[9px] font-medium leading-snug tracking-wide',
              light ? 'text-navy-200' : 'text-slate-500',
            )}
          >
            Human Resource Management System
          </p>
        </div>
      )}
    </div>
  );
}
