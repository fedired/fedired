/*
 * Notification manager for SW
 */
import type { BadgeNames, PushNotificationDataMap } from "@/types";
import { cli } from "@/scripts/operations";
import { getAccountFromId } from "@/scripts/get-account-from-id";
import { swLang } from "@/scripts/lang";
import { getUserName } from "@/scripts/get-user-name";

const swScope = self as unknown as ServiceWorkerGlobalScope;

// `actions` y `renotify` existen en el navegador pero no en los tipos de lib.dom
type SwNotificationOptions = NotificationOptions & {
	actions?: { action: string; title: string }[];
	renotify?: boolean;
};

export const closeNotificationsByTags = async (tags: string[]): Promise<void> => {
	for (const n of (
		await Promise.all(
			tags.map((tag) => swScope.registration.getNotifications({ tag })),
		)
	).flat()) {
		n.close();
	}
};

const iconUrl = (name: BadgeNames): string =>
	`/static-assets/notification-badges/${name}.png`;
/* How to add a new badge:
 * 1. Find the icon from https://phosphoricons.com/
 * 2. Choose #000000 as the color, 96px as the size, and bold as the weight
 * 3. Move icon-name.png to packages/backend/assets/notification-badges/
 * 4. Add 'icon-name' to BadgeNames
 * 5. Add `badge: iconUrl('icon-name'),`
 */

export async function createNotification<
	K extends keyof PushNotificationDataMap,
>(data: PushNotificationDataMap[K]): Promise<void> {
	let n: [string, SwNotificationOptions] | null = null;
	try {
		n = await composeNotification(data);
	} catch (err) {
		// Por ejemplo, si no se pudo cargar el idioma: nunca dejar el push sin notificación
		console.error("Could not compose notification", err);
	}

	if (n) {
		const [title, options] = n;
		return swScope.registration.showNotification(title, options as NotificationOptions);
	} else {
		console.error("Could not compose notification", data);
		return createEmptyNotification();
	}
}

async function composeNotification(
	data: PushNotificationDataMap[keyof PushNotificationDataMap],
): Promise<[string, SwNotificationOptions] | null> {
	const i18n = await (swLang.i18n ?? swLang.fetchLocale());
	const { t } = i18n;
	switch (data.type) {
		/*
		case 'driveFileCreated': // TODO (Server Side)
			return [t('_notification.fileUploaded'), {
				body: body.name,
				icon: body.url,
				data
			}];
		*/
		case "notification":
			switch (data.body.type) {
				case "follow": {
					// users/showの型定義をswos.apiへ当てはめるのが困難なのでapiFetch.requestを直接使用
					const account = await getAccountFromId(data.userId);
					if (!account) return null;
					const userDetail = await cli.request(
						"users/show",
						{ userId: data.body.userId },
						account.token,
					);
					return [
						t("_notification.youWereFollowed"),
						{
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl ?? undefined,
							badge: iconUrl("user-plus"),
							data,
							actions: userDetail.isFollowing
								? []
								: [
										{
											action: "follow",
											title: t("_notification._actions.followBack"),
										},
									],
						},
					];
				}

				case "mention":
					return [
						t("_notification.youGotMention", {
							name: getUserName(data.body.user),
						}),
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl ?? undefined,
							badge: iconUrl("at"),
							data,
							actions: [
								{
									action: "reply",
									title: t("_notification._actions.reply"),
								},
							],
						},
					];

				case "reply":
					return [
						t("_notification.youGotReply", {
							name: getUserName(data.body.user),
						}),
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl ?? undefined,
							badge: iconUrl("reply"),
							data,
							actions: [
								{
									action: "reply",
									title: t("_notification._actions.reply"),
								},
							],
						},
					];

				case "renote":
					return [
						t("_notification.youRenoted", {
							name: getUserName(data.body.user),
						}),
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl ?? undefined,
							badge: iconUrl("boost"),
							data,
							actions: [
								{
									action: "showUser",
									title: getUserName(data.body.user),
								},
							],
						},
					];

				case "quote":
					return [
						t("_notification.youGotQuote", {
							name: getUserName(data.body.user),
						}),
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl ?? undefined,
							badge: iconUrl("quote"),
							data,
							actions: [
								{
									action: "reply",
									title: t("_notification._actions.reply"),
								},
								...(data.body.note.visibility === "public" ||
								data.body.note.visibility === "home"
									? [
											{
												action: "renote",
												title: t("_notification._actions.renote"),
											},
										]
									: []),
							],
						},
					];

				case "reaction": {
					let reaction = data.body.reaction;
					let badge: string | undefined;

					if (reaction.startsWith(":")) {
						// カスタム絵文字の場合
						const name = reaction.substring(1, reaction.length - 1);
						const badgeUrl = new URL(`/emoji/${name}.webp`, origin);
						badgeUrl.searchParams.set("badge", "1");
						badge = badgeUrl.href;
						reaction = name.split("@")[0];
					} else {
						badge = iconUrl("reaction");
					}

					if (
						await fetch(badge)
							.then((res) => res.status !== 200)
							.catch(() => true)
					) {
						badge = iconUrl("plus");
					}

					return [
						`${reaction} ${getUserName(data.body.user)}`,
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl ?? undefined,
							badge,
							data,
							actions: [
								{
									action: "showUser",
									title: getUserName(data.body.user),
								},
							],
						},
					];
				}

				case "pollVote":
					return [
						t("_notification.youGotPoll", {
							name: getUserName(data.body.user),
						}),
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl ?? undefined,
							badge: iconUrl("poll"),
							data,
						},
					];

				case "pollEnded":
					return [
						t("_notification.pollEnded"),
						{
							body: data.body.note.text || "",
							badge: iconUrl("clipboard-check"),
							data,
						},
					];

				case "receiveFollowRequest":
					return [
						t("_notification.youReceivedFollowRequest"),
						{
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl ?? undefined,
							badge: iconUrl("clock"),
							data,
							actions: [
								{
									action: "accept",
									title: t("accept"),
								},
								{
									action: "reject",
									title: t("reject"),
								},
							],
						},
					];

				case "followRequestAccepted":
					return [
						t("_notification.yourFollowRequestAccepted"),
						{
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl ?? undefined,
							badge: iconUrl("check"),
							data,
						},
					];

				case "groupInvited":
					return [
						t("_notification.youWereInvitedToGroup", {
							userName: getUserName(data.body.user),
						}),
						{
							body: data.body.invitation.group.name,
							badge: iconUrl("id-card"),
							data,
							actions: [
								{
									action: "accept",
									title: t("accept"),
								},
								{
									action: "reject",
									title: t("reject"),
								},
							],
						},
					];

				case "app":
					return [
						data.body.header || data.body.body,
						{
							body: data.body.header && data.body.body,
							icon: data.body.icon,
							data,
						},
					];

				default:
					return null;
			}
		case "unreadMessagingMessage":
			if (data.body.groupId === null) {
				return [
					t("_notification.youGotMessagingMessageFromUser", {
						name: getUserName(data.body.user),
					}),
					{
						icon: data.body.user.avatarUrl ?? undefined,
						badge: iconUrl("comments"),
						tag: `messaging:user:${data.body.userId}`,
						data,
						renotify: true,
					},
				];
			}
			return [
				t("_notification.youGotMessagingMessageFromGroup", {
					name: data.body.group?.name ?? "",
				}),
				{
					icon: data.body.user.avatarUrl ?? undefined,
					badge: iconUrl("comments"),
					tag: `messaging:group:${data.body.groupId}`,
					data,
					renotify: true,
				},
			];
		default:
			return null;
	}
}

/**
 * Muestra una notificación silenciosa. Chrome exige que cada push muestre una
 * notificación (userVisibleOnly); si no, muestra una genérica y, si se repite, revoca el permiso.
 * Por eso esta función siempre debe mostrar algo, aunque falle la carga del idioma.
 */
export async function createEmptyNotification(): Promise<void> {
	let title = "Fedired";
	try {
		const i18n = await (swLang.i18n ?? swLang.fetchLocale());
		title = i18n.t("_notification.emptyPushNotificationMessage");
	} catch (err) {
		console.error("Could not load the SW locale for the empty notification", err);
	}

	await swScope.registration.showNotification(title, {
		silent: true,
		badge: iconUrl("null"),
		tag: "read_notification",
	});

	setTimeout(async () => {
		for (const n of [
			...(await swScope.registration.getNotifications({
				tag: "user_visible_auto_notification",
			})),
			...(await swScope.registration.getNotifications({
				tag: "read_notification",
			})),
		]) {
			n.close();
		}
	}, 1000);
}
