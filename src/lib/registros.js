export function actualizarRegistro(registros, empleadoId, fecha, campo, valor) {
  const existente = registros.find(
    (r) => r.empleadoId === empleadoId && r.fecha === fecha,
  )
  if (!existente) {
    if (!valor) return registros
    return [
      ...registros,
      {
        id: crypto.randomUUID(),
        empleadoId,
        fecha,
        entrada: '',
        salida: '',
        [campo]: valor,
      },
    ]
  }
  const actualizado = { ...existente, [campo]: valor }
  if (!actualizado.entrada && !actualizado.salida) {
    return registros.filter((r) => r.id !== existente.id)
  }
  return registros.map((r) => (r.id === existente.id ? actualizado : r))
}
