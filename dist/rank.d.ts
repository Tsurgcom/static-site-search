import type { SearchMeta } from "./format";
export type Ranked = SearchMeta & {
    score: number;
    cosine: number;
};
/**
 * If the compact query is not already a prefix of a known title/slug word,
 * map it onto the closest lexicon entry (keyboard-aware edit distance).
 */
export declare function correctCompact(compact: string, lexicon: string[]): string | null;
export declare function rankHits(query: string, docs: SearchMeta[], cosine: Float32Array, k: number, lexicon: string[]): Ranked[];
export declare function makeLexicon(docs: SearchMeta[]): string[];
