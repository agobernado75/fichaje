import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import LogoFichaOK from './LogoFichaOK'

function Campo({ etiqueta, children }) {
  return (
    <label className="campo-login">
      <span>{etiqueta}</span>
      {children}
    </label>
  )
}

export default function Login({ onClose }) {
  const { iniciarSesion, registrarse } = useAuth()
  const [modo, setModo] = useState('login')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const esLogin = modo === 'login'

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const datos = new FormData(e.target)

    try {
      if (esLogin) {
        await iniciarSesion({
          email: datos.get('email'),
          password: datos.get('password'),
        })
      } else {
        await registrarse({
          email: datos.get('email'),
          password: datos.get('password'),
          nombreCompleto: datos.get('nombre'),
          empresaNombre: datos.get('empresa'),
          taxId: datos.get('taxId'),
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      className="login-tarjeta"
      onClick={(e) => e.stopPropagation()}
      onSubmit={enviar}
    >
      {onClose && (
        <button
          type="button"
          className="login-cerrar"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ✕
        </button>
      )}

      <LogoFichaOK tamano={56} />
      <h1 className="login-titulo">Ficha OK</h1>

      <div className="login-pestanas">
        <button
          type="button"
          className={`pestana ${esLogin ? 'activa' : ''}`}
          onClick={() => {
            setModo('login')
            setError('')
          }}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          className={`pestana ${!esLogin ? 'activa' : ''}`}
          onClick={() => {
            setModo('registro')
            setError('')
          }}
        >
          Registrar admin
        </button>
      </div>

      {!esLogin && (
        <>
          <Campo etiqueta="Nombre completo">
            <input name="nombre" required placeholder="Tu nombre" />
          </Campo>
          <Campo etiqueta="Empresa">
            <input name="empresa" required placeholder="Nombre de la empresa" />
          </Campo>
          <Campo etiqueta="NIF/CIF (opcional)">
            <input name="taxId" placeholder="B00000000" />
          </Campo>
        </>
      )}

      <Campo etiqueta="Correo electrónico">
        <input name="email" type="email" required placeholder="tu@correo.com" />
      </Campo>
      <Campo etiqueta="Contraseña">
        <input name="password" type="password" required minLength={6} placeholder="••••••" />
      </Campo>

      {error && <p className="login-error">{error}</p>}

      <button type="submit" className="btn btn-primario" disabled={enviando}>
        {enviando ? 'Espera…' : esLogin ? 'Entrar' : 'Crear cuenta y empresa'}
      </button>
    </form>
  )
}