import { Client } from 'pg';

const EMPRESA_DICOR_ID = 9;
const SISTEMA_ORIGEN = 'DICOR';
const TIPO_CONTACTO = 'contacto';
const TIPO_DOMICILIO = 'contacto_domicilio';
const TIPO_DOMICILIO_BASE = 'contacto_domicilio_base';
const APPLY = process.argv.includes('--apply');

const TIPOS_ESPERADOS: Record<string, number> = {
  Cliente: 329,
  Proveedor: 80,
  Operador: 43,
  'Socio Comercial': 29,
  Vendedor: 26,
  Fletera: 22,
  Varios: 11,
  'Uso Interno': 6,
  Facturador: 5,
};

const CONFIGURACION_TIPOS: Record<string, { tipoCompatible: string; rol: string | null }> = {
  Cliente: { tipoCompatible: 'Cliente', rol: 'cliente' },
  Proveedor: { tipoCompatible: 'Proveedor', rol: 'proveedor' },
  Vendedor: { tipoCompatible: 'Vendedor', rol: 'vendedor' },
  Operador: { tipoCompatible: 'Otro', rol: 'operador' },
  Fletera: { tipoCompatible: 'Otro', rol: 'fletera' },
  Facturador: { tipoCompatible: 'Otro', rol: 'facturador' },
  'Socio Comercial': { tipoCompatible: 'Otro', rol: 'socio_comercial' },
  Varios: { tipoCompatible: 'Varios', rol: null },
  'Uso Interno': { tipoCompatible: 'Otro', rol: null },
};

type ContactoOrigen = {
  id: number;
  tipo_contacto: string;
  nombre: string | null;
  contacto: string | null;
  rfc: string | null;
  telefono_movil: string | null;
  telefono_trabajo: string | null;
  telefono_casa: string | null;
  zona: string | null;
  diascredito: number | null;
  limite_credito: string | null;
  bloqueado: boolean;
  motivo_bloqueo: string | null;
  fecha_alta: Date | null;
  es_publico_en_general: boolean;
  email: string | null;
  curp: string | null;
  activo: boolean;
  enviar_cfd: boolean;
  enviar_cfd_agente: boolean;
  observaciones: string | null;
  forma_pago_id: string | null;
  metodo_pago_id: string | null;
  uso_cfdi_id: string | null;
  regimen_fiscal_id: string | null;
  cp_id: string | null;
  pais_id: string | null;
  porcentaje_participacion_utilidad: string | null;
};

type DomicilioOrigen = {
  id: number;
  contacto_id: number;
  identificador: string;
  responsable: string | null;
  domicilio: string | null;
  colonia: string | null;
  ciudad: string | null;
  estado: string | null;
  cp: string | null;
  pais: string | null;
  telefono: string | null;
  fax: string | null;
  cruces: string | null;
  recibe: string | null;
  telefono_recibe: string | null;
  coto_o_fraccionamiento: string | null;
  interior: string | null;
  observaciones: string | null;
};

type DomicilioBaseOrigen = {
  id: number;
  calle: string | null;
  numero_exterior: string | null;
  numero_interior: string | null;
  colonia_id: string | null;
  ciudad_id: string | null;
  estado_id: string | null;
  cp_id: string | null;
  pais_id: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function makeClient(prefix: 'DICOR' | 'EMPHASYS'): Client {
  return new Client({
    host: requiredEnv(`${prefix}_PG_HOST`),
    port: Number(requiredEnv(`${prefix}_PG_PORT`)),
    database: requiredEnv(`${prefix}_PG_DATABASE`),
    user: requiredEnv(`${prefix}_PG_USER`),
    password: requiredEnv(`${prefix}_PG_PASSWORD`),
    options: prefix === 'DICOR' || !APPLY ? '-c default_transaction_read_only=on' : undefined,
  });
}

function clean(value: string | null): string | null {
  if (value == null) return null;
  const result = value.trim();
  return result === '' ? null : result;
}

function normalizeName(value: string | null): string {
  const result = clean(value);
  if (!result) throw new Error('DICOR contiene un contacto sin nombre utilizable.');
  return result.replace(/\s+/g, ' ');
}

function normalizeRfc(value: string | null): string | null {
  const result = clean(value)?.toUpperCase().replace(/[^A-Z0-9Ñ&]/g, '') ?? null;
  if (!result) return null;
  if (!/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(result)) {
    throw new Error(`RFC DICOR no válido: ${result}`);
  }
  return result;
}

function validPostalCode(value: string | null): string | null {
  const result = clean(value);
  return result && /^[0-9]{5}$/.test(result) ? result : null;
}

function sourceCountry(value: string | null): string | null {
  const result = clean(value);
  if (!result) return null;
  return result.toUpperCase() === 'MEX' ? 'México' : result;
}

async function getMapping(target: Client, type: string, sourceId: string): Promise<number | null> {
  const result = await target.query<{ id_destino: string }>(
    `SELECT id_destino
       FROM migrate.entidades_correspondencias
      WHERE sistema_origen=$1 AND tipo_entidad=$2
        AND id_origen=$3 AND empresa_destino_id=$4`,
    [SISTEMA_ORIGEN, type, sourceId, EMPRESA_DICOR_ID],
  );
  return result.rows[0] ? Number(result.rows[0].id_destino) : null;
}

async function insertMapping(
  target: Client,
  type: string,
  sourceId: string,
  destinationId: number,
  metadata: Record<string, unknown>,
): Promise<void> {
  await target.query(
    `INSERT INTO migrate.entidades_correspondencias
       (sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [SISTEMA_ORIGEN, type, sourceId, EMPRESA_DICOR_ID, destinationId, metadata],
  );
}

async function main(): Promise<void> {
  const source = makeClient('DICOR');
  const target = makeClient('EMPHASYS');
  await source.connect();
  await target.connect();

  try {
    await source.query('BEGIN READ ONLY');
    const contacts = await source.query<ContactoOrigen>(
      `SELECT id,tipo_contacto::text,nombre,contacto,rfc,telefono_movil,telefono_trabajo,
              telefono_casa,zona,diascredito,limite_credito,bloqueado,motivo_bloqueo,
              fecha_alta,es_publico_en_general,email,curp,activo,enviar_cfd,
              enviar_cfd_agente,observaciones,forma_pago_id,metodo_pago_id,uso_cfdi_id,
              regimen_fiscal_id,cp_id,pais_id,porcentaje_participacion_utilidad
         FROM public.contactos
        ORDER BY id`,
      [],
    );
    const addresses = await source.query<DomicilioOrigen>(
      `SELECT id,contacto_id,identificador,responsable,domicilio,colonia,ciudad,estado,cp,
              pais,telefono,fax,cruces,recibe,telefono_recibe,coto_o_fraccionamiento,
              interior,observaciones
         FROM public.contactos_domicilios
        ORDER BY id`,
      [],
    );
    const baseAddresses = await source.query<DomicilioBaseOrigen>(
      `SELECT id,calle,numero_exterior,numero_interior,colonia_id,ciudad_id,estado_id,cp_id,pais_id
         FROM public.contactos
        WHERE (NULLIF(btrim(COALESCE(calle,'')),'') IS NOT NULL
           OR NULLIF(btrim(COALESCE(cp_id,'')),'') IS NOT NULL)
        ORDER BY id`,
      [],
    );


    const typeCounts: Record<string, number> = {};
    for (const row of contacts.rows) typeCounts[row.tipo_contacto] = (typeCounts[row.tipo_contacto] ?? 0) + 1;
    const distributionChanged =
      Object.keys(typeCounts).length !== Object.keys(TIPOS_ESPERADOS).length
      || Object.entries(TIPOS_ESPERADOS).some(([type, count]) => typeCounts[type] !== count);
    if (distributionChanged) {
      throw new Error(`La distribución de tipos DICOR cambió: ${JSON.stringify(typeCounts)}.`);
    }
    if (contacts.rows.some((row) => Number(row.limite_credito ?? 0) !== 0)) {
      throw new Error('Existe un límite de crédito DICOR no cero; se requiere una decisión explícita.');
    }
    if (contacts.rows.filter((row) => normalizeRfc(row.rfc)).length !== 1) {
      throw new Error('La cantidad de perfiles fiscales DICOR válidos dejó de ser uno.');
    }

    await target.query('BEGIN');
    await target.query(`SET LOCAL lock_timeout='10s'`);
    await target.query(`SET LOCAL statement_timeout='120s'`);

    const prerequisites = await target.query<{ company: boolean; mappings: boolean; roles: boolean; fiscal: boolean; address: boolean }>(
      `SELECT
         EXISTS(SELECT 1 FROM core.empresas WHERE id=$1 AND activo=true) company,
         to_regclass('migrate.entidades_correspondencias') IS NOT NULL mappings,
         to_regclass('public.contactos_roles') IS NOT NULL roles,
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contactos_datos_fiscales' AND column_name='codigo_postal_fiscal') fiscal,
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contactos_domicilios' AND column_name='texto_original') address`,
      [EMPRESA_DICOR_ID],
    );
    if (!Object.values(prerequisites.rows[0]).every(Boolean)) {
      throw new Error('Falta aplicar la migración de esquema de Contactos o la empresa 9 no está activa.');
    }

    const foreignContacts = await target.query(
      `SELECT c.id FROM contactos c
        WHERE c.empresa_id=$1
          AND NOT EXISTS (
            SELECT 1 FROM migrate.entidades_correspondencias m
             WHERE m.sistema_origen=$2 AND m.tipo_entidad=$3
               AND m.empresa_destino_id=$1 AND m.id_destino=c.id
          ) LIMIT 1`,
      [EMPRESA_DICOR_ID, SISTEMA_ORIGEN, TIPO_CONTACTO],
    );
    if (foreignContacts.rowCount) throw new Error('Empresa 9 contiene contactos ajenos a esta migración.');

    for (const row of contacts.rows) {
      const config = CONFIGURACION_TIPOS[row.tipo_contacto];
      if (!config) throw new Error(`Tipo DICOR sin regla aprobada: ${row.tipo_contacto}`);
      const sourceId = String(row.id);
      const name = normalizeName(row.nombre);
      const rfc = normalizeRfc(row.rfc);
      let contactId = await getMapping(target, TIPO_CONTACTO, sourceId);

      if (contactId == null) {
        if (!APPLY) continue;
        const inserted = await target.query<{ id: number }>(
          `INSERT INTO contactos (
             empresa_id,tipo_contacto,nombre,rfc,email,telefono,telefono_secundario,
             activo,bloqueado,dias_credito,limite_credito,fecha_alta,observaciones,
             motivo_bloqueo,zona,nombre_contacto
           ) VALUES ($1,$2::tipo_contacto_enum,$3,$4,$5,$6,$7,$8,$9,$10,NULL,
                     COALESCE($11,now()),$12,$13,$14,$15)
           RETURNING id`,
          [EMPRESA_DICOR_ID, config.tipoCompatible, name, rfc, clean(row.email),
           clean(row.telefono_movil), clean(row.telefono_trabajo) ?? clean(row.telefono_casa),
           row.activo, row.bloqueado, row.diascredito, row.fecha_alta, clean(row.observaciones),
           clean(row.motivo_bloqueo), clean(row.zona), clean(row.contacto)],
        );
        contactId = inserted.rows[0].id;
        await insertMapping(target, TIPO_CONTACTO, sourceId, contactId, {
          tipo_contacto_origen: row.tipo_contacto,
          fecha_alta_origen_nula: row.fecha_alta == null,
          limite_credito_origen: row.limite_credito,
          porcentaje_participacion_utilidad: row.porcentaje_participacion_utilidad,
        });
      } else {
        const existing = await target.query(
          `SELECT 1 FROM contactos
            WHERE id=$1 AND empresa_id=$2 AND nombre=$3
              AND tipo_contacto::text=$4 AND dias_credito IS NOT DISTINCT FROM $5`,
          [contactId, EMPRESA_DICOR_ID, name, config.tipoCompatible, row.diascredito],
        );
        if (existing.rowCount !== 1) throw new Error(`Correspondencia de contacto DICOR ${row.id} incompatible.`);
        if (APPLY) await target.query(
          `UPDATE contactos SET nombre=$1, tipo_contacto=$2::tipo_contacto_enum, rfc=$3,
             email=$4, telefono=$5, telefono_secundario=$6, activo=$7, bloqueado=$8,
             dias_credito=$9, observaciones=$10, motivo_bloqueo=$11, zona=$12,
             nombre_contacto=$13, updated_at=now()
           WHERE id=$14 AND empresa_id=$15`,
          [name, config.tipoCompatible, rfc, clean(row.email), clean(row.telefono_movil),
           clean(row.telefono_trabajo) ?? clean(row.telefono_casa), row.activo, row.bloqueado,
           row.diascredito, clean(row.observaciones), clean(row.motivo_bloqueo), clean(row.zona),
           clean(row.contacto), contactId, EMPRESA_DICOR_ID],
        );
      }

      if (config.rol) {
        if (APPLY) await target.query(
          `INSERT INTO contactos_roles (contacto_id,rol,activo,origen,metadata)
           VALUES ($1,$2,true,$3,$4)
           ON CONFLICT (contacto_id,rol) DO NOTHING`,
          [contactId, config.rol, SISTEMA_ORIGEN, { tipo_contacto_origen: row.tipo_contacto }],
        );
        const role = await target.query(
          `SELECT 1 FROM contactos_roles WHERE contacto_id=$1 AND rol=$2 AND activo=true`,
          [contactId, config.rol],
        );
        if (role.rowCount !== 1) throw new Error(`Rol incompatible para contacto DICOR ${row.id}.`);
      }

      const fiscal = await target.query(
        `SELECT rfc,razon_social_fiscal,codigo_postal_fiscal,regimen_fiscal,uso_cfdi,
                forma_pago,metodo_pago,curp,es_publico_general,enviar_cfd,enviar_cfd_agente
           FROM contactos_datos_fiscales WHERE contacto_id=$1`,
        [contactId],
      );
      if (rfc) {
        if (!fiscal.rowCount) {
          if (APPLY) await target.query(
            `INSERT INTO contactos_datos_fiscales (
               contacto_id,rfc,razon_social_fiscal,codigo_postal_fiscal,curp,regimen_fiscal,
               uso_cfdi,forma_pago,metodo_pago,enviar_cfd,enviar_cfd_agente,es_publico_general
             ) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [contactId, rfc, validPostalCode(row.cp_id), clean(row.curp), clean(row.regimen_fiscal_id),
             clean(row.uso_cfdi_id), clean(row.forma_pago_id), clean(row.metodo_pago_id),
             row.enviar_cfd, row.enviar_cfd_agente, row.es_publico_en_general],
          );
        } else {
          const value = fiscal.rows[0];
          if (value.rfc !== rfc || value.razon_social_fiscal != null || value.codigo_postal_fiscal !== validPostalCode(row.cp_id)) {
            throw new Error(`Perfil fiscal incompatible para contacto DICOR ${row.id}.`);
          }
        }
      } else if (fiscal.rowCount) {
        throw new Error(`Contacto DICOR ${row.id} sin RFC tiene un perfil fiscal destino inesperado.`);
      }
    }

    for (const row of addresses.rows) {
      const parentId = await getMapping(target, TIPO_CONTACTO, String(row.contacto_id));
      if (parentId == null) throw new Error(`Domicilio DICOR ${row.id} no tiene contacto padre mapeado.`);
      const sourceId = String(row.id);
      const originalField = clean(row.domicilio);
      const original = originalField ?? normalizeName(row.identificador);
      let addressId = await getMapping(target, TIPO_DOMICILIO, sourceId);
      if (addressId == null) {
        if (!APPLY) continue;
        const inserted = await target.query<{ id: number }>(
          `INSERT INTO contactos_domicilios (
             contacto_id,identificador,es_principal,responsable,calle,numero_exterior,
             numero_interior,colonia,ciudad,estado,cp,pais,cruces,recibe,
             telefono_recibe,telefono,fax,observaciones,texto_original
           ) VALUES ($1,$2,false,$3,NULL,NULL,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           RETURNING id`,
          [parentId, normalizeName(row.identificador), clean(row.responsable), clean(row.colonia),
           clean(row.ciudad), clean(row.estado), validPostalCode(row.cp), sourceCountry(row.pais),
           clean(row.cruces), clean(row.recibe), clean(row.telefono_recibe), clean(row.telefono),
           clean(row.fax), clean(row.observaciones), original],
        );
        addressId = inserted.rows[0].id;
        await insertMapping(target, TIPO_DOMICILIO, sourceId, addressId, {
          contacto_id_origen: row.contacto_id,
          coto_o_fraccionamiento: row.coto_o_fraccionamiento,
          interior: row.interior,
          domicilio_original_ausente: originalField == null,
        });
      } else {
        if (originalField == null) {
          if (APPLY) await target.query(
            `UPDATE contactos_domicilios
                SET texto_original=$2
              WHERE id=$1 AND texto_original IS NULL`,
            [addressId, original],
          );
        }
        const existing = await target.query(
          `SELECT 1 FROM contactos_domicilios
            WHERE id=$1 AND contacto_id=$2 AND identificador=$3
              AND es_principal=false AND texto_original IS NOT DISTINCT FROM $4`,
          [addressId, parentId, normalizeName(row.identificador), original],
        );
        if (existing.rowCount !== 1) throw new Error(`Correspondencia de domicilio DICOR ${row.id} incompatible.`);
      }
    }

    for (const row of baseAddresses.rows) {
      const parentId = await getMapping(target, TIPO_CONTACTO, String(row.id));
      if (parentId == null) throw new Error(`Dirección base del contacto DICOR ${row.id} no tiene padre mapeado.`);
      const sourceId = String(row.id);
      const original = [clean(row.calle), clean(row.numero_exterior), clean(row.numero_interior)].filter(Boolean).join(' ') || null;
      let addressId = await getMapping(target, TIPO_DOMICILIO_BASE, sourceId);
      if (addressId == null) {
        if (!APPLY) continue;
        const inserted = await target.query<{ id: number }>(
          `INSERT INTO contactos_domicilios (
             contacto_id,identificador,es_principal,calle,numero_exterior,numero_interior,
             cp,pais,texto_original
           ) VALUES ($1,'DIRECCION BASE DICOR',false,$2,$3,$4,$5,$6,$7)
           RETURNING id`,
          [parentId, clean(row.calle), clean(row.numero_exterior), clean(row.numero_interior),
           validPostalCode(row.cp_id), sourceCountry(row.pais_id), original],
        );
        addressId = inserted.rows[0].id;
        await insertMapping(target, TIPO_DOMICILIO_BASE, sourceId, addressId, {
          contacto_id_origen: row.id,
          colonia_id_origen: row.colonia_id,
          ciudad_id_origen: row.ciudad_id,
          estado_id_origen: row.estado_id,
          pais_id_origen: row.pais_id,
        });
      } else {
        const existing = await target.query(
          `SELECT 1 FROM contactos_domicilios
            WHERE id=$1 AND contacto_id=$2 AND identificador='DIRECCION BASE DICOR'
              AND es_principal=false AND texto_original IS NOT DISTINCT FROM $3`,
          [addressId, parentId, original],
        );
        if (existing.rowCount !== 1) throw new Error(`Dirección base DICOR ${row.id} incompatible.`);
      }
    }

    await target.query(APPLY ? 'COMMIT' : 'ROLLBACK');
    await source.query('ROLLBACK');
    console.log(JSON.stringify({
      ok: true,
      contactos_origen: contacts.rowCount,
      domicilios_relacionados_origen: addresses.rowCount,
      domicilios_base_origen: baseAddresses.rowCount,
      modo: APPLY ? 'apply' : 'dry-run',
    }, null, 2));
  } catch (error) {
    await target.query('ROLLBACK').catch(() => undefined);
    await source.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
