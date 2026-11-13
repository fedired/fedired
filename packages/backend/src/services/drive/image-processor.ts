import sharp from "sharp";

export type IImage = {
	data: Buffer;
	ext: string | null;
	type: string;
};

/**
 * Convert to WebP
 *   with resize, remove metadata, resolve orientation, stop animation
 */
export async function convertToWebp(
	path: string,
	width: number,
	height: number,
	quality = 85,
): Promise<IImage> {
	return convertSharpToWebp(
		sharp(path, {
			failOn: "none",
			limitInputPixels: 268402689,
		}),
		width,
		height,
		quality,
	);
}

export async function convertSharpToWebp(
	instance: sharp.Sharp,
	width: number,
	height: number,
	quality = 85,
): Promise<IImage> {
	try {
		const data = await instance
			.resize(width, height, {
				fit: "inside",
				withoutEnlargement: true,
			})
			.rotate()
			.webp({
				quality,
			})
			.toBuffer();

		return {
			data,
			ext: "webp",
			type: "image/webp",
		};
	} finally {
		// Liberar memoria nativa de libvips; sin esto el worker puede OOM al subir varias fotos.
		try {
			instance.destroy();
		} catch {
			// ignore
		}
	}
}
