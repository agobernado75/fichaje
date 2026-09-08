import { useMemo, useState } from 'react'
import QRModal from './QRModal'
import {
  horasLaborables,
  horasDelTurnoPartida,
  minutosAFormato,
  validarHorario,
  ETIQUETAS_TURNO,
  TURNOS_PREDEFINIDOS,
} from '../lib/horario'

function FormularioEmpleado({
  inicial,
  centros,
  onGuardar,
  onCancelar,
  esEdicion,
}) {
  const [nombre, setNombre] = useState(() => {
    if (!inicial) return ''
    const apellido = inicial?.apellidos ?? ''
    const completo = inicial?.nombre ?? ''
    if (apellido && completo.endsWith(apellido)) {
      return completo.slice(0, completo.length - apellido.length).trim()
    }
    return completo
  })
  const [apellidos, setApellidos] = useState(inicial?.apellidos ?? '')
  const [nif, setNif] = useState(inicial?.nif ?? '')
  const [centroId, setCentroId] = useState(
    inicial?.centroId ?? centros.find((c) => c.activo)?.id ?? '',
  )
  const [turno, setTurno] = useState(inicial?.turno ?? '')
  const [horaInicio, setHoraInicio] = useState(inicial?.horarioInicio ?? '')
  const [horaFin, setHoraFin] = useState(inicial?.horarioFin ?? '')
  const [horaInicioPm, setHoraInicioPm] = useState(inicial?.horarioInicioPm ?? '')
  const [horaFinPm, setHoraFinPm] = useState(inicial?.horarioFinPm ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const centrosActivos = useMemo(
    () => centros.filter((c) => c.activo),
    [centros],
  )

  const esPartida = turno === 'partida'
  const horas = esPartida
    ? minutosAFormato(
        horasDelTurnoPartida(
          { inicio: horaInicio, fin: horaFin },
          horaInicioPm || horaFinPm
            ? { inicio: horaInicioPm, fin: horaFinPm }
            : null,
        ),
      )
    : horasLaborables(horaInicio, horaFin)
  const horarioValido = validarHorario(horaInicio, horaFin)
  const mañanaValida = validarHorario(horaInicio, horaFin)
  const tardeCompleta = validarHorario(horaInicioPm, horaFinPm)
  const tardeParcial = (horaInicioPm || horaFinPm) && !tardeCompleta

  function cambiarTurno(e) {
    const valor = e.target.value
    setTurno(valor)
    const preset = TURNOS_PREDEFINIDOS[valor]
    if (preset) {
      if (valor === 'partida') {
        setHoraInicio(preset.mañana.inicio)
        setHoraFin(preset.mañana.fin)
        setHoraInicioPm(preset.tarde.inicio)
        setHoraFinPm(preset.tarde.fin)
      } else {
        setHoraInicio(preset.inicio)
        setHoraFin(preset.fin)
        setHoraInicioPm('')
        setHoraFinPm('')
      }
    }
  }

  async function enviar(e) {
    e.preventDefault()
    setError('')
    if (!nombre.trim() || !apellidos.trim()) {
      setError('Nombre y apellidos son obligatorios.')
      return
    }
    if (centrosActivos.length > 0 && !centroId) {
      setError('Selecciona el centro de trabajo.')
      return
    }
    if (!turno) {
      setError('Selecciona el turno (mañana, tarde, noche o jornada partida).')
      return
    }
    if (esPartida) {
      if (!mañanaValida) {
        setError('Indica un horario de mañana válido (ej. 07:00 – 11:00).')
        return
      }
      if (tardeParcial) {
        setError('Indica la franja de tarde completa o déjala vacía.')
        return
      }
    } else if (!horarioValido) {
      setError('Indica un horario válido (ej. 07:00 – 15:00).')
      return
    }
    setGuardando(true)
    try {
      await onGuardar({
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        nif: nif.trim().toUpperCase(),
        centroId: centrosActivos.length > 0 ? centroId : null,
        turno,
        horaInicio,
        horaFin,
        horaInicioPm,
        horaFinPm,
      })
    } catch (err) {
      setError(`No se pudo guardar: ${err?.message ?? 'error desconocido'}`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="form-empleado" onSubmit={enviar}>
      <label className="campo-form">
        <span>Nombre</span>
        <input
          type="text"
          placeholder="Antonio"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus={!esEdicion}
        />
      </label>
      <label className="campo-form">
        <span>Apellidos</span>
        <input
          type="text"
          placeholder="García Pérez"
          value={apellidos}
          onChange={(e) => setApellidos(e.target.value)}
        />
      </label>
      <label className="campo-form">
        <span>NIF/NIE</span>
        <input
          type="text"
          placeholder="00000000A"
          value={nif}
          onChange={(e) => setNif(e.target.value)}
        />
      </label>

      <label className="campo-form">
        <span>Centro asociado</span>
        {centrosActivos.length === 0 ? (
          <input type="text" value="Crea primero un centro" disabled />
        ) : centrosActivos.length === 1 ? (
          <input type="text" value={centrosActivos[0].nombre} disabled />
        ) : (
          <select value={centroId} onChange={(e) => setCentroId(e.target.value)}>
            <option value="" disabled>
              Selecciona un centro
            </option>
            {centrosActivos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="campo-form">
        <span>Turno</span>
        <select value={turno} onChange={cambiarTurno}>
          <option value="" disabled>
            Selecciona turno
          </option>
          {Object.entries(ETIQUETAS_TURNO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <label className="campo-form">
        <span>Horario</span>
        {esPartida ? (
          <div className="horario-partida">
            <div className="horario-franja">
              <span className="horario-franja-titulo">Mañana</span>
              <div className="horario-entrada">
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
                <span className="horario-separador">–</span>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                />
              </div>
            </div>
            <div className="horario-franja">
              <span className="horario-franja-titulo">Tarde</span>
              <div className="horario-entrada">
                <input
                  type="time"
                  value={horaInicioPm}
                  onChange={(e) => setHoraInicioPm(e.target.value)}
                />
                <span className="horario-separador">–</span>
                <input
                  type="time"
                  value={horaFinPm}
                  onChange={(e) => setHoraFinPm(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="horario-entrada">
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
            />
            <span className="horario-separador">–</span>
            <input
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
            />
          </div>
        )}
        <span className="horario-resumen">
          Horas laborables: <strong>{horas || '✓'}</strong>
        </span>
      </label>

      {error && <p className="error-form">{error}</p>}

      <div className="form-acciones">
        <button type="submit" className="btn btn-primario" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Dar de alta'}
        </button>
        {onCancelar && (
          <button type="button" className="btn btn-secundario" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

export default function AltaEmpleado({
  empleados,
  centros,
  onAgregar,
  onGuardar,
  onAlternar,
  onEliminar,
}) {
  const [editandoId, setEditandoId] = useState(null)
  const [qrEmpleado, setQrEmpleado] = useState(null)

  async function agregar(datos) {
    const nuevo = await onAgregar(datos)
    setQrEmpleado(nuevo)
  }

  const horarioEmpleado = (e) => {
    const base = `${e.horarioInicio || '??:??'} – ${e.horarioFin || '??:??'}`
    if (e.turno === 'partida' && (e.horarioInicioPm || e.horarioFinPm)) {
      return `${base} · ${e.horarioInicioPm || '??:??'} – ${e.horarioFinPm || '??:??'}`
    }
    return base
  }

  const horasEmpleado = (e) => {
    if (e.turno === 'partida') {
      return (
        minutosAFormato(
          horasDelTurnoPartida(
            { inicio: e.horarioInicio, fin: e.horarioFin },
            e.horarioInicioPm || e.horarioFinPm
              ? { inicio: e.horarioInicioPm, fin: e.horarioFinPm }
              : null,
          ),
        ) || '—'
      )
    }
    return horasLaborables(e.horarioInicio, e.horarioFin) || '—'
  }

  return (
    <section>
      <div className="cabecera-seccion">
        <h2>Alta de empleado</h2>
      </div>

      <div className="tarjeta-form">
        <FormularioEmpleado centros={centros} onGuardar={agregar} />
      </div>

      <div className="cabecera-seccion">
        <h2>Trabajadores</h2>
      </div>

      {empleados.length === 0 ? (
        <p className="vacio">Aún no hay trabajadores registrados.</p>
      ) : (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>NIF/NIE</th>
                <th>Centro</th>
                <th>Turno</th>
                <th>Horario</th>
                <th>Hs. laborables</th>
                <th>Estado</th>
                <th className="celda-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((empleado) =>
                editandoId === empleado.id ? (
                  <tr key={empleado.id}>
                    <td colSpan={8}>
                      <FormularioEmpleado
                        inicial={empleado}
                        centros={centros}
                        esEdicion
                        onGuardar={(datos) =>
                          onGuardar(empleado.id, datos).then(() =>
                            setEditandoId(null),
                          )
                        }
                        onCancelar={() => setEditandoId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={empleado.id} className={empleado.activo ? '' : 'fila-inactiva'}>
                    <td className="celda-nombre">
                      <span className="nombre">{empleado.nombre}</span>
                    </td>
                    <td>{empleado.nif || '—'}</td>
                    <td>{empleado.centroNombre || '—'}</td>
                    <td>
                      {empleado.turno
                        ? ETIQUETAS_TURNO[empleado.turno] ?? empleado.turno
                        : '—'}
                    </td>
                    <td>{empleado.horarioInicio ? horarioEmpleado(empleado) : '—'}</td>
                    <td className="celda-horas">{horasEmpleado(empleado)}</td>
                    <td>
                      <span
                        className={`etiqueta ${empleado.activo ? 'etiqueta-verde' : 'etiqueta-gris'}`}
                      >
                        {empleado.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="celda-acciones">
                      <button
                        type="button"
                        className="btn btn-secundario btn-mini"
                        onClick={() => setQrEmpleado(empleado)}
                      >
                        QR
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario btn-mini"
                        onClick={() => setEditandoId(empleado.id)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario btn-mini"
                        onClick={() => onAlternar(empleado.id, !empleado.activo)}
                      >
                        {empleado.activo ? 'Dar de baja' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-peligro btn-mini"
                        onClick={() => eliminarConConfirmacion(empleado, onEliminar)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {qrEmpleado && (
        <QRModal empleado={qrEmpleado} onClose={() => setQrEmpleado(null)} />
      )}
    </section>
  )
}

function eliminarConConfirmacion(empleado, onEliminar) {
  const confirmacion = window.confirm(
    `¿Eliminar a ${empleado.nombre}? También se borrarán sus fichajes y avisos.`,
  )
  if (confirmacion) onEliminar(empleado)
}