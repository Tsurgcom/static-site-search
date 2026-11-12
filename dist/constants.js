/** Feature-hash width. Multiple of 4 so the WASM SIMD kernel can load v128 lanes. */
export const DIMS = 256;
export const TITLE_WEIGHT = 8;
export const HEADING_WEIGHT = 5;
export const DESCRIPTION_WEIGHT = 2.5;
export const BODY_WEIGHT = 1;
/** Neighbour-key substitutions on the query (QWERTY). */
export const FUZZY_WORD_WEIGHT = 0.28;
export const FUZZY_TRIGRAM_WEIGHT = 0.18;
/** Little-endian index header. Existing index.bin files depend on these bytes. */
export const INDEX_MAGIC = 0x3153_5254;
export const INDEX_VERSION = 2;
export const WASM_URL = "/search/engine.wasm";
export const INDEX_URL = "/search/index.bin";
