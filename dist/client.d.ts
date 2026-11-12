import { DIMS } from "./constants";
import { type PackedIndex } from "./format";
import { type WasmKernel } from "./wasm";
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
    searchTimed: (query: string, k?: number) => {
        hits: SearchHit[];
        ms: number;
    };
};
export type LoadSearchEngineOptions = {
    indexUrl?: string;
    wasmUrl?: string;
};
export declare function engineFromParts(index: PackedIndex, kernel: WasmKernel | null): SearchEngine;
export declare function engineFromIndexBytes(indexBytes: Uint8Array, kernel: WasmKernel | null): SearchEngine;
/**
 * Fetch `/search/index.bin` and `/search/engine.wasm` (or the urls you pass)
 * and rank entirely in the browser. There is no search server.
 */
export declare function loadSearchEngine(options?: LoadSearchEngineOptions): Promise<SearchEngine>;
/** Shared engine promise. The first caller's urls win. */
export declare function ensureSearchEngine(options?: LoadSearchEngineOptions): Promise<SearchEngine>;
export { DIMS };
