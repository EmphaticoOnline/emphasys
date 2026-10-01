import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import {
  AlternateEmailRounded,
  BadgeRounded,
  BusinessRounded,
  CategoryRounded,
  CloudDownloadRounded,
  CloudRounded,
  DirectionsCarRounded,
  ForumRounded,
  GridViewRounded,
  GroupRounded,
  HomeWorkRounded,
  LabelRounded,
  LocalShippingRounded,
  PaymentsRounded,
  PercentRounded,
  PictureAsPdfRounded,
  FormatListBulletedRounded,
  ReceiptLongRounded,
  ScheduleRounded,
  SchemaRounded,
  SettingsRounded,
  ShieldRounded,
  TagRounded,
  TuneRounded,
  VerifiedUserRounded,
  ViewListRounded,
  type SvgIconComponent,
} from '@mui/icons-material';
import {
  CONFIGURACION_GRUPOS,
  CONFIGURACION_OPTIONS,
  type ConfiguracionNavigationOption,
} from './configuracion/configuracionNavigation';
import { ConfigNavRow, ConfigPageFrame, ConfigPageHeader, ConfigSection } from '../components/configuracion/configVisual';
import { esRolAdmin } from '../session/rolScope';
import { useSession } from '../session/useSession';

const ICONOS_POR_TITULO: Record<string, SvgIconComponent> = {
  Empresas: BusinessRounded,
  'Horarios laborales': ScheduleRounded,
  Unidades: CategoryRounded,
  'Domicilios propios': HomeWorkRounded,
  Vehículos: DirectionsCarRounded,
  Remolques: LocalShippingRounded,
  Operadores: BadgeRounded,
  Usuarios: GroupRounded,
  Roles: ShieldRounded,
  'Catálogos configurables': CategoryRounded,
  'Campos dinámicos': TuneRounded,
  'Listas de precios': ViewListRounded,
  'Administración de precios': GridViewRounded,
  'Documentos y flujo': SchemaRounded,
  'Parámetros del sistema': SettingsRounded,
  'Opciones de parámetros': FormatListBulletedRounded,
  Conceptos: ReceiptLongRounded,
  'Impuestos por default': PercentRounded,
  'Formatos de impresión': PictureAsPdfRounded,
  'Series de documentos': TagRounded,
  'Correo SMTP': AlternateEmailRounded,
  'PAC CFDI': CloudRounded,
  'Descarga de CFDIs del SAT': CloudDownloadRounded,
  'Etiquetas de WhatsApp': LabelRounded,
  'Plantillas de WhatsApp': ForumRounded,
  'Etapas de producción': SchemaRounded,
  'Campos obligatorios': TuneRounded,
  'Métodos de pago': PaymentsRounded,
  'Políticas de autorización': VerifiedUserRounded,
};

const GRUPOS_ANCHO_COMPLETO = new Set(['catalogos', 'sistema']);

function opcionVisible(
  opcion: ConfiguracionNavigationOption,
  isSuperadmin: boolean,
  puedeHorarios: boolean,
) {
  return (!opcion.soloSuperadmin || isSuperadmin) && (opcion.titulo !== 'Horarios laborales' || puedeHorarios);
}

export default function ConfiguracionPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const isSuperadmin = Boolean(
    window.localStorage.getItem('emphasys.session') &&
      JSON.parse(window.localStorage.getItem('emphasys.session') || '{}')?.user?.es_superadmin,
  );
  const puedeHorarios = Boolean(session.user?.es_superadmin) || esRolAdmin(session.roles);

  const opcionesVisibles = CONFIGURACION_OPTIONS.filter((opcion) => opcionVisible(opcion, isSuperadmin, puedeHorarios));
  const porPath = new Map(opcionesVisibles.map((opcion) => [opcion.path, opcion]));
  const asignadas = new Set<string>();

  const grupos = CONFIGURACION_GRUPOS.map((grupo) => {
    const opciones = grupo.paths.flatMap((path) => {
      const opcion = porPath.get(path);
      if (!opcion) return [];
      asignadas.add(path);
      return [opcion];
    });
    return { ...grupo, opciones };
  }).filter((grupo) => grupo.opciones.length > 0);

  const sueltas = opcionesVisibles.filter((opcion) => !asignadas.has(opcion.path));
  if (sueltas.length) {
    grupos.push({ id: 'otros', titulo: 'Otras opciones', paths: sueltas.map((opcion) => opcion.path), opciones: sueltas });
  }

  const columnas = grupos.filter((grupo) => !GRUPOS_ANCHO_COMPLETO.has(grupo.id));
  const anchoCompleto = grupos.filter((grupo) => GRUPOS_ANCHO_COMPLETO.has(grupo.id));

  return (
    <ConfigPageFrame>
      <ConfigPageHeader
        title="Configuración del sistema"
        description="Administra los elementos clave del ERP. Selecciona una opción para continuar."
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 1.25,
          alignItems: 'start',
        }}
      >
        {columnas.map((grupo) => (
          <ConfigSection key={grupo.id} title={grupo.titulo}>
            {grupo.opciones.map((opcion) => (
              <ConfigNavRow
                key={opcion.path}
                icon={ICONOS_POR_TITULO[opcion.titulo] ?? SchemaRounded}
                title={opcion.titulo}
                description={opcion.descripcion}
                onClick={() => navigate(opcion.path)}
              />
            ))}
          </ConfigSection>
        ))}
      </Box>

      {anchoCompleto.map((grupo) => (
        <ConfigSection key={grupo.id} title={grupo.titulo} columns={2}>
          {grupo.opciones.map((opcion) => (
            <ConfigNavRow
              key={opcion.path}
              icon={ICONOS_POR_TITULO[opcion.titulo] ?? SchemaRounded}
              title={opcion.titulo}
              description={opcion.descripcion}
              onClick={() => navigate(opcion.path)}
            />
          ))}
        </ConfigSection>
      ))}
    </ConfigPageFrame>
  );
}
