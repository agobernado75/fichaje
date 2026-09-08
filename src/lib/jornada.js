function aFechaLocal(iso) {
  const d = new Date(iso)
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function aHoraLocal(iso) {
  const d = new Date(iso)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

// Decide qué tipo de evento corresponde al fichar, según el último evento del día.
// pausa=true marca una pausa (descanso); el sistema alterna inicio/fin automáticamente.
export function tipoDeEvento(ultimoEvento, pausa = false) {
  const tipo = ultimoEvento?.event_type

  if (pausa) {
    if (!tipo) return 'pausa_sin_entrada'
    if (tipo === 'salida') return 'finalizada'
    return tipo === 'pausa_inicio' ? 'pausa_fin' : 'pausa_inicio'
  }

  switch (tipo) {
    case 'entrada':
      return 'salida'
    case 'pausa_inicio':
      return 'pausa_fin'
    case 'pausa_fin':
      return 'salida'
    default:
      return 'entrada'
  }
}

// Agrupa eventos en registros diarios por empleado y fecha, calculando
// entradas, salidas, franjas de pausa y minutos de pausa.
export function agruparJornadas(timeRecords) {
  const grupos = new Map()

  for (const r of timeRecords) {
    const fecha = aFechaLocal(r.recorded_at)
    const clave = `${r.empleadoId}__${fecha}`
    const grupo = grupos.get(clave) ?? {
      empleadoId: r.empleadoId,
      nombre: r.nombre,
      fecha,
      eventos: [],
    }
    grupo.eventos.push({
      id: r.id,
      iso: r.recorded_at,
      hora: aHoraLocal(r.recorded_at),
      evento: r.event_type,
      workCenterId: r.work_center_id ?? null,
    })
    grupos.set(clave, grupo)
  }

  return [...grupos.values()].map((g) => {
    const eventos = g.eventos.sort((a, b) => a.iso.localeCompare(b.iso))
    const eventoEntrada = eventos.find((e) => e.evento === 'entrada')
    const eventoSalida = [...eventos]
      .reverse()
      .find((e) => e.evento === 'salida')
    const entrada = eventoEntrada?.hora ?? ''
    const salida = eventoSalida?.hora ?? ''
    const centroDelDia =
      eventos.find((e) => e.evento === 'entrada')?.workCenterId ??
      eventos[0]?.workCenterId ??
      null

    const pausas = []
    let minutosPausa = 0
    let enPausa = false
    let inicio = null
    for (const e of eventos) {
      if (e.evento === 'pausa_inicio') {
        inicio = e
        enPausa = true
      } else if (e.evento === 'pausa_fin' && inicio) {
        let diff = aMinutos(e.hora) - aMinutos(inicio.hora)
        if (diff < 0) diff += 24 * 60
        minutosPausa += diff
        pausas.push(`${inicio.hora}–${e.hora}`)
        inicio = null
        enPausa = false
      }
    }

    return {
      id: `${g.empleadoId}__${g.fecha}`,
      empleadoId: g.empleadoId,
      nombre: g.nombre,
      fecha: g.fecha,
      entrada,
      salida,
      entradaId: eventoEntrada?.id ?? null,
      salidaId: eventoSalida?.id ?? null,
      pausas,
      enPausa,
      minutosPausa,
      workCenterId: centroDelDia,
    }
  })
}

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
