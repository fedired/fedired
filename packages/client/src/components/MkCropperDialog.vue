<template>
	<XModalWindow
		ref="dialogEl"
		:width="800"
		:height="500"
		:scroll="false"
		:with-ok-button="true"
		@close="cancel()"
		@ok="ok()"
		@closed="$emit('closed')"
	>
		<template #header>{{ i18n.ts.cropImage }}</template>
		<template #default="{ width, height }">
			<div
				class="mk-cropper-dialog"
				:style="`--vw: ${width ? `${width}px` : '100%'}; --vh: ${
					height ? `${height}px` : '100%'
				};`"
			>
				<Transition name="fade">
					<div v-if="loading" class="loading">
						<MkLoading />
					</div>
				</Transition>
				<div class="container">
					<img
						ref="imgEl"
						:src="imgUrl"
						crossorigin="anonymous"
						style="display: none"
						@load="onImageLoad"
					/>
				</div>
			</div>
		</template>
	</XModalWindow>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import type { entities } from "fedired-js";
import Cropper from "cropperjs";
import tinycolor from "tinycolor2";
import XModalWindow from "@/components/MkModalWindow.vue";
import * as os from "@/os";
import { defaultStore } from "@/store";
import { url } from "@/config";
import { query } from "@/scripts/url";
import { uploadFile } from "@/scripts/upload";
import { i18n } from "@/i18n";

const emit = defineEmits<{
	(ev: "ok", cropped: entities.DriveFile): void;
	(ev: "cancel"): void;
	(ev: "closed"): void;
}>();

const props = defineProps<{
	file: entities.DriveFile;
	aspectRatio: number;
}>();

// Archivos de esta instancia: URL directa. El proxy vuelve a descargar por HTTP
// y en LAN (el hostname resuelve a 192.168.x.x) el guard SSRF lo bloquea.
const imgUrl = props.file.url.startsWith(url)
	? props.file.url
	: `${url}/proxy/image.webp?${query({
			url: props.file.url,
		})}`;
const dialogEl = ref<InstanceType<typeof XModalWindow>>();
const imgEl = ref<HTMLImageElement>();
let cropper: Cropper | null = null;
const loading = ref(true);

const ok = async () => {
	async function UploadCroppedImg(): Promise<entities.DriveFile> {
		const croppedCanvas = await cropper?.getCropperSelection()?.$toCanvas();
		if (croppedCanvas == null) {
			throw new Error("Cropping image failed.");
		}

		const blob = await new Promise<Blob | null>((resolve) =>
			croppedCanvas.toBlob((b) => resolve(b), "image/webp", 0.92),
		);

		if (blob == null) {
			throw new Error("Cropping image failed.");
		}

		const baseName = (props.file.name || "image").replace(/\.[^.]+$/, "");
		const file = new File([blob], `${baseName}.webp`, {
			type: "image/webp",
		});

		// keepOriginal=true: ya viene recortada; evita otra compresión en el cliente.
		return await uploadFile(
			file,
			defaultStore.state.uploadFolder,
			file.name,
			true,
		);
	}

	const promise = UploadCroppedImg();

	os.promiseDialog(promise);

	const f = await promise;

	emit("ok", f);
	dialogEl.value!.close();
};

const cancel = () => {
	emit("cancel");
	dialogEl.value!.close();
};

const onImageLoad = () => {
	loading.value = false;

	if (cropper) {
		cropper.getCropperImage()!.$center("contain");
		cropper.getCropperSelection()!.$center();
	}
};

onMounted(() => {
	cropper = new Cropper(imgEl.value!, {});

	const computedStyle = getComputedStyle(document.documentElement);

	const selection = cropper.getCropperSelection()!;
	selection.themeColor = tinycolor(
		computedStyle.getPropertyValue("--accent"),
	).toHexString();
	selection.aspectRatio = props.aspectRatio;
	selection.initialAspectRatio = props.aspectRatio;
	selection.outlined = true;

	window.setTimeout(() => {
		cropper!.getCropperImage()!.$center("contain");
		selection.$center();
	}, 100);

	// モーダルオープンアニメーションが終わったあとで再度調整
	window.setTimeout(() => {
		cropper!.getCropperImage()!.$center("contain");
		selection.$center();
	}, 500);
});
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.5s ease 0.5s;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.mk-cropper-dialog {
	display: flex;
	flex-direction: column;
	inline-size: var(--vw);
	block-size: var(--vh);
	position: relative;

	> .loading {
		position: absolute;
		z-index: 10;
		inset-block-start: 0;
		inset-inline-start: 0;
		inline-size: 100%;
		block-size: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		-webkit-backdrop-filter: var(--blur, blur(10px));
		backdrop-filter: var(--blur, blur(10px));
		background: rgba(0, 0, 0, 0.5);
	}

	> .container {
		flex: 1;
		inline-size: 100%;
		block-size: 100%;

		> ::v-deep(cropper-canvas) {
			inline-size: 100%;
			block-size: 100%;

			> cropper-selection > cropper-handle[action="move"] {
				background: transparent;
			}
		}
	}
}
</style>
