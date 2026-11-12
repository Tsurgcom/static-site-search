export type DocKind = "leaf" | "hub" | "section" | "item";
export type SearchMeta = {
    title: string;
    url: string;
    section: string;
    heading: string;
    snippet: string;
    kind: DocKind;
};
export type PackedIndex = {
    n: number;
    dims: number;
    matrix: Float32Array;
    docs: SearchMeta[];
};
export declare function encodeIndex(docs: SearchMeta[], matrix: Float32Array): Uint8Array;
export declare function decodeIndex(buf: Uint8Array): PackedIndex;
