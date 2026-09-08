export function aMinutos(hhmm) {
  if (!hhmm) return null
  const partes = String(hhmm).split(':')
  if (partes.length < 2) return null
  const h = Number(partes[0])
  const m = Number(partes[1])
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

export function minutosAFormato(minutos) {
  if (minutos === null || minutos === undefined || Number.isNaN(minutos)) return ''
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h === 0 && m === 0) return '0h'
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// Horas laborables entre inicio y fin (soporta turnos que cruzan medianoche).
export function horasDelTurno(inicio, fin) {
  const ini = aMinutos(inicio)
  const f = aMinutos(fin)
  if (ini === null || f === null) return null
  let diff = f - ini
  if (diff < 0) diff += 24 * 60
  return diff
}

export function horasLaborables(inicio, fin) {
  const minutos = horasDelTurno(inicio, fin)
  return minutos === null ? '' : minutosAFormato(minutos)
}

export const ETIQUETAS_TURNO = {
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
  partida: 'Jornada partida',
}

export const TURNOS_PREDEFINIDOS = {
  manana: { inicio: '07:00', fin: '15:00' },
  tarde: { inicio: '15:00', fin: '23:00' },
  noche: { inicio: '23:00', fin: '07:00' },
  partida: {
    mañana: { inicio: '07:00', fin: '11:00' },
    tarde: { inicio: '15:00', fin: '19:00' },
  },
}

export function validarHorario(inicio, fin) {
  const minutos = horasDelTurno(inicio, fin)
  return minutos !== null && minutos > 0
}

// Minutos de la franja de la tarde (jornada partida). Opcional; null si no hay.
export function horasDelTurnoPartida(mañana, tarde) {
  const am = horasDelTurno(mañana?.inicio, mañana?.fin)
  const pm = tarde ? horasDelTurno(tarde.inicio, tarde.fin) : null
  if (am === null) return null
  return am + (pm ?? 0)
}