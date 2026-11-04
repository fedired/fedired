/**
 * Guard contra SSRF para peticiones salientes (fetch de ActivityPub, WebFinger, etc.).
 *
 * Este módulo no depende de nada interno de la aplicación a propósito:
 * así se puede probar con `node:test` sin levantar el backend.
 *
 * Regla: una dirección solo es válida para conectar si es pública. Se rechazan
 * loopback, privadas (RFC1918, ULA), link-local (incluye metadata cloud 169.254.169.254),
 * CGNAT, multicast, reservadas y documentación. Las IPv6 que embeben IPv4
 * (::ffff:x, 64:ff9b::x) se evalúan por su IPv4 embebida.
 */
import { BlockList, isIPv4, isIPv6 } from "node:net";

type Cidr = [address: string, prefix: number];

const PRIVATE_IPV4: Cidr[] = [
	["0.0.0.0", 8], // "esta red"
	["10.0.0.0", 8], // RFC1918
	["100.64.0.0", 10], // CGNAT
	["127.0.0.0", 8], // loopback
	["169.254.0.0", 16], // link-local (metadata cloud)
	["172.16.0.0", 12], // RFC1918
	["192.0.0.0", 24], // asignaciones IETF
	["192.0.2.0", 24], // TEST-NET-1
	["192.168.0.0", 16], // RFC1918
	["198.18.0.0", 15], // benchmarking
	["198.51.100.0", 24], // TEST-NET-2
	["203.0.113.0", 24], // TEST-NET-3
	["224.0.0.0", 4], // multicast
	["240.0.0.0", 4], // reservada + broadcast
];

const PRIVATE_IPV6: Cidr[] = [
	["::", 96], // no especificada, loopback y IPv4-compatible
	["100::", 64], // discard-only
	["2001::", 32], // Teredo
	["2001:db8::", 32], // documentación
	["2002::", 16], // 6to4
	["fc00::", 7], // ULA
	["fe80::", 10], // link-local
	["fec0::", 10], // site-local (obsoleta)
	["ff00::", 8], // multicast
];

function buildBlockList(entries: Cidr[], family: "ipv4" | "ipv6"): BlockList {
	const list = new BlockList();
	for (const [address, prefix] of entries) {
		list.addSubnet(address, prefix, family);
	}
	return list;
}

const blockedV4 = buildBlockList(PRIVATE_IPV4, "ipv4");
const blockedV6 = buildBlockList(PRIVATE_IPV6, "ipv6");

type AllowList = { v4: BlockList; v6: BlockList };

/**
 * Parsea `allowedPrivateNetworks` ("10.0.0.0/8", "fd00::/8" o una IP sola).
 * Entradas inválidas se ignoran: ignorarlas bloquea de más, que es el lado seguro.
 */
function buildAllowList(networks: string[]): AllowList {
	const v4 = new BlockList();
	const v6 = new BlockList();
	for (const net of networks) {
		const [address, rawPrefix] = net.trim().split("/");
		try {
			if (isIPv4(address)) {
				v4.addSubnet(address, rawPrefix ? Number(rawPrefix) : 32, "ipv4");
			} else if (isIPv6(address)) {
				v6.addSubnet(address, rawPrefix ? Number(rawPrefix) : 128, "ipv6");
			}
		} catch {
			// prefijo inválido: se ignora
		}
	}
	return { v4, v6 };
}

let cachedAllowKey = "";
let cachedAllow: AllowList = buildAllowList([]);

function getAllowList(networks: string[]): AllowList {
	const key = networks.join(",");
	if (key !== cachedAllowKey) {
		cachedAllowKey = key;
		cachedAllow = buildAllowList(networks);
	}
	return cachedAllow;
}

/** IPv4 embebida en ::ffff:a.b.c.d (mapeada) o 64:ff9b::a.b.c.d (NAT64). Recibe IPv6 normalizada. */
function embeddedIPv4(normalizedV6: string): string | null {
	const m = normalizedV6.match(
		/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
	);
	if (m == null) return null;
	const hi = Number.parseInt(m[1], 16);
	const lo = Number.parseInt(m[2], 16);
	return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
}

function isPublicIPv4(ip: string, allow: AllowList): boolean {
	if (blockedV4.check(ip, "ipv4")) {
		return allow.v4.check(ip, "ipv4");
	}
	return true;
}

/**
 * ¿Es esta dirección IP pública (y por tanto segura para conectar)?
 *
 * Devuelve `false` si no es una IP: los hostnames deben resolverse antes
 * y cada dirección resultante debe pasar por esta función.
 *
 * @param address IP (acepta corchetes IPv6 y zone id, p. ej. "[::1]" o "fe80::1%eth0")
 * @param allowedPrivateNetworks Rangos privados permitidos explícitamente por la instancia
 */
export function isPublicAddress(
	address: string,
	allowedPrivateNetworks: string[] = [],
): boolean {
	const ip = address.replace(/^\[(.*)\]$/, "$1").split("%")[0];
	const allow = getAllowList(allowedPrivateNetworks);

	if (isIPv4(ip)) {
		return isPublicIPv4(ip, allow);
	}

	if (isIPv6(ip)) {
		// WHATWG URL normaliza IPv6 (p. ej. "::ffff:127.0.0.1" -> "::ffff:7f00:1")
		const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);

		const embedded = embeddedIPv4(normalized);
		if (embedded != null) {
			return isPublicIPv4(embedded, allow);
		}

		// Forma embebida que no reconocemos: se bloquea
		if (
			normalized.startsWith("::ffff:") ||
			normalized.startsWith("64:ff9b::")
		) {
			return false;
		}

		if (blockedV6.check(normalized, "ipv6")) {
			return allow.v6.check(normalized, "ipv6");
		}
		return true;
	}

	return false;
}
