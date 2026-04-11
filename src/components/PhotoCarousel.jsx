import { useState, useRef } from 'react'

export default function PhotoCarousel({ images = [], alt = 'listing photo', onClick }) {
  const [index, setIndex] = useState(0)
  const touchStart = useRef(null)

  if (!images.length) {
    return (
      <div
        className="aspect-square bg-gray-50 flex items-center justify-center select-none cursor-pointer"
        onClick={onClick}
      >
        <img src="/logo.png" alt="UMarket" className="w-20 h-20 object-contain opacity-20" />
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
        onError={(e) => { e.currentTarget.style.display = 'none' }}
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
