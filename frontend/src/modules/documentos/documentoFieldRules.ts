import type { TipoDocumento } from '../../types/documentos.types';
import { DOCUMENTO_SECTIONS, type DocumentoField, type DocumentoSectionKey, type DocumentoFieldRule } from './documentoTypes';
import { DOCUMENTO_TYPE_CONFIG } from './documentoTypeConfig';

const getConfig = (tipo: TipoDocumento) => DOCUMENTO_TYPE_CONFIG[tipo];

export const getFieldRule = (tipo: TipoDocumento, field: DocumentoField): DocumentoFieldRule | undefined =>
  getConfig(tipo)?.campos?.[field];

export const isFieldVisible = (tipo: TipoDocumento, field: DocumentoField): boolean => {
  const config = getConfig(tipo);
  if (!config) return true;
  const rule = getFieldRule(tipo, field);
  if (rule?.visible === false) return false;
  if (rule?.visible === true) return true;

  const section = rule?.section;
  if (section) {
    const sectionRule = config.secciones?.[section];
    if (sectionRule?.visible === false) return false;
  }
  return true;
};

export const isFieldRequired = (tipo: TipoDocumento, field: DocumentoField): boolean => {
  const visible = isFieldVisible(tipo, field);
  if (!visible) return false;
  const rule = getFieldRule(tipo, field);
  return Boolean(rule?.required);
};

export const getSectionVisibility = (tipo: TipoDocumento, section: DocumentoSectionKey): boolean => {
  const config = getConfig(tipo);
  if (!config) return true;
  const rule = config.secciones?.[section];
  return rule?.visible ?? true;
};

export const getVisibleSections = (tipo: TipoDocumento): DocumentoSectionKey[] =>
  DOCUMENTO_SECTIONS.filter((section) => getSectionVisibility(tipo, section));

export const shouldRenderFiscalSection = (tipo: TipoDocumento): boolean => {
  const config = getConfig(tipo);
  if (!config) return false;
  if (config.secciones?.fiscal?.visible === true) return true;
  return Boolean(config.fiscales?.requiereDatosFiscales);
};
