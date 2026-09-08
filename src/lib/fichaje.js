import { tipoDeEvento } from './jornada'

export function decidirFichaje(ultimoEvento, pausa = false) {
  return tipoDeEvento(ultimoEvento, pausa)
}
