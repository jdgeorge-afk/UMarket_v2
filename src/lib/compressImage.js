const MAX_DIMENSION = 1920
const QUALITY = 0.82

/**
 * Compresses and resizes an image File before upload.
 * - Resizes so neither dimension exceeds MAX_DIMENSION
 * - Converts to JPEG (handles HEIC/PNG/etc.)
 * - Returns a new File with .jpg extension
 */
export async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Image compression failed')); return }
          const baseName = file.name.replace(/\.[^.]+$/, '')
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        QUALITY
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}
