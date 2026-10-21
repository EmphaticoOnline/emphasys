import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LeadsPage.tsx', import.meta.url), 'utf8');

test('marca la conversación después de cargar mensajes, sin retraso', () => {
  const loadMessagesStart = source.indexOf('const loadMessages = React.useCallback');
  const loadMessagesEnd = source.indexOf('const focusReplyInput', loadMessagesStart);
  const loadMessages = source.slice(loadMessagesStart, loadMessagesEnd);

  assert.match(loadMessages, /if \(isInitialLoad\) \{\s*await markConversationAsRead\(conversationId\);/s);
  assert.doesNotMatch(loadMessages, /setTimeout\([\s\S]*?marcar|setTimeout\([\s\S]*?markConversationAsRead/);
});

test('solo actualiza el contador tras confirmación y conserva la guarda de conversación activa', () => {
  const start = source.indexOf('const markConversationAsRead');
  const end = source.indexOf('const loadMessages = React.useCallback', start);
  const marker = source.slice(start, end);

  assert.match(marker, /selectedLeadIdRef\.current !== conversationId/);
  assert.match(marker, /if \(!result\.marked \|\| selectedLeadIdRef\.current !== conversationId\) return;/);
  assert.match(marker, /setLeads\(\(prev\) => prev\.map/);
});
