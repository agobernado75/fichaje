const MAX_LADO = 256
const MAX_BYTES = 2 * 1024 * 1024

function leerComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result)
    lector.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    lector.readAsDataURL(file)
  })
}

function dibujarEnCanvas(img, ladoMaximo) {
  const canvas = document.createElement('canvas')
  let { width, height } = img
  if (width > ladoMaximo || height > ladoMaximo) {
    const escala = ladoMaximo / Math.max(width, height)
    width = Math.round(width * escala)
    height = Math.round(height * escala)
  }
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (img.decode) {
    return img.decode().then(
      () => {
        ctx.drawImage(img, 0, 0, width, height)
        return canvas
      },
      () => {
        ctx.drawImage(img, 0, 0, width, height)
        return canvas
      },
    )
  }
  ctx.drawImage(img, 0, 0, width, height)
  return Promise.resolve(canvas)
}

// Valida png/jpg, redimensiona a máx. 256 px y devuelve un data URL PNG
// listo para guardar en companies.logo_url. Lanza error si no es válido.
export async function procesarImagenLogo(file) {
  if (!file) throw new Error('Selecciona una imagen.')
  if (!/^image\/(png|jpeg)$/.test(file.type)) {
    throw new Error('El logo debe estar en formato PNG o JPG.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('La imagen pesa más de 2 MB. Sube una más ligera.')
  }

  const dataUrl = await leerComoDataUrl(file)
  const img = new Image()
  img.src = dataUrl

  const canvas = await dibujarEnCanvas(img, MAX_LADO)
  return canvas.toDataURL('image/png')
}