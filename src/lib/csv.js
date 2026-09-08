function escapar(valor) {
  const texto = String(valor ?? '')
  if (/[",;\n]/.test(texto)) {
    return `"${texto.replaceAll('"', '""')}"`
  }
  return texto
}

export function descargarCSV(nombreArchivo, filas) {
  const encabezados = Object.keys(filas[0] ?? { vacio: '' })
  const lineas = [encabezados, ...filas.map((f) => encabezados.map((c) => f[c]))]
  const contenido =
    '\uFEFF' + lineas.map((linea) => linea.map(escapar).join(';')).join('\n')
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}
