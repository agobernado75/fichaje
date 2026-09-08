import { useState } from 'react'
import QRModal from './QRModal'

function FormularioEmpleado({ inicial, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [cargo, setCargo] = useState(inicial?.cargo ?? '')

  function enviar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    onGuardar({ nombre: nombre.trim(), cargo: cargo.trim() })
  }

  return (
    <form className="form-empleado" onSubmit={enviar}>
      <input
        type="text"
        placeholder="Nombre completo"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoFocus
      />
      <input
        type="text"
        placeholder="Cargo (opcional)"
        value={cargo}
        onChange={(e) => setCargo(e.target.value)}
      />
      <button type="submit" className="btn btn-primario">
        Guardar
      </button>
      {onCancelar && (
        <button
          type="button"
          className="btn btn-secundario"
          onClick={onCancelar}
        >
          Cancelar
        </button>
      )}
    </form>
  )
}

export default function Empleados({ empleados, onAgregar, onGuardar, onAlternar, onEliminar }) {
  const [editandoId, setEditandoId] = useState(null)
  const [qrEmpleado, setQrEmpleado] = useState(null)

  async function agregar(datos) {
    const nuevo = await onAgregar(datos)
    setQrEmpleado(nuevo)
  }

  return (
    <section>
      <div className="cabecera-seccion">
        <h2>Empleados</h2>
      </div>

      <FormularioEmpleado onGuardar={agregar} />

      {empleados.length === 0 ? (
        <p className="vacio">Aún no hay empleados registrados.</p>
      ) : (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cargo</th>
                <th>Estado</th>
                <th className="celda-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((empleado) =>
                editandoId === empleado.id ? (
                  <tr key={empleado.id}>
                    <td colSpan={4}>
                      <FormularioEmpleado
                        inicial={empleado}
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
                    <td>{empleado.cargo || '—'}</td>
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
                        onClick={() =>
                          onAlternar(empleado.id, !empleado.activo)
                        }
                      >
                        {empleado.activo ? 'Desactivar' : 'Activar'}
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
    `¿Eliminar a ${empleado.nombre}? También se borrarán sus registros de asistencia.`,
  )
  if (confirmacion) onEliminar(empleado)
}
