import * as XLSX from 'xlsx'

function descargar(wb, nombreArchivo) {
  XLSX.writeFile(wb, nombreArchivo)
}

// filas: fichajes diarios por empleado {fecha, nombre, entrada, salida, pausas, horasEfectivas, horasEsperadas}
export function exportarInformeXls({
  nombreArchivo,
  filas,
  resumenPorEmpleado,
}) {
  const hojaFichajes = XLSX.utils.json_to_sheet(
    filas.map((f) => ({
      Fecha: f.fecha,
      Empleado: f.nombre,
      Entrada: f.entrada || '',
      Salida: f.salida || '',
      Descansos: f.pausas.slice(0, 2).join(', '),
      'Horas efectivas': f.horasEfectivas ?? '',
      'Horas esperadas': f.horasEsperadas ?? '',
    })),
    { header: ['Fecha', 'Empleado', 'Entrada', 'Salida', 'Descansos', 'Horas efectivas', 'Horas esperadas'] },
  )
  hojaFichajes['!cols'] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 9 },
    { wch: 9 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ]

  const hojaResumen = XLSX.utils.json_to_sheet(
    (resumenPorEmpleado ?? []).map((r) => ({
      Empleado: r.nombre,
      Días: r.dias,
      'Horas efectivas': r.horas,
    })),
    { header: ['Empleado', 'Días', 'Horas efectivas'] },
  )
  hojaResumen['!cols'] = [{ wch: 28 }, { wch: 8 }, { wch: 16 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, hojaFichajes, 'Fichajes')
  XLSX.utils.book_append_sheet(wb, hojaResumen, 'Resumen')
  descargar(wb, nombreArchivo)
}