# Prueba controlada Carta Porte 3.1

No ejecutar ningún paso de timbrado hasta revisar el snapshot del paso F.

## A. Preparar maestros

Verificar primero el nombre de la empresa de pruebas y ejecutar el SQL con su ID explícito:

```bash
psql "$DATABASE_URL" -v cp_test_empresa_id=<empresa_id_confirmado> \
  -f backend/database/scripts/20260820_transporte_cp_sandbox_fixture.sql
```

Conservar los IDs que devuelve el primer `SELECT`. En la UI, seleccionar el producto `CP_TEST_SERV_TRANSP` y el cliente `CP_TEST_CLIENTE`.

## B. Capturar la factura

En la UI normal de Emphasys, crear una factura en la misma empresa: cantidad `1`, importe ficticio, IVA trasladado `16%` y retención IVA `4%`. Conservar su `documento_id`. No timbrarla aún.

## C. Crear el Viaje

Sustituir los marcadores por los IDs del paso A y usar fechas futuras coherentes:

```http
POST /api/transporte/viajes
Content-Type: application/json

{
  "folioInterno": "CP_TEST_VIAJE_001",
  "clienteContactoId": <cliente_contacto_id>,
  "estatus": "listo_para_validar",
  "fechaProgramada": "2026-08-25T08:00:00-06:00",
  "fechaInicio": "2026-08-25T08:00:00-06:00",
  "fechaFin": "2026-08-25T11:00:00-06:00",
  "vehiculoId": <vehiculo_id>,
  "referenciaCliente": "CP TEST SANDBOX",
  "observaciones": "Prueba controlada Carta Porte 3.1",
  "ubicaciones": [
    {
      "ubicacionId": <origen_id>,
      "tipo": "origen",
      "secuencia": 1,
      "fechaHoraProgramada": "2026-08-25T08:00:00-06:00"
    },
    {
      "ubicacionId": <destino_id>,
      "tipo": "destino",
      "secuencia": 2,
      "fechaHoraProgramada": "2026-08-25T11:00:00-06:00",
      "distanciaRecorrida": 145
    }
  ],
  "mercancias": [
    {
      "mercanciaId": <mercancia_id>,
      "cantidad": 31000,
      "pesoKg": 25000,
      "valorMercancia": 750000,
      "origenSecuencia": 1,
      "destinoSecuencia": 2
    }
  ],
  "figuras": [
    {
      "tipoFigura": "01",
      "operadorId": <operador_id>,
      "contactoId": <operador_contacto_id>,
      "secuencia": 1
    }
  ],
  "remolques": [
    { "remolqueId": <remolque_id>, "orden": 1 }
  ]
}
```

Conservar el `viaje.id` de la respuesta.

## D. Relacionar la factura

```http
PUT /api/transporte/viajes/<viaje_id>/documento
Content-Type: application/json

{ "documentoId": <documento_id> }
```

## E. Materializar Carta Porte

```http
POST /api/transporte/viajes/<viaje_id>/validar-carta-porte
```

## F. Revisar el snapshot

```http
GET /api/transporte/viajes/<viaje_id>/carta-porte
```

Comprobar `estatus = "validado"`, `version = "3.1"`, `snapshot_json.IdCCP`, `SubTipoRem = "CTR028"` y `Placa = "41VA7J"`. Detenerse aquí: no ejecutar `POST /api/facturas/<documento_id>/timbrar` hasta aprobar el snapshot.
