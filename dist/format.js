import { DIMS, INDEX_MAGIC, INDEX_VERSION } from "./constants";
export function encodeIndex(docs, matrix) {
    const n = docs.length;
    if (matrix.length !== n * DIMS) {
        throw new Error(`matrix length ${matrix.length} != ${n} * ${DIMS}`);
    }
    const header = 16;
    const vecBytes = n * DIMS * 4;
    const metaBytes = new TextEncoder().encode(JSON.stringify(docs));
    const buf = new Uint8Array(header + vecBytes + metaBytes.length);
    const view = new DataView(buf.buffer);
    view.setUint32(0, INDEX_MAGIC, true);
    view.setUint16(4, INDEX_VERSION, true);
    view.setUint16(6, DIMS, true);
    view.setUint32(8, n, true);
    buf.set(new Uint8Array(matrix.buffer, matrix.byteOffset, vecBytes), header);
    buf.set(metaBytes, header + vecBytes);
    return buf;
}
export function decodeIndex(buf) {
    if (buf.byteLength < 16)
        throw new Error("search index is truncated");
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const magic = view.getUint32(0, true);
    if (magic !== INDEX_MAGIC)
        throw new Error("search index magic mismatch");
    const version = view.getUint16(4, true);
    if (version !== INDEX_VERSION)
        throw new Error(`unsupported search index v${version}`);
    const dims = view.getUint16(6, true);
    const n = view.getUint32(8, true);
    const header = 16;
    const vecBytes = n * dims * 4;
    if (buf.byteLength < header + vecBytes)
        throw new Error("search index vectors truncated");
    const copy = new Float32Array(n * dims);
    copy.set(new Float32Array(buf.buffer, buf.byteOffset + header, n * dims));
    const metaJson = new TextDecoder().decode(buf.subarray(header + vecBytes));
    const docs = JSON.parse(metaJson);
    if (docs.length !== n)
        throw new Error("search index meta count mismatch");
    for (const doc of docs) {
        if (!doc.kind)
            doc.kind = "section";
    }
    return { n, dims, matrix: copy, docs };
}
