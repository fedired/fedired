/*
 * Language manager for SW
 */
import { get, set } from "idb-keyval";
import { I18n, type Locale } from "@/scripts/i18n";

// Must match a file in locales/ (e.g. locales/es-ES.yml). Case-sensitive on the server.
const DEFAULT_LANG = "es-ES";

class SwLang {
	public cacheName = `mk-cache-${_VERSION_}`;

	public lang: Promise<string> = get("lang").then(async (prelang) => {
		if (!prelang) return DEFAULT_LANG;
		return prelang;
	});

	public setLang(newLang: string): Promise<I18n<Locale>> {
		this.lang = Promise.resolve(newLang);
		set("lang", newLang);
		return this.fetchLocale();
	}

	public i18n: Promise<I18n> | null = null;

	public fetchLocale(): Promise<I18n<Locale>> {
		return (this.i18n = this._fetch());
	}

	private async _fetch(): Promise<I18n<Locale>> {
		const lang = await this.lang;
		let localeRes = await this.loadLocale(lang);

		// Si el idioma pedido no existe en el servidor, usar el idioma por defecto
		if (!localeRes && lang !== DEFAULT_LANG) {
			localeRes = await this.loadLocale(DEFAULT_LANG);
		}
		if (!localeRes) throw new Error(`locale fetching error: ${lang}`);

		return new I18n<Locale>(await localeRes.json());
	}

	private async loadLocale(lang: string): Promise<Response | null> {
		const localeUrl = `/assets/locales/${lang}.${_VERSION_}.json`;

		// Service Workerは何度も起動しそのたびにlocaleを読み込むので、CacheStorageを使う
		const cached = await caches.match(localeUrl);

		// _DEV_がtrueの場合は常に最新化
		if (cached && !_DEV_) return cached;

		const fetched = await fetch(localeUrl).catch(() => null);
		if (!fetched?.ok) return cached ?? null;

		// clone antes de consumir el cuerpo, para poder guardarlo en caché
		const toCache = fetched.clone();
		caches.open(this.cacheName).then((cache) => cache.put(localeUrl, toCache));

		return fetched;
	}
}

export const swLang = new SwLang();
