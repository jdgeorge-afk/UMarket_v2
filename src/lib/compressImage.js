const DEFAULT_MAX_PX  = 1200
const DEFAULT_QUALITY = 0.82

/**
 * Compress an image File in the browser before uploading to Supabase Storage.
 * Resizes so the longest edge is ≤ maxPx and re-encodes as JPEG.
 * A 5 MB phone photo typically becomes 200–400 KB (10–25× reduction).
 *
 * @param {File}   file     - original image file
 * @param {number} maxPx    - longest edge cap in pixels (default 1200)
 * @param {number} quality  - JPEG quality 0–1 (default 0.82)
 * @returns {Promise<File>} - compressed JPEG File (.jpg extension)
 */
export async function compressImage(file, maxPx = DEFAULT_MAX_PX, quality = DEFAULT_QUALITY) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return } // fall back to original on failure
          const baseName = file.name.replace(/\.[^.]+$/, '')
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) } // fall back on load error
    img.src = url
  })
}
