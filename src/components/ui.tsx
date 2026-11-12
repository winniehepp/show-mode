import type { ReactNode } from 'react';
import type { Health } from '../sim/types';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export const healthDot: Record<Health, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};
export const healthText: Record<Health, string> = {
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
};
export const healthLabel: Record<Health, string> = { green: 'Healthy', amber: 'Watch', red: 'Action' };

export function Toggle({
  on,
  onClick,
  children,
  tag,
  title,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  tag?: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        on ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500',
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', on ? 'bg-emerald-400' : 'bg-gray-300')} />
      {children}
      {tag && (
        <span className={cx('rounded px-1 text-[10px] font-semibold', on ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>
          {tag}
        </span>
      )}
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          disabled={o.disabled}
          title={o.title}
          className={cx(
            'rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-[13px]',
            value === o.value ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:text-black',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({
  title,
  right,
  children,
  className,
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('rounded-xl border border-gray-200 bg-white p-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'solid',
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'solid' | 'ghost' | 'outline';
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-40',
        variant === 'solid' && 'bg-black text-white hover:bg-gray-800',
        variant === 'outline' && 'border border-gray-300 bg-white text-black hover:border-black',
        variant === 'ghost' && 'text-gray-600 hover:bg-gray-100 hover:text-black',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Product mark: a stylised ticket stub. Fictional, not a real brand. */
export function Mark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1" y="4" width="22" height="16" rx="4" fill="currentColor" />
      <circle cx="1" cy="12" r="3" fill="white" />
      <circle cx="23" cy="12" r="3" fill="white" />
      <path d="M8 9.5h8M8 14.5h5" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
