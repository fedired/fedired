<template>
	<aside class="mastodon-rail" aria-label="Sidebar">
		<button type="button" class="search _button" @click="openSearch">
			<span class="placeholder">{{ i18n.ts.search }}</span>
			<i :class="icon('ph-magnifying-glass')"></i>
		</button>

		<div class="compose _panel">
			<div class="compose-label">
				{{ i18n.ts._postForm._placeholders.a }}
			</div>
			<XPostForm :fixed="true" :autofocus="false" />
		</div>

		<div class="trends _panel">
			<header># {{ i18n.ts._widgets.trends }}</header>
			<XTrends :widget="{ id: 'rail-trends', data: { showHeader: false } }" />
		</div>
	</aside>
</template>

<script lang="ts" setup>
import { defineAsyncComponent } from "vue";
import XPostForm from "@/components/MkPostForm.vue";
import { i18n } from "@/i18n";
import { search } from "@/scripts/search";
import icon from "@/scripts/icon";

const XTrends = defineAsyncComponent(() => import("@/widgets/trends.vue"));

function openSearch() {
	search();
}
</script>

<style lang="scss" scoped>
.mastodon-rail {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding-block: 16px;
	inline-size: 320px;
	box-sizing: border-box;

	> .search {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		border-radius: 999px;
		background: var(--buttonBg);
		border: 1px solid var(--inputBorder);
		color: var(--fg);
		text-align: start;
		font-size: 0.95em;

		> .placeholder {
			opacity: 0.65;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&:hover,
		&:focus-visible {
			border-color: var(--accent);
			background: color-mix(in srgb, var(--accent) 10%, var(--buttonBg));
		}
	}

	> .compose {
		padding: 12px;
		border-radius: 16px;
		overflow: clip;

		> .compose-label {
			font-size: 0.85em;
			opacity: 0.6;
			margin-block-end: 8px;
			padding-inline: 4px;
		}
	}

	> .trends {
		padding: 12px 8px 4px;
		border-radius: 16px;

		> header {
			font-weight: 700;
			font-size: 1.05em;
			margin-block-end: 4px;
			padding-inline: 8px;
		}

		:deep(.mkw-trends) {
			background: transparent !important;
			box-shadow: none !important;
		}
	}
}
</style>
