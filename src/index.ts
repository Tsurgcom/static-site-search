export {
	BODY_WEIGHT,
	DESCRIPTION_WEIGHT,
	DIMS,
	FUZZY_TRIGRAM_WEIGHT,
	FUZZY_WORD_WEIGHT,
	HEADING_WEIGHT,
	INDEX_MAGIC,
	INDEX_URL,
	INDEX_VERSION,
	TITLE_WEIGHT,
	WASM_URL,
} from "./constants";
export { collectMarkdown, stripMarkdown, type CollectFn, type CollectedDoc } from "./collect";
export {
	buildSearchIndex,
	indexDocuments,
	writeSearchIndex,
	type BuildSearchIndexOptions,
	type WriteSearchIndexOptions,
} from "./build-index";
export {
	cosineJs,
	embedDocument,
	embedQuery,
	l2normalize,
	wordsOf,
	type EmbedFields,
} from "./embed";
export {
	decodeIndex,
	encodeIndex,
	type DocKind,
	type PackedIndex,
	type SearchMeta,
} from "./format";
export {
	compactAlnum,
	isNeighbourKey,
	keyboardDistance,
	keySubCost,
	neighbourKeys,
	neighbourWords,
	typoDistance,
} from "./qwerty";
export { correctCompact, makeLexicon, rankHits, type Ranked } from "./rank";
export { instantiateKernel, type WasmKernel } from "./wasm";
export { buildWasm } from "./wasm-build";
export { prebuiltWasmPath } from "./paths";
