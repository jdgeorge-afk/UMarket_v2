import { useEffect } from 'react'

/**
 * Shared modal wrapper.
 * - Mobile: slides up as a bottom sheet (rounded top corners + drag handle)
 * - Desktop (sm+): centered dialog
 */
export default function Modal({ children, onClose, fullHeight = false, wide = false }) {
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
          'relative bg-white z-10 p-6',
          'w-full rounded-t-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
          fullHeight ? 'max-h-[92vh] overflow-y-auto' : '',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5 sm:hidden" />
        {children}
      </div>
    </div>
  )
}
