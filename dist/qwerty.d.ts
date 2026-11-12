export declare function neighbourKeys(ch: string): string;
export declare function isNeighbourKey(a: string, b: string): boolean;
/** Substitution cost: 0 exact, cheap for nearby keys, 1 otherwise. */
export declare function keySubCost(a: string, b: string): number;
/**
 * Keyboard-aware Damerau–Levenshtein. Adjacent keys, skip-one on the same row,
 * and transpositions are cheap so "solen"≈"soken" and "sloen"≈"solen".
 */
export declare function keyboardDistance(a: string, b: string, limit?: number): number;
/** One-key neighbour substitutions of `word` (not the original). */
export declare function neighbourWords(word: string): string[];
export declare function compactAlnum(text: string): string;
/** True when `a` is a likely mistype of `b`, not two unrelated nearby-key words. */
export declare function typoDistance(a: string, b: string): number;
