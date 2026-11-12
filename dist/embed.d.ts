export type EmbedFields = {
    title: string;
    heading?: string;
    description?: string;
    body: string;
};
export declare function wordsOf(text: string): string[];
export declare function l2normalize(vec: Float32Array): void;
export declare function embedDocument(fields: EmbedFields): Float32Array;
export declare function embedQuery(query: string): Float32Array;
export declare function cosineJs(query: Float32Array, matrix: Float32Array, n: number, dims: number): Float32Array;
