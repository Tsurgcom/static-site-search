import { type CollectFn } from "./build-index";
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
/**
 * Vite plugin (Astro uses Vite) that writes the static index and copies the
 * prebuilt cosine kernel into `public/search/` on build and when content changes.
 */
export declare function siteSearchPlugin(options?: SiteSearchPluginOptions): {
    name: string;
    configResolved(config: {
        root: string;
    }): void;
    buildStart(): void;
    configureServer(server: {
        watcher: {
            add: (dir: string) => void;
            on: (ev: string, cb: (file: string) => void) => void;
        };
    }): void;
};
