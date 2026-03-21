import { useState, useRef } from 'react'

export default function PhotoCarousel({ images = [], alt = 'listing photo', onClick }) {
  const [index, setIndex] = useState(0)
  const touchStart = useRef(null)

  if (!images.length) {
    return (
      <div
        className="aspect-square bg-gray-100 flex items-center justify-center text-gray-300 select-none cursor-pointer"
        onClick={onClick}
      >
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    )
  }

  const prev = (e) => {
    e.stopPropagation()
    setIndex((i) => (i > 0 ? i - 1 : images.length - 1))
  }
  const next = (e) => {
    e.stopPropagation()
    setIndex((i) => (i < images.length - 1 ? i + 1 : 0))
  }

  // Touch swipe support
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) diff > 0 ? next(e) : prev(e)
    touchStart.current = null
  }

  return (
    <div
      className="relative aspect-square overflow-hidden bg-gray-100 select-none cursor-pointer"
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={images[index]}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        draggable={false}
      />

      {/* Prev / Next arrows — only visible if multiple images */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center text-xs transition-colors"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center text-xs transition-colors"
            aria-label="Next photo"
          >
            ›
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIndex(i) }}
                className={`rounded-full transition-all ${
                  i === index ? 'bg-white w-3 h-1.5' : 'bg-white/50 w-1.5 h-1.5'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
