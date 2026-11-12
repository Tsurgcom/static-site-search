import { DIMS } from "./constants";

type ScoreFn = (
	n: number,
	dims: number,
	queryPtr: number,
	matrixPtr: number,
	outPtr: number,
) => void;

export type WasmKernel = {
	score: (query: Float32Array, matrix: Float32Array, n: number, dims: number) => Float32Array;
};

const PAGE = 65536;
const ALIGN = 16;

function align(n: number): number {
	return (n + (ALIGN - 1)) & ~(ALIGN - 1);
}

export async function instantiateKernel(wasmBytes: Uint8Array): Promise<WasmKernel> {
	const { instance } = await WebAssembly.instantiate(wasmBytes, {});
	const memory = instance.exports.memory as WebAssembly.Memory;
	const scoreFn = instance.exports.score as ScoreFn;

	return {
		score(query, matrix, n, dims) {
			if (dims !== DIMS) throw new Error(`expected ${DIMS} dims`);
			const qBytes = dims * 4;
			const mBytes = n * dims * 4;
			const oBytes = n * 4;
			const qOff = ALIGN;
			const mOff = align(qOff + qBytes);
			const oOff = align(mOff + mBytes);
			const need = oOff + oBytes;
			const pages = Math.ceil(need / PAGE);
			const have = memory.buffer.byteLength / PAGE;
			if (pages > have) memory.grow(pages - have);

			const mem = new Uint8Array(memory.buffer);
			mem.set(new Uint8Array(query.buffer, query.byteOffset, qBytes), qOff);
			mem.set(new Uint8Array(matrix.buffer, matrix.byteOffset, mBytes), mOff);

			scoreFn(n, dims, qOff, mOff, oOff);
			const out = new Float32Array(n);
			out.set(new Float32Array(memory.buffer, oOff, n));
			return out;
		},
	};
}
