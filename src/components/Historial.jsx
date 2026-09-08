import { useCallback, useMemo, useState } from 'react'
import {
  hoyISO,
  calcularMinutosEfectivos,
  calcularHorasEfectivas,
  minutosAHorasDecimal,
} from '../lib/tiempo'
import { descargarCSV } from '../lib/csv'
import { calcularSaldo, formatearSaldo } from '../lib/saldo'

export default function Historial({ empleados, registros, centros = [] }) {
  const hace30Dias = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return d.toLocaleDateString('sv-SE')
  }, [])
  const [desde, setDesde] = useState(hace30Dias)
  const [hasta, setHasta] = useState(hoyISO())
  const [empleadoFiltro, setEmpleadoFiltro] = useState('todos')

  const descansoPorCentro = useMemo(
    () => new Map(centros.map((c) => [c.id, c.descansoMin ?? 0])),
    [centros],
  )
  const descansoPermitidoDe = useCallback(
    (r, empleado) =>
      descansoPorCentro.get(r?.workCenterId ?? empleado?.centroId ?? null) ?? 0,
    [descansoPorCentro],
  )

  const nombreEmpleado = (id) =>
    empleados.find((e) => e.id === id)?.nombre ?? '(eliminado)'

  const filtrados = useMemo(
    () =>
      registros
        .filter((r) => r.fecha >= desde && r.fecha <= hasta)
        .filter((r) => empleadoFiltro === 'todos' || r.empleadoId === empleadoFiltro)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [registros, desde, hasta, empleadoFiltro],
  )

  const resumen = useMemo(() => {
    const mapa = new Map()
    for (const r of filtrados) {
      const emp = empleados.find((e) => e.id === r.empleadoId)
      const permitido = descansoPermitidoDe(r, emp)
      const exceso = Math.max(0, (r.minutosPausa ?? 0) - permitido)
      const minutos = calcularMinutosEfectivos(
        r.entrada,
        r.salida,
        r.minutosPausa,
        permitido,
      )
      if (minutos === null) continue
      const actual = mapa.get(r.empleadoId) ?? { dias: 0, minutos: 0, saldo: 0 }
      const saldo = calcularSaldo({
        entrada: r.entrada,
        salida: r.salida,
        inicioTurno: emp?.horarioInicio,
        finTurno: emp?.horarioFin,
        excesoDescanso: exceso,
      })
      actual.dias += 1
      actual.minutos += minutos
      if (saldo) actual.saldo += saldo.saldo
      mapa.set(r.empleadoId, actual)
    }
    return [...mapa.entries()]
      .map(([id, datos]) => ({
        id,
        nombre: empleados.find((e) => e.id === id)?.nombre ?? '(eliminado)',
        dias: datos.dias,
        horas: minutosAHorasDecimal(datos.minutos),
        saldo: datos.saldo,
      }))
      .sort((a, b) => b.horas - a.horas)
  }, [filtrados, empleados, descansoPermitidoDe])

  function exportarCSV() {
    descargarCSV(`asistencia_${desde}_${hasta}.csv`,
      filtrados.map((r) => {
        const emp = empleados.find((e) => e.id === r.empleadoId)
        const permitido = descansoPermitidoDe(r, emp)
        const exceso = Math.max(0, (r.minutosPausa ?? 0) - permitido)
        const saldo = calcularSaldo({
          entrada: r.entrada,
          salida: r.salida,
          inicioTurno: emp?.horarioInicio,
          finTurno: emp?.horarioFin,
          excesoDescanso: exceso,
        })
        return {
          Fecha: r.fecha,
          Empleado: nombreEmpleado(r.empleadoId),
          Entrada: r.entrada,
          Salida: r.salida,
          Descansos: r.pausas.join(', '),
          'Horas efectivas': calcularHorasEfectivas(
            r.entrada,
            r.salida,
            r.minutosPausa,
            permitido,
          ) ?? '',
          Saldo: saldo ? formatearSaldo(saldo.saldo) : '',
        }
      }),
    )
  }

  return (
    <section>
      <div className="cabecera-seccion">
        <h2>Historial y reportes</h2>
        <button
          type="button"
          className="btn btn-primario"
          onClick={exportarCSV}
          disabled={filtrados.length === 0}
        >
          Exportar CSV
        </button>
      </div>

      <div className="filtros">
        <label>
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>
        <label>
          Empleado
          <select
            value={empleadoFiltro}
            onChange={(e) => setEmpleadoFiltro(e.target.value)}
          >
            <option value="todos">Todos</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {resumen.length > 0 && (
        <div className="tarjetas-resumen">
          {resumen.map((r) => (
            <div key={r.id} className="tarjeta">
              <span className="tarjeta-nombre">{r.nombre}</span>
              <span className="tarjeta-dato">{r.horas} h</span>
              <span className="tarjeta-sub">
                {r.dias} día(s)
                {r.saldo !== 0 && (
                  <span
                    className={`saldo ${
                      r.saldo > 0 ? 'saldo-pos' : 'saldo-neg'
                    }`}
                  >
                    {' · saldo '}
                    {formatearSaldo(r.saldo)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {filtrados.length === 0 ? (
        <p className="vacio">No hay registros en el rango seleccionado.</p>
      ) : (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Empleado</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Descansos</th>
                <th>Horas efectivas</th>
                <th className="celda-saldo">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const emp = empleados.find((e) => e.id === r.empleadoId)
                const permitido = descansoPermitidoDe(r, emp)
                const exceso = Math.max(0, (r.minutosPausa ?? 0) - permitido)
                const saldo = calcularSaldo({
                  entrada: r.entrada,
                  salida: r.salida,
                  inicioTurno: emp?.horarioInicio,
                  finTurno: emp?.horarioFin,
                  excesoDescanso: exceso,
                })
                return (
                  <tr key={r.id}>
                  <td>{r.fecha}</td>
                  <td className="celda-nombre">
                    <span className="nombre">{nombreEmpleado(r.empleadoId)}</span>
                  </td>
                  <td>{r.entrada || '—'}</td>
                  <td>{r.salida || '—'}</td>
                  <td>{r.pausas.length > 0 ? r.pausas.join(', ') : '—'}</td>
                  <td className="celda-horas">
                    {calcularHorasEfectivas(
                      r.entrada,
                      r.salida,
                      r.minutosPausa,
                      permitido,
                    ) ?? '—'}
                  </td>
                  <td className="celda-saldo">
                    {saldo ? (
                      <>
                        <span
                          className={`saldo ${
                            saldo.saldo > 0
                              ? 'saldo-pos'
                              : saldo.saldo < 0
                                ? 'saldo-neg'
                                : ''
                          }`}
                        >
                          {formatearSaldo(saldo.saldo)}
                        </span>
                        {saldo.saldo !== 0 && (
                          <span className="saldo-desglose">
                            {saldo.tardanza}' tarde · {saldo.extras}' extra
                            {saldo.exceso > 0
                              ? ` · ${saldo.exceso}' descanso`
                              : ''}
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
