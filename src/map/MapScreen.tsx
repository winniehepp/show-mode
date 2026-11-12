import type { ReactNode } from 'react';
import { cx } from '../components/ui';

export const PHONE_W = 278;
export const PHONE_H = 536;

/**
 * Full-bleed map with floating controls on top and a bottom sheet, the standard rideshare layout.
 * `floating` sits on the map just above the sheet (e.g. a "Directions to pickup" button).
 */
export function MapScreen({
  map,
  top,
  sheet,
  floating,
  dark,
  tall,
}: {
  map: ReactNode;
  top?: ReactNode;
  sheet: ReactNode;
  floating?: ReactNode;
  dark?: boolean;
  tall?: boolean;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {map}
      {top && <div className="absolute inset-x-3 top-2.5 z-10 space-y-2">{top}</div>}
      <div className={cx('absolute inset-x-0 bottom-0 z-10 flex flex-col', tall ? 'max-h-[88%]' : 'max-h-[66%]')}>
        {floating && <div className="px-3 pb-2">{floating}</div>}
        <div
          className={cx(
            'no-scrollbar min-h-0 overflow-y-auto rounded-t-[18px] px-4 pb-3 pt-2 shadow-[0_-6px_24px_rgba(0,0,0,0.14)]',
            dark ? 'bg-neutral-900 text-white' : 'bg-white',
          )}
        >
          <div className={cx('mx-auto mb-2.5 h-1 w-9 rounded-full', dark ? 'bg-neutral-600' : 'bg-gray-300')} />
          {sheet}
        </div>
      </div>
    </div>
  );
}

/** Round floating map button (menu / back). */
export function MapButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[16px] shadow-md">
      {children}
    </button>
  );
}
