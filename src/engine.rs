//! SIMD cosine kernel for a static search index.
//! Query and each document row are L2-normalised f32 vectors; the dot product is cosine.
//!
//! Memory is owned by the WASM instance. JS writes the query, matrix, and output
//! buffers, then calls `score`. Rebuild with:
//! `bun scripts/build-search-wasm.ts`
//! or `static-site-search wasm --out <file>`.

#![no_main]
#![no_std]

use core::arch::wasm32::*;

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
	core::arch::wasm32::unreachable();
}

/// Cosine scores: `out[i] = dot(query, matrix[i])` for `i in 0..n`.
///
/// `dims` must be a multiple of 4. Pointers are byte addresses; query and each
/// row must be 16-byte aligned.
#[no_mangle]
pub unsafe extern "C" fn score(
	n: u32,
	dims: u32,
	query_ptr: u32,
	matrix_ptr: u32,
	out_ptr: u32,
) {
	let n = n as usize;
	let dims = dims as usize;
	let query = query_ptr as *const f32;
	let matrix = matrix_ptr as *const f32;
	let out = out_ptr as *mut f32;

	for i in 0..n {
		let row = matrix.add(i * dims);
		let mut acc = f32x4_splat(0.0);
		let mut d = 0usize;
		while d + 4 <= dims {
			let a = v128_load(query.add(d).cast());
			let b = v128_load(row.add(d).cast());
			acc = f32x4_add(acc, f32x4_mul(a, b));
			d += 4;
		}
		*out.add(i) = f32x4_extract_lane::<0>(acc)
			+ f32x4_extract_lane::<1>(acc)
			+ f32x4_extract_lane::<2>(acc)
			+ f32x4_extract_lane::<3>(acc);
	}
}
