import { URL } from "node:url";
import type Bull from "bull";
import httpSignature from "@peertube/http-signature";
import perform from "@/remote/activitypub/perform.js";
import Logger from "@/services/logger.js";
import { registerOrFetchInstanceDoc } from "@/services/register-or-fetch-instance-doc.js";
import { Instances, UserPublickeys } from "@/models/index.js";
import {
	extractHost,
	isAllowedServer,
	isBlockedServer,
	toPuny,
} from "backend-rs";
import { getApId } from "@/remote/activitypub/type.js";
import { fetchInstanceMetadata } from "@/services/fetch-instance-metadata.js";
import type { InboxJobData } from "../types.js";
import DbResolver from "@/remote/activitypub/db-resolver.js";
import { resolvePerson } from "@/remote/activitypub/models/person.js";
import { LdSignature } from "@/remote/activitypub/misc/ld-signature.js";
import { StatusError } from "@/misc/fetch.js";
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import type { UserPublickey } from "@/models/entities/user-publickey.js";
import { verifySignature } from "@/remote/activitypub/check-fetch.js";
import { inspect } from "node:util";
import { consumeInboxQuota } from "@/misc/inbox-rate-limit.js";

const logger = new Logger("inbox");

type AuthUser = {
	user: CacheableRemoteUser;
	key: UserPublickey | null;
};

/** Host de una URI, o null si no es válida (no lanza). */
function safeHost(uri: string): string | null {
	try {
		return extractHost(uri);
	} catch {
		return null;
	}
}

/**
 * Usuario remoto ya conocido en la BD para un actor, sin tocar la red.
 */
async function getKnownAuthUser(
	dbResolver: DbResolver,
	actorUri: string,
): Promise<AuthUser | null> {
	const user = await dbResolver.getUserFromApId(actorUri);
	if (user == null || user.host == null) return null;

	const key = await UserPublickeys.findOneBy({ userId: user.id });
	return { user: user as CacheableRemoteUser, key };
}

// Processing when an activity arrives in the user's inbox
export default async (job: Bull.Job<InboxJobData>): Promise<string> => {
	const signature = job.data.signature; // HTTP-signature
	let activity = job.data.activity;

	//#region Log
	const info = Object.assign({}, activity) as any;
	info["@context"] = undefined;
	logger.debug(JSON.stringify(info, null, 2));

	if (!signature?.keyId) {
		const err = `Invalid signature: ${signature}`;
		job.moveToFailed({ message: err });
		return err;
	}
	//#endregion
	const host = toPuny(new URL(signature.keyId).hostname);

	// interrupt if blocked
	if (await isBlockedServer(host)) {
		return `Blocked request: ${host}`;
	}

	// only whitelisted instances in private mode
	if (!isAllowedServer(host)) {
		return `Blocked request: ${host}`;
	}

	const keyIdLower = signature.keyId.toLowerCase();
	if (keyIdLower.startsWith("acct:")) {
		return `Old keyId is no longer supported. ${keyIdLower}`;
	}

	let actorUri: string;
	try {
		actorUri = getApId(activity.actor);
	} catch {
		return `skip: invalid activity.actor`;
	}
	const actorHost = safeHost(actorUri);

	const dbResolver = new DbResolver();

	// HTTP-Signature keyId from DB
	let authUser: AuthUser | null = await dbResolver.getAuthUserFromKeyId(
		signature.keyId,
	);

	// keyIdでわからなければ、activity.actorを元にDBから取得 || activity.actorを元にリモートから取得
	// ただし actor のホストが keyId のホストと一致しない場合 (リレー等) は、署名検証の前に
	// actor をリモートから取得しない。DB にある場合のみ使い、そうでなければ LD-Signature に任せる。
	if (authUser == null) {
		if (actorHost === host) {
			try {
				authUser = await dbResolver.getAuthUserFromApId(actorUri);
			} catch (e) {
				// Skip if target is 4xx
				if (e instanceof StatusError) {
					if (!e.isRetryable) {
						return `skip: Ignored deleted actors on both ends ${activity.actor} - ${e.statusCode}`;
					}
					throw new Error(`Error in actor ${activity.actor}\n${inspect(e)}`);
				}
			}
		} else {
			authUser = await getKnownAuthUser(dbResolver, actorUri);
		}
	}

	// publicKey がなくても終了
	if (authUser != null && authUser.key == null) {
		return "skip: failed to resolve user publicKey";
	}

	// HTTP-Signatureの検証
	let httpSignatureValidated = false;
	if (authUser?.key != null) {
		httpSignatureValidated = httpSignature.verifySignature(
			signature,
			authUser.key.keyPem,
		);

		// If signature validation failed, try refetching the actor
		if (!httpSignatureValidated) {
			authUser.key = await dbResolver.refetchPublicKeyForApId(authUser.user);

			if (authUser.key == null) {
				return "skip: failed to re-resolve user publicKey";
			}

			httpSignatureValidated = httpSignature.verifySignature(
				signature,
				authUser.key.keyPem,
			);
		}

		if (httpSignatureValidated) {
			if (!verifySignature(signature, authUser.key)) {
				return "skip: Invalid HTTP signature";
			}
		}
	}

	// また、signatureのsignerは、activity.actorと一致する必要がある
	if (!httpSignatureValidated || authUser?.user.uri !== activity.actor) {
		// 一致しなくても、でもLD-Signatureがありそうならそっちも見る
		if (activity.signature) {
			if (activity.signature.type !== "RsaSignature2017") {
				return `skip: unsupported LD-signature type ${activity.signature.type}`;
			}

			// activity.signature.creator: https://example.oom/users/user#main-key
			// みたいになっててUserを引っ張れば公開キーも入ることを期待する
			const creator = activity.signature.creator;

			// creator はこの後、署名検証の前に fetch する。そのため creator のホストは
			// activity.actor のホストと一致している必要がある (任意の URL を取得させない)。
			if (
				typeof creator !== "string" ||
				actorHost == null ||
				safeHost(creator) !== actorHost
			) {
				return "skip: LD-Signature creator host does not match activity.actor";
			}

			const candicate = creator.replace(/#.*/, "");
			await resolvePerson(candicate).catch(() => null);

			// keyIdからLD-Signatureのユーザーを取得
			authUser = await dbResolver.getAuthUserFromKeyId(creator);
			if (authUser == null) {
				return "skip: LD-Signatureのユーザーが取得できませんでした";
			}

			if (authUser.key == null) {
				return "skip: LD-SignatureのユーザーはpublicKeyを持っていませんでした";
			}

			// LD-Signature検証
			const ldSignature = new LdSignature();
			const verified = await ldSignature
				.verifyRsaSignature2017(activity, authUser.key.keyPem)
				.catch(() => false);
			if (!verified) {
				return "skip: LD-Signatureの検証に失敗しました";
			}

			activity = await ldSignature.compactToWellKnown(activity);

			// もう一度actorチェック
			if (authUser.user.uri !== activity.actor) {
				return `skip: LD-Signature user(${authUser.user.uri}) !== activity.actor(${activity.actor})`;
			}

			// ブロックしてたら中断
			const ldHost = extractHost(authUser.user.uri);
			if (await isBlockedServer(ldHost)) {
				return `Blocked request: ${ldHost}`;
			}
		} else {
			return `skip: http-signature verification failed and no LD-Signature. keyId=${signature.keyId}`;
		}
	}

	// ここまでで署名者(authUser)が確定している
	if (authUser == null) {
		return "skip: failed to resolve user";
	}

	// activity.idがあればホストが署名者のホストであることを確認する
	if (typeof activity.id === "string") {
		const signerHost = extractHost(authUser.user.uri!);
		const activityIdHost = extractHost(activity.id);
		if (signerHost !== activityIdHost) {
			return `skip: signerHost(${signerHost}) !== activity.id host(${activityIdHost}`;
		}
	}

	// 署名が検証された actor のホストごとにレート制限 (未検証の keyId は偽装できるため対象外)
	const quotaHost = extractHost(authUser.user.uri!);
	if (!(await consumeInboxQuota(quotaHost))) {
		return `skip: rate limited ${quotaHost}`;
	}

	// Update stats
	registerOrFetchInstanceDoc(authUser.user.host).then((i) => {
		Instances.update(i.id, {
			latestRequestReceivedAt: new Date(),
			lastCommunicatedAt: new Date(),
			isNotResponding: false,
		});

		fetchInstanceMetadata(i);
	});

	// アクティビティを処理
	await perform(authUser.user, activity);
	return "ok";
};
