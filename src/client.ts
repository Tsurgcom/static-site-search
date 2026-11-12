import { DIMS, INDEX_URL, WASM_URL } from "./constants";
import { cosineJs, embedQuery } from "./embed";
import { decodeIndex, type PackedIndex } from "./format";
import { makeLexicon, rankHits } from "./rank";
import { instantiateKernel, type WasmKernel } from "./wasm";

export type SearchHit = {
	title: string;
	url: string;
	section: string;
	heading: string;
	snippet: string;
	score: number;
};

export type SearchEngine = {
	n: number;
	search: (query: string, k?: number) => SearchHit[];
	searchTimed: (query: string, k?: number) => { hits: SearchHit[]; ms: number };
};

export type LoadSearchEngineOptions = {
	indexUrl?: string;
	wasmUrl?: string;
};

let enginePromise: Promise<SearchEngine> | null = null;

export function engineFromParts(index: PackedIndex, kernel: WasmKernel | null): SearchEngine {
	const lexicon = makeLexicon(index.docs);
	const scoreQuery = (qvec: Float32Array) => {
		if (kernel) return kernel.score(qvec, index.matrix, index.n, index.dims);
		return cosineJs(qvec, index.matrix, index.n, index.dims);
	};

	const search = (query: string, k = 8): SearchHit[] => {
		const trimmed = query.trim();
		if (!trimmed) return [];
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

export function engineFromIndexBytes(
	indexBytes: Uint8Array,
	kernel: WasmKernel | null,
): SearchEngine {
	return engineFromParts(decodeIndex(indexBytes), kernel);
}

async function fetchBytes(url: string): Promise<Uint8Array> {
	const cache: RequestCache = import.meta.env?.DEV ? "no-store" : "default";
	const res = await fetch(url, { cache });
	if (!res.ok) throw new Error(`${url} ${res.status}`);
	return new Uint8Array(await res.arrayBuffer());
}

/**
 * Fetch `/search/index.bin` and `/search/engine.wasm` (or the urls you pass)
 * and rank entirely in the browser. There is no search server.
 */
export async function loadSearchEngine(
	options: LoadSearchEngineOptions = {},
): Promise<SearchEngine> {
	const indexUrl = options.indexUrl ?? INDEX_URL;
	const wasmUrl = options.wasmUrl ?? WASM_URL;
	const [indexBytes, wasmBytes] = await Promise.all([fetchBytes(indexUrl), fetchBytes(wasmUrl)]);
	let kernel: WasmKernel | null = null;
	try {
		kernel = await instantiateKernel(wasmBytes);
	} catch {
		kernel = null;
	}
	return engineFromIndexBytes(indexBytes, kernel);
}

/** Shared engine promise. The first caller's urls win. */
export function ensureSearchEngine(options?: LoadSearchEngineOptions): Promise<SearchEngine> {
	if (!enginePromise) enginePromise = loadSearchEngine(options);
	return enginePromise;
}

export { DIMS };
