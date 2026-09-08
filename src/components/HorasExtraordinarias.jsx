import { useMemo, useState } from 'react'
import { hoyISO } from '../lib/tiempo'
import { horaAMinutos, minutosAHora } from '../lib/api'
import { descargarCSV } from '../lib/csv'

const ETIQUETA_ESTADO = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  denegada: 'Denegada',
}

const LIMITE_ANUAL_HORAS = 80

function hace30Dias() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return d.toLocaleDateString('sv-SE')
}

function anioDe(fecha) {
  return (fecha ?? '').slice(0, 4)
}

export default function HorasExtraordinarias({
  empleados = [],
  centros = [],
  horasExtra = [],
  onCrear,
  onEditar,
  onCambiarEstado,
  onEliminar,
}) {
  const [desde, setDesde] = useState(hace30Dias())
  const [hasta, setHasta] = useState(hoyISO())
  const [empleadoFiltro, setEmpleadoFiltro] = useState('todos')
  const [centroFiltro, setCentroFiltro] = useState('todos')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')

  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState({
    empleadoId: '',
    fecha: hoyISO(),
    duracion: '',
    descripcion: '',
    estado: 'pendiente',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const activos = empleados.filter((e) => e.activo)

  const centrosPorId = useMemo(
    () => new Map(centros.map((c) => [c.id, c.nombre])),
    [centros],
  )

  const filtrados = useMemo(
    () =>
      horasExtra
        .filter((r) => r.fecha >= desde && r.fecha <= hasta)
        .filter(
          (r) =>
            empleadoFiltro === 'todos' || r.empleadoId === empleadoFiltro,
        )
        .filter(
          (r) => centroFiltro === 'todos' || r.centroId === centroFiltro,
        )
        .filter(
          (r) => estadoFiltro === 'todos' || r.estado === estadoFiltro,
        )
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [horasExtra, desde, hasta, empleadoFiltro, centroFiltro, estadoFiltro],
  )

  const resumen = useMemo(() => {
    const mapa = new Map()
    for (const r of filtrados) {
      if (r.estado !== 'aprobada') continue
      const actual = mapa.get(r.empleadoId) ?? { nombre: r.nombre, minutos: 0 }
      actual.minutos += r.minutos
      mapa.set(r.empleadoId, actual)
    }
    return [...mapa.values()].sort((a, b) => b.minutos - a.minutos)
  }, [filtrados])

  const anual = useMemo(() => {
    const anio = String(new Date().getFullYear())
    const mapa = new Map()
    for (const r of horasExtra) {
      if (r.estado !== 'aprobada' || anioDe(r.fecha) !== anio) continue
      const actual = mapa.get(r.empleadoId) ?? { nombre: r.nombre, minutos: 0 }
      actual.minutos += r.minutos
      mapa.set(r.empleadoId, actual)
    }
    return [...mapa.values()].sort((a, b) => b.minutos - a.minutos)
  }, [horasExtra])

  const totalAprobadasMin = useMemo(
    () => filtrados.filter((r) => r.estado === 'aprobada').reduce((s, r) => s + r.minutos, 0),
    [filtrados],
  )

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function abrirEdicion(r) {
    setError('')
    setEditandoId(r.id)
    setForm({
      empleadoId: r.empleadoId,
      fecha: r.fecha,
      duracion: minutosAHora(r.minutos),
      descripcion: r.descripcion ?? '',
      estado: r.estado,
    })
  }

  function cancelar() {
    setError('')
    setEditandoId(null)
    setForm({ empleadoId: '', fecha: hoyISO(), duracion: '', descripcion: '', estado: 'pendiente' })
  }

  async function enviar(e) {
    e.preventDefault()
    setError('')
    const minutos = horaAMinutos(form.duracion)
    if (!form.empleadoId) {
      setError('Selecciona un empleado.')
      return
    }
    if (!form.fecha) {
      setError('Indica la fecha.')
      return
    }
    if (minutos === null) {
      setError('Indica una duración válida en formato H:MM (ej. 2:30).')
      return
    }
    const empleado = empleados.find((x) => x.id === form.empleadoId)
    const datos = {
      empleadoId: form.empleadoId,
      workCenterId: empleado?.centroId ?? null,
      fecha: form.fecha,
      minutos,
      descripcion: form.descripcion,
      estado: form.estado,
    }
    setGuardando(true)
    try {
      if (editandoId) await onEditar(editandoId, datos)
      else await onCrear(datos)
      cancelar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  function exportarCSV() {
    descargarCSV(
      `horas_extra_${desde}_${hasta}.csv`,
      filtrados.map((r) => ({
        Fecha: r.fecha,
        Empleado: r.nombre,
        Centro: r.centroNombre || '',
        'Duración': minutosAHora(r.minutos),
        Descripción: r.descripcion ?? '',
        Estado: ETIQUETA_ESTADO[r.estado] ?? r.estado,
      })),
    )
  }

  return (
    <section>
      <div className="cabecera-seccion">
        <h2>Horas extraordinarias</h2>
        <button
          type="button"
          className="btn btn-primario"
          onClick={exportarCSV}
          disabled={filtrados.length === 0}
        >
          Exportar CSV
        </button>
      </div>

      <div className="tarjeta-form">
        <h3 className="logo-titulo">
          {editandoId ? 'Editar horas extra' : 'Registrar horas extra'}
        </h3>
        <form className="form-empleado" onSubmit={enviar}>
          <label className="campo-form">
            <span>Empleado</span>
            <select
              value={form.empleadoId}
              onChange={(e) => cambiar('empleadoId', e.target.value)}
            >
              <option value="">Selecciona…</option>
              {activos.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="campo-form">
            <span>Fecha</span>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => cambiar('fecha', e.target.value)}
            />
          </label>
          <label className="campo-form">
            <span>Duración (H:MM)</span>
            <input
              type="text"
              placeholder="2:30"
              value={form.duracion}
              onChange={(e) => cambiar('duracion', e.target.value)}
            />
          </label>
          <label className="campo-form campo-amplio">
            <span>Motivo / descripción</span>
            <input
              type="text"
              placeholder="Cierre de obra, reunión, pico de trabajo…"
              value={form.descripcion}
              onChange={(e) => cambiar('descripcion', e.target.value)}
            />
          </label>
          <label className="campo-form">
            <span>Estado</span>
            <select
              value={form.estado}
              onChange={(e) => cambiar('estado', e.target.value)}
            >
              <option value="pendiente">Pendiente</option>
              <option value="aprobada">Aprobada</option>
              {editandoId && <option value="denegada">Denegada</option>}
            </select>
          </label>

          {error && <p className="error-form">{error}</p>}

          <div className="form-acciones">
            <button type="submit" className="btn btn-primario" disabled={guardando}>
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Registrar'}
            </button>
            {editandoId && (
              <button type="button" className="btn btn-secundario" onClick={cancelar}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="filtros">
        <label>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value || hace30Dias())} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value || hoyISO())} />
        </label>
        <label>
          Empleado
          <select value={empleadoFiltro} onChange={(e) => setEmpleadoFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Centro
          <select value={centroFiltro} onChange={(e) => setCentroFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Aprobada</option>
            <option value="denegada">Denegada</option>
          </select>
        </label>
      </div>

      {resumen.length > 0 && (
        <div className="tarjetas-resumen">
          {resumen.map((r) => (
            <div key={r.nombre} className="tarjeta">
              <span className="tarjeta-nombre">{r.nombre}</span>
              <span className="tarjeta-dato">{minutosAHora(r.minutos)}</span>
              <span className="tarjeta-sub">
                aprobadas en el rango
              </span>
            </div>
          ))}
        </div>
      )}

      {anual.length > 0 && (
        <div className="tarjeta-horas-extra-anual">
          <p className="horas-extra-anual-titulo">
            Acumulado aprobado del año (límite legal {LIMITE_ANUAL_HORAS} h/año)
          </p>
          <ul className="horas-extra-anual-lista">
            {anual.map((a) => {
              const horas = a.minutos / 60
              const excede = horas > LIMITE_ANUAL_HORAS
              const cerca = !excede && horas >= LIMITE_ANUAL_HORAS * 0.9
              return (
                <li key={a.nombre}>
                  <span className="nombre">{a.nombre}</span>
                  <span
                    className={`etiqueta ${
                      excede
                        ? 'etiqueta-roja'
                        : cerca
                          ? 'etiqueta-ambar'
                          : 'etiqueta-verde'
                    }`}
                  >
                    {minutosAHora(a.minutos)}
                    {excede
                      ? ` · límite superado`
                      : ` de ${LIMITE_ANUAL_HORAS}h`}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <p className="horas-extra-total">
        Total aprobadas en el rango: <strong>{minutosAHora(totalAprobadasMin)}</strong>
      </p>

      {filtrados.length === 0 ? (
        <p className="vacio">No hay horas extraordinarias en el rango seleccionado.</p>
      ) : (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Empleado</th>
                <th>Centro</th>
                <th>Duración</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th className="celda-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id} className={r.estado === 'denegada' ? 'fila-inactiva' : ''}>
                  <td>{r.fecha}</td>
                  <td className="celda-nombre">
                    <span className="nombre">{r.nombre}</span>
                  </td>
                  <td>{r.centroNombre || '—'}</td>
                  <td className="celda-horas">{minutosAHora(r.minutos)}</td>
                  <td>{r.descripcion || '—'}</td>
                  <td>
                    <span className={`etiqueta etiqueta-${r.estado}`}>
                      {ETIQUETA_ESTADO[r.estado] ?? r.estado}
                    </span>
                  </td>
                  <td className="celda-acciones">
                    {r.estado === 'pendiente' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primario btn-mini"
                          onClick={() => onCambiarEstado(r.id, 'aprobada')}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secundario btn-mini"
                          onClick={() => onCambiarEstado(r.id, 'denegada')}
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn-secundario btn-mini"
                      onClick={() => abrirEdicion(r)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-secundario btn-mini"
                      onClick={() => onEliminar(r.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}