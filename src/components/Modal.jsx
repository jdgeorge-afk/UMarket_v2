import { useEffect } from 'react'

/**
 * Shared modal wrapper.
 * - Mobile: full-screen overlay with sticky header (title + back button)
 * - Desktop (sm+): centered dialog with max height
 */
export default function Modal({ children, onClose, fullHeight = false, wide = false, title, footer }) {
  // Lock background scroll without breaking touch-scroll inside the modal
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-4"
      style={{ height: '100dvh' }}
    >
      {/* Backdrop — tapping closes on desktop; hidden behind full-screen sheet on mobile */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet / Dialog */}
      <div
        className={[
          'relative bg-white z-10 w-full',
          // Mobile: fill the entire remaining viewport so nothing is clipped
          'flex-1 flex flex-col',
          // Desktop: revert to a centered dialog
          'sm:flex-none sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
          fullHeight ? 'sm:max-h-[90vh]' : '',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Mobile sticky header ────────────────────────────────────────── */}
        <div className="sm:hidden flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label="Back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-bold text-gray-900 text-base">{title ?? 'Back'}</span>
        </div>

        {/* ── Scrollable content ──────────────────────────────────────────── */}
        <div
          className={[
            'p-6 pb-4',
            'overflow-y-auto flex-1 min-h-0',
            fullHeight ? 'sm:overflow-y-auto' : '',
          ].join(' ')}
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        >
          {/* Drag handle — desktop only */}
          <div className="hidden sm:block w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
          {children}
        </div>

        {/* ── Sticky footer (action buttons) ──────────────────────────────── */}
        {footer && (
          <div
            className="shrink-0 px-6 pt-3 pb-6 border-t border-gray-100 bg-white"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
