export type WasmKernel = {
    score: (query: Float32Array, matrix: Float32Array, n: number, dims: number) => Float32Array;
};
export declare function instantiateKernel(wasmBytes: Uint8Array): Promise<WasmKernel>;
