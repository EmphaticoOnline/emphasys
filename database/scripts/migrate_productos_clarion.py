#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migración de productos: Clarion → Emphasys
Fuente: archivo TSV exportado de Clarion (encoding Windows-1252)

Prerrequisitos:
  pip install psycopg2-binary
  Ejecutar primero las migraciones SQL:
    - 20260608_create_productos_legacy_supplier.sql
    - 20260608_migrate_productos_supplier.sql
    - 20260608_add_cantidad_minima_venta.sql
"""

import csv
import json
import sys
from decimal import Decimal, InvalidOperation

import psycopg2
from psycopg2.extras import RealDictCursor

# ══════════════════════════════════════════════════════
#  CONFIGURACIÓN — ajustar antes de ejecutar
# ══════════════════════════════════════════════════════
DB = {
    'host':     '148.113.192.7',
    'port':     5432,
    'dbname':   'emphasys',
    'user':     'postgres',
    'password': 'Avko7tp3',
}
EMPRESA_ID   = 7
ARCHIVO      = r'C:\Temp\productos.txt'
ENCODING_SRC = 'windows-1252'
DRY_RUN      = True   # True → simula sin escribir en base de datos
# ══════════════════════════════════════════════════════


# ── Helpers de parseo ─────────────────────────────────

def limpio(v):
    return (v or '').strip()

def truncar(v, n):
    s = limpio(v)
    return s[:n] if s else None

def decimal_o_none(v):
    s = limpio(v).replace(',', '').replace(' ', '')
    if not s:
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None

def entero_o_none(v):
    d = decimal_o_none(v)
    if d is None:
        return None
    try:
        return int(d)
    except Exception:
        return None

def bool_clarion(v):
    """Clarion usa 0/1 como entero para booleanos."""
    return limpio(v) == '1'

def tipo_producto(v):
    return 'inventariable' if limpio(v) == 'I' else 'no_inventariable'

def iva_porcentaje(tasa_texto):
    """IVA ACREDITABLE e IVA DIFERIDO → 16. Vacío → None."""
    t = limpio(tasa_texto).upper()
    return Decimal('16') if 'IVA' in t else None


# ── Caches y lookups ──────────────────────────────────

_cache_unidades = {}

def lookup_unidad(cur, clave_texto):
    if not clave_texto:
        return None
    k = clave_texto.upper()
    if k not in _cache_unidades:
        cur.execute(
            "SELECT id FROM public.unidades "
            "WHERE empresa_id = %s AND UPPER(clave) = %s AND activo = true LIMIT 1",
            (EMPRESA_ID, k))
        r = cur.fetchone()
        _cache_unidades[k] = r['id'] if r else None
    return _cache_unidades[k]


_cache_impuestos = {}

def lookup_impuesto(cur, tipo, tasa_decimal):
    k = (tipo, str(tasa_decimal))
    if k not in _cache_impuestos:
        cur.execute(
            "SELECT id FROM public.impuestos "
            "WHERE tipo = %s AND tasa = %s AND activo = true LIMIT 1",
            (tipo, tasa_decimal))
        r = cur.fetchone()
        _cache_impuestos[k] = r['id'] if r else None
    return _cache_impuestos[k]


_cache_catalogo_tipo = {}

def get_or_create_catalogo_tipo(cur, entidad_tipo_id, nombre):
    k = (EMPRESA_ID, entidad_tipo_id, nombre)
    if k not in _cache_catalogo_tipo:
        cur.execute(
            "SELECT id FROM core.catalogos_tipos "
            "WHERE empresa_id = %s AND entidad_tipo_id = %s AND nombre = %s",
            (EMPRESA_ID, entidad_tipo_id, nombre))
        r = cur.fetchone()
        if not r:
            cur.execute(
                "INSERT INTO core.catalogos_tipos (empresa_id, entidad_tipo_id, nombre) "
                "VALUES (%s, %s, %s) RETURNING id",
                (EMPRESA_ID, entidad_tipo_id, nombre))
            r = cur.fetchone()
        _cache_catalogo_tipo[k] = r['id']
    return _cache_catalogo_tipo[k]


_cache_catalogo = {}

def get_or_create_catalogo(cur, tipo_catalogo_id, descripcion):
    k = (EMPRESA_ID, tipo_catalogo_id, descripcion.upper())
    if k not in _cache_catalogo:
        cur.execute(
            "SELECT id FROM core.catalogos "
            "WHERE empresa_id = %s AND tipo_catalogo_id = %s AND UPPER(descripcion) = %s",
            (EMPRESA_ID, tipo_catalogo_id, descripcion.upper()))
        r = cur.fetchone()
        if not r:
            cur.execute(
                "INSERT INTO core.catalogos (empresa_id, tipo_catalogo_id, descripcion) "
                "VALUES (%s, %s, %s) RETURNING id",
                (EMPRESA_ID, tipo_catalogo_id, descripcion))
            r = cur.fetchone()
        _cache_catalogo[k] = r['id']
    return _cache_catalogo[k]


_cache_campo_config = {}

def get_or_create_campo_configuracion(cur, entidad_tipo_id, nombre, clave, catalogo_tipo_id):
    k = (EMPRESA_ID, entidad_tipo_id, clave)
    if k not in _cache_campo_config:
        cur.execute(
            "SELECT id FROM core.campos_configuracion "
            "WHERE empresa_id = %s AND entidad_tipo_id = %s AND clave = %s",
            (EMPRESA_ID, entidad_tipo_id, clave))
        r = cur.fetchone()
        if not r:
            cur.execute(
                "INSERT INTO core.campos_configuracion "
                "(empresa_id, entidad_tipo_id, nombre, clave, tipo_dato, tipo_control, catalogo_tipo_id) "
                "VALUES (%s, %s, %s, %s, 'lista', 'dropdown', %s) RETURNING id",
                (EMPRESA_ID, entidad_tipo_id, nombre, clave, catalogo_tipo_id))
            r = cur.fetchone()
        _cache_campo_config[k] = r['id']
    return _cache_campo_config[k]


# ── Inserción por fila ────────────────────────────────

def migrar_fila(cur, fila, entidad_tipo_id, cat_metodo_id, cat_color_id):
    clave = truncar(fila.get('Prd:Identificacion'), 50)
    if not clave:
        return None  # fila vacía

    iva_pct    = iva_porcentaje(fila.get('Prd:Tasa', ''))
    ieps_pct   = decimal_o_none(fila.get('Prd:Pctiepsventas'))
    ret_iva    = bool_clarion(fila.get('Prd:Seretieneiva', '0'))
    ret_isr    = bool_clarion(fila.get('Prd:Seretieneisr', '0'))

    # ── 1. productos ────────────────────────────────────────────────
    cur.execute("""
        INSERT INTO public.productos (
            empresa_id, clave, descripcion, activo, clasificacion,
            tipo_producto, familia, linea, presentacion,
            unidad_venta_id, unidad_inventario_id, unidad_compra,
            existencia_actual,
            costo_estandar, costo_promedio, ultimo_costo,
            iva_porcentaje, ieps_porcentaje,
            retiene_iva, retiene_isr,
            clave_producto_sat, fraccion_arancelaria,
            largo, ancho, espesor,
            piezas_por_empaque, peso_por_empaque, unidad_peso_empaque,
            es_estacional, factor_demanda, demanda_mensual_estimado,
            observaciones, observaciones_compras, observaciones_diseno,
            dias_entrega, cantidad_minima_compra, cantidad_minima_venta,
            proveedor_principal_id, proveedor_alternativo_1_id, proveedor_alternativo_2_id
        ) VALUES (
            %(empresa_id)s, %(clave)s, %(descripcion)s, %(activo)s, %(clasificacion)s,
            %(tipo_producto)s, %(familia)s, %(linea)s, %(presentacion)s,
            %(unidad_venta_id)s, %(unidad_inventario_id)s, %(unidad_compra)s,
            %(existencia_actual)s,
            %(costo_estandar)s, %(costo_promedio)s, %(ultimo_costo)s,
            %(iva_porcentaje)s, %(ieps_porcentaje)s,
            %(retiene_iva)s, %(retiene_isr)s,
            %(clave_producto_sat)s, %(fraccion_arancelaria)s,
            %(largo)s, %(ancho)s, %(espesor)s,
            %(piezas_por_empaque)s, %(peso_por_empaque)s, %(unidad_peso_empaque)s,
            %(es_estacional)s, %(factor_demanda)s, %(demanda_mensual_estimado)s,
            %(observaciones)s, %(observaciones_compras)s, %(observaciones_diseno)s,
            %(dias_entrega)s, %(cantidad_minima_compra)s, %(cantidad_minima_venta)s,
            NULL, NULL, NULL
        )
        ON CONFLICT (empresa_id, clave) DO NOTHING
        RETURNING id
    """, {
        'empresa_id':               EMPRESA_ID,
        'clave':                    clave,
        'descripcion':              truncar(fila.get('Prd:Descripcion'), 150) or clave,
        'activo':                   not bool_clarion(fila.get('Prd:Baja', '0')),
        'clasificacion':            truncar(fila.get('Prd:Clasificacion'), 50),
        'tipo_producto':            tipo_producto(fila.get('Prd:Tipo', 'N')),
        'familia':                  truncar(fila.get('Prd:Familia'), 50),
        'linea':                    truncar(fila.get('Prd:Linea'), 50),
        'presentacion':             truncar(fila.get('Prd:Presentacion'), 50),
        'unidad_venta_id':          lookup_unidad(cur, limpio(fila.get('Prd:Umventa'))),
        'unidad_inventario_id':     lookup_unidad(cur, limpio(fila.get('Prd:Unidad'))),
        'unidad_compra':            truncar(fila.get('Prd:Umcompra'), 20),
        'existencia_actual':        decimal_o_none(fila.get('Prd:Existencia')),
        'costo_estandar':           decimal_o_none(fila.get('Prd:Costoestandar')),
        'costo_promedio':           decimal_o_none(fila.get('Prd:Costopromedio')),
        'ultimo_costo':             decimal_o_none(fila.get('Prd:Ultimocosto')),
        'iva_porcentaje':           iva_pct,
        'ieps_porcentaje':          ieps_pct if (ieps_pct and ieps_pct > 0) else None,
        'retiene_iva':              ret_iva,
        'retiene_isr':              ret_isr,
        'clave_producto_sat':       truncar(fila.get('Prd:Codigoproductosat'), 20),
        'fraccion_arancelaria':     truncar(fila.get('Prd:Fraccionarancelaria'), 15),
        'largo':                    decimal_o_none(fila.get('Prd:Largo')),
        'ancho':                    decimal_o_none(fila.get('Prd:Ancho')),
        'espesor':                  decimal_o_none(fila.get('Prd:Grueso')),
        'piezas_por_empaque':       decimal_o_none(fila.get('Prd:Piezasporcarton')),
        'peso_por_empaque':         decimal_o_none(fila.get('Prd:Pesobrutoporcarton')),
        'unidad_peso_empaque':      truncar(fila.get('Prd:Unidadpesobruto'), 20),
        'es_estacional':            bool_clarion(fila.get('Prd:Esestacional', '0')),
        'factor_demanda':           decimal_o_none(fila.get('Prd:Factordemanda')),
        'demanda_mensual_estimado': decimal_o_none(fila.get('Prd:Demandamensual')),
        'observaciones':            limpio(fila.get('Prd:Observaciones')) or None,
        'observaciones_compras':    limpio(fila.get('Prd:Observacionescompras')) or None,
        'observaciones_diseno':     limpio(fila.get('Prd:Observacionesdiseno')) or None,
        'dias_entrega':             entero_o_none(fila.get('Prd:Tiemposurtido')),
        'cantidad_minima_compra':   decimal_o_none(fila.get('Prd:Moq')),
        'cantidad_minima_venta':    decimal_o_none(fila.get('Prd:Minimoparaventa')),
    })

    r = cur.fetchone()
    if r:
        producto_id = r['id']
    else:
        # ON CONFLICT DO NOTHING: el producto ya existía
        cur.execute(
            "SELECT id FROM public.productos WHERE empresa_id = %s AND clave = %s",
            (EMPRESA_ID, clave))
        producto_id = cur.fetchone()['id']

    # ── 2. productos_impuestos ──────────────────────────────────────
    # IVA traslado
    if iva_pct:
        imp_id = lookup_impuesto(cur, 'traslado', Decimal('0.1600'))
        if imp_id:
            cur.execute("""
                INSERT INTO public.productos_impuestos (producto_id, impuesto_id)
                SELECT %s, %s WHERE NOT EXISTS (
                    SELECT 1 FROM public.productos_impuestos
                    WHERE producto_id = %s AND impuesto_id = %s)""",
                (producto_id, imp_id, producto_id, imp_id))

    # IEPS traslado
    if ieps_pct and ieps_pct > 0:
        imp_id = lookup_impuesto(cur, 'traslado', ieps_pct / 100)
        if imp_id:
            cur.execute("""
                INSERT INTO public.productos_impuestos (producto_id, impuesto_id)
                SELECT %s, %s WHERE NOT EXISTS (
                    SELECT 1 FROM public.productos_impuestos
                    WHERE producto_id = %s AND impuesto_id = %s)""",
                (producto_id, imp_id, producto_id, imp_id))

    # Retención IVA
    if ret_iva:
        tasa_ret = decimal_o_none(fila.get('Prd:Tasaretencioniva'))
        if tasa_ret:
            imp_id = lookup_impuesto(cur, 'retencion', tasa_ret / 100)
            if imp_id:
                cur.execute("""
                    INSERT INTO public.productos_impuestos (producto_id, impuesto_id)
                    SELECT %s, %s WHERE NOT EXISTS (
                        SELECT 1 FROM public.productos_impuestos
                        WHERE producto_id = %s AND impuesto_id = %s)""",
                    (producto_id, imp_id, producto_id, imp_id))

    # Retención ISR
    if ret_isr:
        tasa_ret = decimal_o_none(fila.get('Prd:Tasaretencionisr'))
        if tasa_ret:
            cur.execute(
                "SELECT id FROM public.impuestos "
                "WHERE tipo = 'retencion' AND nombre ILIKE '%ISR%' AND activo = true LIMIT 1")
            r = cur.fetchone()
            if r:
                cur.execute("""
                    INSERT INTO public.productos_impuestos (producto_id, impuesto_id)
                    SELECT %s, %s WHERE NOT EXISTS (
                        SELECT 1 FROM public.productos_impuestos
                        WHERE producto_id = %s AND impuesto_id = %s)""",
                    (producto_id, r['id'], producto_id, r['id']))

    # ── 3. productos_archivos ───────────────────────────────────────
    archivos = [
        ('Prd:Archivofotografia1', 'imagen',       1, True),
        ('Prd:Archivofotografia2', 'imagen',       2, False),
        ('Prd:Archivofichatecnica', 'ficha_tecnica', 1, False),
        ('Prd:Archivocertificado',  'certificado',   1, False),
    ]
    for campo, tipo_arch, orden, principal in archivos:
        nombre_arch = limpio(fila.get(campo))
        if nombre_arch:
            cur.execute("""
                INSERT INTO public.productos_archivos
                    (producto_id, tipo_archivo, archivo, orden_visual, principal)
                SELECT %s, %s, %s, %s, %s WHERE NOT EXISTS (
                    SELECT 1 FROM public.productos_archivos
                    WHERE producto_id = %s AND tipo_archivo = %s AND archivo = %s)""",
                (producto_id, tipo_arch, nombre_arch, orden, principal,
                 producto_id, tipo_arch, nombre_arch))

    # ── 4. migrate.productos_legacy_supplier ────────────────────────
    cur.execute("""
        INSERT INTO migrate.productos_legacy_supplier (
            empresa_id, clave_producto,
            proveedor_surtido, proveedor_surtido_2, proveedor_surtido_3,
            usa_pedimento, costo_reposicion,
            unidad_aduana, factor_equivalente_unidad_aduana
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (empresa_id, clave_producto) DO NOTHING""",
        (
            EMPRESA_ID, clave,
            limpio(fila.get('Prd:Proveedor')) or None,
            limpio(fila.get('Prd:Proveedor2')) or None,
            limpio(fila.get('Prd:Proveedor3')) or None,
            bool_clarion(fila.get('Prd:Usapedimento', '0')),
            decimal_o_none(fila.get('Prd:Costoreposicion')),
            truncar(fila.get('Prd:Unidadaduana'), 20),
            decimal_o_none(fila.get('Prd:Factorequivalenteunidadaduana')),
        ))

    # ── 5. entidades_catalogos: Método de Identificación ────────────
    metodo = limpio(fila.get('Prd:Metodoidentificacion'))
    if metodo and metodo.upper() != 'NINGUNO':
        cat_id = get_or_create_catalogo(cur, cat_metodo_id, metodo)
        cur.execute("""
            INSERT INTO core.entidades_catalogos
                (empresa_id, entidad_tipo_id, entidad_id, catalogo_id)
            SELECT %s, %s, %s, %s WHERE NOT EXISTS (
                SELECT 1 FROM core.entidades_catalogos
                WHERE empresa_id = %s AND entidad_tipo_id = %s
                  AND entidad_id = %s AND catalogo_id = %s)""",
            (EMPRESA_ID, entidad_tipo_id, producto_id, cat_id,
             EMPRESA_ID, entidad_tipo_id, producto_id, cat_id))

    # ── 6. entidades_catalogos: Color ───────────────────────────────
    color = limpio(fila.get('Prd:Color'))
    if color:
        cat_id = get_or_create_catalogo(cur, cat_color_id, color)
        cur.execute("""
            INSERT INTO core.entidades_catalogos
                (empresa_id, entidad_tipo_id, entidad_id, catalogo_id)
            SELECT %s, %s, %s, %s WHERE NOT EXISTS (
                SELECT 1 FROM core.entidades_catalogos
                WHERE empresa_id = %s AND entidad_tipo_id = %s
                  AND entidad_id = %s AND catalogo_id = %s)""",
            (EMPRESA_ID, entidad_tipo_id, producto_id, cat_id,
             EMPRESA_ID, entidad_tipo_id, producto_id, cat_id))

    # ── 7. migrate.productos_raw (fila completa como JSONB) ─────────
    cur.execute(
        "INSERT INTO migrate.productos_raw (empresa_id, data) VALUES (%s, %s)",
        (EMPRESA_ID, json.dumps(dict(fila), ensure_ascii=False)))

    return clave


# ── Main ──────────────────────────────────────────────

def main():
    conn = psycopg2.connect(**DB, cursor_factory=RealDictCursor)
    conn.autocommit = False
    cur = conn.cursor()

    # ── Fase de configuración (catálogos y campos) ──
    try:
        cur.execute(
            "SELECT id FROM core.entidades_tipos WHERE codigo = 'PRODUCTO' LIMIT 1")
        r = cur.fetchone()
        if not r:
            sys.exit("ERROR: no existe el tipo de entidad 'PRODUCTO' en core.entidades_tipos")
        entidad_tipo_id = r['id']

        cat_metodo_id = get_or_create_catalogo_tipo(
            cur, entidad_tipo_id, 'Método de Identificación')
        cat_color_id  = get_or_create_catalogo_tipo(
            cur, entidad_tipo_id, 'Color')

        get_or_create_campo_configuracion(
            cur, entidad_tipo_id,
            'Método de Identificación', 'metodo_identificacion', cat_metodo_id)
        get_or_create_campo_configuracion(
            cur, entidad_tipo_id,
            'Color', 'color', cat_color_id)

        if not DRY_RUN:
            conn.commit()
        else:
            conn.rollback()

    except Exception as e:
        conn.rollback()
        sys.exit(f"ERROR en fase de configuración: {e}")

    # ── Fase de migración (una fila a la vez con savepoint) ──
    stats   = {'ok': 0, 'omitidos': 0, 'errores': 0}
    errores = []

    with open(ARCHIVO, encoding=ENCODING_SRC, newline='') as f:
        reader = csv.DictReader(f, delimiter='\t', quotechar='"')

        for linea, fila in enumerate(reader, start=2):
            clave = truncar(fila.get('Prd:Identificacion'), 50)
            if not clave:
                stats['omitidos'] += 1
                continue

            cur.execute("SAVEPOINT sp_fila")
            try:
                migrar_fila(cur, fila, entidad_tipo_id, cat_metodo_id, cat_color_id)
                cur.execute("RELEASE SAVEPOINT sp_fila")
                stats['ok'] += 1

            except Exception as exc:
                cur.execute("ROLLBACK TO SAVEPOINT sp_fila")
                errores.append({'linea': linea, 'clave': clave, 'error': str(exc)})
                stats['errores'] += 1

    if not DRY_RUN:
        conn.commit()
    else:
        conn.rollback()
        print("(DRY RUN — ningún cambio fue escrito)")

    conn.close()

    # ── Reporte final ──
    print(f"\nMigración completada")
    print(f"  OK:       {stats['ok']}")
    print(f"  Omitidos: {stats['omitidos']}")
    print(f"  Errores:  {stats['errores']}")

    if errores:
        print(f"\nDetalle de errores:")
        for e in errores:
            print(f"  Línea {e['linea']:>4} | {e['clave']:<30} | {e['error']}")


if __name__ == '__main__':
    main()
