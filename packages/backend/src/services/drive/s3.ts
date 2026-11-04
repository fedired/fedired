import type http from "node:http";
import type https from "node:https";
import { URL } from "node:url";
import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { Meta } from "@/models/entities/meta.js";
import { getAgentByUrl } from "@/misc/fetch.js";
import { inspect } from "node:util";

export function getS3(meta: Meta) {
	const u =
		meta.objectStorageEndpoint != null
			? `${meta.objectStorageUseSsl ? "https://" : "http://"}${
					meta.objectStorageEndpoint
				}`
			: `${meta.objectStorageUseSsl ? "https://" : "http://"}example.net`;

	try {
		const url = new URL(u);
		const agent = getAgentByUrl(url, !meta.objectStorageUseProxy);

		return new S3Client({
			// SDK v3 needs a full URL (with protocol) as endpoint. Omit it for AWS.
			endpoint: meta.objectStorageEndpoint ? u : undefined,
			credentials: {
				accessKeyId: meta.objectStorageAccessKey!,
				secretAccessKey: meta.objectStorageSecretKey!,
			},
			// SDK v2 defaulted to us-east-1 when no region was set; keep that behaviour.
			region: meta.objectStorageRegion || "us-east-1",
			forcePathStyle: !meta.objectStorageEndpoint // AWS with endPoint omitted
				? false
				: meta.objectStorageS3ForcePathStyle,
			requestHandler:
				url.protocol === "http:"
					? new NodeHttpHandler({ httpAgent: agent as http.Agent })
					: new NodeHttpHandler({ httpsAgent: agent as https.Agent }),
		});
	} catch (e) {
		throw new Error(
			`Failed to construct S3 client, assembled S3 URL: ${u}\n${inspect(e)}`,
		);
	}
}
