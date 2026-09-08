import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { procesarImagenLogo } from '../lib/imagen'

function SeccionLogo() {
  const { empresa, establecerLogo } = useAuth()
  const [preview, setPreview] = useState(null)
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const inputRef = useRef(null)

  const logoActual = preview ?? empresa?.logo_url ?? ''
  const inicial = (empresa?.name ?? '').trim().charAt(0).toUpperCase() || '?'

  function alSeleccionar(e) {
    const f = e.target.files?.[0]
    setError('')
    if (!f) {
      setArchivo(null)
      setPreview(null)
      return
    }
    setArchivo(f)
    const lector = new FileReader()
    lector.onload = () => setPreview(lector.result)
    lector.readAsDataURL(f)
  }

  function cancelar() {
    if (inputRef.current) inputRef.current.value = ''
    setArchivo(null)
    setPreview(null)
    setError('')
  }

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      const logo = await procesarImagenLogo(archivo)
      await establecerLogo(logo)
      cancelar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    setError('')
    setGuardando(true)
    try {
      await establecerLogo(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="tarjeta-form">
      <h3 className="logo-titulo">Logo de la empresa</h3>
      <div className="logo-empresa-caja">
        <div className="logo-preview">
          {logoActual ? (
            <img src={logoActual} alt="Logo de la empresa" />
          ) : (
            <span className="logo-placeholder">{inicial}</span>
          )}
        </div>
        <div className="logo-controles">
          <label className="btn btn-secundario logo-subir">
            Elegir imagen…
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={alSeleccionar}
            />
          </label>
          <p className="logo-ayuda">Formato PNG o JPG · se reduce y guarda automáticamente.</p>
          <div className="logo-acciones">
            {preview && (
              <button
                type="button"
                className="btn btn-primario btn-mini"
                onClick={guardar}
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : 'Guardar logo'}
              </button>
            )}
            {preview && (
              <button type="button" className="btn btn-secundario btn-mini" onClick={cancelar}>
                Cancelar
              </button>
            )}
            {!preview && empresa?.logo_url && (
              <button
                type="button"
                className="btn btn-secundario btn-mini"
                onClick={eliminar}
                disabled={guardando}
              >
                Eliminar logo
              </button>
            )}
          </div>
          {error && <p className="error-form">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function FormularioCentro({ inicial, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [direccion, setDireccion] = useState(inicial?.direccion ?? '')
  const [provincia, setProvincia] = useState(inicial?.provincia ?? '')
  const [descansoMin, setDescansoMin] = useState(
    inicial?.descansoMin ?? '',
  )
  const [error, setError] = useState('')

  function enviar(e) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) {
      setError('El nombre del centro es obligatorio.')
      return
    }
    const descanso = descansoMin === '' ? null : Number(descansoMin)
    if (descanso !== null && (!Number.isInteger(descanso) || descanso < 0)) {
      setError('Los minutos de descanso deben ser un número entero mayor o igual que 0.')
      return
    }
    onGuardar({
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      provincia: provincia.trim(),
      descansoMin: descanso,
    })
  }

  return (
    <form className="form-empleado" onSubmit={enviar}>
      <label className="campo-form">
        <span>Nombre del centro</span>
        <input
          type="text"
          placeholder="Obra / centro nº 1"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus={!inicial}
        />
      </label>
      <label className="campo-form campo-amplio">
        <span>Dirección completa</span>
        <input
          type="text"
          placeholder="Calle, número, localidad…"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
        />
      </label>
      <label className="campo-form">
        <span>Provincia</span>
        <input
          type="text"
          placeholder="Madrid"
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
        />
      </label>
      <label className="campo-form">
        <span>Descanso permitido (min)</span>
        <input
          type="number"
          min="0"
          placeholder="0"
          value={descansoMin}
          onChange={(e) => setDescansoMin(e.target.value)}
        />
        <span className="horario-resumen">
          Descanso dentro del horario laboral. Si el trabajador lo supera, los
          minutos de más van a su absentismo/deuda.
        </span>
      </label>

      {error && <p className="error-form">{error}</p>}

      <div className="form-acciones">
        <button type="submit" className="btn btn-primario">
          {inicial ? 'Guardar cambios' : 'Crear centro'}
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

export default function Centros({
  centros,
  onAgregar,
  onGuardar,
  onAlternar,
}) {
  const [editandoId, setEditandoId] = useState(null)
  const activos = centros.filter((c) => c.activo).length

  return (
    <section>
      <div className="cabecera-seccion">
        <h2>Centros de trabajo</h2>
      </div>

      <SeccionLogo />

      <div className="tarjeta-form">
        <FormularioCentro onGuardar={onAgregar} />
      </div>

      {activos === 0 && (
        <p className="aviso-centros">
          No hay centros activos. Crea al menos uno para poder asignar
          trabajadores.
        </p>
      )}

      <div className="cabecera-seccion">
        <h2>Centros / obras</h2>
      </div>

      {centros.length === 0 ? (
        <p className="vacio">Aún no hay centros creados.</p>
      ) : (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Centro</th>
                <th>Dirección</th>
                <th>Descanso</th>
                <th>Estado</th>
                <th className="celda-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {centros.map((centro) =>
                editandoId === centro.id ? (
                  <tr key={centro.id}>
                    <td colSpan={5}>
                      <FormularioCentro
                        inicial={centro}
                        onGuardar={(datos) =>
                          onGuardar(centro.id, datos).then(() =>
                            setEditandoId(null),
                          )
                        }
                        onCancelar={() => setEditandoId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={centro.id} className={centro.activo ? '' : 'fila-inactiva'}>
                    <td className="celda-nombre">
                      <span className="nombre">{centro.nombre}</span>
                    </td>
                    <td>
                      {centro.direccion || '—'}
                      {centro.provincia ? ` (${centro.provincia})` : ''}
                    </td>
                    <td>
                      {centro.descansoMin > 0
                        ? `${centro.descansoMin} min`
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`etiqueta ${centro.activo ? 'etiqueta-verde' : 'etiqueta-gris'}`}
                      >
                        {centro.activo ? 'Activo' : 'Dado de baja'}
                      </span>
                    </td>
                    <td className="celda-acciones">
                      <button
                        type="button"
                        className="btn btn-secundario btn-mini"
                        onClick={() => setEditandoId(centro.id)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario btn-mini"
                        onClick={() => onAlternar(centro.id, !centro.activo)}
                      >
                        {centro.activo ? 'Dar de baja' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}