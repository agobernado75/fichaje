/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { obtenerEmpresaDeUsuario, actualizarLogoEmpresa } from '../lib/api'

const AuthContext = createContext(null)

async function crearEmpresaParaUsuario(userId, email, { empresaNombre, taxId, nombreCompleto }) {
  const empresaId = crypto.randomUUID()

  const { error: errorEmpresa } = await supabase
    .from('companies')
    .insert({ id: empresaId, name: empresaNombre, tax_id: taxId || null, active: true })
  if (errorEmpresa) throw errorEmpresa

  const { error: errorPerfil } = await supabase.from('profiles').insert({
    id: userId,
    company_id: empresaId,
    full_name: nombreCompleto,
    email,
    role: 'admin',
    active: true,
  })
  if (errorPerfil) throw errorPerfil

  const { error: errorCentro } = await supabase.from('work_centers').insert({
    company_id: empresaId,
    name: 'Centro por defecto',
    address: '',
    latitude: 0,
    longitude: 0,
    qr_token_hash: crypto.randomUUID(),
    active: true,
  })
  if (errorCentro) throw errorCentro

  const { data: nuevaEmpresa, error: errorLectura } = await supabase
    .from('companies')
    .select('*')
    .eq('id', empresaId)
    .single()
  if (errorLectura) throw errorLectura

  return nuevaEmpresa
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [empresa, setEmpresa] = useState(null)
  const [recargandoEmpresa, setRecargandoEmpresa] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setSesion(sesion)
      if (!sesion?.user) setEmpresa(null)
    })

    return () => sub?.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const id = sesion?.user?.id
    if (!id) return
    obtenerEmpresaDeUsuario(id).then(setEmpresa)
  }, [sesion])

  async function registrarse({ email, password, nombreCompleto, empresaNombre, taxId }) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    const userId = data?.user?.id
    if (!userId) throw new Error('No se pudo crear el usuario')

    const nuevaEmpresa = await crearEmpresaParaUsuario(userId, email, {
      empresaNombre,
      taxId,
      nombreCompleto,
    })
    setEmpresa(nuevaEmpresa)
    return data.session
  }

  async function configurarEmpresa({ nombreCompleto, empresaNombre, taxId }) {
    const user = sesion?.user
    if (!user) throw new Error('No hay sesión activa')
    setRecargandoEmpresa(true)
    try {
      const nuevaEmpresa = await crearEmpresaParaUsuario(user.id, user.email, {
        empresaNombre,
        taxId,
        nombreCompleto,
      })
      setEmpresa(nuevaEmpresa)
      return nuevaEmpresa
    } finally {
      setRecargandoEmpresa(false)
    }
  }

  async function iniciarSesion({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function establecerLogo(logoUrl) {
    const id = empresa?.id
    if (!id) throw new Error('No hay empresa en la sesión')
    await actualizarLogoEmpresa(id, logoUrl)
    setEmpresa((anterior) => ({ ...anterior, logo_url: logoUrl }))
    return logoUrl
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        sesion,
        usuario: sesion?.user ?? null,
        empresa,
        cargando,
        recargandoEmpresa,
        registrarse,
        configurarEmpresa,
        iniciarSesion,
        establecerLogo,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}