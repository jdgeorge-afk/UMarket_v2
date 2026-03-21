import { useEffect } from 'react'

/**
 * Shared modal wrapper.
 * - Mobile: slides up as a bottom sheet with sticky header (title + close button)
 * - Desktop (sm+): centered dialog
 */
export default function Modal({ children, onClose, fullHeight = false, wide = false, title }) {
  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet / Dialog */}
      <div
        className={[
          'relative bg-white z-10',
          'w-full rounded-t-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
          fullHeight ? 'max-h-[92vh] flex flex-col' : '',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Mobile sticky header ────────────────────────────────────────── */}
        <div className="sm:hidden flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-bold text-gray-900 text-base">{title ?? 'Back'}</span>
        </div>

        {/* ── Scrollable content ──────────────────────────────────────────── */}
        <div className={['p-6', fullHeight ? 'overflow-y-auto flex-1' : ''].join(' ')}>
          {/* Drag handle — desktop sheet hint, mobile uses header instead */}
          <div className="hidden sm:block w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
          {children}
        </div>
      </div>
    </div>
  )
}
