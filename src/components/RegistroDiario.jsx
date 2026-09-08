import { useMemo, useState } from 'react'
import { hoyISO, calcularHorasEfectivas } from '../lib/tiempo'
import { calcularSaldo, formatearSaldo } from '../lib/saldo'

export default function RegistroDiario({
  empleados,
  registros,
  ausencias = [],
  centros = [],
  onActualizarRegistro,
}) {
  const [fecha, setFecha] = useState(hoyISO())
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const activos = empleados.filter((e) => e.activo)

  const descansoPorCentro = useMemo(
    () => new Map(centros.map((c) => [c.id, c.descansoMin ?? 0])),
    [centros],
  )
  const descansoPermitidoDe = (registro, empleado) =>
    descansoPorCentro.get(
      registro?.workCenterId ?? empleado?.centroId ?? null,
    ) ?? 0

  const registroDe = (empleadoId) =>
    registros.find((r) => r.empleadoId === empleadoId && r.fecha === fecha)

  function abrirEdicion(empleado, registro) {
    setError('')
    setEditando({
      empleadoId: empleado.id,
      nombre: empleado.nombre,
      fecha,
      entrada: registro?.entrada ?? '',
      salida: registro?.salida ?? '',
      tieneEntrada: Boolean(registro?.entradaId),
      tieneSalida: Boolean(registro?.salidaId),
    })
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setGuardando(true)
    try {
      await onActualizarRegistro({
        empleadoId: editando.empleadoId,
        fecha: editando.fecha,
        entrada: editando.entrada,
        salida: editando.salida,
      })
      setEditando(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section>
      <div className="cabecera-seccion">
        <h2>Registro diario</h2>
        <label className="filtro-fecha">
          Fecha
          <input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => setFecha(e.target.value || hoyISO())}
          />
        </label>
      </div>

      {activos.length === 0 ? (
        <p className="vacio">
          No hay empleados activos. Agrega uno en «Alta Empleado».
        </p>
      ) : (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Descansos</th>
                <th>Horas efectivas</th>
                <th className="celda-saldo">Saldo</th>
                <th className="celda-acciones"></th>
              </tr>
            </thead>
            <tbody>
              {activos.map((empleado) => {
                const registro = registroDe(empleado.id)
                const entrada = registro?.entrada ?? ''
                const salida = registro?.salida ?? ''
                const pausas = registro?.pausas ?? []
                const enPausa = registro?.enPausa ?? false
                const permitido = descansoPermitidoDe(registro, empleado)
                const exceso = Math.max(
                  0,
                  (registro?.minutosPausa ?? 0) - permitido,
                )
                const horas = calcularHorasEfectivas(
                  entrada,
                  salida,
                  registro?.minutosPausa,
                  permitido,
                )
                const saldo = calcularSaldo({
                  entrada,
                  salida,
                  inicioTurno: empleado.horarioInicio,
                  finTurno: empleado.horarioFin,
                  excesoDescanso: exceso,
                })
                const ausencia = ausencias.find(
                  (a) => a.empleadoId === empleado.id && !a.closed_at,
                )
                return (
                  <tr key={empleado.id}>
                    <td className="celda-nombre">
                      <span className="nombre">{empleado.nombre}</span>
                      {ausencia && (
                        <span className={`sello-ausencia sello-${ausencia.motivo}`}>
                          {ausencia.motivo === 'medico' ? 'Médico' : 'Otros'}
                        </span>
                      )}
                      {empleado.cargo && (
                        <span className="cargo">{empleado.cargo}</span>
                      )}
                    </td>
                    <td>{entrada || '—'}</td>
                    <td>{salida || '—'}</td>
                    <td>
                      {pausas.length > 0
                        ? `${pausas.join(', ')}${enPausa ? ' · en descanso' : ''}`
                        : enPausa
                          ? 'en descanso'
                          : '—'}
                    </td>
                    <td className="celda-horas">{horas ?? '—'}</td>
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
                    <td className="celda-acciones">
                      <button
                        type="button"
                        className="btn btn-secundario btn-mini"
                        onClick={() => abrirEdicion(empleado, registro)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <form
            className="modal-edicion"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h3>Editar fichaje</h3>
            <p className="modal-edicion-sub">
              {editando.nombre} · {editando.fecha}
            </p>

            <label className="fila-form">
              <span>Entrada</span>
              <input
                type="time"
                value={editando.entrada}
                onChange={(e) =>
                  setEditando({ ...editando, entrada: e.target.value })
                }
              />
            </label>
            <p className="modal-edicion-aviso">
              {editando.tieneEntrada
                ? 'Se modificará la entrada actual.'
                : 'Sin entrada registrada: se creará al guardar.'}
            </p>

            <label className="fila-form">
              <span>Salida</span>
              <input
                type="time"
                value={editando.salida}
                onChange={(e) =>
                  setEditando({ ...editando, salida: e.target.value })
                }
              />
            </label>
            <p className="modal-edicion-aviso">
              {editando.tieneSalida
                ? 'Se modificará la salida actual.'
                : 'Sin salida registrada: se creará al guardar.'}
            </p>

            {error && <p className="login-error">{error}</p>}

            <div className="modal-acciones">
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setEditando(null)}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primario"
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}