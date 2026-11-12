import { BODY_WEIGHT, DESCRIPTION_WEIGHT, DIMS, FUZZY_TRIGRAM_WEIGHT, FUZZY_WORD_WEIGHT, HEADING_WEIGHT, TITLE_WEIGHT, } from "./constants";
import { neighbourKeys, neighbourWords } from "./qwerty";
const STOP = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "of",
    "to",
    "in",
    "for",
    "on",
    "with",
    "our",
    "we",
    "you",
    "your",
    "is",
    "are",
    "was",
    "be",
    "by",
    "from",
    "as",
    "at",
    "this",
    "that",
    "it",
    "its",
    "if",
    "not",
    "can",
    "will",
    "has",
    "have",
    "had",
    "also",
    "than",
    "then",
    "into",
    "over",
    "such",
    "any",
    "all",
    "may",
    "more",
    "other",
    "their",
    "they",
    "them",
    "who",
    "which",
    "when",
    "where",
    "what",
    "how",
    "about",
    "been",
    "being",
    "both",
    "each",
    "few",
    "own",
    "same",
    "too",
    "very",
    "just",
    "only",
    "including",
    "within",
    "through",
    "between",
]);
function fnv1a(token) {
    let h = 0x811c9dc5;
    for (let i = 0; i < token.length; i++) {
        h ^= token.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
function addToken(vec, token, weight) {
    if (!token || weight === 0)
        return;
    const h = fnv1a(token);
    const i = h & (DIMS - 1);
    vec[i] += (h & 1) === 0 ? weight : -weight;
}
export function wordsOf(text) {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 2 && !STOP.has(w));
}
function addWord(vec, word, weight, prefixes) {
    addToken(vec, `w:${word}`, weight);
    if (prefixes) {
        const max = Math.min(word.length - 1, 12);
        for (let i = 2; i <= max; i++) {
            addToken(vec, `w:${word.slice(0, i)}`, weight * 0.32);
        }
    }
    if (word.length >= 3) {
        for (let i = 0; i + 3 <= word.length; i++) {
            addToken(vec, `g:${word.slice(i, i + 3)}`, weight * 0.55);
        }
    }
}
function addFuzzyWord(vec, word, weight) {
    for (const variant of neighbourWords(word)) {
        addToken(vec, `w:${variant}`, weight * FUZZY_WORD_WEIGHT);
    }
    if (word.length >= 3) {
        for (let i = 0; i + 3 <= word.length; i++) {
            const tri = word.slice(i, i + 3);
            for (let p = 0; p < 3; p++) {
                const nbs = neighbourKeys(tri[p]);
                for (const n of nbs) {
                    addToken(vec, `g:${tri.slice(0, p)}${n}${tri.slice(p + 1)}`, weight * FUZZY_TRIGRAM_WEIGHT);
                }
            }
        }
    }
}
function addField(vec, text, weight, opts) {
    if (!text || weight === 0)
        return;
    const words = wordsOf(text);
    const tf = new Map();
    for (const w of words)
        tf.set(w, (tf.get(w) ?? 0) + 1);
    for (const [word, count] of tf) {
        const tfw = weight * (1 + Math.log(count));
        addWord(vec, word, tfw, opts.prefixes === true);
        if (opts.fuzzy)
            addFuzzyWord(vec, word, tfw);
    }
}
export function l2normalize(vec) {
    let sum = 0;
    for (let i = 0; i < vec.length; i++)
        sum += vec[i] * vec[i];
    if (sum <= 0)
        return;
    const inv = 1 / Math.sqrt(sum);
    for (let i = 0; i < vec.length; i++)
        vec[i] *= inv;
}
export function embedDocument(fields) {
    const vec = new Float32Array(DIMS);
    addField(vec, fields.title, TITLE_WEIGHT, { prefixes: true });
    if (fields.heading && fields.heading !== fields.title) {
        addField(vec, fields.heading, HEADING_WEIGHT, { prefixes: true });
    }
    if (fields.description)
        addField(vec, fields.description, DESCRIPTION_WEIGHT, {});
    addField(vec, fields.body, BODY_WEIGHT, {});
    l2normalize(vec);
    return vec;
}
export function embedQuery(query) {
    const vec = new Float32Array(DIMS);
    addField(vec, query, 1, { prefixes: true, fuzzy: true });
    l2normalize(vec);
    return vec;
}
export function cosineJs(query, matrix, n, dims) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let acc = 0;
        const row = i * dims;
        for (let d = 0; d < dims; d++)
            acc += query[d] * matrix[row + d];
        out[i] = acc;
    }
    return out;
}
