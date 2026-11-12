import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { writeSearchIndex } from "./build-index";
import { prebuiltWasmPath } from "./paths";
function contentMarker(contentDir) {
    const dir = contentDir.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
    return `/${dir}/`;
}
/**
 * Vite plugin (Astro uses Vite) that writes the static index and copies the
 * prebuilt cosine kernel into `public/search/` on build and when content changes.
 */
export function siteSearchPlugin(options = {}) {
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
        console.info(`[static-site-search] indexed ${result.n} docs → ${result.path} (${result.bytes} bytes)`);
    };
    return {
        name: "static-site-search",
        configResolved(config) {
            root = config.root;
        },
        buildStart() {
            if (builtOnce)
                return;
            builtOnce = true;
            rebuild();
        },
        configureServer(server) {
            rebuild();
            server.watcher.add(contentDirName);
            const marker = contentMarker(contentDirName);
            server.watcher.on("change", (file) => {
                const norm = file.replaceAll("\\", "/");
                if (!norm.includes(marker))
                    return;
                if (norm.endsWith(".md") || norm.endsWith(".mdx"))
                    rebuild();
            });
        },
    };
}
