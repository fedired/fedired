import { redisClient } from "@/db/redis.js";
import Logger from "@/services/logger.js";

const logger = new Logger("inbox-rate-limit");

/** Tamaño de la ventana fija (segundos). */
const WINDOW_SECONDS = 60;

/** Actividades verificadas por host y por ventana. */
export const INBOX_MAX_PER_HOST_PER_WINDOW = 1200;

/**
 * Cuenta una actividad verificada del host en la ventana actual.
 *
 * Se llama solo después de verificar la firma: la keyId sin verificar se puede
 * falsificar, y contarla permitiría agotar la cuota de un host legítimo.
 *
 * Si Redis falla, se permite la actividad (fail-open) para no cortar la federación
 * por un problema de caché.
 *
 * @returns `true` si la actividad está dentro de la cuota
 */
export async function consumeInboxQuota(
	host: string,
	limit = INBOX_MAX_PER_HOST_PER_WINDOW,
): Promise<boolean> {
	const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
	const key = `inbox-rl:${host}:${window}`;

	try {
		const count = await redisClient.incr(key);
		if (count === 1) {
			// Deja caducar la clave justo después de su ventana
			await redisClient.expire(key, WINDOW_SECONDS * 2);
		}
		return count <= limit;
	} catch (e) {
		logger.warn(`rate limit check failed for ${host}, allowing: ${e}`);
		return true;
	}
}
