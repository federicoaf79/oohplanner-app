/**
 * generateMockup.js
 * Genera mockup: foto de cartel + arte en perspectiva dentro de billboard_zone
 * Usa canvas con subdivisión en triángulos para aproximar perspectiva.
 */

// Carga una imagen y la devuelve como HTMLImageElement
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar: ${src?.slice(0, 60)}`))
    img.src = src
  })
}

// Interpola bilinealmente entre las 4 esquinas del zone
// u,v en [0,1] → punto en pixels
function bilinear(tl, tr, bl, br, u, v) {
  const topX = tl.x + (tr.x - tl.x) * u
  const topY = tl.y + (tr.y - tl.y) * u
  const botX = bl.x + (br.x - bl.x) * u
  const botY = bl.y + (br.y - bl.y) * u
  return { x: topX + (botX - topX) * v, y: topY + (botY - topY) * v }
}

/**
 * Dibuja un triángulo de la imagen source mapeado a un triángulo destino
 * usando ctx.setTransform() + clip
 *
 * Source: (s0x,s0y), (s1x,s1y), (s2x,s2y) en coordenadas de la imagen
 * Dest:   (d0x,d0y), (d1x,d1y), (d2x,d2y) en coordenadas del canvas
 *
 * Transformación afín: destX = a*srcX + c*srcY + e
 *                      destY = b*srcX + d*srcY + f
 * Resuelta con regla de Cramer para 3 correspondencias de puntos.
 */
function drawTriangle(ctx, img,
  s0x, s0y, s1x, s1y, s2x, s2y,
  d0x, d0y, d1x, d1y, d2x, d2y
) {
  // Determinante de la matriz de coeficientes source
  const denom = s0x * (s1y - s2y) + s1x * (s2y - s0y) + s2x * (s0y - s1y)
  if (Math.abs(denom) < 0.001) return

  ctx.save()

  // Clip al triángulo destino
  ctx.beginPath()
  ctx.moveTo(d0x, d0y)
  ctx.lineTo(d1x, d1y)
  ctx.lineTo(d2x, d2y)
  ctx.closePath()
  ctx.clip()

  // Regla de Cramer para los dos sistemas 3×3 compartiendo la misma matriz:
  //   [s0x s0y 1]   sistema X → [a, c, e]   sistema Y → [b, d, f]
  //   [s1x s1y 1]
  //   [s2x s2y 1]
  const a = (d0x * (s1y - s2y) + d1x * (s2y - s0y) + d2x * (s0y - s1y)) / denom
  const b = (d0y * (s1y - s2y) + d1y * (s2y - s0y) + d2y * (s0y - s1y)) / denom
  const c = (-d0x * (s1x - s2x) - d1x * (s2x - s0x) - d2x * (s0x - s1x)) / denom
  const d = (-d0y * (s1x - s2x) - d1y * (s2x - s0x) - d2y * (s0x - s1x)) / denom
  const e = (d0x * (s1x * s2y - s2x * s1y) + d1x * (s2x * s0y - s0x * s2y) + d2x * (s0x * s1y - s1x * s0y)) / denom
  const f = (d0y * (s1x * s2y - s2x * s1y) + d1y * (s2x * s0y - s0x * s2y) + d2y * (s0x * s1y - s1x * s0y)) / denom

  ctx.setTransform(a, b, c, d, e, f)
  ctx.drawImage(img, 0, 0)

  ctx.restore()
}

/**
 * Dibuja el artwork en perspectiva sobre la zona del cartel.
 * Subdivide el artwork en una grilla NxN de quads, cada quad en 2 triángulos.
 *
 * @param ctx       - Canvas 2D context
 * @param artwork   - HTMLImageElement del arte
 * @param tl,tr,bl,br - Esquinas destino en pixels del canvas
 * @param divisions - Subdivisiones de la grilla (más = mejor perspectiva)
 */
function drawPerspective(ctx, artwork, tl, tr, bl, br, divisions = 24) {
  const imgW = artwork.width
  const imgH = artwork.height

  for (let j = 0; j < divisions; j++) {
    for (let i = 0; i < divisions; i++) {
      const u0 = i / divisions
      const u1 = (i + 1) / divisions
      const v0 = j / divisions
      const v1 = (j + 1) / divisions

      // Source coords en la imagen del artwork
      const sx0 = u0 * imgW, sy0 = v0 * imgH
      const sx1 = u1 * imgW, sy1 = v1 * imgH

      // Dest coords interpolados bilinealmente
      const p00 = bilinear(tl, tr, bl, br, u0, v0)
      const p10 = bilinear(tl, tr, bl, br, u1, v0)
      const p01 = bilinear(tl, tr, bl, br, u0, v1)
      const p11 = bilinear(tl, tr, bl, br, u1, v1)

      // Triángulo superior: (0,0)-(1,0)-(0,1) del quad
      drawTriangle(ctx, artwork,
        sx0, sy0,  sx1, sy0,  sx0, sy1,
        p00.x, p00.y,  p10.x, p10.y,  p01.x, p01.y
      )

      // Triángulo inferior: (1,0)-(1,1)-(0,1) del quad
      drawTriangle(ctx, artwork,
        sx1, sy0,  sx1, sy1,  sx0, sy1,
        p10.x, p10.y,  p11.x, p11.y,  p01.x, p01.y
      )
    }
  }
}

/**
 * Genera un mockup: foto del cartel con el artwork insertado en perspectiva.
 *
 * @param {string} photoSrc   - URL o dataURL de la foto del cartel
 * @param {Object} zone       - { tl:{x,y}, tr:{x,y}, bl:{x,y}, br:{x,y} } coords 0-1
 * @param {string} artworkSrc - URL o dataURL del arte publicitario
 * @param {Object} [options]
 * @param {number} [options.maxWidth=1200]  - Ancho máximo del canvas
 * @param {number} [options.quality=0.85]   - Calidad JPEG
 * @returns {Promise<string>} dataURL JPEG del mockup
 */
export async function generateMockup(photoSrc, zone, artworkSrc, options = {}) {
  const { maxWidth = 1200, quality = 0.85 } = options

  const [photo, artwork] = await Promise.all([
    loadImage(photoSrc),
    loadImage(artworkSrc),
  ])

  // Canvas al tamaño de la foto (capped)
  let w = photo.width, h = photo.height
  if (w > maxWidth) {
    h = Math.round(h * maxWidth / w)
    w = maxWidth
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  // 1. Dibujar foto base
  ctx.drawImage(photo, 0, 0, w, h)

  // 2. Convertir zone (0-1) a pixels
  const tl = { x: zone.tl.x * w, y: zone.tl.y * h }
  const tr = { x: zone.tr.x * w, y: zone.tr.y * h }
  const bl = { x: zone.bl.x * w, y: zone.bl.y * h }
  const br = { x: zone.br.x * w, y: zone.br.y * h }

  // 3. Dibujar artwork en perspectiva
  drawPerspective(ctx, artwork, tl, tr, bl, br)

  // 4. Exportar
  return canvas.toDataURL('image/jpeg', quality)
}
