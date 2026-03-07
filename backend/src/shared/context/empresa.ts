// Empresa activa (temporal)
// En el futuro esto vendrá del usuario / token / sesión

export function getEmpresaActivaId(): number {
  const fromEnv = process.env.EMPRESA_ACTIVA_ID || process.env.EMPRESA_ID_ACTIVA || process.env.EMPRESA_ID;
  const parsed = fromEnv !== undefined ? Number(fromEnv) : NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  // Fallback conservador (evitar crash si no está configurado el entorno)
  return 1;
}
