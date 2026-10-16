# Fixtures de importación de estados de cuenta

Diagnóstico: el importador actual admite dos formatos efectivos: CSV de texto UTF-8 y libros XLSX. En CSV detecta el delimitador comparando la primera línea: usa `;` si hay más puntos y coma que comas; en cualquier otro caso usa `,`. No admite OFX, TXT libre, XLS binario ni PDF desde la interfaz actual.

Archivos incluidos:

- `estado-cuenta-comas.csv`: 18 movimientos, encabezados en español, coma, fechas ISO `AAAA-MM-DD`.
- `estado-cuenta-punto-y-coma.csv`: 18 movimientos, encabezados alternativos reconocidos, punto y coma, fechas `DD/MM/AAAA`.
- `estado-cuenta-xlsx.xlsx`: 18 movimientos en la primera hoja, con columnas `Fecha`, `Concepto`, `Referencia`, `Cargo`, `Abono` y `Saldo`.

Contrato observado:

- Obligatorio: una columna reconocible como `fecha` (también `dia`, `fecha operacion` o `fecha movimiento`) y al menos una de `cargo`, `abono` o `importe`.
- Opcionales: descripción (`concepto`, `descripcion`, `concepto bancario`, `detalle`), referencia (`referencia`, `referencia bancaria`) y saldo (`saldo`, `saldo posterior`, `saldo final`).
- También reconoce `retiro`, `egreso`, `debitos`/`débito` para cargos; `deposito`/`depósito`, `ingreso`, `credito`/`crédito` para abonos; e `importe`, `monto` o `movimiento` como importe único.
- Fechas: `AAAA-MM-DD`, `D/M/AAAA`, `D-M-AAAA`, `D.M.AAAA`, y números seriales de Excel en XLSX. No se interpreta hora ni formatos con año de dos dígitos.
- Importes: números positivos; se eliminan `$`, comas y espacios, y se aceptan paréntesis como negativo. El parser de CSV requiere punto decimal; no convierte coma decimal.
- Un movimiento válido debe tener cargo o abono, no ambos. El importe se vuelve absoluto; el tipo es `Retiro` si hay cargo y `Deposito` si hay abono. Con `importe` solo, el código intenta inferir retiro por signo, aunque la validación exige importe positivo, por lo que no es una vía recomendable.
- Solo toma la primera hoja del XLSX y la primera fila como encabezados. No busca encabezados después de filas de portada, no mapea columnas por posición, no admite múltiples layouts bancarios automáticamente y no acepta OFX/TXT/PDF.

Cómo probar desde Emphasys:

1. Entrar a Tesorería y seleccionar una cuenta bancaria abierta.
2. Abrir Conciliación bancaria / Importar estado de cuenta.
3. Seleccionar primero `estado-cuenta-comas.csv` o `estado-cuenta-xlsx.xlsx`; revisar la previsualización y confirmar la importación.
4. Probar también `estado-cuenta-punto-y-coma.csv`; usa el delimitador `;` y punto decimal, por lo que debe resultar válido.
5. La importación escribe datos en la base; probar solo en una cuenta/empresa de pruebas y no repetir el mismo archivo, porque el sistema detecta el hash y rechaza una segunda importación.

Este diagnóstico fue realizado por inspección estática del código; no se ejecutó la importación ni se modificó la base de datos.
