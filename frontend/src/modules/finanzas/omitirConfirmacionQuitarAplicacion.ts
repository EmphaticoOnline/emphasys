const PREFIJO = 'emphasys:finanzas:nota-credito:omitir-confirmacion-quitar-aplicacion';

type AlmacenLocal = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function llaveOmitirConfirmacionQuitarAplicacion(usuarioId: number | null | undefined): string | null {
  const id = Number(usuarioId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return `${PREFIJO}:${id}`;
}

export function omiteConfirmacionQuitarAplicacion(
  usuarioId: number | null | undefined,
  almacen: AlmacenLocal = window.localStorage,
): boolean {
  const llave = llaveOmitirConfirmacionQuitarAplicacion(usuarioId);
  if (!llave) return false;
  try {
    return almacen.getItem(llave) === '1';
  } catch {
    return false;
  }
}

export function debeGuardarOmitirConfirmacion(confirmoQuitar: boolean, omitirConfirmacion: boolean): boolean {
  return confirmoQuitar && omitirConfirmacion;
}

export function guardarOmitirConfirmacionQuitarAplicacion(
  usuarioId: number | null | undefined,
  almacen: AlmacenLocal = window.localStorage,
): void {
  const llave = llaveOmitirConfirmacionQuitarAplicacion(usuarioId);
  if (!llave) return;
  try {
    almacen.setItem(llave, '1');
  } catch {
    // localStorage puede no estar disponible; la confirmación seguirá apareciendo.
  }
}
