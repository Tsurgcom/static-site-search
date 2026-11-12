import { join } from "node:path";
import { fileURLToPath } from "node:url";
/** Package root both when this file is `src/paths.ts` and when it is compiled to `dist/paths.js`. */
export function packageRoot() {
    return fileURLToPath(new URL("..", import.meta.url));
}
export function engineSourcePath() {
    return join(packageRoot(), "src/engine.rs");
}
export function prebuiltWasmPath() {
    return join(packageRoot(), "wasm/engine.wasm");
}
