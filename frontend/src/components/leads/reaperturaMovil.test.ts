import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { esReaperturaMismaConversacion } from './reaperturaMovil.ts';

/**
 * Regresión móvil: tras "Regresar a la bandeja", volver a tocar la misma
 * conversación debe reabrir el chat, recargar los mensajes y pedir la lectura,
 * aunque selectedLeadId no cambie.
 */
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const mobileView = readText('./LeadsMobileView.tsx');
const leadsPage = readText('../../pages/LeadsPage.tsx');

test('detecta la reapertura de la conversación ya seleccionada', () => {
  assert.equal(esReaperturaMismaConversacion('500', '500'), true);
});

test('abrir otra conversación no es reapertura (la recarga la hace el efecto de selección)', () => {
  assert.equal(esReaperturaMismaConversacion('501', '500'), false);
});

test('sin selección previa o sin id no es reapertura', () => {
  assert.equal(esReaperturaMismaConversacion('500', ''), false);
  assert.equal(esReaperturaMismaConversacion('500', null), false);
  assert.equal(esReaperturaMismaConversacion('500', undefined), false);
  assert.equal(esReaperturaMismaConversacion('', ''), false);
});

test('la bandeja móvil reabre el chat aunque la selección no cambie', () => {
  const handler = mobileView.match(/const handleOpenLead = \(id: string\) => \{([\s\S]*?)\n  \};/);
  assert.ok(handler, 'falta handleOpenLead en LeadsMobileView');
  assert.match(handler[1], /setManuallyBackToInbox\(false\)/);
  assert.match(handler[1], /onSelectLead\(id\)/);
  assert.match(mobileView, /onClick=\{\(\) => handleOpenLead\(lead\.id\)\}/);
  assert.doesNotMatch(mobileView, /onClick=\{\(\) => onSelectLead\(lead\.id\)\}/);
});

test('la reapertura móvil fuerza la carga inicial de mensajes (que registra la lectura)', () => {
  const handler = leadsPage.match(/const handleOpenLeadMobile = React\.useCallback\(\(id: string\) => \{([\s\S]*?)\n  \}, \[/);
  assert.ok(handler, 'falta handleOpenLeadMobile en LeadsPage');
  assert.match(handler[1], /esReaperturaMismaConversacion\(id, selectedLeadIdRef\.current\)/);
  // Sin opciones = carga inicial; es la única que llama a markConversationAsRead.
  assert.match(handler[1], /loadMessages\(id\);/);
  assert.match(handler[1], /handleSelectLeadMobile\(id\)/);
  assert.match(leadsPage, /if \(isInitialLoad\) \{\s*await markConversationAsRead\(conversationId\);/);
});

test('solo la vista móvil usa la reapertura; escritorio conserva su handler', () => {
  const mobileBlock = leadsPage.slice(leadsPage.indexOf('<LeadsMobileView'), leadsPage.indexOf('<LeadsDesktopView'));
  const desktopBlock = leadsPage.slice(leadsPage.indexOf('<LeadsDesktopView'));
  assert.match(mobileBlock, /onSelectLead=\{handleOpenLeadMobile\}/);
  assert.match(desktopBlock, /onSelectLead=\{handleSelectLeadMobile\}/);
});
