import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

function nombreArchivo(nombre) {
  return (
    'qr-' +
    nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '') +
    '.png'
  )
}

export default function QRModal({ empleado, onClose }) {
  const tarjetaRef = useRef(null)

  function descargarPNG() {
    const canvas = tarjetaRef.current.querySelector('canvas')
    const enlace = document.createElement('a')
    enlace.download = nombreArchivo(empleado.nombre)
    enlace.href = canvas.toDataURL('image/png')
    enlace.click()
  }

  function imprimir() {
    window.print()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Código QR de ${empleado.nombre}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Código QR de acceso</h3>
        <div className="qr-imprimible" ref={tarjetaRef}>
          <QRCodeCanvas
            value={empleado.id}
            size={600}
            marginSize={2}
            level="M"
            style={{ width: 'min(60vw, 240px)', height: 'min(60vw, 240px)' }}
          />
          <p className="qr-nombre">{empleado.nombre}</p>
          {empleado.cargo && <p className="qr-cargo">{empleado.cargo}</p>}
        </div>
        <p className="qr-ayuda">
          Imprime esta credencial para que el empleado pueda fichar escaneando
          su código en la pantalla de entrada.
        </p>
        <div className="modal-acciones">
          <button type="button" className="btn btn-primario" onClick={descargarPNG}>
            Descargar PNG
          </button>
          <button type="button" className="btn btn-secundario" onClick={imprimir}>
            Imprimir
          </button>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
