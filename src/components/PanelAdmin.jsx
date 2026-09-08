import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AltaEmpleado from './AltaEmpleado'
import Centros from './Centros'
import Absentismo from './Absentismo'
import Informe from './Informe'
import RegistroDiario from './RegistroDiario'
import Historial from './Historial'
import Avisos from './Avisos'
import HorasExtraordinarias from './HorasExtraordinarias'
import LogoFichaOK from './LogoFichaOK'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  obtenerEmpleados,
  crearEmpleado,
  editarEmpleado,
  alternarActivoEmpleado,
  eliminarEmpleado,
  obtenerCentros,
  crearCentro,
  editarCentro,
  alternarActivoCentro,
  obtenerTimeRecords,
  obtenerAusencias,
  cerrarAusencia,
  actualizarEvento,
  crearEvento,
  obtenerHorasExtraordinarias,
  crearHoraExtraordinaria,
  editarHoraExtraordinaria,
  cambiarEstadoHoraExtraordinaria,
  eliminarHoraExtraordinaria,
} from '../lib/api'
import { agruparJornadas } from '../lib/jornada'

const VISTAS = [
  { id: 'alta-empleado', etiqueta: 'Alta Empleado' },
  { id: 'alta-centro', etiqueta: 'Alta Centro' },
  { id: 'absentismo', etiqueta: 'Absentismo' },
  { id: 'informe', etiqueta: 'Informe' },
  { id: 'registro-diario', etiqueta: 'Registro diario' },
  { id: 'historial', etiqueta: 'Historial' },
  { id: 'horas-extra', etiqueta: 'Horas extra' },
  { id: 'ausencias', etiqueta: 'Ausencias' },
]

export default function PanelAdmin() {
  const { empresa, cerrarSesion } = useAuth()
  const [vista, setVista] = useState('alta-empleado')
  const [empleados, setEmpleados] = useState([])
  const [centros, setCentros] = useState([])
  const [registros, setRegistros] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [horasExtra, setHorasExtra] = useState([])
  const [cargando, setCargando] = useState(true)

  const refrescarEmpleados = useCallback(async () => {
    const data = await obtenerEmpleados()
    setEmpleados(data)
  }, [])

  const refrescarCentros = useCallback(async () => {
    const data = await obtenerCentros()
    setCentros(data)
  }, [])

  const refrescarRegistros = useCallback(async () => {
    const eventos = await obtenerTimeRecords({
      desde: '0001-01-01',
      hasta: '9999-12-31',
    })
    setRegistros(agruparJornadas(eventos))
  }, [])

  const refrescarAusencias = useCallback(async () => {
    setAusencias(await obtenerAusencias())
  }, [])

  const refrescarHorasExtra = useCallback(async () => {
    setHorasExtra(await obtenerHorasExtraordinarias())
  }, [])

  useEffect(() => {
    let activo = true
    const seguro = async (fn) => {
      try {
        return await fn()
      } catch (e) {
        console.warn('No se pudo cargar un bloque del panel:', e.message)
        return []
      }
    }
    Promise.all([
      seguro(obtenerEmpleados),
      seguro(obtenerCentros),
      seguro(() => obtenerTimeRecords({ desde: '0001-01-01', hasta: '9999-12-31' })),
      seguro(obtenerAusencias),
      seguro(obtenerHorasExtraordinarias),
    ])
      .then(([emp, cent, eventos, aus, hext]) => {
        if (!activo) return
        setEmpleados(emp)
        setCentros(cent)
        setRegistros(agruparJornadas(eventos))
        setAusencias(aus)
        setHorasExtra(hext)
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    const companyId = empresa?.id
    if (!companyId) return

    const temporizadores = new Map()
    const programar = (clave, fn) => {
      if (temporizadores.has(clave)) clearTimeout(temporizadores.get(clave))
      temporizadores.set(
        clave,
        setTimeout(() => {
          temporizadores.delete(clave)
          fn().catch((e) => console.error(e))
        }, 600),
      )
    }

    const canal = supabase
      .channel('panel-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_records',
          filter: `company_id=eq.${companyId}`,
        },
        () => programar('registros', refrescarRegistros),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employees',
          filter: `company_id=eq.${companyId}`,
        },
        () => programar('empleados', refrescarEmpleados),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_centers',
          filter: `company_id=eq.${companyId}`,
        },
        () => programar('centros', refrescarCentros),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'absences',
          filter: `company_id=eq.${companyId}`,
        },
        () => programar('ausencias', refrescarAusencias),
      )
      .subscribe()

    return () => {
      for (const t of temporizadores.values()) clearTimeout(t)
      temporizadores.clear()
      supabase.removeChannel(canal)
    }
  }, [empresa?.id, refrescarAusencias, refrescarCentros, refrescarEmpleados, refrescarRegistros])

  async function agregarEmpleado(datos) {
    const nuevo = await crearEmpleado({ ...datos, companyId: empresa.id })
    await refrescarEmpleados()
    return nuevo
  }

  async function guardarEmpleado(id, datos) {
    await editarEmpleado(id, datos)
    await refrescarEmpleados()
  }

  async function alternarEmpleado(id, activo) {
    await alternarActivoEmpleado(id, activo)
    await refrescarEmpleados()
  }

  async function eliminarEmpleadoHandler(empleado) {
    await eliminarEmpleado(empleado.id)
    await refrescarEmpleados()
    await refrescarRegistros()
    await refrescarAusencias()
  }

  async function agregarCentro(datos) {
    await crearCentro({ ...datos, companyId: empresa.id })
    await refrescarCentros()
  }

  async function guardarCentro(id, datos) {
    await editarCentro(id, datos)
    await refrescarCentros()
  }

  async function alternarCentro(id, activo) {
    await alternarActivoCentro(id, activo)
    await refrescarCentros()
  }

  async function cerrarAviso(id) {
    await cerrarAusencia(id)
    await refrescarAusencias()
    await refrescarEmpleados()
  }

  async function crearHoraExtra(datos) {
    await crearHoraExtraordinaria({ ...datos, companyId: empresa.id })
    await refrescarHorasExtra()
  }

  async function guardarHoraExtra(id, datos) {
    await editarHoraExtraordinaria(id, datos)
    await refrescarHorasExtra()
  }

  async function cambiarHoraExtra(id, estado) {
    await cambiarEstadoHoraExtraordinaria(id, estado)
    await refrescarHorasExtra()
  }

  async function borrarHoraExtra(id) {
    await eliminarHoraExtraordinaria(id)
    await refrescarHorasExtra()
  }

  async function actualizarRegistro({ empleadoId, fecha, entrada, salida }) {
    const registro = registros.find(
      (r) => r.empleadoId === empleadoId && r.fecha === fecha,
    )
    const empleado = empleados.find((e) => e.id === empleadoId)
    const aISO = (hhmm) => new Date(`${fecha}T${hhmm}:00`).toISOString()

    const operaciones = []
    if (entrada) {
      if (registro?.entradaId) {
        operaciones.push(actualizarEvento(registro.entradaId, aISO(entrada)))
      } else {
        operaciones.push(
          crearEvento({
            employeeId: empleadoId,
            companyId: empresa.id,
            workCenterId: empleado?.centroId ?? null,
            eventType: 'entrada',
            recordedAt: aISO(entrada),
          }),
        )
      }
    }
    if (salida) {
      if (registro?.salidaId) {
        operaciones.push(actualizarEvento(registro.salidaId, aISO(salida)))
      } else {
        operaciones.push(
          crearEvento({
            employeeId: empleadoId,
            companyId: empresa.id,
            workCenterId: empleado?.centroId ?? null,
            eventType: 'salida',
            recordedAt: aISO(salida),
          }),
        )
      }
    }

    await Promise.all(operaciones)
    await refrescarRegistros()
  }

  if (cargando) return <div className="cargando">Cargando datos…</div>

  const logoURL = empresa?.logo_url || ''
  const inicialEmpresa = (empresa?.name ?? '').trim().charAt(0).toUpperCase() || '?'

  return (
    <div className="app-panel">
      <header className="cabecera cabecera-panel">
        <div className="marca-panel">
          <LogoFichaOK tamano={38} />
          <span className="marca-panel-titulo">Ficha OK</span>
        </div>
        <div className="kiosco-enlaces">
          <Link to="/" className="enlace-admin">
            Pantalla de escaneo
          </Link>
          <button type="button" className="btn btn-secundario btn-mini" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="panel-contenedor">
        <aside className="menu-lateral">
          <div className="empresa-bloque">
            {logoURL ? (
              <img className="menu-logotipo" src={logoURL} alt={empresa?.name ?? ''} />
            ) : (
              <span className="menu-logotipo sin-logo">{inicialEmpresa}</span>
            )}
            <span className="empresa-nombre">{empresa?.name ?? ''}</span>
          </div>
          <nav>
            {VISTAS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`menu-item ${vista === v.id ? 'activo' : ''}`}
                onClick={() => setVista(v.id)}
              >
                {v.etiqueta}
              </button>
            ))}
          </nav>
        </aside>

        <main className="contenido">
          {vista === 'alta-empleado' && (
            <AltaEmpleado
              empleados={empleados}
              centros={centros}
              onAgregar={agregarEmpleado}
              onGuardar={guardarEmpleado}
              onAlternar={alternarEmpleado}
              onEliminar={eliminarEmpleadoHandler}
            />
          )}
          {vista === 'alta-centro' && (
            <Centros
              centros={centros}
              onAgregar={agregarCentro}
              onGuardar={guardarCentro}
              onAlternar={alternarCentro}
            />
          )}
          {vista === 'absentismo' && (
            <Absentismo
              empleados={empleados}
              centros={centros}
              registros={registros}
              ausencias={ausencias}
              onCerrarAusencia={cerrarAviso}
            />
          )}
          {vista === 'informe' && (
            <Informe
              empresa={empresa}
              centros={centros}
              empleados={empleados}
              registros={registros}
            />
          )}
          {vista === 'registro-diario' && (
            <RegistroDiario
              empleados={empleados}
              centros={centros}
              registros={registros}
              ausencias={ausencias}
              onActualizarRegistro={actualizarRegistro}
            />
          )}
          {vista === 'historial' && (
            <Historial empleados={empleados} registros={registros} centros={centros} />
          )}
          {vista === 'horas-extra' && (
            <HorasExtraordinarias
              empleados={empleados}
              centros={centros}
              horasExtra={horasExtra}
              onCrear={crearHoraExtra}
              onEditar={guardarHoraExtra}
              onCambiarEstado={cambiarHoraExtra}
              onEliminar={borrarHoraExtra}
            />
          )}
          {vista === 'ausencias' && (
            <Avisos ausencias={ausencias} onCerrar={cerrarAviso} />
          )}
        </main>
      </div>

      <footer className="pie">
        {empresa?.name ? (
          <span className="pie-empresa">
            {logoURL && <img className="pie-logotipo" src={logoURL} alt="" />}
            Empresa: {empresa.name}
          </span>
        ) : (
          ''
        )}
      </footer>
    </div>
  )
}