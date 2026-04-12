/**
 * Compress an image File in the browser before uploading to Supabase Storage.
 *
 * Why this matters: a phone photo can be 5–10 MB. Serving that raw from
 * Supabase Storage burns egress quota fast. Compressing to ≤1200 px / 82 %
 * JPEG quality typically reduces a 5 MB photo to ~200–400 KB — a 10–25×
 * reduction — with no visible quality loss at card/detail size.
 *
 * @param {File}   file      — original image file
 * @param {number} maxPx     — longest edge in pixels (default 1200)
 * @param {number} quality   — JPEG quality 0–1 (default 0.82)
 * @returns {Promise<File>}  — compressed JPEG File (same name, .jpg extension)
 */
export async function compressImage(file, maxPx = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img

      // Scale down so the longest edge is ≤ maxPx, preserving aspect ratio
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height / width) * maxPx)
          width  = maxPx
        } else {
          width  = Math.round((width / height) * maxPx)
          height = maxPx
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas compression failed')); return }
          const baseName = file.name.replace(/\.[^.]+$/, '')
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // If compression fails for any reason, fall back to the original file
      resolve(file)
    }

    img.src = objectUrl
  })
}
