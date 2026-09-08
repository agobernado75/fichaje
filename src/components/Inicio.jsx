import { Link } from 'react-router-dom'
import EscanerQR from './EscanerQR'

export default function Inicio() {
  return (
    <div className="inicio">
      <Link to="/acceso" className="inicio-admin">
        Acceso admin
      </Link>

      <EscanerQR modo="publico" />
    </div>
  )
}