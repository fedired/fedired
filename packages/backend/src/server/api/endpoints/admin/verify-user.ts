import define from "@/server/api/define.js";
import { Users } from "@/models/index.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const user = await Users.findOneBy({ id: ps.userId });

	if (user == null) {
		throw new Error("user not found");
	}

	if (user.host != null) {
		throw new Error("only local users can be verified");
	}

	await Users.update(user.id, {
		isVerified: true,
	});
});
