import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import PanelAdmin from './components/PanelAdmin'
import Inicio from './components/Inicio'
import AccesoAdmin from './components/AccesoAdmin'
import EscanerQR from './components/EscanerQR'
import ConfigurarEmpresa from './components/ConfigurarEmpresa'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './context/AuthContext'

function AppRoutes() {
  const { sesion, empresa, cargando } = useAuth()

  if (cargando) {
    return <div className="cargando">Cargando…</div>
  }

  if (!sesion) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/acceso" element={<AccesoAdmin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (!empresa) {
    return <ConfigurarEmpresa />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EscanerQR />} />
        <Route path="/admin" element={<PanelAdmin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App