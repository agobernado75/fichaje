import { horasDelTurno, horasDelTurnoPartida } from './horario.js'
import { calcularMinutosEfectivos } from './tiempo.js'

function esperadoDe(empleado) {
  if (empleado.turno === 'partida') {
    return horasDelTurnoPartida(
      { inicio: empleado.horarioInicio, fin: empleado.horarioFin },
      empleado.horarioInicioPm || empleado.horarioFinPm
        ? { inicio: empleado.horarioInicioPm, fin: empleado.horarioFinPm }
        : null,
    )
  }
  return horasDelTurno(empleado.horarioInicio, empleado.horarioFin)
}

function aFechaLocal(iso) {
  const d = new Date(iso)
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// Lista de fechas (YYYY-MM-DD) entre dos fechas, ambas inclusive.
function diasEntre(desde, hasta) {
  const lista = []
  const cursor = new Date(`${desde}T00:00:00`)
  const fin = new Date(`${hasta}T00:00:00`)
  if (fin < cursor) return lista
  while (cursor <= fin) {
    const ano = cursor.getFullYear()
    const mes = String(cursor.getMonth() + 1).padStart(2, '0')
    const dia = String(cursor.getDate()).padStart(2, '0')
    lista.push(`${ano}-${mes}-${dia}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return lista
}

const maxFecha = (a, b) => (a > b ? a : b)
const minFecha = (a, b) => (a < b ? a : b)

export function computarAbsentismo({
  empleados,
  centros,
  registros,
  ausencias,
  desde,
  hasta,
}) {
  const empleadoPorId = new Map(empleados.map((e) => [e.id, e]))
  const centroPorId = new Map(centros.map((c) => [c.id, c]))
  const descansoPorCentro = new Map(
    centros.map((c) => [c.id, c.descansoMin ?? 0]),
  )

  const jornadas = (registros ?? []).filter(
    (r) => r.fecha >= desde && r.fecha <= hasta,
  )

  const jornadaDias = new Set()
  for (const j of jornadas) jornadaDias.add(`${j.empleadoId}__${j.fecha}`)

  const porEmpleado = new Map()
  const porCentro = new Map()
  let empresaDeficitMin = 0
  let empresaMedicoMin = 0
  let empresaOtrosMin = 0

  function accEmpleado(empleado, centroId) {
    const id = empleado.id
    if (!porEmpleado.has(id)) {
      porEmpleado.set(id, {
        id,
        nombre: empleado.nombre,
        centroId: centroId ?? empleado.centroId ?? null,
        centroNombre: (centroId ?? empleado.centroId)
          ? centroPorId.get(centroId ?? empleado.centroId)?.nombre ?? ''
          : '',
        deficitMin: 0,
        medicoMin: 0,
        otrosMin: 0,
      })
    }
    return porEmpleado.get(id)
  }

  function accCentro(centroId) {
    const clave = centroId ?? 'sin-centro'
    if (!porCentro.has(clave)) {
      porCentro.set(clave, {
        centroId: centroId ?? null,
        nombre: centroId ? centroPorId.get(centroId)?.nombre ?? 'Sin centro' : 'Sin centro',
        deficitMin: 0,
        medicoMin: 0,
        otrosMin: 0,
      })
    }
    return porCentro.get(clave)
  }

  // --- Déficit sobre el horario en días fichados ---
  for (const j of jornadas) {
    const empleado = empleadoPorId.get(j.empleadoId)
    if (!empleado) continue
    const esperado = esperadoDe(empleado)
    if (esperado === null || esperado <= 0) continue
    const permitido =
      descansoPorCentro.get(j.workCenterId ?? empleado.centroId ?? null) ?? 0
    const actual = calcularMinutosEfectivos(
      j.entrada,
      j.salida,
      j.minutosPausa,
      permitido,
    )
    const d = Math.max(0, esperado - (actual ?? 0))
    if (d <= 0) continue

    const centroId = j.workCenterId ?? empleado.centroId ?? null
    accEmpleado(empleado, centroId).deficitMin += d
    accCentro(centroId).deficitMin += d
    empresaDeficitMin += d
  }

  // --- Ausencias: días sin fichar = déficit completo; duración por motivo ---
  for (const a of ausencias ?? []) {
    const empleado = empleadoPorId.get(a.empleadoId)
    if (!empleado) continue
    const centroId = a.work_center_id ?? empleado.centroId ?? null
    const item = accEmpleado(empleado, centroId)
    const itemCentro = accCentro(centroId)

    const inicio = aFechaLocal(a.recorded_at)
    const fin = a.closed_at ? aFechaLocal(a.closed_at) : hasta
    for (const dia of diasEntre(maxFecha(inicio, desde), minFecha(fin, hasta))) {
      if (jornadaDias.has(`${empleado.id}__${dia}`)) continue
      const esperado = esperadoDe(empleado)
      if (esperado === null || esperado <= 0) continue
      item.deficitMin += esperado
      itemCentro.deficitMin += esperado
      empresaDeficitMin += esperado
    }

    if (!a.closed_at) continue
    const duracion = (new Date(a.closed_at) - new Date(a.recorded_at)) / 60000
    if (duracion <= 0) continue
    if (a.motivo === 'medico') {
      item.medicoMin += duracion
      itemCentro.medicoMin += duracion
      empresaMedicoMin += duracion
    } else {
      item.otrosMin += duracion
      itemCentro.otrosMin += duracion
      empresaOtrosMin += duracion
    }
  }

  const listaEmpleados = [...porEmpleado.values()].map((e) => ({
    ...e,
    deficitHoras: redondear2(e.deficitMin / 60),
    medicoHoras: redondear2(e.medicoMin / 60),
    otrosHoras: redondear2(e.otrosMin / 60),
    totalAusenciaHoras: redondear2((e.medicoMin + e.otrosMin) / 60),
  }))

  const listaCentros = [...porCentro.values()].map((c) => ({
    ...c,
    deficitHoras: redondear2(c.deficitMin / 60),
    medicoHoras: redondear2(c.medicoMin / 60),
    otrosHoras: redondear2(c.otrosMin / 60),
  }))

  return {
    porEmpleado: listaEmpleados.sort((a, b) => b.deficitMin - a.deficitMin),
    porCentro: listaCentros.sort((a, b) => b.deficitMin - a.deficitMin),
    empresa: {
      deficitMin: empresaDeficitMin,
      medicoMin: empresaMedicoMin,
      otrosMin: empresaOtrosMin,
      deficitHoras: redondear2(empresaDeficitMin / 60),
      medicoHoras: redondear2(empresaMedicoMin / 60),
      otrosHoras: redondear2(empresaOtrosMin / 60),
    },
  }
}

function redondear2(n) {
  return Math.round(n * 100) / 100
}