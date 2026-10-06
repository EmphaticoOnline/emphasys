# Escenario controlado de conciliación asistida

Preparado para Producción con los IDs verificados:

- empresa: `ESCUELA KEMPER URGATE` (`empresa_id = 8`)
- cuenta: `Cuenta de Prueba` (`cuenta_id = 10`, MXN)

Archivos:

- `estado-cuenta-conciliacion-test.csv`: archivo principal con nueve movimientos.
- `estado-cuenta-conciliacion-test-traslape.csv`: reutiliza `TEST-BANK-001` y agrega `TEST-BANK-010`.

El parser actual acepta exactamente los encabezados `Fecha`, `Concepto`, `Referencia`, `Cargo`, `Abono` y `Saldo`. El importe se obtiene de `Cargo` o `Abono`; el tipo se deriva de la columna con importe positivo.
