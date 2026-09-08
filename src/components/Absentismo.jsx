import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { computarAbsentismo } from '../lib/absentismo'
import { hoyISO } from '../lib/tiempo'
import { minutosAFormato } from '../lib/horario'

const COLORES = {
  deficit: '#d97706',
  medico: '#2563eb',
  otros: '#9a3412',
}

function cortarNombre(nombre, max = 16) {
  return nombre.length > max ? `${nombre.slice(0, max - 1)}…` : nombre
}

function hoyLocal() {
  return hoyISO()
}

function primerDiaDelMes() {
  const ahora = new Date()
  const ano = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}-01`
}

const ETIQUETA_MOTIVO = { medico: 'Médico', otros: 'Otros' }

export default function Absentismo({
  empleados,
  centros,
  registros,
  ausencias,
  onCerrarAusencia,
}) {
  const [desde, setDesde] = useState(primerDiaDelMes)
  const [hasta, setHasta] = useState(hoyLocal())

  const datos = useMemo(
    () =>
      computarAbsentismo({
        empleados,
        centros,
        registros,
        ausencias,
        desde,
        hasta,
      }),
    [empleados, centros, registros, ausencias, desde, hasta],
  )

  const topAbsentistas = useMemo(
    () =>
      datos.porEmpleado
        .slice(0, 8)
        .map((e) => ({ nombre: cortarNombre(e.nombre), horas: e.deficitHoras }))
        .filter((e) => e.horas > 0),
    [datos],
  )

  const porCentro = useMemo(
    () =>
      datos.porCentro
        .filter((c) => c.deficitHoras > 0 || c.medicoHoras > 0 || c.otrosHoras > 0)
        .map((c) => ({
          centro: cortarNombre(c.nombre),
          déficit: c.deficitHoras,
          médico: c.medicoHoras,
          otros: c.otrosHoras,
        })),
    [datos],
  )

  const activas = useMemo(
    () => ausencias.filter((a) => !a.closed_at),
    [ausencias],
  )

  return (
    <section>
      <div className="cabecera-seccion">
        <h2>Absentismo</h2>
      </div>

      <div className="filtros">
        <label>
          Desde
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={hasta}
            min={desde}
            max={hoyLocal()}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>
      </div>

      <div className="tarjetas-resumen">
        <div className="tarjeta">
          <span className="tarjeta-nombre">Horas no trabajadas (empresa)</span>
          <span className="tarjeta-dato">{minutosAFormato(datos.empresa.deficitMin)}</span>
          <span className="tarjeta-sub">Por no cumplir el horario</span>
        </div>
        <div className="tarjeta">
          <span className="tarjeta-nombre">Ausencias Médico</span>
          <span className="tarjeta-dato color-medico">
            {minutosAFormato(datos.empresa.medicoMin)}
          </span>
          <span className="tarjeta-sub">Total por avisos cerrados</span>
        </div>
        <div className="tarjeta">
          <span className="tarjeta-nombre">Ausencias Otros</span>
          <span className="tarjeta-dato color-otros">
            {minutosAFormato(datos.empresa.otrosMin)}
          </span>
          <span className="tarjeta-sub">Total por avisos cerrados</span>
        </div>
      </div>

      {activas.length > 0 && (
        <div className="aviso-activas">
          <h3>Avisos activos</h3>
          <ul>
            {activas.map((a) => (
              <li key={a.id}>
                <strong>{a.nombre}</strong> · {ETIQUETA_MOTIVO[a.motivo] ?? a.motivo} ·{' '}
                {new Date(a.recorded_at).toLocaleString('es-ES')}
                <button
                  type="button"
                  className="btn btn-mini"
                  onClick={() => onCerrarAusencia(a.id)}
                >
                  Cerrar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="graficas">
        <div className="grafica">
          <h3>Empleados más absentistas</h3>
          {topAbsentistas.length === 0 ? (
            <p className="vacio">Sin déficit en el periodo.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topAbsentistas} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" unit=" h" />
                <YAxis dataKey="nombre" type="category" width={130} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v} h`, 'Horas no trabajadas']} />
                <Bar dataKey="horas" fill={COLORES.deficit} barSize={18} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grafica">
          <h3>Déficit por centro</h3>
          {porCentro.length === 0 ? (
            <p className="vacio">Sin datos en el periodo.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porCentro} margin={{ top: 8, right: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="centro" tick={{ fontSize: 12 }} />
                <YAxis unit=" h" />
                <Tooltip formatter={(v) => [`${v} h`, 'Déficit']} />
                <Bar dataKey="déficit" barSize={26} radius={[4, 4, 0, 0]}>
                  {porCentro.map((_, i) => (
                    <Cell key={i} fill={COLORES.deficit} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grafica">
          <h3>Horas Médico / Otros por centro</h3>
          {porCentro.length === 0 ? (
            <p className="vacio">Sin datos en el periodo.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porCentro} margin={{ top: 8, right: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="centro" tick={{ fontSize: 12 }} />
                <YAxis unit=" h" />
                <Tooltip />
                <Legend />
                <Bar dataKey="médico" stackId="a" fill={COLORES.medico} radius={[3, 3, 0, 0]} />
                <Bar dataKey="otros" stackId="a" fill={COLORES.otros} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  )
}