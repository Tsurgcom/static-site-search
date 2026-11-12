import { type CollectFn, type CollectedDoc } from "./collect";
export type { CollectFn, CollectedDoc };
export type BuildSearchIndexOptions = {
    contentDir: string;
    /** Defaults to {@link collectMarkdown}. Site-specific collectors stay in the client app. */
    collect?: CollectFn;
};
export type WriteSearchIndexOptions = BuildSearchIndexOptions & {
    outPath: string;
};
export declare function indexDocuments(collected: CollectedDoc[]): {
    bytes: Uint8Array;
    n: number;
};
export declare function buildSearchIndex(options: BuildSearchIndexOptions): {
    bytes: Uint8Array;
    n: number;
};
export declare function writeSearchIndex(options: WriteSearchIndexOptions): {
    path: string;
    n: number;
    bytes: number;
};
