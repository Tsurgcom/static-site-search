/** Feature-hash width. Multiple of 4 so the WASM SIMD kernel can load v128 lanes. */
export declare const DIMS = 256;
export declare const TITLE_WEIGHT = 8;
export declare const HEADING_WEIGHT = 5;
export declare const DESCRIPTION_WEIGHT = 2.5;
export declare const BODY_WEIGHT = 1;
/** Neighbour-key substitutions on the query (QWERTY). */
export declare const FUZZY_WORD_WEIGHT = 0.28;
export declare const FUZZY_TRIGRAM_WEIGHT = 0.18;
/** Little-endian index header. Existing index.bin files depend on these bytes. */
export declare const INDEX_MAGIC = 827544148;
export declare const INDEX_VERSION = 2;
export declare const WASM_URL = "/search/engine.wasm";
export declare const INDEX_URL = "/search/index.bin";
