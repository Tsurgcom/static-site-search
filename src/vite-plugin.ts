import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type CollectFn, writeSearchIndex } from "./build-index";
import { prebuiltWasmPath } from "./paths";

export type SiteSearchPluginOptions = {
	/** Directory of source documents, relative to the Vite project root. Default `content`. */
	contentDir?: string;
	/** Index output, relative to the Vite project root. Default `public/search/index.bin`. */
	outPath?: string;
	/** WASM output, relative to the Vite project root. Default `public/search/engine.wasm`. */
	wasmOutPath?: string;
	/**
	 * Site-owned collector. Omit it to index one document per markdown file.
	 * URL maps, hubs, and profile pages stay in the client app's collector.
	 */
	collect?: CollectFn;
};

function contentMarker(contentDir: string): string {
	const dir = contentDir.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
	return `/${dir}/`;
}

/**
 * Vite plugin (Astro uses Vite) that writes the static index and copies the
 * prebuilt cosine kernel into `public/search/` on build and when content changes.
 */
export function siteSearchPlugin(options: SiteSearchPluginOptions = {}) {
	let root = process.cwd();
	let builtOnce = false;
	const contentDirName = options.contentDir ?? "content";
	const outRel = options.outPath ?? "public/search/index.bin";
	const wasmRel = options.wasmOutPath ?? "public/search/engine.wasm";

	const rebuild = () => {
		const outPath = join(root, outRel);
		const result = writeSearchIndex({
			contentDir: join(root, contentDirName),
			outPath,
			collect: options.collect,
		});
		const wasmOut = join(root, wasmRel);
		const prebuilt = prebuiltWasmPath();
		if (resolve(prebuilt) !== resolve(wasmOut)) {
			mkdirSync(dirname(wasmOut), { recursive: true });
			copyFileSync(prebuilt, wasmOut);
		}
		console.info(
			`[static-site-search] indexed ${result.n} docs → ${result.path} (${result.bytes} bytes)`,
		);
	};

	return {
		name: "static-site-search",
		configResolved(config: { root: string }) {
			root = config.root;
		},
		buildStart() {
			if (builtOnce) return;
			builtOnce = true;
			rebuild();
		},
		configureServer(server: {
			watcher: { add: (dir: string) => void; on: (ev: string, cb: (file: string) => void) => void };
		}) {
			rebuild();
			server.watcher.add(contentDirName);
			const marker = contentMarker(contentDirName);
			server.watcher.on("change", (file: string) => {
				const norm = file.replaceAll("\\", "/");
				if (!norm.includes(marker)) return;
				if (norm.endsWith(".md") || norm.endsWith(".mdx")) rebuild();
			});
		},
	};
}
