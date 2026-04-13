/**
 * validateArtwork.js
 * Valida ratio y resolución mínima de imágenes para mockups OOH.
 */

const SLOT_RULES = {
  h: {
    label: 'Horizontal (16:9)',
    targetRatio: 16 / 9,     // 1.778
    minRatio: 1.5,
    maxRatio: 2.0,
    minW: 1600,
    minH: 900,
    example: '1920 × 1080',
  },
  v: {
    label: 'Vertical (9:16)',
    targetRatio: 9 / 16,     // 0.5625
    minRatio: 0.45,
    maxRatio: 0.65,
    minW: 900,
    minH: 1600,
    example: '1080 × 1920',
  },
  sq: {
    label: 'Cuadrado (1:1)',
    targetRatio: 1.0,
    minRatio: 0.85,
    maxRatio: 1.15,
    minW: 900,
    minH: 900,
    example: '1080 × 1080',
  },
}

/**
 * Lee las dimensiones reales de una imagen File.
 * @param {File} file
 * @returns {Promise<{width: number, height: number}>}
 */
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}

/**
 * Valida una imagen para un slot de artwork.
 *
 * @param {File} file - Archivo de imagen
 * @param {'h' | 'v' | 'sq'} slot - Slot destino
 * @returns {Promise<{ valid: boolean, error?: string, width?: number, height?: number }>}
 */
export async function validateArtwork(file, slot) {
  // Validar tipo
  if (!file.type || !['image/jpeg', 'image/png'].includes(file.type)) {
    return { valid: false, error: 'Solo se aceptan archivos PNG o JPG.' }
  }

  // Validar peso (2MB)
  if (file.size > 2 * 1024 * 1024) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1)
    return { valid: false, error: `La imagen pesa ${sizeMB} MB. Máximo permitido: 2 MB.` }
  }

  const rules = SLOT_RULES[slot]
  if (!rules) {
    return { valid: false, error: 'Slot de arte no válido.' }
  }

  // Leer dimensiones reales
  let dims
  try {
    dims = await getImageDimensions(file)
  } catch {
    return { valid: false, error: 'No se pudo leer la imagen. Verificá que sea un archivo válido.' }
  }

  const { width, height } = dims
  const ratio = width / height

  // Validar resolución mínima
  if (width < rules.minW || height < rules.minH) {
    return {
      valid: false,
      width,
      height,
      error: `La imagen es muy chica (${width} × ${height} px). Para ${rules.label} el mínimo es ${rules.minW} × ${rules.minH} px (recomendado: ${rules.example}).`,
    }
  }

  // Validar ratio
  if (ratio < rules.minRatio || ratio > rules.maxRatio) {
    const orientation = ratio > rules.targetRatio ? 'ancha' : 'alta'
    return {
      valid: false,
      width,
      height,
      error: `La proporción no es correcta para ${rules.label} — la imagen es demasiado ${orientation} (${width} × ${height}). Necesitás una imagen con proporción cercana a ${rules.example}.`,
    }
  }

  return { valid: true, width, height }
}

export { SLOT_RULES }
