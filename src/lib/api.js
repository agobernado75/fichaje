import { supabase } from './supabase'

const EVENTO_A_BD = {
  entrada: 'entry',
  salida: 'exit',
  pausa_inicio: 'break_start',
  pausa_fin: 'break_end',
}
const BD_A_EVENTO = {
  entry: 'entrada',
  exit: 'salida',
  break_start: 'pausa_inicio',
  break_end: 'pausa_fin',
}

export async function obtenerEmpresaDeUsuario(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('company_id, companies(*)')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.companies ?? null
}

export async function obtenerCentroPorDefecto(companyId) {
  const { data, error } = await supabase
    .from('work_centers')
    .select('id')
    .eq('company_id', companyId)
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function obtenerCentros() {
  let { data, error } = await supabase
    .from('work_centers')
    .select('id, name, address, provincia, descanso_min, active')
    .order('created_at', { ascending: true })

  if (error) {
    // Columna descanso_min aún no existe en la BD; reintenta sin ella.
    const retry = await supabase
      .from('work_centers')
      .select('id, name, address, provincia, active')
      .order('created_at', { ascending: true })
    if (retry.error) throw retry.error
    data = retry.data
  }

  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.name ?? '',
    direccion: c.address ?? '',
    provincia: c.provincia ?? '',
    descansoMin: c.descanso_min ?? 0,
    activo: c.active,
  }))
}

export async function crearCentro({ nombre, direccion, provincia, descansoMin, companyId }) {
  const payload = {
    company_id: companyId,
    name: nombre,
    address: direccion || '',
    provincia: provincia || '',
    latitude: 0,
    longitude: 0,
    qr_token_hash: crypto.randomUUID(),
    active: true,
  }
  if (Number.isInteger(descansoMin) && descansoMin >= 0) {
    payload.descanso_min = descansoMin
  }
  let { data, error } = await supabase
    .from('work_centers')
    .insert(payload)
    .select('id')
    .single()

  if (error && error.message?.includes('descanso_min')) {
    delete payload.descanso_min
    const retry = await supabase
      .from('work_centers')
      .insert(payload)
      .select('id')
      .single()
    if (retry.error) throw retry.error
    return retry.data
  }
  if (error) throw error
  return data
}

export async function editarCentro(centroId, { nombre, direccion, provincia, descansoMin }) {
  const payload = {
    name: nombre,
    address: direccion || '',
    provincia: provincia || '',
  }
  if (Number.isInteger(descansoMin) && descansoMin >= 0) {
    payload.descanso_min = descansoMin
  }
  let { error } = await supabase
    .from('work_centers')
    .update(payload)
    .eq('id', centroId)

  if (error && error.message?.includes('descanso_min')) {
    delete payload.descanso_min
    const retry = await supabase
      .from('work_centers')
      .update(payload)
      .eq('id', centroId)
    if (retry.error) throw retry.error
    return
  }
  if (error) throw error
}

export async function alternarActivoCentro(centroId, activo) {
  const { error } = await supabase
    .from('work_centers')
    .update({ active: activo })
    .eq('id', centroId)
  if (error) throw error
}

export async function obtenerEmpleados() {
  const { data, error } = await supabase
    .from('employees')
    .select(
      'id, employee_number, active, surname, nif, shift, shift_start, shift_end, shift_start_pm, shift_end_pm, profiles(full_name, email), employee_work_centers(active, work_centers(id, name))',
    )
  if (error) throw error

  return (data ?? []).map((e) => {
    const centro = e.employee_work_centers?.find((ewc) => ewc.active)
    return {
      id: e.id,
      nombre: e.profiles?.full_name ?? '',
      email: e.profiles?.email ?? '',
      cargo: e.employee_number ?? '',
      apellidos: e.surname ?? '',
      nif: e.nif ?? '',
      turno: e.shift ?? '',
      horarioInicio: (e.shift_start ?? '').toString().slice(0, 5),
      horarioFin: (e.shift_end ?? '').toString().slice(0, 5),
      horarioInicioPm: (e.shift_start_pm ?? '').toString().slice(0, 5),
      horarioFinPm: (e.shift_end_pm ?? '').toString().slice(0, 5),
      centroId: centro?.work_centers?.id ?? centro?.id ?? null,
      centroNombre: centro?.work_centers?.name ?? '',
      activo: e.active,
    }
  })
}

export async function crearEmpleado({
  nombre,
  apellidos,
  nif,
  centroId,
  turno,
  horaInicio,
  horaFin,
  horaInicioPm,
  horaFinPm,
  companyId,
}) {
  const nombreCompleto = `${nombre} ${apellidos ?? ''}`.trim()
  const { data: perfil, error: errorPerfil } = await supabase
    .from('profiles')
    .insert({
      id: crypto.randomUUID(),
      full_name: nombreCompleto,
      email: null,
      role: 'employee',
      active: true,
      company_id: companyId,
    })
    .select('id')
    .single()
  if (errorPerfil) throw errorPerfil

  const { data: empleado, error: errorEmpleado } = await supabase
    .from('employees')
    .insert({
      profile_id: perfil.id,
      company_id: companyId,
      surname: apellidos?.trim() || null,
      nif: nif?.trim().toUpperCase() || null,
      shift: turno || null,
      shift_start: horaInicio || null,
      shift_end: horaFin || null,
      shift_start_pm: turno === 'partida' ? (horaInicioPm || null) : null,
      shift_end_pm: turno === 'partida' ? (horaFinPm || null) : null,
      active: true,
    })
    .select('id, surname, nif, shift, shift_start, shift_end, shift_start_pm, shift_end_pm, active, profile_id')
    .single()
  if (errorEmpleado) throw errorEmpleado

  const centroIdFinal = centroId ?? (await obtenerCentroPorDefecto(companyId))
  if (centroIdFinal) {
    const { error: errorCentro } = await supabase
      .from('employee_work_centers')
      .insert({
        employee_id: empleado.id,
        work_center_id: centroIdFinal,
        active: true,
      })
    if (errorCentro) throw errorCentro
  }

  return {
    id: empleado.id,
    nombre: nombreCompleto,
    apellidos: empleado.surname ?? '',
    nif: empleado.nif ?? '',
    turno: empleado.shift ?? '',
    horarioInicio: (empleado.shift_start ?? '').toString().slice(0, 5),
    horarioFin: (empleado.shift_end ?? '').toString().slice(0, 5),
    horarioInicioPm: (empleado.shift_start_pm ?? '').toString().slice(0, 5),
    horarioFinPm: (empleado.shift_end_pm ?? '').toString().slice(0, 5),
    centroId: centroIdFinal ?? null,
    cargo: '',
    activo: true,
  }
}

export async function editarEmpleado(
  empleadoId,
  { nombre, apellidos, nif, centroId, turno, horaInicio, horaFin, horaInicioPm, horaFinPm },
) {
  const { data: emp, error: errorEmp } = await supabase
    .from('employees')
    .select('profile_id')
    .eq('id', empleadoId)
    .single()
  if (errorEmp) throw errorEmp

  const operaciones = []
  if (nombre !== undefined) {
    const apellidosActual = apellidos ?? ''
    operaciones.push(
      supabase
        .from('profiles')
        .update({ full_name: `${nombre} ${apellidosActual}`.trim() })
        .eq('id', emp.profile_id),
    )
  }
  operaciones.push(
    supabase
      .from('employees')
      .update({
        surname: apellidos?.trim() || null,
        nif: nif?.trim().toUpperCase() || null,
        shift: turno || null,
        shift_start: horaInicio || null,
        shift_end: horaFin || null,
        shift_start_pm: turno === 'partida' ? (horaInicioPm || null) : null,
        shift_end_pm: turno === 'partida' ? (horaFinPm || null) : null,
      })
      .eq('id', empleadoId),
  )

  const resultados = await Promise.all(operaciones)
  for (const r of resultados) if (r.error) throw r.error

  if (centroId) {
    const { data: ewc, error: errorEwc } = await supabase
      .from('employee_work_centers')
      .select('work_center_id')
      .eq('employee_id', empleadoId)
    if (errorEwc) throw errorEwc

    await supabase
      .from('employee_work_centers')
      .update({ active: false })
      .eq('employee_id', empleadoId)
      .then(comprobarError)

    const yaAsignado = ewc?.some((f) => f.work_center_id === centroId)
    if (yaAsignado) {
      await supabase
        .from('employee_work_centers')
        .update({ active: true })
        .eq('employee_id', empleadoId)
        .eq('work_center_id', centroId)
        .then(comprobarError)
    } else {
      await supabase
        .from('employee_work_centers')
        .insert({
          employee_id: empleadoId,
          work_center_id: centroId,
          active: true,
        })
        .then(comprobarError)
    }
  }
}

function comprobarError({ error }) {
  if (error) throw error
  return error
}

export async function alternarActivoEmpleado(empleadoId, activo) {
  const { error } = await supabase
    .from('employees')
    .update({ active: activo })
    .eq('id', empleadoId)
  if (error) throw error
}

export async function eliminarEmpleado(empleadoId) {
  const { data: emp, error: errorEmp } = await supabase
    .from('employees')
    .select('profile_id')
    .eq('id', empleadoId)
    .single()
  if (errorEmp) throw errorEmp

  const { error: errorCentros } = await supabase
    .from('employee_work_centers')
    .delete()
    .eq('employee_id', empleadoId)
  if (errorCentros) throw errorCentros

  const { error: errorEventos } = await supabase
    .from('time_records')
    .delete()
    .eq('employee_id', empleadoId)
  if (errorEventos) throw errorEventos

  const { error: errorEmp2 } = await supabase
    .from('employees')
    .delete()
    .eq('id', empleadoId)
  if (errorEmp2) throw errorEmp2

  const { error: errorPerfil } = await supabase
    .from('profiles')
    .delete()
    .eq('id', emp.profile_id)
  if (errorPerfil) throw errorPerfil
}

export async function últimoEventoDeHoy(empleadoId) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const { data, error } = await supabase
    .from('time_records')
    .select('event_type, recorded_at')
    .eq('employee_id', empleadoId)
    .gte('recorded_at', hoy.toISOString())
    .order('recorded_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] ? { ...data[0], event_type: BD_A_EVENTO[data[0].event_type] ?? data[0].event_type } : null
}

export async function registrarTimeRecord({ employeeId, workCenterId, eventType, companyId }) {
  const { error } = await supabase.from('time_records').insert({
    employee_id: employeeId,
    company_id: companyId || null,
    work_center_id: workCenterId || null,
    event_type: EVENTO_A_BD[eventType] ?? eventType,
    recorded_at: new Date().toISOString(),
    qr_verified: true,
    gps_verified: false,
    idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
}

export async function obtenerTimeRecords({ desde, hasta }) {
  let consulta = supabase
    .from('time_records')
    .select(
      'id, employee_id, event_type, recorded_at, work_center_id, employees(profiles(full_name))',
    )
    .gte('recorded_at', `${desde}T00:00:00`)
    .lte('recorded_at', `${hasta}T23:59:59`)

  const { data, error } = await consulta.order('recorded_at', {
    ascending: false,
  })
  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id,
    empleadoId: r.employee_id,
    nombre: r.employees?.profiles?.full_name ?? '(sin nombre)',
    event_type: BD_A_EVENTO[r.event_type] ?? r.event_type,
    recorded_at: r.recorded_at,
    work_center_id: r.work_center_id ?? null,
  }))
}

export async function actualizarLogoEmpresa(companyId, logoUrl) {
  const { error } = await supabase
    .from('companies')
    .update({ logo_url: logoUrl })
    .eq('id', companyId)
  if (error) throw error
}

export async function actualizarEvento(eventoId, recordedAt) {
  const { error } = await supabase
    .from('time_records')
    .update({ recorded_at: recordedAt })
    .eq('id', eventoId)
  if (error) throw error
}

export async function crearEvento({ employeeId, companyId, workCenterId, eventType, recordedAt }) {
  const { error } = await supabase.from('time_records').insert({
    employee_id: employeeId,
    company_id: companyId || null,
    work_center_id: workCenterId || null,
    event_type: EVENTO_A_BD[eventType] ?? eventType,
    recorded_at: recordedAt,
    qr_verified: false,
    gps_verified: false,
    idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
}

export async function obtenerAusencias() {
  const { data, error } = await supabase
    .from('absences')
    .select(
      'id, employee_id, work_center_id, motivo, recorded_at, closed_at, employees(profiles(full_name))',
    )
    .order('recorded_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id,
    empleadoId: r.employee_id,
    nombre: r.employees?.profiles?.full_name ?? '(sin nombre)',
    motivo: r.motivo,
    recorded_at: r.recorded_at,
    closed_at: r.closed_at,
    work_center_id: r.work_center_id ?? null,
  }))
}

export async function cerrarAusencia(id) {
  const { error } = await supabase
    .from('absences')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ---------- Horas extraordinarias (registro manual) ----------

// Convierte "2:30" a minutos (150). Devuelve null si no es un formato H:MM válido.
export function horaAMinutos(hhmm) {
  if (typeof hhmm !== 'string') return null
  const m = hhmm.trim().match(/^(\d{1,3}):([0-5]\d)$/)
  if (!m) return null
  const total = Number(m[1]) * 60 + Number(m[2])
  if (total <= 0) return null
  return total
}

// Convierte minutos a "H:MM" (o "MM" para la etiqueta de estado).
export function minutosAHora(min) {
  const total = Math.round(min ?? 0)
  if (total <= 0) return ''
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return `${h}:${String(m).padStart(2, '0')}`
}

export async function obtenerHorasExtraordinarias() {
  const { data, error } = await supabase
    .from('overtime')
    .select(
      'id, employee_id, company_id, work_center_id, fecha, minutos, descripcion, estado, aprobado_por, aprobado_at, created_at, employees(profiles(full_name))',
    )
    .order('fecha', { ascending: false })
  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id,
    empleadoId: r.employee_id,
    nombre: r.employees?.profiles?.full_name ?? '(sin nombre)',
    centroId: r.work_center_id ?? null,
    centroNombre: '',
    fecha: r.fecha,
    minutos: r.minutos,
    descripcion: r.descripcion ?? '',
    estado: r.estado,
    aprobadoPor: r.aprobado_por,
    aprobadoAt: r.aprobado_at,
    createdAt: r.created_at,
  }))
}

export async function crearHoraExtraordinaria({
  empleadoId,
  companyId,
  workCenterId,
  fecha,
  minutos,
  descripcion,
  estado,
}) {
  const { error } = await supabase.from('overtime').insert({
    employee_id: empleadoId,
    company_id: companyId || null,
    work_center_id: workCenterId || null,
    fecha,
    minutos,
    descripcion: descripcion?.trim() || null,
    estado: estado ?? 'pendiente',
    aprobado_por: estado === 'aprobada' ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
    aprobado_at: estado === 'aprobada' ? new Date().toISOString() : null,
  })
  if (error) throw error
}

export async function editarHoraExtraordinaria(id, { fecha, minutos, descripcion, estado, workCenterId }) {
  const { error } = await supabase
    .from('overtime')
    .update({
      fecha,
      minutos,
      descripcion: descripcion?.trim() || null,
      estado,
      work_center_id: workCenterId || null,
      aprobado_por: estado === 'aprobada' ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
      aprobado_at: estado === 'aprobada' ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function cambiarEstadoHoraExtraordinaria(id, estado) {
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('overtime')
    .update({
      estado,
      aprobado_por: estado === 'aprobada' ? userData.user?.id ?? null : null,
      aprobado_at: estado === 'aprobada' ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function eliminarHoraExtraordinaria(id) {
  const { error } = await supabase.from('overtime').delete().eq('id', id)
  if (error) throw error
}
