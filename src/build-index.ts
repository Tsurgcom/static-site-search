import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { collectMarkdown, type CollectFn, type CollectedDoc } from "./collect";
import { DIMS } from "./constants";
import { embedDocument } from "./embed";
import { encodeIndex, type SearchMeta } from "./format";

export type { CollectFn, CollectedDoc };

export type BuildSearchIndexOptions = {
	contentDir: string;
	/** Defaults to {@link collectMarkdown}. Site-specific collectors stay in the client app. */
	collect?: CollectFn;
};

export type WriteSearchIndexOptions = BuildSearchIndexOptions & {
	outPath: string;
};

export function indexDocuments(collected: CollectedDoc[]): { bytes: Uint8Array; n: number } {
	const matrix = new Float32Array(collected.length * DIMS);
	const docs: SearchMeta[] = collected.map((doc, i) => {
		const vec = embedDocument({
			title: doc.titleText,
			heading: doc.heading,
			description: doc.description,
			body: doc.bodyText,
		});
		matrix.set(vec, i * DIMS);
		return {
			title: doc.title,
			url: doc.url,
			section: doc.section,
			heading: doc.heading,
			snippet: doc.snippet,
			kind: doc.kind,
		};
	});
	return { bytes: encodeIndex(docs, matrix), n: docs.length };
}

export function buildSearchIndex(options: BuildSearchIndexOptions): { bytes: Uint8Array; n: number } {
	const collect = options.collect ?? collectMarkdown;
	return indexDocuments(collect(options.contentDir));
}

export function writeSearchIndex(
	options: WriteSearchIndexOptions,
): { path: string; n: number; bytes: number } {
	const { bytes, n } = buildSearchIndex(options);
	mkdirSync(dirname(options.outPath), { recursive: true });
	writeFileSync(options.outPath, bytes);
	return { path: options.outPath, n, bytes: bytes.byteLength };
}
