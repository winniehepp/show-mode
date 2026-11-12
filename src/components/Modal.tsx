import type { ReactNode } from 'react';

export function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div className="max-h-full w-[880px] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
            {sub && <p className="text-[13px] text-gray-500">{sub}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[20px] leading-none text-gray-400 hover:bg-gray-100 hover:text-black"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
