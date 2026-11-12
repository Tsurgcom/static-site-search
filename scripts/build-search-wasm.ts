import { join } from "node:path";
import { buildWasm } from "../src/wasm-build";

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(name);
	if (i === -1 || i + 1 >= process.argv.length) return undefined;
	return process.argv[i + 1];
}

const out = arg("--out") ?? join(import.meta.dir, "../wasm/engine.wasm");
buildWasm(out);
