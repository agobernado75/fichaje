import { aMinutos } from './horario.js'

// Saldo diario frente al turno (modelo por tramos):
// - tardanza: minutos fichados de entrada después del comienzo del turno.
// - extras: minutos trabajados a mayores después del fin del turno.
// - excesoDescanso: minutos de descanso por encima del permitido en el centro.
// - saldo = extras - tardanza - excesoDescanso: positivo = extras, negativo = pendiente, 0 = recuperado.
export function calcularSaldo({
  entrada,
  salida,
  inicioTurno,
  finTurno,
  excesoDescanso = 0,
}) {
  if (!entrada || !salida || !inicioTurno || !finTurno) return null
  const e = aMinutos(entrada)
  const s = aMinutos(salida)
  const i = aMinutos(inicioTurno)
  const f = aMinutos(finTurno)
  if (e === null || s === null || i === null || f === null) return null

  const tardanza = Math.max(0, e - i)
  const extras = Math.max(0, s - f)
  const exceso = Math.max(0, excesoDescanso ?? 0)
  return { tardanza, extras, exceso, saldo: extras - tardanza - exceso }
}

export function formatearSaldo(min) {
  if (min === null || min === undefined || Number.isNaN(min)) return '—'
  if (min === 0) return '0m'
  const signo = min > 0 ? '+' : '-'
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h === 0) return `${signo}${m}m`
  if (m === 0) return `${signo}${h}h`
  return `${signo}${h}h ${m}m`
}