import { cn } from '../../lib/cn';

const LOGO_SRC = '/upstars-logo.png';

interface UpstarsLogoProps {
  /** Visual size of the mark. */
  size?: 'sm' | 'md' | 'lg' | 'hero';
  /** Show “HRMS” wordmark beside the logo. */
  withWordmark?: boolean;
  /** Light text for dark backgrounds (sidebar / auth panel). */
  light?: boolean;
  className?: string;
  imgClassName?: string;
}

const SIZE = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  hero: 'h-28 w-28 sm:h-36 sm:w-36',
} as const;

/** Official UPstars mark — gold laurel / UPS star on black. */
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
        alt="UPstars"
        className={cn(
          SIZE[size],
          'shrink-0 rounded-full object-cover shadow-lg shadow-black/40 ring-1 ring-gold/30',
          imgClassName,
        )}
        draggable={false}
      />
      {withWordmark && (
        <div className="leading-tight">
          <p className={cn('font-semibold tracking-tight', light ? 'text-white' : 'text-navy', size === 'sm' ? 'text-sm' : 'text-base')}>
            UP<span className="text-gold">stars</span>
          </p>
          <p
            className={cn(
              'text-[10px] font-medium uppercase tracking-[0.22em]',
              light ? 'text-navy-200' : 'text-slate-500',
            )}
          >
            HRMS
          </p>
        </div>
      )}
    </div>
  );
}
