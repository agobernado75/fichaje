import { Link, useNavigate } from 'react-router-dom'
import Login from './Login'

export default function AccesoAdmin() {
  const navigate = useNavigate()

  return (
    <div className="acceso-page">
      <Login onClose={() => navigate('/')} />
      <Link to="/" className="acceso-volver">
        ← Volver al fichaje
      </Link>
    </div>
  )
}