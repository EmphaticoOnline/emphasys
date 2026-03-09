export function formatearFolioDocumento(serie: string, numero: number): string {
  const serieLimpia = (serie ?? '').trim();

  const ancho = Math.abs(numero) < 1000 ? 3 : 6;
  const numeroConSigno = numero < 0 ? '-' : '';
  const numeroFormateado = `${numeroConSigno}${Math.abs(numero).toString().padStart(ancho, '0')}`;

  if (!serieLimpia) {
    return numeroFormateado;
  }

  return `${serieLimpia}-${numeroFormateado}`;
}
