#!/usr/bin/env bun
import { writeSearchIndex } from "./build-index";
import { buildWasm } from "./wasm-build";
function arg(name) {
    const i = process.argv.indexOf(name);
    if (i === -1 || i + 1 >= process.argv.length)
        return undefined;
    return process.argv[i + 1];
}
function usage() {
    console.error("usage: static-site-search index --content <dir> --out <file>");
    console.error("       static-site-search wasm --out <file>");
    process.exit(1);
}
const cmd = process.argv[2];
if (cmd === "index") {
    const content = arg("--content");
    const out = arg("--out");
    if (!content || !out)
        usage();
    const result = writeSearchIndex({ contentDir: content, outPath: out });
    console.info(`indexed ${result.n} docs → ${result.path} (${result.bytes} bytes)`);
}
else if (cmd === "wasm") {
    const out = arg("--out");
    if (!out)
        usage();
    buildWasm(out);
}
else {
    usage();
}
