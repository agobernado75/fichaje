import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { obtenerEmpleados, últimoEventoDeHoy, registrarTimeRecord, obtenerCentroPorDefecto } from '../lib/api'
import { decidirFichaje } from '../lib/fichaje'
import { useAuth } from '../context/AuthContext'
import LogoFichaOK from './LogoFichaOK'

function beep(frecuencia = 880, duracion = 0.12, retardo = 0) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = frecuencia
    gain.gain.value = 0.12
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime + retardo)
    osc.stop(ctx.currentTime + retardo + duracion)
  } catch {
    /* audio no disponible */
  }
}

function mensajeError(err) {
  const nombre = err?.name ?? 'Error'
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return (
        'Permiso de cámara denegado o bloqueado por el navegador/el sistema. ' +
        'Pulsa Reintentar (vuelve a pedir permiso) y, si no aparece la ventana del navegador, ' +
        'activa la cámara para Opera en Ajustes del Sistema › Privacidad y seguridad › Cámara. ' +
        `(${nombre})`
      )
    case 'NotFoundError':
      return 'No se encontró ninguna cámara conectada al dispositivo.'
    case 'NotReadableError':
      return 'La cámara está siendo usada por otra aplicación (Zoom, FaceTime…). Ciérrala y pulsa Reintentar.'
    default:
      return `No se pudo acceder a la cámara (${nombre}). Pulsa Reintentar para volver a intentarlo.`
  }
}

const MENSAJES = {
  entrada: (nombre, hora) =>
    `Entrada registrada · ${hora} · ${nombre}. Recuerda: para la salida, pincha en «Fichaje» y escanea de nuevo.`,
  salida: (nombre, hora) => `Salida registrada · ${hora} · ${nombre}`,
  pausa_inicio: (nombre, hora) =>
    `Descanso iniciado · ${hora} · ${nombre}. Recuerda: para finalizarlo, pincha en «Descanso» y escanea de nuevo.`,
  pausa_fin: (nombre, hora) => `Descanso finalizado · ${hora} · ${nombre}`,
  ausencia_inicio: (nombre, hora, etiqueta) =>
    `Ausencia (${etiqueta}) registrada · ${hora} · ${nombre}. Recuerda: para finalizarla, pincha en «${etiqueta}» y escanea de nuevo.`,
  ausencia_fin: (nombre, hora) => `Ausencia finalizada · ${hora} · ${nombre}`,
  inactivo: (nombre) => `${nombre} está inactivo`,
  sinCentro: () => 'No hay un centro de trabajo activo para este empleado',
  pausa_sinEntrada: () => 'No se puede registrar un descanso sin haber marcado la entrada',
  finalizada: (nombre) => `${nombre} ya finalizó su jornada`,
  desconocido: () => 'Código QR no reconocido',
  error: (detalle) => `Error del servidor: ${detalle}`,
}

const TONOS = {
  entrada: 880,
  salida: 660,
  pausa_inicio: 440,
  pausa_fin: 520,
  ausencia_inicio: 340,
  ausencia_fin: 590,
}
const ETIQUETA_MOTIVO = { medico: 'Médico', otros: 'Otros' }
const EVENTO_PUBLICO = {
  entry: 'entrada',
  exit: 'salida',
  break_start: 'pausa_inicio',
  break_end: 'pausa_fin',
}

const CONFIG_ESCANEO = {
  fps: 10,
  qrbox: (anchoVideo, altoVideo) => {
    const lado = Math.max(80, Math.floor(Math.min(anchoVideo, altoVideo) * 0.7))
    return { width: lado, height: lado }
  },
}
const CONSTRAINTS_FALLBACK = [
  { facingMode: 'environment' },
  { facingMode: 'user' },
  { video: true },
]

export default function EscanerQR({ modo = 'admin' }) {
  const esPublico = modo === 'publico'
  const { empresa, cerrarSesion } = useAuth()
  const [toast, setToast] = useState(null)
  const [errorCamara, setErrorCamara] = useState(null)
  const [camaras, setCamaras] = useState([])
  const [camaraActiva, setCamaraActiva] = useState('')
  const [iniciando, setIniciando] = useState(false)
  const [empleados, setEmpleados] = useState([])
  const [modoPausa, setModoPausa] = useState(false)
  const [motivoAusencia, setMotivoAusencia] = useState(null)

  const scannerRef = useRef(null)
  const montadoRef = useRef(true)
  const iniciandoRef = useRef(false)
  const ultimoScanRef = useRef({ texto: '', tiempo: 0 })
  const centroRef = useRef(null)
  const procesarRef = useRef(null)

  useEffect(() => {
    if (esPublico) return
    const companyId = empresa?.id
    if (!companyId) return
    obtenerEmpleados().then(setEmpleados).catch(() => {})
    obtenerCentroPorDefecto(companyId).then((id) => {
      centroRef.current = id
    })
  }, [empresa?.id, esPublico])

  const avisoSafari = useMemo(() => {
    const ua = navigator.userAgent
    const esSafari = /Safari/i.test(ua) && !/Chrom|Android/i.test(ua)
    const seguro =
      location.protocol === 'https:' ||
      ['localhost', '127.0.0.1'].includes(location.hostname)
    return esSafari && !seguro
  }, [])

  function mostrarToast(clave, nombre, hora, extra) {
    beep(TONOS[clave] ?? 220, clave === 'desconocido' ? 0.25 : 0.12)
    setToast({ clave, texto: MENSAJES[clave](nombre ?? '', hora ?? '', extra ?? '') })
    window.setTimeout(() => {
      if (montadoRef.current) setToast(null)
    }, 5000)
  }

  async function marcarAusencia(qr) {
    const { data, error } = await supabase.rpc('marcar_ausencia', {
      qr,
      motivo: motivoAusencia,
    })
    if (error) throw error
    return data
  }

  function atenderAusencia(data) {
    if (!data?.ok) {
      const nombre = data?.nombre ?? ''
      if (data?.motivo === 'inactivo') mostrarToast('inactivo', nombre)
      else mostrarToast('desconocido')
      return
    }
    const hora = new Date(data.recorded_at).toTimeString().slice(0, 5)
    mostrarToast(
      data.accion === 'fin' ? 'ausencia_fin' : 'ausencia_inicio',
      data.nombre ?? '',
      hora,
      ETIQUETA_MOTIVO[data.motivo] ?? data.motivo,
    )
  }

  async function registrar(empleadoId) {
    const ultimo = await últimoEventoDeHoy(empleadoId)
    const tipo = decidirFichaje(ultimo, modoPausa)
    const nombre =
      empleados.find((e) => e.id === empleadoId)?.nombre ?? ''
    if (tipo === 'pausa_sin_entrada') {
      mostrarToast('pausa_sinEntrada')
      return
    }
    if (tipo === 'finalizada') {
      mostrarToast('finalizada', nombre)
      return
    }
    await registrarTimeRecord({
      employeeId: empleadoId,
      workCenterId: centroRef.current,
      eventType: tipo,
      companyId: empresa.id,
    })
    const hora = new Date().toTimeString().slice(0, 5)
    mostrarToast(tipo, nombre, hora)
  }

  async function registrarPublico(texto) {
    const qr = texto.trim().toLowerCase()
    if (motivoAusencia) {
      console.log('[marcar_ausencia] qr:', JSON.stringify(qr), 'motivo:', motivoAusencia)
      try {
        atenderAusencia(await marcarAusencia(qr))
      } catch (err) {
        console.error('[marcar_ausencia] error RPC:', err.message)
        mostrarToast('error', err.message)
      }
      return
    }
    const tipo = modoPausa ? 'pausa' : null
    console.log('[fichar_desde_qr] qr escaneado:', JSON.stringify(qr), 'tipo:', tipo)
    const { data, error } = await supabase.rpc('fichar_desde_qr', { qr, tipo })
    if (error) {
      console.error('[fichar_desde_qr] error RPC:', error.message)
      mostrarToast('error', error.message)
      return
    }
    console.log('[fichar_desde_qr] respuesta:', JSON.stringify(data))
    if (!data?.ok) {
      const motivo = data?.motivo
      const nombre = data?.nombre ?? ''
      if (motivo === 'inactivo') mostrarToast('inactivo', nombre)
      else if (motivo === 'sin_centro') mostrarToast('sinCentro')
      else if (motivo === 'pausa_sin_entrada') mostrarToast('pausa_sinEntrada')
      else if (motivo === 'finalizada') mostrarToast('finalizada', nombre)
      else mostrarToast('desconocido')
      return
    }
    const tipoEvento = EVENTO_PUBLICO[data.tipo] ?? 'desconocido'
    const hora = new Date(data.recorded_at).toTimeString().slice(0, 5)
    mostrarToast(tipoEvento, data.nombre ?? '', hora)
  }

  function procesarCodigo(texto) {
    const ahora = Date.now()
    if (
      ultimoScanRef.current.texto === texto &&
      ahora - ultimoScanRef.current.tiempo < 3000
    ) {
      return
    }
    ultimoScanRef.current = { texto, tiempo: ahora }

    if (esPublico) {
      registrarPublico(texto).catch((err) => {
        console.error(err)
        mostrarToast('desconocido')
      })
      return
    }

    const empleado = empleados.find((e) => e.id === texto.trim())
    if (!empleado) {
      mostrarToast('desconocido')
      return
    }
    if (!empleado.activo) {
      mostrarToast('inactivo', empleado.nombre)
      return
    }
    if (motivoAusencia) {
      marcarAusencia(empleado.id)
        .then(atenderAusencia)
        .catch((err) => {
          console.error(err)
          mostrarToast('error', err.message)
        })
      return
    }
    registrar(empleado.id).catch((err) => {
      console.error(err)
      mostrarToast('desconocido')
    })
  }

  useEffect(() => {
    procesarRef.current = procesarCodigo
  })

  const escaneoEstable = (texto) => procesarRef.current?.(texto)

  async function listarCamaras() {
    try {
      const lista = await Html5Qrcode.getCameras()
      if (montadoRef.current) {
        setCamaras(lista.map((c) => ({ id: c.id, label: c.label })))
      }
      return lista
    } catch {
      return []
    }
  }

  async function iniciar(idPreferido) {
    if (!montadoRef.current || iniciandoRef.current) return
    iniciandoRef.current = true
    setErrorCamara(null)
    setIniciando(true)

    const scanner = scannerRef.current
    let ultimoError = null

    try {
      const lista = idPreferido
        ? [{ id: idPreferido }]
        : await listarCamaras()

      for (const camara of lista) {
        try {
          await scanner.start(
            { deviceId: { exact: camara.id } },
            CONFIG_ESCANEO,
            (texto) => escaneoEstable(texto),
            () => {},
          )
          if (montadoRef.current) {
            setCamaraActiva(camara.id)
            await listarCamaras()
          }
          return
        } catch (err) {
          console.error('[camara] intento por deviceId falló:', err?.name, err)
          ultimoError = err
        }
      }

      for (const constraints of CONSTRAINTS_FALLBACK) {
        try {
          await scanner.start(
            constraints,
            CONFIG_ESCANEO,
            (texto) => escaneoEstable(texto),
            () => {},
          )
          if (montadoRef.current) {
            await listarCamaras()
          }
          return
        } catch (err) {
          console.error('[camara] intento genérico falló:', err?.name, err)
          ultimoError = err
        }
      }

      throw ultimoError ?? new Error('Sin acceso a la cámara')
    } catch (err) {
      if (montadoRef.current) setErrorCamara(mensajeError(err))
    } finally {
      iniciandoRef.current = false
      if (montadoRef.current) setIniciando(false)
    }
  }

  async function cambiarCamara(evento) {
    const id = evento.target.value
    setCamaraActiva(id)
    const s = scannerRef.current
    if (s?.isScanning) {
      try {
        await s.stop()
      } catch {
        /* continuar igualmente */
      }
    }
    iniciar(id)
  }

  useEffect(() => {
    montadoRef.current = true
    scannerRef.current = new Html5Qrcode('lector-qr', { verbose: false })
    const temporizador = window.setTimeout(() => iniciar(), 0)

    return () => {
      montadoRef.current = false
      window.clearTimeout(temporizador)
      const s = scannerRef.current
      if (s && s.isScanning) {
        s.stop().catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activos = empleados.filter((e) => e.activo)

  return (
    <div className="kiosco">
      <header className={`kiosco-cabecera ${esPublico ? 'modo-publico' : ''}`}>
        <div className="kiosco-marca">
          <LogoFichaOK tamano={esPublico ? 64 : 40} />
          <h1>Ficha OK</h1>
        </div>
        {!esPublico && (
          <div className="kiosco-enlaces">
            <Link to="/admin" className="enlace-admin">
              Panel de administración
            </Link>
            <button type="button" className="btn btn-secundario btn-mini" onClick={cerrarSesion}>
              Salir
            </button>
          </div>
        )}
      </header>

      {avisoSafari && (
        <p className="kiosco-aviso">
          Safari solo permite usar la cámara en sitios HTTPS. Abre la app con un
          túnel HTTPS (por ejemplo npx ngrok http 5173) o usa Chrome.
        </p>
      )}

      <p className="kiosco-instruccion">Acerca tu código QR a la cámara</p>

      <div className="kiosco-modos" role="group" aria-label="Tipo de fichaje">
        <button
          type="button"
          className={`btn ${!modoPausa && !motivoAusencia ? 'activado activado-fichaje' : ''}`}
          onClick={() => {
            setModoPausa(false)
            setMotivoAusencia(null)
          }}
        >
          Fichaje
        </button>
        <button
          type="button"
          className={`btn ${modoPausa && !motivoAusencia ? 'activado activado-pausa' : ''}`}
          onClick={() => {
            setModoPausa(true)
            setMotivoAusencia(null)
          }}
        >
          Descanso
        </button>
      </div>

      <div className="kiosco-modos" role="group" aria-label="Tipo de ausencia">
        <button
          type="button"
          className={`btn ${motivoAusencia === 'medico' ? 'activado activado-aviso' : ''}`}
          onClick={() => {
            setMotivoAusencia('medico')
            setModoPausa(false)
          }}
        >
          Médico
        </button>
        <button
          type="button"
          className={`btn ${motivoAusencia === 'otros' ? 'activado activado-aviso' : ''}`}
          onClick={() => {
            setMotivoAusencia('otros')
            setModoPausa(false)
          }}
        >
          Otros
        </button>
      </div>

      <div className="kiosco-visor">
        <div id="lector-qr" />
        {errorCamara && (
          <div className="kiosco-error">
            <p>{errorCamara}</p>
            <button
              type="button"
              className="btn btn-mini btn-primario"
              onClick={() => iniciar()}
              disabled={iniciando}
            >
              {iniciando ? 'Activando…' : 'Reintentar'}
            </button>
          </div>
        )}
      </div>

      {camaras.length > 1 && (
        <select
          className="selector-camara"
          value={camaraActiva}
          onChange={cambiarCamara}
          aria-label="Seleccionar cámara"
        >
          {camaras.map((c, i) => (
            <option key={c.id} value={c.id}>
              {c.label || `Cámara ${i + 1}`}
            </option>
          ))}
        </select>
      )}

      <div aria-live="polite" className="toast-zona">
        {toast && (
          <div className={`toast toast-${toast.clave}`}>{toast.texto}</div>
        )}
      </div>

      {!esPublico && (
        <details className="registro-manual">
          <summary>Registro manual</summary>
          {activos.length === 0 ? (
            <p>No hay empleados activos.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const datos = new FormData(e.target)
                const id = datos.get('empleado')
                if (!id) return
                ultimoScanRef.current = { texto: id, tiempo: Date.now() }
                registrar(id).catch(() => {})
              }}
            >
              <select name="empleado" defaultValue="" required>
                <option value="" disabled>
                  Selecciona tu nombre
                </option>
                {activos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primario">
                Fichar
              </button>
            </form>
          )}
        </details>
      )}
    </div>
  )
}
