import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

const TABLA_ANCHOS = {
  Fecha: 1500,
  Entrada: 1100,
  Salida: 1100,
  Descansos: 1800,
  'Horas efectivas': 1500,
  'Horas esperadas': 1500,
}

function celda(texto, ancho, negrita = false) {
  return new TableCell({
    width: { size: ancho, type: WidthType.DXA },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ text: texto ?? '', bold: negrita, size: 20 }),
        ],
      }),
    ],
  })
}

function fila(celdas, anchos) {
  return new TableRow({
    children: celdas.map((c, i) => celda(c, anchos[i], false)),
  })
}

function filaEncabezado(columnas, anchos) {
  return new TableRow({
    children: columnas.map((c) => celda(c, anchos[c], true)),
    tableHeader: true,
  })
}

// empresa: { name, tax_id }, centro: { nombre, direccion, provincia },
// trabajadores: [{ nombre, horasMes, filas: [{fecha, entrada, salida, pausas, horasEfectivas, horasEsperadas}] }]
export async function exportarInformeDoc({ empresa, centro, mes, trabajadores }) {
  const cuerpo = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: empresa?.name ?? '', bold: true, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: `CIF: ${empresa?.tax_id ?? '—'}`, size: 24 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Centro: ${centro?.nombre ?? ''}${centro?.direccion || centro?.provincia ? ` — ${[centro.direccion, centro.provincia].filter(Boolean).join(', ')}` : ''}`,
          size: 24,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({ text: `Informe de asistencia — ${mes}`, bold: true, size: 28 }),
      ],
    }),
  ]

  for (const t of (trabajadores ?? []).filter((x) => x.filas.length > 0)) {
    cuerpo.push(
      new Paragraph({
        spacing: { before: 300, after: 60 },
        children: [new TextRun({ text: t.nombre, bold: true, size: 26 })],
      }),
    )
    cuerpo.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `Horas realizadas en ${mes}: `, size: 22 }),
          new TextRun({ text: t.horasMes || '0h', bold: true, size: 22 }),
        ],
      }),
    )

    const columnas = ['Fecha', 'Entrada', 'Salida', 'Descansos', 'Horas efectivas', 'Horas esperadas']
    const filas = t.filas.map((f) =>
      fila(
        [f.fecha, f.entrada || '—', f.salida || '—', (f.pausas ?? []).slice(0, 2).join(', ') || '—', f.horasEfectivas ?? '—', f.horasEsperadas ?? '—'],
        columnas.map((c) => TABLA_ANCHOS[c]),
      ),
    )

    cuerpo.push(
      new Table({
        width: { size: 8500, type: WidthType.DXA },
        rows: [filaEncabezado(columnas, TABLA_ANCHOS), ...filas],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 },
        },
      }),
    )
  }

  const documento = new Document({
    sections: [
      {
        properties: {},
        children: cuerpo,
      },
    ],
  })

  const blob = await Packer.toBlob(documento)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `informe-${mes}-${centro?.nombre ?? 'empresa'}.docx`
  enlace.click()
  URL.revokeObjectURL(url)
}