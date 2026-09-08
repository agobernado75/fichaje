export function hoyISO() {
  return new Date().toLocaleDateString('sv-SE')
}

export function horaActual() {
  return new Date().toTimeString().slice(0, 5)
}

function aMinutos(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function calcularMinutos(entrada, salida) {
  const ini = aMinutos(entrada)
  const fin = aMinutos(salida)
  if (ini === null || fin === null) return null
  let diff = fin - ini
  if (diff < 0) diff += 24 * 60
  return diff
}

function formatoHoras(diff) {
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h === 0 && m === 0) return '0h'
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function calcularHoras(entrada, salida) {
  const diff = calcularMinutos(entrada, salida)
  if (diff === null) return null
  return formatoHoras(diff)
}

// El descanso permitido (dentro del horario laboral) no descuenta;
// solo el exceso sobre lo permitido resta del tiempo efectivo.
export function calcularMinutosEfectivos(
  entrada,
  salida,
  minutosPausa = 0,
  descansoPermitido = 0,
) {
  const base = calcularMinutos(entrada, salida)
  if (base === null) return null
  const exceso = Math.max(0, (minutosPausa ?? 0) - (descansoPermitido ?? 0))
  return Math.max(0, base - exceso)
}

export function calcularHorasEfectivas(
  entrada,
  salida,
  minutosPausa = 0,
  descansoPermitido = 0,
) {
  const diff = calcularMinutosEfectivos(
    entrada,
    salida,
    minutosPausa,
    descansoPermitido,
  )
  if (diff === null) return null
  return formatoHoras(diff)
}

export function minutosAHorasDecimal(minutos) {
  return Math.round((minutos / 60) * 100) / 100
}
