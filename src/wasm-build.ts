import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { engineSourcePath, prebuiltWasmPath } from "./paths";

function compile(src: string, out: string) {
	return spawnSync(
		"rustc",
		[
			src,
			"--edition",
			"2021",
			"--crate-type",
			"cdylib",
			"--target",
			"wasm32-unknown-unknown",
			"-C",
			"opt-level=3",
			"-C",
			"lto=fat",
			"-C",
			"panic=abort",
			"-C",
			"strip=symbols",
			"-C",
			"target-feature=+simd128",
			"-o",
			out,
		],
		{ stdio: "inherit" },
	);
}

function rustcFailed(result: ReturnType<typeof spawnSync>): boolean {
	return Boolean(result.error) || result.status !== 0;
}

/**
 * Compile `src/engine.rs` to `out`. If rustc or the wasm32 target is missing,
 * copy the committed `wasm/engine.wasm` so installs do not require Rust.
 */
export function buildWasm(out: string): void {
	mkdirSync(dirname(out), { recursive: true });
	const src = engineSourcePath();
	const prebuilt = prebuiltWasmPath();

	let result = compile(src, out);
	if (rustcFailed(result)) {
		const rustup = spawnSync("rustup", ["target", "add", "wasm32-unknown-unknown"], {
			stdio: "inherit",
		});
		if (!rustup.error && rustup.status === 0) result = compile(src, out);
	}

	if (!rustcFailed(result)) {
		console.info(`[static-site-search] wrote ${out}`);
		return;
	}

	if (!existsSync(prebuilt)) {
		console.error("[static-site-search] rustc failed and no prebuilt wasm/engine.wasm is available");
		process.exit(result.status ?? 1);
	}
	if (resolve(prebuilt) !== resolve(out)) copyFileSync(prebuilt, out);
	console.info(`[static-site-search] rustc unavailable; copied prebuilt wasm → ${out}`);
}
