import * as React from 'react';
import {
  Autocomplete,
  Box,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type {
  ConfiguracionCuentaContable,
  TipoEntidad,
  UsoContable,
} from '../../types/configuracionCuentasContables';
import {
  TIPOS_ENTIDAD,
  TIPO_ENTIDAD_LABELS,
  USOS_CONTABLES,
  USO_CONTABLE_LABELS,
  USO_CONTABLE_TIPOS_ENTIDAD_PERMITIDOS,
} from '../../types/configuracionCuentasContables';
import {
  crearConfiguracionCuentaContable,
  actualizarConfiguracionCuentaContable,
  fetchValoresProducto,
} from '../../services/configuracionCuentasContablesService';
import { fetchCuentasAfectables } from '../../services/contabilidadService';
import { fetchContactosPaginados } from '../../services/contactosService';
import { fetchProductosPaginados } from '../../services/productosService';
import { fetchAlmacenes } from '../../services/inventarioService';
import { fetchCuentas as fetchFinanzasCuentas } from '../../services/finanzasService';
import { fetchConceptos } from '../../services/conceptosService';
import { fetchImpuestosCatalogo } from '../../services/impuestosService';
import type { CuentaAfectable } from '../../types/polizas';
import type { Almacen } from '../../types/inventario';
import type { FinanzasCuenta } from '../../types/finanzas';
import type { Concepto } from '../../types/finanzas';
import type { ImpuestoCatalogo } from '../../types/impuestos';
import FloatingFormActions from '../../components/FloatingFormActions';

type OpcionContacto = { id: number; nombre: string };
type OpcionProducto = { id: number; clave: string; descripcion: string };

const ATRIBUTOS_PRODUCTO: Partial<Record<TipoEntidad, 'familia' | 'linea' | 'clasificacion' | 'tipo_producto'>> = {
  producto_familia: 'familia',
  producto_linea: 'linea',
  producto_clasificacion: 'clasificacion',
  producto_tipo: 'tipo_producto',
};

function labelCuenta(o: CuentaAfectable) {
  return `${o.cuenta} — ${o.descripcion}`;
}

// Etiqueta del selector dinámico de entidad: para contacto depende de si el
// uso contable es cliente_cxc o proveedor_cxp (Cliente / Proveedor); el resto
// usa la etiqueta genérica del tipo de entidad.
function labelEntidadDinamica(tipo: TipoEntidad, usoContable: UsoContable | ''): string {
  if (tipo === 'contacto') {
    if (usoContable === 'cliente_cxc') return 'Cliente';
    if (usoContable === 'proveedor_cxp') return 'Proveedor';
    return 'Contacto';
  }
  if (tipo === 'finanzas_cuenta') return 'Banco / Caja';
  return TIPO_ENTIDAD_LABELS[tipo];
}

interface Props {
  configuracion: ConfiguracionCuentaContable | null;
  onCancel: () => void;
  onSaved: () => void;
}

export default function ConfiguracionCuentaContableFormView({ configuracion, onCancel, onSaved }: Props) {
  const isEdit = Boolean(configuracion);

  const [usoContable, setUsoContable] = React.useState<UsoContable | ''>(configuracion?.uso_contable ?? '');
  const [tipoEntidad, setTipoEntidad] = React.useState<TipoEntidad>(configuracion?.entidad_tipo ?? 'global');
  const [activa, setActiva] = React.useState<boolean>(configuracion?.activa ?? true);
  const [notas, setNotas] = React.useState<string>(configuracion?.notas ?? '');
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [cuentaSel, setCuentaSel] = React.useState<CuentaAfectable | null>(
    configuracion ? { id: configuracion.cuenta_id, cuenta: configuracion.cuenta, descripcion: configuracion.descripcion_cuenta } : null
  );
  const [cuentaInput, setCuentaInput] = React.useState('');
  const [cuentaOptions, setCuentaOptions] = React.useState<CuentaAfectable[]>(cuentaSel ? [cuentaSel] : []);
  const [cuentaLoading, setCuentaLoading] = React.useState(false);

  const [contactoSel, setContactoSel] = React.useState<OpcionContacto | null>(
    configuracion?.contacto_id ? { id: configuracion.contacto_id, nombre: configuracion.entidad_nombre } : null
  );
  const [contactoInput, setContactoInput] = React.useState('');
  const [contactoOptions, setContactoOptions] = React.useState<OpcionContacto[]>(contactoSel ? [contactoSel] : []);
  const [contactoLoading, setContactoLoading] = React.useState(false);

  const [productoSel, setProductoSel] = React.useState<OpcionProducto | null>(
    configuracion?.producto_id
      ? { id: configuracion.producto_id, clave: '', descripcion: configuracion.entidad_nombre }
      : null
  );
  const [productoInput, setProductoInput] = React.useState('');
  const [productoOptions, setProductoOptions] = React.useState<OpcionProducto[]>(productoSel ? [productoSel] : []);
  const [productoLoading, setProductoLoading] = React.useState(false);

  const [almacenSel, setAlmacenSel] = React.useState<Almacen | null>(
    configuracion?.almacen_id ? { id: configuracion.almacen_id, nombre: configuracion.entidad_nombre } : null
  );
  const [almacenOptions, setAlmacenOptions] = React.useState<Almacen[]>([]);

  const [finanzasCuentaSel, setFinanzasCuentaSel] = React.useState<FinanzasCuenta | null>(
    configuracion?.finanzas_cuenta_id
      ? ({ id: configuracion.finanzas_cuenta_id, identificador: configuracion.entidad_nombre } as FinanzasCuenta)
      : null
  );
  const [finanzasCuentaOptions, setFinanzasCuentaOptions] = React.useState<FinanzasCuenta[]>([]);

  const [conceptoSel, setConceptoSel] = React.useState<Concepto | null>(
    configuracion?.concepto_id
      ? ({ id: configuracion.concepto_id, nombre_concepto: configuracion.entidad_nombre } as Concepto)
      : null
  );
  const [conceptoOptions, setConceptoOptions] = React.useState<Concepto[]>([]);

  const [impuestoSel, setImpuestoSel] = React.useState<ImpuestoCatalogo | null>(
    configuracion?.impuesto_id
      ? ({ id: configuracion.impuesto_id, nombre: configuracion.entidad_nombre } as ImpuestoCatalogo)
      : null
  );
  const [impuestoOptions, setImpuestoOptions] = React.useState<ImpuestoCatalogo[]>([]);

  const [valorProducto, setValorProducto] = React.useState<string | null>(
    configuracion?.producto_familia ??
      configuracion?.producto_linea ??
      configuracion?.producto_clasificacion ??
      configuracion?.producto_tipo ??
      null
  );
  const [valoresProductoOptions, setValoresProductoOptions] = React.useState<string[]>([]);
  const [valoresProductoLoading, setValoresProductoLoading] = React.useState(false);

  // Catálogos chicos: se cargan una sola vez, sin búsqueda incremental.
  React.useEffect(() => {
    fetchAlmacenes()
      .then(setAlmacenOptions)
      .catch(() => setAlmacenOptions([]));
    fetchFinanzasCuentas()
      .then(setFinanzasCuentaOptions)
      .catch(() => setFinanzasCuentaOptions([]));
    fetchConceptos()
      .then(setConceptoOptions)
      .catch(() => setConceptoOptions([]));
    fetchImpuestosCatalogo()
      .then(setImpuestoOptions)
      .catch(() => setImpuestoOptions([]));
  }, []);

  // Atributos de producto (familia/línea/clasificación/tipo): catálogo dinámico
  // según el tipo de entidad elegido, para no permitir captura libre.
  React.useEffect(() => {
    const campo = ATRIBUTOS_PRODUCTO[tipoEntidad];
    if (!campo) {
      setValoresProductoOptions([]);
      return;
    }
    setValoresProductoLoading(true);
    fetchValoresProducto(campo)
      .then(setValoresProductoOptions)
      .catch(() => setValoresProductoOptions([]))
      .finally(() => setValoresProductoLoading(false));
  }, [tipoEntidad]);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuenta contable: búsqueda incremental contra contabilidad.cuentas afectables.
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCuentaLoading(true);
      fetchCuentasAfectables(cuentaInput)
        .then((data) => setCuentaOptions(cuentaSel ? [cuentaSel, ...data.filter((d) => d.id !== cuentaSel.id)] : data))
        .catch(() => setCuentaOptions([]))
        .finally(() => setCuentaLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaInput]);

  const contactoDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // El uso contable acota qué tipo de contacto es válido: cliente_cxc solo
  // admite contactos Cliente (el backend agrega automáticamente "Varios"),
  // proveedor_cxp solo Proveedor. Para cualquier otro uso donde se permita
  // contacto (no hay otros por ahora) no se manda filtro.
  const tiposContactoPermitidos = React.useMemo<string[] | undefined>(() => {
    if (usoContable === 'cliente_cxc') return ['Cliente'];
    if (usoContable === 'proveedor_cxp') return ['Proveedor'];
    return undefined;
  }, [usoContable]);

  React.useEffect(() => {
    if (tipoEntidad !== 'contacto') return;
    if (contactoDebounceRef.current) clearTimeout(contactoDebounceRef.current);
    contactoDebounceRef.current = setTimeout(() => {
      setContactoLoading(true);
      fetchContactosPaginados({
        page: 1,
        limit: 20,
        ...(contactoInput ? { search: contactoInput } : {}),
        ...(tiposContactoPermitidos ? { tipos: tiposContactoPermitidos } : {}),
      })
        .then((resp) =>
          setContactoOptions(
            contactoSel ? [contactoSel, ...resp.data.filter((d) => d.id !== contactoSel.id)] : resp.data
          )
        )
        .catch(() => setContactoOptions([]))
        .finally(() => setContactoLoading(false));
    }, 300);
    return () => {
      if (contactoDebounceRef.current) clearTimeout(contactoDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactoInput, tipoEntidad, tiposContactoPermitidos]);

  const productoDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (tipoEntidad !== 'producto') return;
    if (productoDebounceRef.current) clearTimeout(productoDebounceRef.current);
    productoDebounceRef.current = setTimeout(() => {
      setProductoLoading(true);
      fetchProductosPaginados({ page: 1, limit: 20, ...(productoInput ? { search: productoInput } : {}) })
        .then((resp) =>
          setProductoOptions(
            productoSel ? [productoSel, ...resp.data.filter((d) => d.id !== productoSel.id)] : resp.data
          )
        )
        .catch(() => setProductoOptions([]))
        .finally(() => setProductoLoading(false));
    }, 300);
    return () => {
      if (productoDebounceRef.current) clearTimeout(productoDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoInput, tipoEntidad]);

  const tiposEntidadPermitidos = React.useMemo<TipoEntidad[]>(
    () => (usoContable ? USO_CONTABLE_TIPOS_ENTIDAD_PERMITIDOS[usoContable] : Array.from(TIPOS_ENTIDAD)),
    [usoContable]
  );

  const handleChangeTipoEntidad = (nuevo: TipoEntidad) => {
    setTipoEntidad(nuevo);
    setContactoSel(null);
    setProductoSel(null);
    setAlmacenSel(null);
    setFinanzasCuentaSel(null);
    setConceptoSel(null);
    setImpuestoSel(null);
    setValorProducto(null);
  };

  // Cambiar el uso contable puede invalidar tanto el tipo de entidad elegido
  // (ej. banco_caja no admite Global) como la entidad puntual seleccionada
  // (ej. un contacto Proveedor deja de ser válido al pasar a cliente_cxc,
  // aunque el tipo de entidad "Contacto" siga permitido).
  const handleChangeUsoContable = (nuevo: UsoContable) => {
    setUsoContable(nuevo);
    const permitidos = USO_CONTABLE_TIPOS_ENTIDAD_PERMITIDOS[nuevo];
    if (!permitidos.includes(tipoEntidad)) {
      handleChangeTipoEntidad(permitidos[0] ?? 'global');
    } else if (tipoEntidad === 'contacto') {
      setContactoSel(null);
      setContactoOptions([]);
    }
  };

  const handleSave = async () => {
    if (!cuentaSel) {
      setFormError('La cuenta contable es obligatoria');
      return;
    }
    if (!usoContable) {
      setFormError('El uso contable es obligatorio');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      const payload = {
        cuenta_id: cuentaSel.id,
        uso_contable: usoContable,
        contacto_id: tipoEntidad === 'contacto' ? contactoSel?.id ?? null : null,
        producto_id: tipoEntidad === 'producto' ? productoSel?.id ?? null : null,
        almacen_id: tipoEntidad === 'almacen' ? almacenSel?.id ?? null : null,
        finanzas_cuenta_id: tipoEntidad === 'finanzas_cuenta' ? finanzasCuentaSel?.id ?? null : null,
        concepto_id: tipoEntidad === 'concepto' ? conceptoSel?.id ?? null : null,
        impuesto_id: tipoEntidad === 'impuesto' ? impuestoSel?.id ?? null : null,
        producto_familia: tipoEntidad === 'producto_familia' ? valorProducto : null,
        producto_linea: tipoEntidad === 'producto_linea' ? valorProducto : null,
        producto_clasificacion: tipoEntidad === 'producto_clasificacion' ? valorProducto : null,
        producto_tipo: tipoEntidad === 'producto_tipo' ? valorProducto : null,
        activa,
        notas: notas.trim() || null,
      };

      if (tipoEntidad !== 'global' && tipoEntidad !== 'producto_familia' && tipoEntidad !== 'producto_linea' &&
          tipoEntidad !== 'producto_clasificacion' && tipoEntidad !== 'producto_tipo') {
        const requiereSeleccion =
          (tipoEntidad === 'contacto' && !contactoSel) ||
          (tipoEntidad === 'producto' && !productoSel) ||
          (tipoEntidad === 'almacen' && !almacenSel) ||
          (tipoEntidad === 'finanzas_cuenta' && !finanzasCuentaSel) ||
          (tipoEntidad === 'concepto' && !conceptoSel) ||
          (tipoEntidad === 'impuesto' && !impuestoSel);
        if (requiereSeleccion) {
          setFormError(`Selecciona ${labelEntidadDinamica(tipoEntidad, usoContable).toLowerCase()}`);
          setSaving(false);
          return;
        }
      }
      if (
        ['producto_familia', 'producto_linea', 'producto_clasificacion', 'producto_tipo'].includes(tipoEntidad) &&
        !valorProducto
      ) {
        setFormError(`Selecciona ${TIPO_ENTIDAD_LABELS[tipoEntidad].toLowerCase()}`);
        setSaving(false);
        return;
      }

      if (isEdit && configuracion) {
        await actualizarConfiguracionCuentaContable(configuracion.id, payload);
      } else {
        await crearConfiguracionCuentaContable(payload);
      }
      onSaved();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar la configuración contable');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2.5 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        {isEdit ? 'Editar configuración contable' : 'Nueva configuración contable'}
      </Typography>

      <Paper sx={{ p: 3, pb: '96px', maxWidth: 560 }}>
        <Stack spacing={2}>
          <TextField
            select
            label="Uso contable"
            required
            value={usoContable}
            onChange={(e) => handleChangeUsoContable(e.target.value as UsoContable)}
            size="small"
            fullWidth
          >
            {USOS_CONTABLES.map((uso) => (
              <MenuItem key={uso} value={uso}>
                {USO_CONTABLE_LABELS[uso]}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Tipo de entidad"
            required
            value={tipoEntidad}
            onChange={(e) => handleChangeTipoEntidad(e.target.value as TipoEntidad)}
            size="small"
            fullWidth
            disabled={!usoContable}
            helperText={!usoContable ? 'Selecciona primero el uso contable' : undefined}
          >
            {tiposEntidadPermitidos.map((tipo) => (
              <MenuItem key={tipo} value={tipo}>
                {labelEntidadDinamica(tipo, usoContable)}
              </MenuItem>
            ))}
          </TextField>

          {tipoEntidad === 'contacto' && (
            <Autocomplete
              size="small"
              options={contactoOptions}
              value={contactoSel}
              loading={contactoLoading}
              getOptionLabel={(o) => o.nombre}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_e, value) => setContactoSel(value)}
              onInputChange={(_e, value) => setContactoInput(value)}
              renderInput={(params) => (
                <TextField
                  {...(params as any)}
                  label={labelEntidadDinamica('contacto', usoContable)}
                  placeholder={`Buscar ${labelEntidadDinamica('contacto', usoContable).toLowerCase()}...`}
                />
              )}
            />
          )}

          {tipoEntidad === 'producto' && (
            <Autocomplete
              size="small"
              options={productoOptions}
              value={productoSel}
              loading={productoLoading}
              getOptionLabel={(o) => (o.clave ? `${o.clave} — ${o.descripcion}` : o.descripcion)}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_e, value) => setProductoSel(value)}
              onInputChange={(_e, value) => setProductoInput(value)}
              renderInput={(params) => <TextField {...(params as any)} label="Producto" placeholder="Buscar producto..." />}
            />
          )}

          {tipoEntidad === 'almacen' && (
            <Autocomplete
              size="small"
              options={almacenOptions}
              value={almacenSel}
              getOptionLabel={(o) => o.nombre}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_e, value) => setAlmacenSel(value)}
              renderInput={(params) => <TextField {...(params as any)} label="Almacén" />}
            />
          )}

          {tipoEntidad === 'finanzas_cuenta' && (
            <Autocomplete
              size="small"
              options={finanzasCuentaOptions}
              value={finanzasCuentaSel}
              getOptionLabel={(o) => o.identificador}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_e, value) => setFinanzasCuentaSel(value)}
              renderInput={(params) => <TextField {...(params as any)} label={labelEntidadDinamica('finanzas_cuenta', usoContable)} />}
            />
          )}

          {tipoEntidad === 'concepto' && (
            <Autocomplete
              size="small"
              options={conceptoOptions}
              value={conceptoSel}
              getOptionLabel={(o) => o.nombre_concepto}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_e, value) => setConceptoSel(value)}
              renderInput={(params) => <TextField {...(params as any)} label="Concepto" />}
            />
          )}

          {tipoEntidad === 'impuesto' && (
            <Autocomplete
              size="small"
              options={impuestoOptions}
              value={impuestoSel}
              getOptionLabel={(o) => o.nombre}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_e, value) => setImpuestoSel(value)}
              renderInput={(params) => <TextField {...(params as any)} label="Impuesto" />}
            />
          )}

          {(['producto_familia', 'producto_linea', 'producto_clasificacion', 'producto_tipo'] as TipoEntidad[]).includes(
            tipoEntidad
          ) && (
            <Autocomplete
              size="small"
              options={valoresProductoOptions}
              value={valorProducto}
              loading={valoresProductoLoading}
              onChange={(_e, value) => setValorProducto(value)}
              renderInput={(params) => <TextField {...(params as any)} label={TIPO_ENTIDAD_LABELS[tipoEntidad]} />}
            />
          )}

          <Autocomplete
            size="small"
            options={cuentaOptions}
            value={cuentaSel}
            loading={cuentaLoading}
            getOptionLabel={labelCuenta}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(_e, value) => setCuentaSel(value)}
            onInputChange={(_e, value) => setCuentaInput(value)}
            renderInput={(params) => (
              <TextField {...(params as any)} label="Cuenta contable" required placeholder="Buscar cuenta..." />
            )}
          />

          <FormControlLabel
            control={<Switch checked={activa} onChange={(e) => setActiva(e.target.checked)} />}
            label={activa ? 'Activa' : 'Inactiva'}
          />

          <TextField
            label="Notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={2}
          />

          {formError && (
            <Typography color="error" variant="body2">
              {formError}
            </Typography>
          )}
        </Stack>
      </Paper>

      <FloatingFormActions onBack={onCancel} backDisabled={saving} onSave={handleSave} saving={saving} saveDisabled={saving} />
    </Box>
  );
}
