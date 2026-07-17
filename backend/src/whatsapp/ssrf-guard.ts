import dns from "dns";
import { BlockList } from "net";
import { URL } from "url";

// Protección SSRF para la descarga de adjuntos entrantes de WhatsApp: la URL
// que manda Gupshup en el webhook es, por definición, dato no confiable (en
// teoría cualquier cosa que llegue en ese campo del payload). Antes de que el
// backend haga una petición saliente hacia ella, se le aplican todas las
// validaciones de este módulo.
//
// Estrategia (evita depender del `maxRedirects`/`beforeRedirect` de axios,
// cuyas garantías de "abortar" un salto no están documentadas con la
// claridad suficiente para algo de seguridad crítica):
//   1. Cada URL (la inicial y cada destino de redirección) se valida por
//      estructura ANTES de intentar resolverla o conectarse
//      (validateUrlStructure): protocolo, credenciales embebidas, allowlist
//      de host si está activa.
//   2. La resolución DNS se hace con un `lookup` custom
//      (createValidatingLookup) que se pasa directamente a axios/Node como
//      la función que usa el socket para conectarse. Como es la MISMA
//      función la que valida y la que efectivamente resuelve el hostname en
//      el momento exacto de abrir la conexión TCP, no hay ventana entre
//      "verificar" y "conectar" en la que un DNS rebinding pueda colar una
//      IP distinta (ver createValidatingLookup).
//   3. El llamador (whatsapp-media-download.service.ts) desactiva el
//      auto-seguimiento de redirecciones de axios (`maxRedirects: 0`) y
//      hace su propio loop: cada Location recibido pasa de nuevo por los
//      pasos 1 y 2 antes de seguirlo. Ver fetchWithSsrfGuard más abajo.

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`SSRF_BLOCKED: ${reason}`);
    this.name = "SsrfBlockedError";
  }
}

// Solo https: Gupshup entrega siempre enlaces https para medios; no hay
// motivo legítimo para aceptar http/otros esquemas en este flujo, y
// permitirlos abriría la puerta a esquemas peligrosos (file:, ftp:, etc.).
const ALLOWED_PROTOCOLS = new Set(["https:"]);

// Allowlist opcional de hosts reales de medios de Gupshup. Se deja vacía
// (deshabilitada) a propósito: Gupshup no publica una lista cerrada y
// estable de dominios/subdominios de su CDN de medios (puede variar por
// región o cambiar sin aviso), y una allowlist mal calibrada rompería
// adjuntos legítimos silenciosamente. La defensa real contra SSRF acá es el
// bloqueo de IPs privadas/reservadas en cada resolución DNS (abajo), que no
// depende de conocer los hosts exactos de antemano. Si en el futuro se
// confirma con Gupshup una lista estable de hosts de medios, agregarla aquí
// endurece el filtro sin requerir cambios en el resto del flujo.
const HOST_ALLOWLIST: readonly string[] = [];

/**
 * Valida la estructura de la URL (protocolo, credenciales embebidas,
 * allowlist de host si aplica) y devuelve el objeto URL parseado. Debe
 * llamarse tanto para la URL inicial como para CADA destino de redirección
 * antes de intentar conectarse a él.
 */
export function validateUrlStructure(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("URL malformada");
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new SsrfBlockedError(`protocolo no permitido (${parsed.protocol})`);
  }

  if (parsed.username || parsed.password) {
    throw new SsrfBlockedError("URL con credenciales embebidas no permitida");
  }

  if (HOST_ALLOWLIST.length > 0 && !HOST_ALLOWLIST.includes(parsed.hostname.toLowerCase())) {
    throw new SsrfBlockedError(`host fuera de la allowlist (${parsed.hostname})`);
  }

  return parsed;
}

// Bloqueo de rangos IPv4/IPv6 privados, loopback, link-local, multicast,
// reservados y de documentación/benchmarking, usando net.BlockList (API
// nativa de Node desde v15, sin dependencias nuevas). Se prefiere sobre
// comparaciones manuales de string/prefijo porque BlockList hace la
// aritmética CIDR real — evita bugs sutiles como bloquear "fe8x::" con un
// startsWith en vez de la máscara /10 real, y normaliza correctamente
// direcciones IPv4-mapeadas en IPv6 (::ffff:10.0.0.1 se evalúa contra las
// reglas IPv4, confirmado con pruebas manuales antes de integrarlo).
const blockedRanges = new BlockList();

// IPv4 (RFC 6890 / IANA Special-Purpose Address Registry)
blockedRanges.addSubnet("0.0.0.0", 8, "ipv4"); // "esta" red
blockedRanges.addSubnet("10.0.0.0", 8, "ipv4"); // privado
blockedRanges.addSubnet("100.64.0.0", 10, "ipv4"); // CGNAT / shared address space
blockedRanges.addSubnet("127.0.0.0", 8, "ipv4"); // loopback
blockedRanges.addSubnet("169.254.0.0", 16, "ipv4"); // link-local (incluye metadata de nubes: 169.254.169.254)
blockedRanges.addSubnet("172.16.0.0", 12, "ipv4"); // privado
blockedRanges.addSubnet("192.0.0.0", 24, "ipv4"); // asignaciones de protocolo IETF
blockedRanges.addSubnet("192.0.2.0", 24, "ipv4"); // TEST-NET-1 (documentación)
blockedRanges.addSubnet("192.88.99.0", 24, "ipv4"); // relay anycast 6to4 (deprecado, igual se bloquea)
blockedRanges.addSubnet("192.168.0.0", 16, "ipv4"); // privado
blockedRanges.addSubnet("198.18.0.0", 15, "ipv4"); // benchmarking
blockedRanges.addSubnet("198.51.100.0", 24, "ipv4"); // TEST-NET-2 (documentación)
blockedRanges.addSubnet("203.0.113.0", 24, "ipv4"); // TEST-NET-3 (documentación)
blockedRanges.addSubnet("224.0.0.0", 4, "ipv4"); // multicast
blockedRanges.addSubnet("240.0.0.0", 4, "ipv4"); // reservado + broadcast 255.255.255.255

// IPv6 (RFC 4291 / RFC 6890 / IANA IPv6 Special-Purpose Address Registry)
blockedRanges.addSubnet("::1", 128, "ipv6"); // loopback
blockedRanges.addSubnet("::", 128, "ipv6"); // no especificada
blockedRanges.addSubnet("64:ff9b::", 96, "ipv6"); // NAT64 (embebe IPv4 arbitraria; se bloquea entero)
blockedRanges.addSubnet("100::", 64, "ipv6"); // discard-only (RFC 6666)
blockedRanges.addSubnet("2001:db8::", 32, "ipv6"); // documentación
blockedRanges.addSubnet("2002::", 16, "ipv6"); // 6to4 (embebe IPv4 arbitraria; se bloquea entero)
blockedRanges.addSubnet("fc00::", 7, "ipv6"); // unique local (privado)
blockedRanges.addSubnet("fe80::", 10, "ipv6"); // link-local
blockedRanges.addSubnet("ff00::", 8, "ipv6"); // multicast

export function isPublicRoutableIp(ip: string, family: 4 | 6): boolean {
  return !blockedRanges.check(ip, family === 4 ? "ipv4" : "ipv6");
}

export type ValidatedLookupAuditEntry = { hostname: string; candidatas: string[]; elegida: string | null };

/**
 * Construye una función `lookup` compatible con la opción `lookup` de
 * axios/Node (usada internamente por `net.connect`/TLS justo antes de abrir
 * la conexión). Resuelve TODAS las direcciones del hostname, descarta las
 * que caen en rangos bloqueados, y solo entonces entrega una dirección
 * válida para conectar. Como esta es la función que Node realmente usa para
 * resolver en el momento de conectar (no una verificación previa y
 * separada), un DNS rebinding que cambiara la respuesta entre "cuando lo
 * chequeamos" y "cuando conectamos" no tiene ventana: son la misma
 * operación.
 */
export function createValidatingLookup(auditTrail?: ValidatedLookupAuditEntry[]) {
  return (
    hostname: string,
    options: dns.LookupAllOptions | number,
    callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
  ) => {
    const requestedFamily = typeof options === "number" ? options : options?.family || 0;

    dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) {
        return callback(err, "", 0);
      }
      if (!addresses || addresses.length === 0) {
        return callback(new SsrfBlockedError(`sin direcciones DNS para ${hostname}`) as any, "", 0);
      }

      const candidatas = addresses.filter(
        (a) => (requestedFamily === 0 || a.family === requestedFamily) && isPublicRoutableIp(a.address, a.family as 4 | 6)
      );

      auditTrail?.push({
        hostname,
        candidatas: addresses.map((a) => a.address),
        elegida: candidatas[0]?.address ?? null,
      });

      if (candidatas.length === 0) {
        return callback(
          new SsrfBlockedError(`todas las IPs resueltas para ${hostname} están en rangos bloqueados`) as any,
          "",
          0
        );
      }

      const elegida = candidatas[0];
      callback(null, elegida.address, elegida.family);
    });
  };
}
