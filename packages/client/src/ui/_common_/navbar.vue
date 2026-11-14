<template>
	<header class="mvcprjjd sidebar" :class="{ iconOnly }">
		<div class="body">
			<div class="top">
				<MkA
					v-tooltip.noDelay.right="instanceName"
					class="brand"
					to="/"
					exact
				>
					<img
						class="logo"
						:src="instanceLogo"
						:alt="instanceName"
						@error="onLogoError"
					/>
					<span class="brand-text">{{ instanceName }}</span>
				</MkA>
			</div>
			<nav class="middle">
				<MkA
					v-click-anime
					v-tooltip.noDelay.right="i18n.ts._timelines.home"
					class="item _button index"
					active-class="active"
					to="/"
					exact
				>
					<i :class="icon('ph-house icon ph-fw')"></i
					><span class="text">{{ i18n.ts._timelines.home }}</span>
				</MkA>
				<template v-for="item in menu">
					<div v-if="item === '-'" class="divider"></div>
					<component
						:is="navbarItemDef[item].to ? 'MkA' : 'button'"
						v-else-if="
							navbarItemDef[item] &&
							navbarItemDef[item].show !== false
						"
						v-click-anime
						v-tooltip.noDelay.right="
							i18n.ts[navbarItemDef[item].title]
						"
						class="item _button"
						:class="[item, { active: navbarItemDef[item].active }]"
						active-class="active"
						:to="navbarItemDef[item].to"
						v-on="
							navbarItemDef[item].action
								? { click: navbarItemDef[item].action }
								: {}
						"
					>
						<i
							class="icon ph-fw ph-lg"
							:class="navbarItemDef[item].icon"
						></i
						><span class="text">{{
							i18n.ts[navbarItemDef[item].title]
						}}</span>
						<span
							v-if="navbarItemDef[item].indicated"
							class="indicator"
							><i class="icon ph-circle ph-fill"></i
						></span>
					</component>
				</template>
				<MkA
					v-click-anime
					v-tooltip.noDelay.right="i18n.ts.profile"
					class="item _button"
					active-class="active"
					:to="`/@${me.username}`"
				>
					<i :class="icon('ph-user icon ph-fw')"></i
					><span class="text">{{ i18n.ts.profile }}</span>
				</MkA>
				<div class="divider"></div>
				<MkA
					v-if="isModerator"
					v-click-anime
					v-tooltip.noDelay.right="i18n.ts.controlPanel"
					class="item _button"
					active-class="active"
					to="/admin"
				>
					<span
						v-if="
							thereIsUnresolvedAbuseReport ||
							noMaintainerInformation ||
							noBotProtection ||
							noEmailServer ||
							updateAvailable
						"
						class="indicator"
					></span
					><i :class="icon('ph-door icon ph-fw')"></i
					><span class="text">{{ i18n.ts.controlPanel }}</span>
				</MkA>
				<button
					v-click-anime
					v-tooltip.noDelay.right="i18n.ts.more"
					class="item _button"
					@click="more"
				>
					<i :class="icon('ph-dots-three-outline ph-dir icon ph-fw')"></i
					><span class="text">{{ i18n.ts.more }}</span>
					<span v-if="otherMenuItemIndicated" class="indicator"
						><i class="icon ph-circle ph-fill"></i
					></span>
				</button>
				<MkA
					v-click-anime
					v-tooltip.noDelay.right="i18n.ts.settings"
					class="item _button"
					active-class="active"
					to="/settings"
					exact
				>
					<i :class="icon('ph-gear icon ph-fw')"></i
					><span class="text">{{ i18n.ts.settings }}</span>
				</MkA>
			</nav>
			<div class="bottom">
				<button
					v-tooltip.noDelay.right="i18n.ts.toPost"
					class="item _button post"
					data-cy-open-post-form
					@click="os.post"
				>
					<i :class="icon('icon ph-pencil ph-fw ph-lg')"></i
					><span class="text">{{ i18n.ts.toPost }}</span>
				</button>
				<button
					v-click-anime
					v-tooltip.noDelay.right="`${i18n.ts.account}: @${me.username}`"
					class="item _button account"
					@click="openAccountMenu"
				>
					<MkAvatar :user="me" class="icon" disable-link />
					<span class="meta">
						<span class="name">{{ me.name || me.username }}</span>
						<span class="handle">@{{ me.username }}</span>
					</span>
					<i :class="icon('ph-dots-three more')"></i>
				</button>
			</div>
		</div>
	</header>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, ref, watch } from "vue";
import * as os from "@/os";
import { navbarItemDef } from "@/navbar";
import { openAccountMenu as openAccountMenu_ } from "@/account";
import { isAdmin, isModerator, me } from "@/me";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import { getInstanceInfo } from "@/instance";
import { instanceName, version } from "@/config";
import icon from "@/scripts/icon";

const instanceMeta = getInstanceInfo();
const fallbackLogo = "/static-assets/icons/192.png";
const instanceLogo = ref(
	instanceMeta.iconUrl ||
		(instanceMeta as { faviconUrl?: string | null }).faviconUrl ||
		fallbackLogo,
);
function onLogoError() {
	if (instanceLogo.value !== fallbackLogo) {
		instanceLogo.value = fallbackLogo;
	}
}

const isEmpty = (x: string | null) => x == null || x === "";

const iconOnly = ref(false);

const menu = computed(() => defaultStore.state.menu);
const otherMenuItemIndicated = computed(() => {
	for (const def in navbarItemDef) {
		if (menu.value.includes(def)) continue;
		if (navbarItemDef[def].indicated) return true;
	}
	return false;
});

const calcViewState = () => {
	// Keep labeled nav longer (Mastodon/Tangerine-style) until narrow widths
	iconOnly.value =
		window.innerWidth <= 900 || defaultStore.state.menuDisplay === "sideIcon";
};

calcViewState();

matchMedia("(max-inline-size: 900px)").onchange = (mql) => calcViewState();

watch(defaultStore.reactiveState.menuDisplay, () => {
	calcViewState();
});

const {
	maintainerName,
	maintainerEmail,
	disableRegistration,
	enableHcaptcha,
	enableRecaptcha,
	enableEmail,
} = getInstanceInfo();

const noMaintainerInformation =
	isEmpty(maintainerName) || isEmpty(maintainerEmail);
const noBotProtection =
	!disableRegistration && !enableHcaptcha && !enableRecaptcha;
const noEmailServer = !enableEmail;
const thereIsUnresolvedAbuseReport = ref(false);
const updateAvailable = ref(false);

if (isAdmin) {
	os.api("admin/abuse-user-reports", {
		state: "unresolved",
		limit: 1,
	}).then((reports) => {
		if (reports?.length > 0) thereIsUnresolvedAbuseReport.value = true;
	});
}

if (defaultStore.state.showAdminUpdates) {
	os.api("latest-version").then((res) => {
		updateAvailable.value = version < res?.latest_version;
	});
}

function openAccountMenu(ev: MouseEvent) {
	openAccountMenu_(
		{
			withExtraOperation: true,
		},
		ev,
	);
}

function more(ev: MouseEvent) {
	os.popup(
		defineAsyncComponent(() => import("@/components/MkLaunchPad.vue")),
		{
			src: ev.currentTarget ?? ev.target,
		},
		{},
		"closed",
	);
}
</script>

<style lang="scss" scoped>
.mvcprjjd {
	$nav-width: 250px;
	$nav-icon-only-width: 80px;
	flex: 0 0 $nav-width;
	inline-size: $nav-width;
	box-sizing: border-box;

	> .body {
		position: sticky;
		inset-block-start: 0;
		inline-size: $nav-icon-only-width;
			block-size: 100dvb;
		box-sizing: border-box;
		overflow: auto;
		overflow-x: clip;
		overflow-inline: clip;
		contain: strict;
		display: flex;
		flex-direction: column;
		
		@supports not (overflow-inline: clip) {
			.vertical-lr &, .vertical-rl & {
				overflow-x: auto;
				overflow-y: clip;
			}
		}

		#firefish_app > :not(.wallpaper) & {
			background: var(--navBg);
		}
		#firefish_app > .wallpaper:not(.centered) & {
			border-inline-end: 1px solid var(--divider);
		}
	}

	&:not(.iconOnly) {
		> .body {
			margin-inline-start: -200px;
			padding-inline-start: 200px;
			box-sizing: content-box;
			inline-size: $nav-width;

			> .top {
				position: relative;
				z-index: 1;
				padding-block: 1.25rem 0.5rem;
				padding-inline: 0;

				> .brand {
					display: flex;
					align-items: center;
					justify-content: flex-start;
					gap: 10px;
					padding-inline: 22px;
					margin-block-end: 0.75rem;
					color: var(--fg);
					text-decoration: none;

					> .logo {
						inline-size: 36px;
						block-size: 36px;
						border-radius: 10px;
						object-fit: contain;
						background: var(--panel);
					}

					> .brand-text {
						font-size: 1.25em;
						font-weight: 800;
						letter-spacing: -0.02em;
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
					}
				}
			}

			> .bottom {
				padding-block: 20px;
				padding-inline: 0;

				> .post {
					position: relative;
					inline-size: calc(100% - 32px);
					margin-inline: 16px;
					block-size: 48px;
					color: var(--fgOnAccent);
					font-weight: 800;
					text-align: center;
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 8px;

					&:before {
						content: "";
						display: block;
						inline-size: 100%;
						block-size: 100%;
						position: absolute;
						inset: 0;
						border-radius: 999px;
						background: var(--accent);
					}

					&:hover,
					&:focus-within,
					&.active {
						&:before {
							filter: brightness(1.08);
							transition: all 0.2s ease;
						}
					}

					> .icon,
					> .text {
						position: relative;
						color: var(--fgOnAccent, #fff);
						inset-inline-start: 0;
					}

					> .text {
						margin-inline-start: 0;
						font-size: 1.05em;
					}
				}

				> .instance {
					position: relative;
					display: block;
					text-align: center;
					inline-size: 100%;

					> .icon {
						display: inline-block;
						inline-size: 32px !important;
						aspect-ratio: 1;
						margin-block-start: 1rem;
					}
				}

				> .account {
					position: relative;
					display: flex;
					align-items: center;
					inline-size: calc(100% - 16px);
					margin: 0.75rem 8px 0;
					padding: 8px 10px;
					color: var(--navFg);
					border-radius: 999px;
					gap: 10px;
					text-align: start;

					> .icon {
						inline-size: 40px;
						aspect-ratio: 1;
						border-radius: 50%;
						flex-shrink: 0;
					}

					> .meta {
						display: flex;
						flex-direction: column;
						min-inline-size: 0;
						flex: 1;
						line-height: 1.2;

						> .name {
							font-weight: 700;
							font-size: 0.95em;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}

						> .handle {
							font-size: 0.85em;
							opacity: 0.65;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}
					}

					> .more {
						opacity: 0.7;
						flex-shrink: 0;
					}

					&:hover {
						background: var(--accentedBg);
						color: var(--fg);
					}
				}
			}

			> .middle {
				flex: 1;
				overflow: auto;

				> .divider {
					margin-block: 12px;
					margin-inline: 16px;
					border-block-start: solid 0.5px var(--divider);
				}

				> .item {
					position: relative;
					display: flex;
					align-items: center;
					padding-inline-start: 18px;
					margin-inline: 8px;
					line-height: 3rem;
					margin-block-end: 0.15rem;
					white-space: nowrap;
					inline-size: calc(100% - 16px);
					text-align: start;
					box-sizing: border-box;
					color: var(--navFg);
					border-radius: 999px;

					> .icon {
						position: relative;
						inline-size: 28px;
						margin-inline-end: 14px;
						font-size: 1.35em;
					}

					> .indicator {
						position: absolute;
						inset-block-start: 6px;
						inset-inline-start: 28px;
						color: var(--navIndicator);
						font-size: 8px;
						animation: blink 1s infinite;
					}

					> .text {
						position: relative;
						font-size: 1.15em;
						font-weight: 500;
						overflow: hidden;
						text-overflow: ellipsis;
					}

					&.active > .text {
						font-weight: 800;
					}

					&:hover,
					&:focus-within {
						text-decoration: none;
						color: var(--fg);
						background: var(--listItemHoverBg, var(--accentedBg));
					}

					&.active {
						color: var(--fg);
						font-weight: 800;
					}

					&:hover,
					&:focus-within,
					&.active {
						&:before {
							display: none;
						}
					}

					&.active {
						background: transparent;
					}
				}
			}
		}
	}

	&.iconOnly {
		flex: 0 0 $nav-icon-only-width;
		inline-size: $nav-icon-only-width;

		> .body {
			inline-size: $nav-icon-only-width;

			> .top {
				padding-block: 1.25rem 0.5rem;
				padding-inline: 0;

				> .brand {
					display: flex;
					justify-content: center;
					padding-inline: 0;

					> .logo {
						inline-size: 36px;
						block-size: 36px;
						border-radius: 10px;
						object-fit: contain;
					}

					> .brand-text {
						display: none;
					}
				}
			}

			> .bottom {
				padding-block: 20px;
				padding-inline: 0;

				> .post {
					display: block;
					position: relative;
					inline-size: 100%;
					block-size: 52px;
					margin-block-end: 16px;
					text-align: center;

					&:before {
						content: "";
						display: block;
						position: absolute;
						inset: 0;
						margin: auto;
						inline-size: 52px;
						aspect-ratio: 1/1;
						border-radius: 100%;
						background: linear-gradient(
							var(--gradient-to-inline-end),
							var(--buttonGradateA),
							var(--buttonGradateB)
						);
					}

					&:hover,
					&:focus-within,
					&.active {
						&:before {
							background: var(--accentLighten);
							transition: all 0.4s ease;
						}
					}

					> .icon {
						position: relative;
						color: var(--fgOnAccent);
					}

					> .text {
						display: none;
					}
				}

				> .account {
					display: flex;
					justify-content: center;
					align-items: center;
					margin-block-start: 0.75rem;
					padding-inline: 0;
					inline-size: 100%;

					> .icon {
						inline-size: 36px;
						aspect-ratio: 1;
						border-radius: 50%;
					}

					> .meta,
					> .more {
						display: none;
					}
				}
			}

			> .middle {
				flex: 1;
				overflow: auto;

				> .divider {
					margin-block: 8px;
					margin-inline: auto;
					inline-size: calc(100% - 32px);
					border-block-start: solid 0.5px var(--divider);
				}

				> .item {
					display: block;
					position: relative;
					padding-block: 1.1rem;
					padding-inline: 0;
					margin-block-end: 0.2rem;
					inline-size: 100%;
					text-align: center;

					> .icon {
						display: block;
						margin-block: 0;
						margin-inline: auto;
						opacity: 0.7;
						transform: translateY(0em);
					}

					> .text {
						display: none;
					}

					> .indicator {
						position: absolute;
						inset-block-start: 6px;
						inset-inline-start: 24px;
						color: var(--navIndicator);
						font-size: 8px;
						animation: blink 1s infinite;
					}

					&:hover,
					&:focus-within,
					&.active {
						text-decoration: none;
						color: var(--accent);
						transition: all 0.4s ease;

						&:before {
							content: "";
							display: block;
							block-size: 100%;
							aspect-ratio: 1;
							margin: auto;
							position: absolute;
							inset: 0;
							border-radius: 999px;
							background: var(--accentedBg);
						}

						> .icon,
						> .text {
							opacity: 1;
						}
					}
				}
			}
		}
	}

	.item {
		outline: none;
		&:focus-visible:before {
			outline: auto;
		}
	}
}
</style>
