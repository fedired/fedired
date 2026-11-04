<template>
	<div>
		<MkStickyContainer>
			<template #header
				><MkPageHeader
					:actions="headerActions"
					:tabs="headerTabs"
					:display-back-button="true"
			/></template>
			<MkSpacer :content-max="700" :margin-min="16" :margin-max="32">
				<MkInfo class="_formBlock">{{
					i18n.ts.verifiedUsersDescription
				}}</MkInfo>

				<MkButton primary class="_formBlock" @click="addUser">
					<template #icon><i :class="icon('ph-seal-check')"></i></template>
					{{ i18n.ts.verifyUser }}
				</MkButton>

				<MkPagination
					v-slot="{ items }"
					ref="paginationComponent"
					:pagination="pagination"
					class="users"
				>
					<div
						v-for="user in items"
						:key="user.id"
						class="_panel users"
						style="display: flex; align-items: center; gap: 12px; padding: 12px; margin-bottom: 8px"
					>
						<MkAvatar :user="user" style="width: 42px; height: 42px" />
						<div style="flex: 1; min-width: 0">
							<MkUserName :user="user" />
							<div>
								<MkAcct :user="user" />
							</div>
						</div>
						<MkButton danger inline @click="removeUser(user)">
							{{ i18n.ts.unverifyUser }}
						</MkButton>
					</div>
				</MkPagination>
			</MkSpacer>
		</MkStickyContainer>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import type { entities } from "fedired-js";

import MkButton from "@/components/MkButton.vue";
import MkInfo from "@/components/MkInfo.vue";
import MkPagination from "@/components/MkPagination.vue";
import MkAvatar from "@/components/global/MkAvatar.vue";
import MkUserName from "@/components/global/MkUserName.vue";
import MkAcct from "@/components/global/MkAcct.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import icon from "@/scripts/icon";

const paginationComponent = ref<InstanceType<typeof MkPagination>>();

const pagination = {
	endpoint: "admin/show-users" as const,
	limit: 30,
	params: {
		sort: "+createdAt",
		state: "verified",
		origin: "local",
	},
};

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

function reload() {
	paginationComponent.value?.reload();
}

function addUser() {
	os.selectLocalUser().then((user) => {
		os.apiWithDialog("admin/verify-user", { userId: user.id }).then(() => {
			reload();
		});
	});
}

function removeUser(user: entities.UserDetailed) {
	os.confirm({
		type: "warning",
		text: i18n.t("unverifyUserConfirm", { user: `@${user.username}` }),
	}).then(({ canceled }) => {
		if (canceled) return;
		os.apiWithDialog("admin/unverify-user", { userId: user.id }).then(() => {
			reload();
		});
	});
}

definePageMetadata({
	title: i18n.ts.verifiedUsers,
	icon: `${icon("ph-seal-check")}`,
});
</script>
