import assert from 'node:assert/strict';
import test from 'node:test';
import { dayjsFromIsoDate, toApiDateTime, formatDateTimeDisplay, formatIsoDateTimeLocalDisplay, maskDisplayInput, parseDisplayDateTime, formatDateDisplay, isValidDisplayDate, isValidIsoDate, parseDisplayDate, toApiDate, validateDateRange } from './dateUtils.ts';

test('formatea y convierte fechas sin invertir día y mes', () => {
  assert.equal(formatDateDisplay('2026-04-03'), '03/04/2026');
  assert.equal(parseDisplayDate('03/04/2026'), '2026-04-03');
  assert.equal(toApiDate('2026-04-03'), '2026-04-03');
});

test('valida fechas ambiguas e inválidas', () => {
  assert.equal(isValidDisplayDate('04/03/2026'), true);
  assert.equal(isValidDisplayDate('31/02/2026'), false);
  assert.equal(isValidIsoDate('2024-02-29'), true);
  assert.equal(isValidIsoDate('2025-02-29'), false);
  assert.equal(parseDisplayDate('13/13/2026'), null);
});

test('valida rangos ISO y no depende de la zona horaria del proceso', () => {
  assert.equal(validateDateRange('2026-04-03', '2026-04-04'), null);
  assert.equal(validateDateRange('2026-04-05', '2026-04-04'), 'La fecha inicial no puede ser posterior a la fecha final.');
  assert.equal(formatDateDisplay('2026-01-01'), '01/01/2026');
});

test('máscara de captura DD/MM/YYYY (Compass) solo admite dígitos y añade separadores', () => {
  assert.equal(maskDisplayInput('2'), '2');
  assert.equal(maskDisplayInput('2103'), '21/03');
  assert.equal(maskDisplayInput('21032026'), '21/03/2026');
  assert.equal(maskDisplayInput('21/03/2026999'), '21/03/2026');
  assert.equal(maskDisplayInput('abc'), '');
  assert.equal(maskDisplayInput('210320261430', true), '21/03/2026 14:30');
  assert.equal(maskDisplayInput('2103202614', true), '21/03/2026 14');
});

test('captura DD/MM/YYYY se convierte a ISO y rechaza fechas imposibles', () => {
  assert.equal(parseDisplayDate('05/01/2026'), '2026-01-05');
  assert.equal(parseDisplayDate('31/02/2026'), null);
  assert.equal(parseDisplayDate('01/05/2026'), '2026-05-01');
  assert.equal(parseDisplayDateTime('05/01/2026 09:30'), '2026-01-05T09:30');
  assert.equal(parseDisplayDateTime('05/01/2026 24:00'), null);
  assert.equal(parseDisplayDateTime('05/01/2026 09:60'), null);
});

test('fecha-hora local ISO se muestra sin desplazamiento de zona horaria', () => {
  assert.equal(formatIsoDateTimeLocalDisplay('2026-12-31T23:59'), '31/12/2026 23:59');
  assert.equal(formatIsoDateTimeLocalDisplay(''), '');
  assert.equal(formatDateDisplay('2026-01-05'), '05/01/2026');
});

test('ida y vuelta display → ISO → display es estable (selector de semana)', () => {
  for (const iso of ['2026-01-01', '2026-02-28', '2024-02-29', '2026-12-31']) {
    assert.equal(parseDisplayDate(formatDateDisplay(iso)), iso);
  }
});

test('05/04/2026 es 5 de abril (día primero), nunca 4 de mayo', () => {
  assert.equal(parseDisplayDate('05/04/2026'), '2026-04-05');
  assert.equal(formatDateDisplay('2026-04-05'), '05/04/2026');
  assert.equal(parseDisplayDateTime('05/04/2026 18:45'), '2026-04-05T18:45');
  assert.equal(maskDisplayInput('05042026'), '05/04/2026');
  assert.equal(new Date(`${parseDisplayDate('05/04/2026')}T12:00:00Z`).getUTCMonth(), 3);
  assert.equal(parseDisplayDate('04/05/2026'), '2026-05-04');
});

test('fechas inválidas o ambiguas se rechazan sin adivinar', () => {
  for (const malo of ['32/01/2026', '00/01/2026', '15/13/2026', '29/02/2025', '31/04/2026', '5/4/2026', '05-04-2026', '2026-04-05', '05/04/26', '', ' ']) {
    assert.equal(parseDisplayDate(malo), null, malo);
    assert.equal(isValidDisplayDate(malo), false, malo);
  }
  assert.equal(parseDisplayDate('29/02/2024'), '2024-02-29');
  assert.equal(isValidIsoDate('2026-02-30'), false);
  assert.equal(isValidIsoDate('2026-4-5'), false);
  assert.equal(toApiDate('05/04/2026'), '2026-04-05'); // dayjs() solo habría leído mes/día
  assert.equal(formatDateDisplay('05/04/2026'), '05/04/2026');
  assert.equal(toApiDate('5/4/2026'), null);
  assert.equal(validateDateRange('2026-04-05', '2026-04-05'), null);
  assert.equal(validateDateRange('2026-13-01', null), 'La fecha inicial no es válida.');
});

test('fecha civil estable bajo distintas zonas horarias (sin corrimiento de día)', () => {
  const original = process.env.TZ;
  try {
    for (const tz of ['UTC', 'America/Mexico_City', 'America/Tijuana', 'Pacific/Auckland', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      process.env.TZ = tz;
      for (const iso of ['2026-01-01', '2026-04-05', '2026-12-31', '2024-02-29']) {
        assert.equal(formatDateDisplay(iso), `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`, `${tz} ${iso}`);
        assert.equal(toApiDate(dayjsFromIsoDate(iso)), iso, `${tz} ${iso}`);
      }
      assert.equal(toApiDateTime('2026-04-05T23:59'), '2026-04-05T23:59', tz);
      assert.equal(formatIsoDateTimeLocalDisplay('2026-04-05T23:59'), '05/04/2026 23:59', tz);
      assert.equal(formatDateTimeDisplay('2026-04-05T00:05'), '05/04/2026 00:05', tz);
    }
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});
