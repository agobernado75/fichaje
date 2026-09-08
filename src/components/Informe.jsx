import { useMemo, useState } from 'react'
import {
  calcularMinutosEfectivos,
  calcularHorasEfectivas,
  minutosAHorasDecimal,
} from '../lib/tiempo'
import { horasLaborables, horasDelTurnoPartida, minutosAFormato } from '../lib/horario'
import { exportarInformeXls } from '../lib/exportarXls'
import { exportarInformeDoc } from '../lib/exportarDoc'

function mesActual() {
  const ahora = new Date()
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`
}

const nombreMes = (mes) => {
  if (!mes) return ''
  const [ano, m] = mes.split('-')
  const nombre = new Date(Date.UTC(Number(ano), Number(m) - 1, 1)).toLocaleDateString(
    'es-ES',
    { month: 'long' },
  )
  return `${nombre[0]?.toUpperCase() ?? ''}${nombre.slice(1)} ${ano}`
}

export default function Informe({ empresa, centros, empleados, registros }) {
  const centrosActivos = useMemo(
    () => centros.filter((c) => c.activo),
    [centros],
  )
  const [centroId, setCentroId] = useState(centrosActivos[0]?.id ?? '')
  const [mes, setMes] = useState(mesActual())

  const empleadosDelCentro = useMemo(
    () => empleados.filter((e) => e.centroId === centroId),
    [empleados, centroId],
  )

  const descansoPorCentro = useMemo(
    () => new Map(centros.map((c) => [c.id, c.descansoMin ?? 0])),
    [centros],
  )

  const filas = useMemo(() => {
    const ids = new Set(empleadosDelCentro.map((e) => e.id))
    const nombreDe = new Map(empleadosDelCentro.map((e) => [e.id, e.nombre]))
    const horarioDe = new Map(
      empleadosDelCentro.map((e) => [
        e.id,
        {
          i: e.horarioInicio,
          f: e.horarioFin,
          ipm: e.horarioInicioPm,
          fpm: e.horarioFinPm,
          partida: e.turno === 'partida',
        },
      ]),
    )
    return (registros ?? [])
      .filter(
        (r) =>
          ids.has(r.empleadoId) &&
          r.fecha.startsWith(`${mes}-`) &&
          (r.entrada || r.salida),
      )
      .map((r) => {
        const horario = horarioDe.get(r.empleadoId) ?? {}
        const horasEsperadas = horario.partida
          ? minutosAFormato(
              horasDelTurnoPartida(
                { inicio: horario.i, fin: horario.f },
                horario.ipm || horario.fpm
                  ? { inicio: horario.ipm, fin: horario.fpm }
                  : null,
              ),
            ) || ''
          : horasLaborables(horario.i, horario.f) || ''
        const permitido =
          descansoPorCentro.get(r.workCenterId ?? centroId ?? null) ?? 0
        const minutos = calcularMinutosEfectivos(
          r.entrada,
          r.salida,
          r.minutosPausa,
          permitido,
        )
        return {
          fecha: r.fecha,
          nombre: nombreDe.get(r.empleadoId) ?? r.nombre,
          entrada: r.entrada,
          salida: r.salida,
          pausas: r.pausas,
          minutosEfectivos: minutos,
          horasEfectivas: minutos === null ? null : calcularHorasEfectivas(r.entrada, r.salida, r.minutosPausa, permitido),
          horasEsperadas,
        }
      })
  }, [empleadosDelCentro, registros, mes, centroId, descansoPorCentro])

  const resumenPorEmpleado = useMemo(() => {
    const mapa = new Map()
    for (const f of filas) {
      if (f.minutosEfectivos === null) continue
      const item = mapa.get(f.nombre) ?? { nombre: f.nombre, dias: 0, minutos: 0 }
      item.dias += 1
      item.minutos += f.minutosEfectivos
      mapa.set(f.nombre, item)
    }
    return [...mapa.values()].map((r) => ({
      nombre: r.nombre,
      dias: r.dias,
      horas: minutosAHorasDecimal(r.minutos),
    }))
  }, [filas])

  const trabajadoresDoc = useMemo(() => {
    const porEmpleado = new Map()
    for (const f of filas) {
      const item = porEmpleado.get(f.nombre) ?? { nombre: f.nombre, minutos: 0, filas: [] }
      item.minutos += f.minutosEfectivos ?? 0
      item.filas.push(f)
      porEmpleado.set(f.nombre, item)
    }
    return [...porEmpleado.values()]
      .map((t) => ({
        nombre: t.nombre,
        horasMes: minutosAFormato(t.minutos),
        filas: t.filas.sort((a, b) => a.fecha.localeCompare(b.fecha)),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [filas])

  const centro = centros.find((c) => c.id === centroId)

  const nombreArchivo = () =>
    `informe-${mes}-${centro?.nombre ?? 'sin-centro'}`

  function descargarXls() {
    exportarInformeXls({
      nombreArchivo: `${nombreArchivo()}.xlsx`,
      filas,
      resumenPorEmpleado,
    })
  }

  async function descargarWord() {
    await exportarInformeDoc({
      empresa,
      centro: centro
        ? { nombre: centro.nombre, direccion: centro.direccion, provincia: centro.provincia }
        : null,
      mes: nombreMes(mes),
      trabajadores: trabajadoresDoc,
    })
  }

  return (
    <section>
      <div className="cabecera-seccion">
        <h2>Informe</h2>
      </div>

      <div className="filtros">
        <label>
          Centro
          <select
            value={centroId}
            onChange={(e) => setCentroId(e.target.value)}
          >
            {centrosActivos.length === 0 && <option value="">Sin centros activos</option>}
            {centrosActivos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mes
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </label>
      </div>

      {centrosActivos.length === 0 ? (
        <p className="vacio">
          Crea un centro activo en «Alta centro» para poder generar informes.
        </p>
      ) : (
        <div className="informe-resumen">
          <p>
            <strong>{empresa?.name}</strong> · CIF {empresa?.tax_id ?? '—'} ·{' '}
            {centro?.nombre ?? ''}
            {centro?.direccion || centro?.provincia
              ? ` — ${[centro.direccion, centro.provincia].filter(Boolean).join(', ')}`
              : ''}
          </p>
          <p>
            Mes: <strong>{nombreMes(mes)}</strong> ·{' '}
            {filas.length} fichajes · {trabajadoresDoc.length} trabajadores
          </p>

          <div className="form-acciones">
            <button
              type="button"
              className="btn btn-primario"
              onClick={descargarXls}
              disabled={filas.length === 0}
            >
              Descargar XLS
            </button>
            <button
              type="button"
              className="btn btn-primario"
              onClick={descargarWord}
              disabled={filas.length === 0}
            >
              Descargar Word
            </button>
          </div>
        </div>
      )}

      {filas.length === 0 && centrosActivos.length > 0 && (
        <p className="vacio">
          No hay fichajes en el centro y mes seleccionados.
        </p>
      )}

      {resumenPorEmpleado.length > 0 && (
        <div className="tarjetas-resumen">
          {resumenPorEmpleado.map((r) => (
            <div key={r.nombre} className="tarjeta">
              <span className="tarjeta-nombre">{r.nombre}</span>
              <span className="tarjeta-dato">{r.horas} h</span>
              <span className="tarjeta-sub">{r.dias} día(s)</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}