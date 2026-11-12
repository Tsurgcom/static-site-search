# @tsurgcom/static-site-search

Static site search for a content directory. At build time the package embeds
each document into a 256-wide feature hash and writes `index.bin`. In the
browser, the page fetches `/search/index.bin` and `/search/engine.wasm` and
ranks locally. There is no search server.

## Install

```sh
bun add github:Tsurgcom/static-site-search
```

`bun install` compiles TypeScript to `dist/`. It does not need Rust. A prebuilt
kernel is already at `wasm/engine.wasm`.

## Exports

| Import | Role |
| --- | --- |
| `@tsurgcom/static-site-search` | Build an index, encode and decode `index.bin`, embed documents and queries, rank hits |
| `@tsurgcom/static-site-search/client` | `ensureSearchEngine` and the browser types. This entry does not import `node:fs` |
| `@tsurgcom/static-site-search/vite` | `siteSearchPlugin` for Vite and Astro |
| `@tsurgcom/static-site-search/engine.wasm` | Prebuilt cosine kernel |

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  },
  "./client": {
    "types": "./dist/client.d.ts",
    "import": "./dist/client.js",
    "default": "./dist/client.js"
  },
  "./vite": {
    "types": "./dist/vite-plugin.d.ts",
    "import": "./dist/vite-plugin.js",
    "default": "./dist/vite-plugin.js"
  },
  "./engine.wasm": "./wasm/engine.wasm"
}
```

`INDEX_MAGIC` is `0x31535254` (little-endian `uint32`). Do not change it.
Existing `index.bin` files use those header bytes. `INDEX_VERSION` is `2`.

## Astro

Astro runs Vite. Add the plugin in `astro.config.mjs`.

Generic markdown (one document per `.md` / `.mdx` file, url taken from
frontmatter or the file path):

```js
import { defineConfig } from "astro/config";
import { siteSearchPlugin } from "@tsurgcom/static-site-search/vite";

export default defineConfig({
  vite: {
    plugins: [
      siteSearchPlugin({
        contentDir: "content",
        outPath: "public/search/index.bin",
      }),
    ],
  },
});
```

Frontmatter may set `title`, `url`, `section`, `description`, `heading`, and
`kind` (`leaf`, `hub`, `section`, or `item`).

### What stays in the site

This package does not ship a search box and it does not know your URLs.

- **`collect.ts` stays in the site.** Hubs, section splits, profile pages, and
  any URL map belong to the site. Pass that function as `collect`. It must
  return `CollectedDoc` values (`title`, `url`, `section`, `heading`,
  `snippet`, `kind`, plus `titleText`, `description`, and `bodyText`).
- **The search UI stays in the site.** Import `ensureSearchEngine` from the
  client entry and render hits yourself.

```js
import { defineConfig } from "astro/config";
import { siteSearchPlugin } from "@tsurgcom/static-site-search/vite";
import { collectDocs } from "./src/lib/search/collect.ts";

export default defineConfig({
  vite: {
    plugins: [
      siteSearchPlugin({
        contentDir: "content",
        outPath: "public/search/index.bin",
        collect: collectDocs,
      }),
    ],
  },
});
```

```tsx
import { ensureSearchEngine, type SearchHit } from "@tsurgcom/static-site-search/client";

const engine = await ensureSearchEngine();
const hits: SearchHit[] = engine.search(query, 8);
```

`ensureSearchEngine()` fetches `/search/index.bin` and `/search/engine.wasm`.
Those paths are the defaults (`INDEX_URL` and `WASM_URL`). Astro serves files
in `public/` at the site root, so the plugin writes both assets there.

## How the index rebuild works

`siteSearchPlugin` rebuilds during `buildStart` and again when the dev server
starts. It then watches the content directory and rebuilds when a `.md` or
`.mdx` file changes.

Each rebuild:

1. Calls `collect(contentDir)`. The default collector is `collectMarkdown`.
2. Embeds `titleText`, `heading`, `description`, and `bodyText` into one
   L2-normalised 256-float vector per document.
3. Writes `public/search/index.bin` (16-byte header, float matrix, JSON metadata).
4. Copies the prebuilt `wasm/engine.wasm` to `public/search/engine.wasm`.

The browser never calls a search API. `loadSearchEngine` fetches those two
files, scores the matrix with the WASM kernel, and falls back to a JS cosine
if the kernel cannot start. `rankHits` then applies keyboard-aware lexical
ranking (QWERTY neighbour substitutions and transpositions).

You can rebuild without Vite:

```sh
bunx static-site-search index --content content --out public/search/index.bin
bunx static-site-search wasm --out public/search/engine.wasm
```

`index` uses `collectMarkdown`. For a custom collector, call `writeSearchIndex`
from the site's own script and pass `collect`.

`wasm` compiles `src/engine.rs` with `rustc` (`wasm32-unknown-unknown`, SIMD).
If Rust is not installed it copies the committed `wasm/engine.wasm` instead.
Rebuild the committed kernel, when you change `engine.rs`, with:

```sh
bun scripts/build-search-wasm.ts
```

## Scripts

```sh
bun install
bun test
bun run build
```

## License

[MIT](./LICENSE)
