import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildSearchIndex, indexDocuments, type CollectedDoc } from "../src/build-index";
import { engineFromIndexBytes } from "../src/client";
import { collectMarkdown } from "../src/collect";
import { DIMS, INDEX_MAGIC } from "../src/constants";
import { cosineJs, embedQuery } from "../src/embed";
import { decodeIndex } from "../src/format";
import { isNeighbourKey, keyboardDistance, neighbourWords } from "../src/qwerty";
import { siteSearchPlugin } from "../src/vite-plugin";
import { instantiateKernel } from "../src/wasm";

const root = join(import.meta.dir, "..");
const fixtureDir = join(import.meta.dir, "fixtures/content");

function doc(partial: Partial<CollectedDoc> & Pick<CollectedDoc, "title" | "url">): CollectedDoc {
	return {
		title: partial.title,
		url: partial.url,
		section: partial.section ?? "Pages",
		heading: partial.heading ?? partial.title,
		snippet: partial.snippet ?? partial.title,
		kind: partial.kind ?? "leaf",
		titleText: partial.titleText ?? partial.title,
		description: partial.description ?? "",
		bodyText: partial.bodyText ?? partial.title,
	};
}

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) out.push(...walk(path));
		else out.push(path);
	}
	return out;
}

describe("qwerty nearest-key", () => {
	test("n sits next to m", () => {
		expect(isNeighbourKey("n", "m")).toBe(true);
		expect(neighbourWords("campimg")).toContain("camping");
	});

	test("keyboard distance treats neighbour substitution as cheap", () => {
		expect(keyboardDistance("campimg", "camping")).toBeLessThan(0.5);
		expect(keyboardDistance("note", "note")).toBe(0);
		expect(keyboardDistance("soken", "solen")).toBeLessThan(1);
		expect(keyboardDistance("sloen", "solen")).toBeLessThan(2.2);
		expect(keyboardDistance("abcd", "wxyz")).toBeGreaterThan(0.6);
	});
});

describe("fixture index", () => {
	const collected = collectMarkdown(fixtureDir);
	const packed = buildSearchIndex({ contentDir: fixtureDir });
	const engine = engineFromIndexBytes(packed.bytes, null);

	test("indexes every markdown fixture", () => {
		expect(collected.length).toBe(3);
		expect(packed.n).toBe(collected.length);
		const notes = collected.find((d) => d.title === "Field notes");
		expect(notes?.url).toBe("/notes/");
		expect(notes?.kind).toBe("hub");
		expect(notes?.section).toBe("Notes");
		const alpine = collected.find((d) => d.url === "/guides/alpine-hiking/");
		expect(alpine?.kind).toBe("leaf");
		expect(alpine?.bodyText).toContain("alpine hiking");
		expect(alpine?.bodyText).not.toContain("**");
	});

	test("titles outrank body mentions", () => {
		const hits = engine.search("alpine hiking", 8);
		expect(hits[0]?.url).toBe("/guides/alpine-hiking/");
		expect(hits[0]?.title.toLowerCase()).toContain("alpine hiking");
		expect(hits.some((h) => h.url === "/journal/camp-meals/")).toBe(false);
	});

	test("header magic bytes stay fixed", () => {
		expect(INDEX_MAGIC).toBe(0x31535254);
		const view = new DataView(packed.bytes.buffer, packed.bytes.byteOffset, packed.bytes.byteLength);
		expect(view.getUint32(0, true)).toBe(0x31535254);
		const decoded = decodeIndex(packed.bytes);
		expect(decoded.n).toBe(packed.n);
		expect(decoded.dims).toBe(DIMS);
		expect(decoded.docs[0]?.url).toBeTruthy();
	});
});

describe("ranking fixtures", () => {
	const docs: CollectedDoc[] = [
		doc({
			title: "Gardens",
			url: "/gardens/",
			kind: "hub",
			section: "Gardens",
			titleText: "Gardens",
			bodyText: "A hub of garden paths and seasonal planting.",
		}),
		doc({
			title: "Tools for the garden",
			url: "/guides/garden-tools/",
			kind: "leaf",
			titleText: "Tools for the garden",
			bodyText: "Forks, gloves, and a sharpening stone.",
		}),
		doc({
			title: "Camping basics",
			url: "/guides/camping/",
			kind: "leaf",
			titleText: "Camping basics",
			bodyText: "Tents, tarps, and dry bags for weekend camping.",
		}),
		doc({
			title: "Packing list",
			url: "/journal/packing/",
			kind: "section",
			titleText: "Packing list",
			bodyText: "Bring snacks and mention camping basics only in passing.",
		}),
		doc({
			title: "Mara Solen",
			url: "/people/mara-solen/",
			kind: "leaf",
			section: "People",
			titleText: "Mara Solen",
			bodyText: "Mara Solen writes field notes and leads weekend walks.",
		}),
		doc({
			title: "Staff notes",
			url: "/notes/archive/",
			kind: "section",
			titleText: "Staff notes",
			bodyText: "Mara Solen visited the archive to file a map.",
			snippet: "Mara Solen visited the archive.",
		}),
		doc({
			title: "Cedar Avenue",
			url: "/visit/",
			kind: "hub",
			section: "Visit",
			titleText: "Cedar Avenue",
			bodyText: "The studio sits on Cedar Avenue and is open on weekdays.",
		}),
		doc({
			title: "Workshop booking",
			url: "/visit/booking/",
			kind: "leaf",
			titleText: "Workshop booking",
			bodyText: "Reserve a bench with the workshop booking form.",
		}),
	];

	for (let i = 0; i < 40; i++) {
		docs.push(
			doc({
				title: `Entry ${i}`,
				url: `/archive/entry-${i}/`,
				kind: "section",
				titleText: `Entry ${i}`,
				bodyText: `Archived note number ${i} with no overlapping topic words.`,
			}),
		);
	}

	const packed = indexDocuments(docs);
	const engine = engineFromIndexBytes(packed.bytes, null);

	test("a title match beats a body mention", () => {
		const hits = engine.search("camping basics", 8);
		expect(hits[0]?.url).toBe("/guides/camping/");
		expect(hits.some((h) => h.url === "/journal/packing/")).toBe(false);
	});

	test("nearest-key typo still finds the page", () => {
		const hits = engine.search("campimg", 8);
		expect(hits.length).toBeGreaterThan(0);
		expect(hits[0]?.url).toBe("/guides/camping/");
	});

	test("name queries prefer the profile page", () => {
		for (const query of ["mara", "nara", "amra", "solen", "sloen", "soken"]) {
			const hits = engine.search(query, 8);
			expect(hits[0]?.url, query).toBe("/people/mara-solen/");
			expect(hits.every((h) => h.url === "/people/mara-solen/"), query).toBe(true);
		}
	});

	test("typing a hub title letter by letter keeps the hub first", () => {
		let typed = "";
		for (const ch of "gardens") {
			typed += ch;
			if (typed.length < 2) continue;
			const top = engine.search(typed)[0];
			expect(top?.url, typed).toBe("/gardens/");
		}
	});

	test("phrases find the page that owns them", () => {
		expect(engine.search("workshop booking")[0]?.url).toBe("/visit/booking/");
		expect(engine.search("cedar avenue")[0]?.url).toBe("/visit/");
	});

	test("search is faster than 8ms on this corpus", () => {
		engine.search("warmup gardens");
		const { ms } = engine.searchTimed("camping basics");
		expect(ms).toBeLessThan(8);
	});
});

describe("wasm cosine kernel", () => {
	test("matches JS dots within 1e-5", async () => {
		const wasmPath = join(root, "wasm/engine.wasm");
		const wasmBytes = readFileSync(wasmPath);
		expect(wasmBytes.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x61, 0x73, 0x6d]));
		const kernel = await instantiateKernel(wasmBytes);
		const packed = decodeIndex(buildSearchIndex({ contentDir: fixtureDir }).bytes);
		const q = embedQuery("alpine hiking");
		const js = cosineJs(q, packed.matrix, packed.n, packed.dims);
		const wasm = kernel.score(q, packed.matrix, packed.n, packed.dims);
		expect(wasm.length).toBe(js.length);
		expect(packed.dims).toBe(DIMS);
		let maxDiff = 0;
		for (let i = 0; i < js.length; i++) maxDiff = Math.max(maxDiff, Math.abs(js[i] - wasm[i]));
		expect(maxDiff).toBeLessThan(1e-5);
	});
});

describe("vite plugin", () => {
	test("writes the index and copies the kernel", () => {
		const tmp = mkdtempSync(join(tmpdir(), "static-site-search-"));
		try {
			let calls = 0;
			const plugin = siteSearchPlugin({
				collect: () => {
					calls += 1;
					return [
						doc({
							title: "Alpine Hiking",
							url: "/guides/alpine-hiking/",
							bodyText: "Routes above the tree line for alpine hiking.",
						}),
					];
				},
			});
			plugin.configResolved({ root: tmp });
			plugin.buildStart();
			plugin.buildStart();
			expect(calls).toBe(1);
			const indexPath = join(tmp, "public/search/index.bin");
			const wasmPath = join(tmp, "public/search/engine.wasm");
			expect(statSync(indexPath).size).toBeGreaterThan(16);
			expect(readFileSync(wasmPath).subarray(0, 4)).toEqual(Buffer.from([0x00, 0x61, 0x73, 0x6d]));
			const decoded = decodeIndex(readFileSync(indexPath));
			expect(decoded.docs[0]?.url).toBe("/guides/alpine-hiking/");

			let onChange: (file: string) => void = () => {};
			plugin.configureServer({
				watcher: {
					add() {},
					on(_ev, cb) {
						onChange = cb;
					},
				},
			});
			expect(calls).toBe(2);
			onChange(join(tmp, "content/page.md"));
			expect(calls).toBe(3);
			onChange(join(tmp, "src/page.ts"));
			expect(calls).toBe(3);
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
});

describe("cli", () => {
	test("index writes a decodable file", () => {
		const tmp = mkdtempSync(join(tmpdir(), "static-site-search-cli-"));
		const out = join(tmp, "index.bin");
		try {
			const result = spawnSync(
				process.execPath,
				[join(root, "src/cli.ts"), "index", "--content", fixtureDir, "--out", out],
				{ cwd: root, encoding: "utf8" },
			);
			expect(result.status).toBe(0);
			const decoded = decodeIndex(readFileSync(out));
			expect(decoded.n).toBe(3);
			expect(decoded.docs.some((d) => d.url === "/guides/alpine-hiking/")).toBe(true);
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});

	test("wasm writes a kernel", () => {
		const tmp = mkdtempSync(join(tmpdir(), "static-site-search-wasm-"));
		const out = join(tmp, "engine.wasm");
		try {
			const result = spawnSync(
				process.execPath,
				[join(root, "src/cli.ts"), "wasm", "--out", out],
				{ cwd: root, encoding: "utf8", timeout: 60_000 },
			);
			expect(result.status).toBe(0);
			expect(readFileSync(out).subarray(0, 4)).toEqual(Buffer.from([0x00, 0x61, 0x73, 0x6d]));
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	}, 60_000);
});

describe("package boundary", () => {
	test("client entry does not import node builtins", () => {
		function resolveImport(fromFile: string, spec: string): string {
			const base = resolve(dirname(fromFile), spec);
			return base.endsWith(".ts") ? base : `${base}.ts`;
		}

		function assertBrowserSafe(file: string, seen = new Set<string>()) {
			const abs = resolve(file);
			if (seen.has(abs)) return;
			seen.add(abs);
			const text = readFileSync(abs, "utf8");
			expect(text.includes("node:"), abs).toBe(false);
			for (const match of text.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
				const spec = match[1];
				if (!spec) continue;
				assertBrowserSafe(resolveImport(abs, spec), seen);
			}
		}

		assertBrowserSafe(join(root, "src/client.ts"));
	});

	test("sources carry no client branding or legacy magic label", () => {
		const files = [
			...walk(join(root, "src")),
			...walk(join(root, "scripts")),
			...walk(join(root, "test/fixtures")),
			join(root, "README.md"),
			join(root, "LICENSE"),
			join(root, "package.json"),
		];
		const banned = ["trs1", "terence", "sabina", "chibula", "trsolicitors", "masimova", "pond street", "fetter"];
		for (const file of files) {
			const lower = readFileSync(file, "utf8").toLowerCase();
			for (const word of banned) {
				expect(lower.includes(word), `${file} contains ${word}`).toBe(false);
			}
		}
	});

	test("export map", () => {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
			name: string;
			private?: boolean;
			license: string;
			exports: Record<string, unknown>;
		};
		expect(pkg.name).toBe("@tsurgcom/static-site-search");
		expect(pkg.private).toBeUndefined();
		expect(pkg.license).toBe("MIT");
		expect(Object.keys(pkg.exports).sort()).toEqual([".", "./client", "./engine.wasm", "./vite"]);
		expect(pkg.exports["./engine.wasm"]).toBe("./wasm/engine.wasm");
		expect(pkg.exports["."]).toEqual({
			types: "./dist/index.d.ts",
			import: "./dist/index.js",
			default: "./dist/index.js",
		});
		expect(pkg.exports["./client"]).toEqual({
			types: "./dist/client.d.ts",
			import: "./dist/client.js",
			default: "./dist/client.js",
		});
		expect(pkg.exports["./vite"]).toEqual({
			types: "./dist/vite-plugin.d.ts",
			import: "./dist/vite-plugin.js",
			default: "./dist/vite-plugin.js",
		});
	});
});
