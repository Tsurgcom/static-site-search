/**
 * Compile `src/engine.rs` to `out`. If rustc or the wasm32 target is missing,
 * copy the committed `wasm/engine.wasm` so installs do not require Rust.
 */
export declare function buildWasm(out: string): void;
