import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { collectMarkdown } from "./collect";
import { DIMS } from "./constants";
import { embedDocument } from "./embed";
import { encodeIndex } from "./format";
export function indexDocuments(collected) {
    const matrix = new Float32Array(collected.length * DIMS);
    const docs = collected.map((doc, i) => {
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
export function buildSearchIndex(options) {
    const collect = options.collect ?? collectMarkdown;
    return indexDocuments(collect(options.contentDir));
}
export function writeSearchIndex(options) {
    const { bytes, n } = buildSearchIndex(options);
    mkdirSync(dirname(options.outPath), { recursive: true });
    writeFileSync(options.outPath, bytes);
    return { path: options.outPath, n, bytes: bytes.byteLength };
}
