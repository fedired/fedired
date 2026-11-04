import * as http from "node:http";
import * as https from "node:https";
import type { LookupOptions } from "node:dns";
import { isIP } from "node:net";
import { URL } from "node:url";
import CacheableLookup from "cacheable-lookup";
import fetch, { type RequestRedirect } from "node-fetch";
import { HttpProxyAgent, HttpsProxyAgent } from "hpagent";
import { config } from "@/config.js";
import { isSafeUrl } from "backend-rs";
import { isPublicAddress } from "@/misc/ssrf-guard.js";

/** Máximo de redirecciones que seguimos nosotros (node-fetch usa 20 por defecto). */
const MAX_REDIRECTS = 20;
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];
/** Cabeceras que no deben viajar a otro origen al seguir una redirección. */
const CROSS_ORIGIN_STRIPPED_HEADERS = [
	"authorization",
	"cookie",
	"cookie2",
	"www-authenticate",
];

export async function getJson(
	url: string,
	accept = "application/json, */*",
	timeout = 10000,
	headers?: Record<string, string>,
) {
	const res = await getResponse({
		url,
		method: "GET",
		headers: Object.assign(
			{
				"User-Agent": config.userAgent,
				Accept: accept,
			},
			headers || {},
		),
		timeout,
	});

	return await res.json();
}

export async function getHtml(
	url: string,
	accept = "text/html, */*",
	timeout = 10000,
	headers?: Record<string, string>,
) {
	const res = await getResponse({
		url,
		method: "GET",
		headers: Object.assign(
			{
				"User-Agent": config.userAgent,
				Accept: accept,
			},
			headers || {},
		),
		timeout,
	});

	return await res.text();
}

export async function getResponse(args: {
	url: string;
	method: string;
	body?: string;
	headers: Record<string, string>;
	timeout?: number;
	redirect?: RequestRedirect;
}) {
	if (!isSafeUrl(args.url)) {
		throw new StatusError("Invalid URL", 400);
	}

	const timeout = args.timeout || 30 * 1000; // Increased from 10 seconds to 30 seconds

	const controller = new AbortController();
	setTimeout(() => {
		controller.abort();
	}, timeout * 6);

	let url = args.url;
	let method = args.method;
	let body = args.body;
	const headers: Record<string, string> = { ...args.headers };

	// Las redirecciones se siguen a mano (no con node-fetch) para validar cada salto:
	// node-fetch no pasa por el lookup hook cuando el destino es una IP literal.
	for (let redirects = 0; ; redirects++) {
		await assertPublicUrl(url);

		const res = await fetch(url, {
			method,
			headers,
			body,
			timeout,
			size: 10 * 1024 * 1024,
			agent: getAgentByUrl,
			signal: controller.signal,
			redirect: "manual",
		});

		const location = res.headers.get("location");
		const isRedirect =
			REDIRECT_STATUSES.includes(res.status) && location != null;

		if (isRedirect && args.redirect === "error") {
			throw new Error(
				"uri requested responds with a redirect, redirect mode is set to error",
			);
		}

		if (isRedirect && args.redirect !== "manual") {
			if (redirects >= MAX_REDIRECTS) {
				throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
			}

			// Drena el cuerpo de la redirección para liberar el socket
			res.body.resume();

			const next = new URL(location, url);
			if (!isSafeUrl(next.href)) {
				throw new StatusError("Invalid URL", 400);
			}

			if (next.origin !== new URL(url).origin) {
				for (const key of Object.keys(headers)) {
					if (CROSS_ORIGIN_STRIPPED_HEADERS.includes(key.toLowerCase())) {
						delete headers[key];
					}
				}
			}

			if (
				res.status === 303 ||
				((res.status === 301 || res.status === 302) && method === "POST")
			) {
				method = "GET";
				body = undefined;
			}

			url = next.href;
			continue;
		}

		if (
			args.redirect === "manual" &&
			[301, 302, 307, 308].includes(res.status)
		) {
			if (!isSafeUrl(res.url)) {
				throw new StatusError("Invalid URL", 400);
			}
			return res;
		}

		if (!res.ok) {
			throw new StatusError(
				`${res.status} ${res.statusText}`,
				res.status,
				res.statusText,
			);
		}

		return res;
	}
}

const cache = new CacheableLookup({
	maxTtl: 3600, // 1hours
	errorTtl: 30, // 30secs
	lookup: false, // nativeのdns.lookupにfallbackしない
});

/**
 * Resuelve un hostname con la caché compartida con el connect (mismo resultado que usará el socket).
 */
function resolveAll(hostname: string) {
	return cache.lookupAsync(hostname, { all: true });
}

function blockedAddressError(): Error {
	const err = new Error("Blocked private or reserved address") as Error & {
		code: string;
	};
	err.code = "ERR_SSRF_BLOCKED";
	return err;
}

/**
 * Validación previa de cada URL antes de enviarla.
 * Cubre IP literales (Node no hace lookup para ellas) y también rutas con proxy,
 * donde el connect lo hace el proxy y el lookup hook no se ejecuta.
 */
async function assertPublicUrl(url: string): Promise<void> {
	const hostname = new URL(url).hostname.replace(/^\[(.*)\]$/, "$1");

	if (isIP(hostname) !== 0) {
		if (!isPublicAddress(hostname, config.allowedPrivateNetworks)) {
			throw new StatusError("Blocked private or reserved address", 400);
		}
		return;
	}

	const addresses = await resolveAll(hostname);
	if (addresses.length === 0) {
		throw new StatusError(`Cannot resolve host ${hostname}`, 400);
	}
	for (const { address } of addresses) {
		if (!isPublicAddress(address, config.allowedPrivateNetworks)) {
			throw new StatusError("Blocked private or reserved address", 400);
		}
	}
}

/**
 * Lookup hook de los agentes: en el momento de conectar, rechaza el socket si
 * alguna dirección resuelta es privada. Esto cubre el rebinding de DNS, porque
 * el socket solo puede usar direcciones que pasaron este filtro.
 */
// Firma laxa a propósito: Node define varias sobrecargas de lookup (con y sin `all`)
// y el agente las llama con opciones que dependen de la versión de Node.
// biome-ignore lint/suspicious/noExplicitAny: sobrecargas de dns.lookup
const safeLookup = (hostname: string, options: any, callback: any) => {
	const opts = typeof options === "object" && options != null ? options : {};
	// Los tipos de LookupOptions de @types/node y de cacheable-lookup no son compatibles (family).
	const lookupOptions = { ...opts, all: true } as never;

	cache.lookupAsync(hostname, lookupOptions).then(
		(addresses) => {
			if (addresses.length === 0) {
				return callback(
					Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
						code: "ENOTFOUND",
					}),
				);
			}
			for (const { address } of addresses) {
				if (!isPublicAddress(address, config.allowedPrivateNetworks)) {
					return callback(blockedAddressError());
				}
			}
			if (opts.all) {
				return callback(null, [...addresses]);
			}
			return callback(null, addresses[0].address, addresses[0].family);
		},
		(err: NodeJS.ErrnoException) => callback(err),
	);
};

/**
 * Get http non-proxy agent
 */
const _http = new http.Agent({
	keepAlive: true,
	keepAliveMsecs: 30 * 1000,
	lookup: safeLookup,
	localAddress: config.outgoingAddress,
} as http.AgentOptions);

/**
 * Get https non-proxy agent
 */
const _https = new https.Agent({
	keepAlive: true,
	keepAliveMsecs: 30 * 1000,
	lookup: safeLookup,
	localAddress: config.outgoingAddress,
} as https.AgentOptions);

const maxSockets = Math.max(256, config.deliverJobConcurrency || 128);

/**
 * Get http proxy or non-proxy agent
 */
export const httpAgent = config.proxy
	? new HttpProxyAgent({
			keepAlive: true,
			keepAliveMsecs: 30 * 1000,
			maxSockets,
			maxFreeSockets: 256,
			scheduling: "lifo",
			proxy: config.proxy,
			localAddress: config.outgoingAddress,
		})
	: _http;

/**
 * Get https proxy or non-proxy agent
 */
export const httpsAgent = config.proxy
	? new HttpsProxyAgent({
			keepAlive: true,
			keepAliveMsecs: 30 * 1000,
			maxSockets,
			maxFreeSockets: 256,
			scheduling: "lifo",
			proxy: config.proxy,
			localAddress: config.outgoingAddress,
		})
	: _https;

/**
 * Get agent by URL
 * @param url URL
 * @param bypassProxy Allways bypass proxy
 */
export function getAgentByUrl(url: URL, bypassProxy = false) {
	if (bypassProxy || (config.proxyBypassHosts || []).includes(url.hostname)) {
		return url.protocol === "http:" ? _http : _https;
	} else {
		return url.protocol === "http:" ? httpAgent : httpsAgent;
	}
}

/**
 * Get agent by Hostname
 * @param hostname Hostname
 * @param bypassProxy Allways bypass proxy
 */
export function getAgentByHostname(hostname: string, bypassProxy = false) {
	if (bypassProxy || (config.proxyBypassHosts || []).includes(hostname)) {
		return {
			http: _http,
			https: _https,
		};
	} else {
		return {
			http: httpAgent,
			https: httpsAgent,
		};
	}
}

export class StatusError extends Error {
	public statusCode: number;
	public statusMessage?: string;
	public isClientError: boolean;

	constructor(message: string, statusCode: number, statusMessage?: string) {
		super(message);
		this.name = "StatusError";
		this.statusCode = statusCode;
		this.statusMessage = statusMessage;
		this.isClientError =
			typeof this.statusCode === "number" &&
			this.statusCode >= 400 &&
			this.statusCode < 500;
	}
}
