/**
 * API Server
 */

import Koa from "koa";
import Router from "@koa/router";
import multer from "@koa/multer";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import { setupMastodonApi } from "./mastodon/index.js";
import { AccessTokens, Users } from "@/models/index.js";
import { config } from "@/config.js";
import endpoints from "./endpoints.js";
import compatibility from "./compatibility.js";
import handler from "./api-handler.js";
import signup from "./private/signup.js";
import signin from "./private/signin.js";
import signupPending from "./private/signup-pending.js";
import verifyEmail from "./private/verify-email.js";

// Init app
const app = new Koa();

// Error handling middleware to prevent connection resets and 502 Bad Gateway.
// Siempre responder JSON: el cliente (upload / cropper) hace response.json()
// y si Caddy/Node devuelve texto "Internal Server Error" rompe con
// Unexpected token 'I'.
app.use(async (ctx, next) => {
	try {
		await next();
	} catch (err: any) {
		console.error("API Error caught by top-level middleware:", err);
		const isMulterLimit =
			err?.code === "LIMIT_FILE_SIZE" || err?.code === "LIMIT_UNEXPECTED_FILE";
		ctx.status = isMulterLimit
			? 413
			: err.status || err.statusCode || 500;
		ctx.type = "application/json";
		ctx.body = {
			error: {
				message: isMulterLimit
					? "File too large."
					: err.message || "Internal server error",
				code: err.code || "INTERNAL_ERROR",
				id: isMulterLimit
					? "d08dbc37-a6a9-463a-8c47-96c32ab5f064"
					: "5d37dbcb-891e-41ca-a3d6-e690c97775ac",
				kind: isMulterLimit ? "client" : "server",
			},
		};
	}
});

app.use(
	cors({
		origin: "*",
	}),
);

// No caching
app.use(async (ctx, next) => {
	ctx.set("Cache-Control", "private, max-age=0, must-revalidate");
	await next();
});

// Init router
const router = new Router();
const mastoRouter = new Router();
const mastoFileRouter = new Router();
const errorRouter = new Router();

// Init multer instance
const upload = multer({
	storage: multer.diskStorage({}),
	limits: {
		fileSize: config.maxFileSize,
		files: 1,
	},
});

router.use(
	bodyParser({
		// リクエストが multipart/form-data でない限りはJSONだと見なす
		detectJSON: (ctx) =>
			!(
				ctx.is("multipart/form-data") ||
				ctx.is("application/x-www-form-urlencoded")
			),
	}),
);

setupMastodonApi(mastoRouter);

/**
 * Register endpoint handlers
 */
for (const endpoint of [...endpoints, ...compatibility]) {
	if (endpoint.meta.requireFile) {
		router.post(
			`/${endpoint.name}`,
			upload.single("file"),
			handler.bind(null, endpoint),
		);
	} else {
		// 後方互換性のため
		if (endpoint.name.includes("-")) {
			router.post(
				`/${endpoint.name.replace(/-/g, "_")}`,
				handler.bind(null, endpoint),
			);

			if (endpoint.meta.allowGet) {
				router.get(
					`/${endpoint.name.replace(/-/g, "_")}`,
					handler.bind(null, endpoint),
				);
			} else {
				router.get(`/${endpoint.name.replace(/-/g, "_")}`, async (ctx) => {
					ctx.status = 405;
				});
			}
		}

		router.post(`/${endpoint.name}`, handler.bind(null, endpoint));

		if (endpoint.meta.allowGet) {
			router.get(`/${endpoint.name}`, handler.bind(null, endpoint));
		} else {
			router.get(`/${endpoint.name}`, async (ctx) => {
				ctx.status = 405;
			});
		}
	}
}

router.post("/signup", signup);
router.post("/signin", signin);
router.post("/signup-pending", signupPending);
router.post("/verify-email", verifyEmail);

router.post("/miauth/:session/check", async (ctx) => {
	const token = await AccessTokens.findOneBy({
		session: ctx.params.session,
	});

	if (token?.session != null && !token.fetched) {
		AccessTokens.update(token.id, {
			fetched: true,
		});

		ctx.body = {
			ok: true,
			token: token.token,
			user: await Users.pack(token.userId, null, { detail: true }),
		};
	} else {
		ctx.body = {
			ok: false,
		};
	}
});

// Return 404 for unknown API
errorRouter.all("(.*)", async (ctx) => {
	ctx.status = 404;
});

// Register router
app.use(mastoFileRouter.routes());
app.use(mastoRouter.routes());
app.use(mastoRouter.allowedMethods());
app.use(router.routes());
app.use(errorRouter.routes());

export default app;
