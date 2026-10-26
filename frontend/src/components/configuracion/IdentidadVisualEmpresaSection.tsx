import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Popover,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { ThemeProvider, useTheme, type Theme } from '@mui/material/styles';
import { HexColorPicker } from 'react-colorful';
import { catalogoOutlinedButtonSx, catalogoPrimaryButtonSx } from '../catalogo/catalogoSurfaces';
import { Section } from '../transporte/transporteVisual';
import {
  analizarLogoIdentidad,
  fetchIdentidadVisual,
  guardarIdentidadVisual,
  type IdentidadVisualEmpresa,
} from '../../services/identidadVisualService';
import { useSession } from '../../session/useSession';
import { getEmpresaBrand } from '../../theme/brand/empresaBrand';
import { useBrand } from '../../theme/brand/useBrand';
import { getThemeById, type ThemeId } from '../../theme/themes';
import {
  colorEfectivo,
  contrasteRol,
  cuerpoCambios,
  describirColor,
  ETIQUETA_FONDO,
  ETIQUETAS,
  leerHex,
  manualesAfectados,
  rolesCambiados,
  ROLES,
  SIN_COLORES,
  type Colores,
  type Origen,
  ETIQUETA_SUPERFICIE,
  SUPERFICIE_SECUNDARIA_EMPHASYS,
  textoSobreSuperficieSecundaria,
} from './identidadVisualEdicion';
import { emphasysBrand } from '../../theme/brand/emphasys';
import { brandLogos } from '../../theme/brand/logos';
import { useEmpresaLogo } from '../../theme/brand/useEmpresaLogo';
import { razonContraste } from '../../../../backend/src/shared/identidadVisual/contraste';
import type { ModoPresentacionLogo } from '../../services/identidadVisualService';

type RolIdentidad = (typeof ROLES)[number];

const ORIGEN_EMPHASYS: Origen = { primario: 'emphasys', acento: 'emphasys', sidebar: 'emphasys' };
const ETIQUETA_ORIGEN = { emphasys: 'Emphasys', analisis: 'Del análisis', manual: 'Manual' } as const;

const botonPrimarioSx = (theme: Theme) => ({ ...(catalogoPrimaryButtonSx as (t: Theme) => object)(theme), borderRadius: 1.5 });
const botonSecundarioSx = (theme: Theme) => ({ ...(catalogoOutlinedButtonSx as (t: Theme) => object)(theme), borderRadius: 1.5 });

const muestraSx = (color: string) => (theme: Theme) => ({
  width: 34,
  height: 34,
  borderRadius: 1.5,
  bgcolor: color,
  border: `1px solid ${theme.emphasys.content.border}`,
  flexShrink: 0,
});

/** Vista previa mínima con el tema real (clásico o experimental) de la marca en edición. */
function VistaPreviaTema({ titulo }: { titulo: string }) {
  const theme = useTheme();
  const { activeBrand } = useBrand();
  const { frame, content } = theme.emphasys;
  return (
    <Box sx={{ display: 'flex', minHeight: 156, borderRadius: 2, overflow: 'hidden', border: `1px solid ${content.border}`, bgcolor: content.background }}>
      <Box sx={{ width: 118, bgcolor: frame.background, p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: frame.muted, px: 0.5, pb: 0.5 }}>
          {titulo}
        </Typography>
        {['Contactos', 'Ventas', 'CRM'].map((item, i) => (
          <Box
            key={item}
            sx={{
              fontSize: 12.5,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              color: i === 1 ? frame.selectionForeground : frame.itemForeground,
              bgcolor: i === 1 ? frame.selection : 'transparent',
              borderLeft: `3px solid ${i === 1 ? frame.accent : 'transparent'}`,
            }}
          >
            {item}
          </Box>
        ))}
      </Box>
      <Box sx={{ flex: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1, bgcolor: content.elevated }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: activeBrand.colors.blue.base }}>Factura F-1024</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: activeBrand.colors.accent }}>Indicador de acento</Typography>
        <Box sx={{ mt: 'auto' }}>
          <Button variant="contained" size="small" disableElevation>
            Guardar
          </Button>
        </Box>
      </Box>
      <Box sx={{ width: 34, bgcolor: theme.emphasys.workspaceRail.background, color: theme.emphasys.workspaceRail.foreground, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>R</Box>
    </Box>
  );
}

function FilaColor({
  rol,
  valor,
  origenGuardado,
  propuesta,
  editable,
  onCambiar,
}: {
  rol: RolIdentidad;
  valor: string | null;
  origenGuardado: Origen[RolIdentidad];
  propuesta: string | null;
  editable: boolean;
  onCambiar: (valor: string | null) => void;
}) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const [texto, setTexto] = useState(valor ?? '');
  useEffect(() => setTexto(valor ?? ''), [valor]);
  const efectivo = colorEfectivo(rol, valor);
  const contraste = contrasteRol(rol, valor);
  const textoInvalido = texto !== '' && !leerHex(texto);

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ py: 1 }}>
      <Box sx={{ width: { sm: 170 }, flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{ETIQUETAS[rol].titulo}</Typography>
        <Typography variant="caption" color="text.secondary">
          {ETIQUETAS[rol].uso}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, flexWrap: 'wrap', rowGap: 1 }}>
        <Box
          component="button"
          type="button"
          aria-label={`Elegir color ${ETIQUETAS[rol].titulo}`}
          disabled={!editable}
          onClick={(e: React.MouseEvent<HTMLElement>) => setAncla(e.currentTarget)}
          sx={(theme) => ({ ...muestraSx(efectivo)(theme), cursor: editable ? 'pointer' : 'default', p: 0 })}
        />
        <TextField
          size="small"
          value={texto}
          placeholder="Emphasys"
          disabled={!editable}
          error={textoInvalido}
          helperText={textoInvalido ? 'Usa #RRGGBB' : undefined}
          onChange={(e) => {
            setTexto(e.target.value);
            const hex = leerHex(e.target.value.trim());
            if (hex) onCambiar(hex);
          }}
          sx={{ width: 130 }}
          inputProps={{ 'aria-label': `Hex ${ETIQUETAS[rol].titulo}`, spellCheck: false }}
        />
        <Chip
          size="small"
          color={contraste.ok ? 'success' : 'error'}
          variant="outlined"
          label={`${contraste.ratio}:1 sobre ${ETIQUETA_FONDO[contraste.contra]}${contraste.ok ? '' : ` · mínimo ${contraste.minimo}`}`}
        />
        <Chip size="small" variant="outlined" label={`Guardado: ${ETIQUETA_ORIGEN[origenGuardado]}`} />
        {editable && propuesta && propuesta !== valor && (
          <Button size="small" sx={botonSecundarioSx} onClick={() => onCambiar(propuesta)}>
            Usar sugerido
          </Button>
        )}
        {editable && valor !== null && (
          <Button size="small" sx={botonSecundarioSx} onClick={() => onCambiar(null)}>
            Emphasys
          </Button>
        )}
      </Stack>
      <Popover open={Boolean(ancla)} anchorEl={ancla} onClose={() => setAncla(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Box sx={{ p: 1.5 }}>
          <HexColorPicker color={efectivo} onChange={(hex) => onCambiar(hex.toLowerCase())} />
        </Box>
      </Popover>
    </Stack>
  );
}

function FilaSuperficie({ valor, editable, onCambiar }: { valor: string | null; editable: boolean; onCambiar: (valor: string | null) => void }) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const efectivo = valor ?? SUPERFICIE_SECUNDARIA_EMPHASYS;
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ py: 1 }}>
    <Box sx={{ width: { sm: 170 }, flexShrink: 0 }}><Typography sx={{ fontWeight: 700, fontSize: 14 }}>{ETIQUETA_SUPERFICIE.titulo}</Typography><Typography variant="caption" color="text.secondary">{ETIQUETA_SUPERFICIE.uso}</Typography></Box>
    <Stack direction="row" spacing={1} alignItems="center"><Box component="button" type="button" aria-label="Elegir color Superficie secundaria" disabled={!editable} onClick={(e: React.MouseEvent<HTMLElement>) => setAncla(e.currentTarget)} sx={(theme) => ({ ...muestraSx(efectivo)(theme), cursor: editable ? 'pointer' : 'default', p: 0 })} /><TextField size="small" value={valor ?? ''} placeholder="Emphasys" disabled={!editable} onChange={(e) => { const hex = leerHex(e.target.value.trim()); if (hex) onCambiar(hex); }} sx={{ width: 130 }} inputProps={{ 'aria-label': 'Hex Superficie secundaria', spellCheck: false }} /><Chip size="small" variant="outlined" label={`Texto ${{ "#f4f0e8": "beige", "#ffffff": "blanco" }[textoSobreSuperficieSecundaria(efectivo)] ?? "oscuro"} (automático)`} />{editable && valor !== null && <Button size="small" sx={botonSecundarioSx} onClick={() => onCambiar(null)}>Emphasys</Button>}</Stack>
    <Popover open={Boolean(ancla)} anchorEl={ancla} onClose={() => setAncla(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}><Box sx={{ p: 1.5 }}><HexColorPicker color={efectivo} onChange={(hex) => onCambiar(hex.toLowerCase())} /></Box></Popover>
  </Stack>;
}

/**
 * Identidad visual de una empresa: análisis del logo, colores sugeridos,
 * edición manual, vista previa en ambos temas y guardado con confirmación.
 * Login y selección de empresa siguen con Emphasys; sin colores guardados, la
 * empresa se ve exactamente como Emphasys.
 */
export type IdentidadVisualEmpresaHandle = { guardarPendientes: () => Promise<boolean> };

const IdentidadVisualEmpresaSection = forwardRef<IdentidadVisualEmpresaHandle, { empresaId: number | null; tieneLogo: boolean; logoVersion: number }>(function IdentidadVisualEmpresaSection({ empresaId, tieneLogo, logoVersion }, ref) {
  const { session } = useSession();
  const editable = Boolean(session.user?.es_superadmin);
  const [identidad, setIdentidad] = useState<IdentidadVisualEmpresa | null>(null);
  const [borrador, setBorrador] = useState<Colores>(SIN_COLORES);
  const [modo, setModo] = useState<'emphasys' | 'personalizado'>('emphasys');
  const [modoPresentacionLogo, setModoPresentacionLogo] = useState<ModoPresentacionLogo>('automatico');
  const [cargando, setCargando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ conflictos: RolIdentidad[] } | null>(null);
  const logoPreview = useEmpresaLogo(empresaId, brandLogos.logo);

  const guardados = identidad?.colores ?? SIN_COLORES;
  const superficieGuardada = identidad?.superficie_secundaria ?? guardados.superficie_secundaria ?? null;
  const origen = identidad?.origen ?? ORIGEN_EMPHASYS;
  const propuesta = identidad?.propuesta ?? null;
  // En modo Emphasys los colores son los de Emphasys (null en BD): el preset visual del borrador no cuenta como cambio.
  const borradorEfectivo = modo === 'emphasys' ? SIN_COLORES : borrador;
  const cambiados = rolesCambiados(guardados, borradorEfectivo);
  const cambioSuperficie = superficieGuardada !== borradorEfectivo.superficie_secundaria;
  const cambioModo = (identidad?.modo ?? 'emphasys') !== modo;
  const cambioPresentacionLogo = (identidad?.modo_presentacion_logo ?? 'automatico') !== modoPresentacionLogo;
  const hayCambios = cambiados.length > 0 || cambioSuperficie || cambioModo || cambioPresentacionLogo;
  const manuales = manualesAfectados(guardados, origen, borradorEfectivo);
  const sinContraste = ROLES.filter((rol) => borrador[rol] !== null && !contrasteRol(rol, borrador[rol]).ok);
  const superficieEfectiva = borrador.superficie_secundaria ?? SUPERFICIE_SECUNDARIA_EMPHASYS;
  const superficiePrimerPlano = textoSobreSuperficieSecundaria(superficieEfectiva);
  const superficieSinContraste = razonContraste(superficieEfectiva, superficiePrimerPlano) < 4.5;

  const aplicar = useCallback((datos: IdentidadVisualEmpresa) => {
    setIdentidad(datos);
    setBorrador((datos.modo ?? 'emphasys') === 'emphasys'
      ? { primario: emphasysBrand.colors.blue.base, acento: emphasysBrand.colors.accent, sidebar: emphasysBrand.colors.graphite.chrome, superficie_secundaria: emphasysBrand.colors.graphite.raised }
      : { ...datos.colores, superficie_secundaria: datos.superficie_secundaria ?? datos.colores.superficie_secundaria ?? null });
    setModo(datos.modo ?? 'emphasys');
    setModoPresentacionLogo(datos.modo_presentacion_logo ?? 'automatico');
  }, []);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setCargando(true);
    setError(null);
    try {
      aplicar(await fetchIdentidadVisual(empresaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la identidad visual');
    } finally {
      setCargando(false);
    }
  }, [empresaId, aplicar]);

  useEffect(() => {
    setIdentidad(null);
    setBorrador(SIN_COLORES);
    setExito(null);
    void cargar();
  }, [cargar]);

  // Tras subir un logo, el análisis corre en segundo plano: se recarga la propuesta.
  useEffect(() => {
    if (!logoVersion || !empresaId) return undefined;
    const t = window.setTimeout(() => {
      fetchIdentidadVisual(empresaId)
        .then((datos) => setIdentidad((previa) => ({ ...datos, colores: previa?.colores ?? datos.colores })))
        .catch(() => {});
    }, 2500);
    return () => window.clearTimeout(t);
  }, [logoVersion, empresaId]);

  const analizar = async () => {
    if (!empresaId) return;
    setAnalizando(true);
    setError(null);
    setExito(null);
    try {
      const datos = await analizarLogoIdentidad(empresaId);
      // Solo cambia la propuesta; el borrador y los colores guardados se conservan.
      setIdentidad(datos);
      setExito(datos.propuesta?.estado === 'ok' ? 'Logotipo analizado. Revisa los colores sugeridos.' : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar el logotipo');
    } finally {
      setAnalizando(false);
    }
  };

  const guardar = async (confirmarSobrescritura: boolean): Promise<boolean> => {
    if (!empresaId) return false;
    setGuardando(true);
    setError(null);
    try {
      const r = await guardarIdentidadVisual(empresaId, { ...cuerpoCambios(guardados, borradorEfectivo), superficie_secundaria: borradorEfectivo.superficie_secundaria }, confirmarSobrescritura, modo, modoPresentacionLogo);
      if (!r.ok) {
        setConfirmar({ conflictos: r.conflictos });
        return false;
      }
      aplicar(r.identidad);
      setConfirmar(null);
      setExito('Identidad visual guardada.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la identidad visual');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  useImperativeHandle(ref, () => ({
    guardarPendientes: async () => {
      if (!editable || !hayCambios) return true;
      return guardar(false);
    },
  }), [editable, hayCambios, guardar]);

  const marcaPrevia = useMemo(() => getEmpresaBrand(borrador, undefined, modo), [borrador, modo]);
  const temasPrevios = useMemo(
    () => (['classic', 'experimental'] as ThemeId[]).map((id) => ({ id, tema: getThemeById(id, marcaPrevia) })),
    [marcaPrevia]
  );

  if (!empresaId) {
    return (
      <Section title="Identidad visual" inset>
        <Typography variant="body2" color="text.secondary">
          Guarda primero la empresa para configurar su identidad visual.
        </Typography>
      </Section>
    );
  }

  return (
    <Section title="Identidad visual" inset>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Colores de la empresa dentro del ERP. El login y la selección de empresa siempre usan Emphasys. Un color sin definir usa el de Emphasys.
        </Typography>

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        {exito && <Alert severity="success" onClose={() => setExito(null)}>{exito}</Alert>}
        {!editable && <Alert severity="info">Solo un superadministrador puede modificar la identidad visual.</Alert>}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Button variant={modo === 'emphasys' ? 'contained' : 'outlined'} sx={botonPrimarioSx} disabled={!editable} onClick={() => { setModo('emphasys'); setModoPresentacionLogo('automatico'); setBorrador({ primario: emphasysBrand.colors.blue.base, acento: emphasysBrand.colors.accent, sidebar: emphasysBrand.colors.graphite.chrome, superficie_secundaria: emphasysBrand.colors.graphite.raised }); }}>Emphasys original</Button>
          <Button variant="outlined" sx={botonSecundarioSx} onClick={analizar} disabled={!editable || !tieneLogo || analizando}>
            {analizando ? 'Analizando…' : 'Analizar logo'}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {!tieneLogo
              ? 'Sube un logotipo para obtener colores sugeridos.'
              : !propuesta
                ? 'Aún no hay colores sugeridos para este logotipo.'
                : propuesta.estado === 'ok'
                  ? `Sugerencia del logotipo${propuesta.confianza !== null ? ` (confianza ${Math.round(propuesta.confianza * 100)} %)` : ''}.`
                  : propuesta.estado === 'sin_colores_utiles'
                    ? 'El logotipo no tiene colores útiles; se recomienda conservar Emphasys.'
                    : 'No se pudo leer el logotipo; intenta subirlo de nuevo.'}
          </Typography>
          {propuesta?.estado === 'ok' && (
            <Stack direction="row" spacing={0.75} alignItems="center">
              {ROLES.map((rol) => (
                <Box key={rol} title={`${ETIQUETAS[rol].titulo}: ${propuesta[rol]}`} sx={muestraSx(propuesta[rol] ?? colorEfectivo(rol, null))} />
              ))}
              {editable && (
                <Button
                  size="small"
                  sx={botonSecundarioSx}
                  onClick={() => setBorrador({ primario: propuesta.primario, acento: propuesta.acento, sidebar: propuesta.sidebar })}
                >
                  Usar todos
                </Button>
              )}
            </Stack>
          )}
        </Stack>

        <FormControl size="small" sx={{ maxWidth: 310 }} disabled={!editable}>
          <InputLabel id="modo-presentacion-logo-label">Presentación del logotipo</InputLabel>
          <Select
            labelId="modo-presentacion-logo-label"
            value={modoPresentacionLogo}
            label="Presentación del logotipo"
            onChange={(event) => setModoPresentacionLogo(event.target.value as ModoPresentacionLogo)}
          >
            <MenuItem value="automatico">Automático</MenuItem>
            <MenuItem value="fondo_blanco">Original sobre blanco</MenuItem>
            <MenuItem value="logo_blanco">Logotipo blanco</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          {modoPresentacionLogo === 'automatico'
            ? 'El fondo protector se agrega solo cuando el contraste del logotipo lo requiere.'
            : modoPresentacionLogo === 'fondo_blanco'
              ? 'Conserva los colores originales sobre una superficie blanca discreta.'
              : 'Convierte visualmente el logotipo a blanco sobre el Sidebar; los fondos sólidos integrados pueden requerir un archivo con transparencia.'}
        </Typography>
        <Box sx={{ width: 'fit-content', maxWidth: '100%', p: modoPresentacionLogo === 'fondo_blanco' ? 1 : 0.75, borderRadius: 1.5, bgcolor: modoPresentacionLogo === 'logo_blanco' ? (getEmpresaBrand(borrador, undefined, modo).colors.graphite.chrome) : modoPresentacionLogo === 'fondo_blanco' ? '#fff' : 'transparent', border: '1px solid', borderColor: 'divider' }}>
          <img src={logoPreview} alt="Vista previa del logotipo" style={{ display: 'block', height: 42, maxWidth: 'min(260px, 70vw)', width: 'auto', objectFit: 'contain', filter: modoPresentacionLogo === 'logo_blanco' ? 'brightness(0) invert(1)' : 'none' }} />
        </Box>

        {cargando ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Cargando identidad visual…</Typography>
          </Stack>
        ) : (
          <Box>
            {ROLES.map((rol) => (
              <FilaColor
                key={rol}
                rol={rol}
                valor={borrador[rol]}
                origenGuardado={origen[rol]}
                propuesta={propuesta?.estado === 'ok' ? propuesta[rol] : null}
                editable={editable}
                onCambiar={(valor) => { setModo('personalizado'); setBorrador((previo) => ({ ...previo, [rol]: valor })); }}
              />
            ))}
            <FilaSuperficie valor={borrador.superficie_secundaria} editable={editable} onCambiar={(valor) => { setModo('personalizado'); setBorrador((previo) => ({ ...previo, superficie_secundaria: valor })); }} />
          </Box>
        )}

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>Vista previa</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
            {temasPrevios.map(({ id, tema }) => (
              <ThemeProvider key={id} theme={tema}>
                <VistaPreviaTema titulo={id === 'classic' ? 'Clásico' : 'Experimental'} />
              </ThemeProvider>
            ))}
          </Box>
        </Box>

        {sinContraste.length > 0 && (
          <Alert severity="warning">
            {sinContraste.map((rol) => ETIQUETAS[rol].titulo).join(', ')} no tiene contraste suficiente; ajústalo antes de guardar.
          </Alert>
        )}
        {superficieSinContraste && <Alert severity="warning">Superficie secundaria sin contraste suficiente con su color de texto calculado; elige otro color.</Alert>}

        {editable && (
          <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" rowGap={1}>
            <Button sx={botonSecundarioSx} onClick={() => { setModo('emphasys'); setBorrador(SIN_COLORES); }} disabled={modo === 'emphasys' || guardando}>
              Restablecer Emphasys
            </Button>
            <Button sx={botonSecundarioSx} onClick={() => { setModo(identidad?.modo ?? 'emphasys'); setModoPresentacionLogo(identidad?.modo_presentacion_logo ?? 'automatico'); setBorrador({ ...guardados, superficie_secundaria: superficieGuardada }); }} disabled={!hayCambios}>
              Descartar cambios
            </Button>
            <Button
              variant="contained"
              disableElevation
              sx={botonPrimarioSx}
              disabled={!hayCambios || sinContraste.length > 0 || superficieSinContraste || guardando}
              onClick={() => setConfirmar({ conflictos: manuales })}
            >
              Guardar identidad
            </Button>
          </Stack>
        )}
      </Stack>

      <Dialog open={Boolean(confirmar)} onClose={() => !guardando && setConfirmar(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Guardar identidad visual</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {cambiados.map((rol) => (
              <Typography key={rol} variant="body2">
                <strong>{ETIQUETAS[rol].titulo}:</strong> {describirColor(guardados[rol])} → {describirColor(borrador[rol])}
              </Typography>
            ))}
            {confirmar && confirmar.conflictos.length > 0 && (
              <Alert severity="warning">
                Se sobrescribirán colores personalizados manualmente: {confirmar.conflictos.map((rol) => ETIQUETAS[rol].titulo).join(', ')}.
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              Los usuarios de la empresa verán estos colores al entrar a la empresa.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button sx={botonSecundarioSx} onClick={() => setConfirmar(null)} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            sx={botonPrimarioSx}
            disabled={guardando}
            onClick={() => void guardar(Boolean(confirmar?.conflictos.length))}
          >
            {guardando ? 'Guardando…' : confirmar?.conflictos.length ? 'Sobrescribir y guardar' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Section>
  );
});

export default IdentidadVisualEmpresaSection;
