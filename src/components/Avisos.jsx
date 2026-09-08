import { useMemo, useState } from 'react'
import { hoyISO } from '../lib/tiempo'

function aFechaLocal(iso) {
  const d = new Date(iso)
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function aHora(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

const ETIQUETA_MOTIVO = { medico: 'Médico', otros: 'Otros' }

function FechaDeCierre({ ausencia }) {
  return ausencia.closed_at ? aHora(ausencia.closed_at) : 'Activa'
}

export default function Avisos({ ausencias = [], onCerrar }) {
  const [fecha, setFecha] = useState(hoyISO())

  const activas = useMemo(
    () => ausencias.filter((a) => !a.closed_at),
    [ausencias],
  )

  const delDia = useMemo(
    () =>
      ausencias
        .filter((a) => aFechaLocal(a.recorded_at) === fecha)
        .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)),
    [ausencias, fecha],
  )

  return (
    <section>
      <div className="cabecera-seccion">
        <h2>Avisos de ausencia</h2>
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

      {activas.length > 0 && (
        <div className="tarjetas-resumen">
          {activas.map((a) => (
            <div key={a.id} className="tarjeta aviso-activo">
              <span className="tarjeta-nombre">{a.nombre}</span>
              <span className="tarjeta-dato">
                {ETIQUETA_MOTIVO[a.motivo] ?? a.motivo}
              </span>
              <span className="tarjeta-sub">
                Desde {aHora(a.recorded_at)} · activa
              </span>
              {onCerrar && (
                <button
                  type="button"
                  className="btn btn-mini"
                  onClick={() => onCerrar(a.id)}
                >
                  Cerrar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {delDia.length === 0 ? (
        <p className="vacio">
          No hay avisos el {fecha} a la vista.
        </p>
      ) : (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Motivo</th>
                <th>Inicio</th>
                <th>Fin</th>
                {onCerrar && <th></th>}
              </tr>
            </thead>
            <tbody>
              {delDia.map((a) => (
                <tr key={a.id} className={!a.closed_at ? 'fila-activa' : ''}>
                  <td className="celda-nombre">
                    <span className="nombre">{a.nombre}</span>
                  </td>
                  <td>{ETIQUETA_MOTIVO[a.motivo] ?? a.motivo}</td>
                  <td>{aHora(a.recorded_at)}</td>
                  <td>
                    <FechaDeCierre ausencia={a} />
                  </td>
                  {onCerrar && (
                    <td>
                      {!a.closed_at && (
                        <button
                          type="button"
                          className="btn btn-mini"
                          onClick={() => onCerrar(a.id)}
                        >
                          Cerrar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}