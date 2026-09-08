import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function ConfigurarEmpresa() {
  const { usuario, configurarEmpresa, cerrarSesion } = useAuth()
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const datos = new FormData(e.target)
    try {
      await configurarEmpresa({
        nombreCompleto: datos.get('nombre') || usuario?.email || '',
        empresaNombre: datos.get('empresa'),
        taxId: datos.get('taxId'),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <form className="login-tarjeta" onSubmit={enviar}>
        <h1 className="login-titulo">Configura tu empresa</h1>
        <p className="login-ayuda">
          Tu cuenta existe pero aún no está asociada a una empresa. Crea una para
          empezar a usar la app.
        </p>

        <label className="campo-login">
          <span>Nombre completo (admin)</span>
          <input name="nombre" placeholder="Tu nombre" />
        </label>
        <label className="campo-login">
          <span>Empresa</span>
          <input name="empresa" required placeholder="Nombre de la empresa" />
        </label>
        <label className="campo-login">
          <span>NIF/CIF (opcional)</span>
          <input name="taxId" placeholder="B00000000" />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" className="btn btn-primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Crear empresa'}
        </button>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={cerrarSesion}
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  )
}