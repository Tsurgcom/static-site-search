import { DIMS, INDEX_URL, WASM_URL } from "./constants";
import { cosineJs, embedQuery } from "./embed";
import { decodeIndex } from "./format";
import { makeLexicon, rankHits } from "./rank";
import { instantiateKernel } from "./wasm";
let enginePromise = null;
export function engineFromParts(index, kernel) {
    const lexicon = makeLexicon(index.docs);
    const scoreQuery = (qvec) => {
        if (kernel)
            return kernel.score(qvec, index.matrix, index.n, index.dims);
        return cosineJs(qvec, index.matrix, index.n, index.dims);
    };
    const search = (query, k = 8) => {
        const trimmed = query.trim();
        if (!trimmed)
            return [];
        const qvec = embedQuery(trimmed);
        return rankHits(trimmed, index.docs, scoreQuery(qvec), k, lexicon);
    };
    return {
        n: index.n,
        search,
        searchTimed(query, k = 8) {
            const t0 = performance.now();
            const hits = search(query, k);
            return { hits, ms: performance.now() - t0 };
        },
    };
}
export function engineFromIndexBytes(indexBytes, kernel) {
    return engineFromParts(decodeIndex(indexBytes), kernel);
}
async function fetchBytes(url) {
    const cache = import.meta.env?.DEV ? "no-store" : "default";
    const res = await fetch(url, { cache });
    if (!res.ok)
        throw new Error(`${url} ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
}
/**
 * Fetch `/search/index.bin` and `/search/engine.wasm` (or the urls you pass)
 * and rank entirely in the browser. There is no search server.
 */
export async function loadSearchEngine(options = {}) {
    const indexUrl = options.indexUrl ?? INDEX_URL;
    const wasmUrl = options.wasmUrl ?? WASM_URL;
    const [indexBytes, wasmBytes] = await Promise.all([fetchBytes(indexUrl), fetchBytes(wasmUrl)]);
    let kernel = null;
    try {
        kernel = await instantiateKernel(wasmBytes);
    }
    catch {
        kernel = null;
    }
    return engineFromIndexBytes(indexBytes, kernel);
}
/** Shared engine promise. The first caller's urls win. */
export function ensureSearchEngine(options) {
    if (!enginePromise)
        enginePromise = loadSearchEngine(options);
    return enginePromise;
}
export { DIMS };
