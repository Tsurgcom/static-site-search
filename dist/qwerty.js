/**
 * UK/US QWERTY adjacency. A mistype of "campimg" (n sits next to m)
 * expands to "camping" in one neighbour substitution. b↔m is one key
 * past n on the bottom row — still a cheap substitution.
 */
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const POS = {};
const NEIGHBOURS = {};
for (let r = 0; r < ROWS.length; r++) {
    const row = ROWS[r];
    for (let i = 0; i < row.length; i++) {
        POS[row[i]] = { row: r, col: i };
        const keys = new Set();
        const add = (rr, ii) => {
            const ch = ROWS[rr]?.[ii];
            if (ch)
                keys.add(ch);
        };
        add(r, i - 1);
        add(r, i + 1);
        add(r - 1, i);
        add(r - 1, i - 1);
        add(r - 1, i + 1);
        add(r + 1, i);
        add(r + 1, i - 1);
        add(r + 1, i + 1);
        keys.delete(row[i]);
        NEIGHBOURS[row[i]] = [...keys].join("");
    }
}
export function neighbourKeys(ch) {
    return NEIGHBOURS[ch.toLowerCase()] ?? "";
}
export function isNeighbourKey(a, b) {
    if (a === b)
        return false;
    return neighbourKeys(a).includes(b);
}
/** Substitution cost: 0 exact, cheap for nearby keys, 1 otherwise. */
export function keySubCost(a, b) {
    if (a === b)
        return 0;
    if (isNeighbourKey(a, b))
        return 0.35;
    const pa = POS[a];
    const pb = POS[b];
    if (pa && pb && pa.row === pb.row && Math.abs(pa.col - pb.col) === 2)
        return 0.55;
    return 1;
}
const DEL_COST = 0.75;
const TRANS_COST = 0.45;
/**
 * Keyboard-aware Damerau–Levenshtein. Adjacent keys, skip-one on the same row,
 * and transpositions are cheap so "solen"≈"soken" and "sloen"≈"solen".
 */
export function keyboardDistance(a, b, limit = 2.2) {
    if (a === b)
        return 0;
    const n = a.length;
    const m = b.length;
    if (Math.abs(n - m) > 2)
        return limit + 1;
    let prev2 = new Float64Array(m + 1);
    let prev = new Float64Array(m + 1);
    let cur = new Float64Array(m + 1);
    for (let j = 0; j <= m; j++)
        prev[j] = j * DEL_COST;
    for (let i = 1; i <= n; i++) {
        cur[0] = i * DEL_COST;
        let rowMin = cur[0];
        const ca = a[i - 1];
        for (let j = 1; j <= m; j++) {
            const cb = b[j - 1];
            const sub = prev[j - 1] + keySubCost(ca, cb);
            const del = prev[j] + DEL_COST;
            const ins = cur[j - 1] + DEL_COST;
            let best = sub < del ? (sub < ins ? sub : ins) : del < ins ? del : ins;
            if (i > 1 && j > 1 && ca === b[j - 2] && a[i - 2] === cb) {
                const tr = prev2[j - 2] + TRANS_COST;
                if (tr < best)
                    best = tr;
            }
            cur[j] = best;
            if (best < rowMin)
                rowMin = best;
        }
        if (rowMin > limit)
            return limit + 1;
        const tmp = prev2;
        prev2 = prev;
        prev = cur;
        cur = tmp;
    }
    return prev[m];
}
/** One-key neighbour substitutions of `word` (not the original). */
export function neighbourWords(word) {
    if (word.length < 3 || word.length > 18)
        return [];
    const out = [];
    const seen = new Set();
    for (let i = 0; i < word.length; i++) {
        const nbs = neighbourKeys(word[i]);
        if (!nbs)
            continue;
        const left = word.slice(0, i);
        const right = word.slice(i + 1);
        for (const n of nbs) {
            const variant = left + n + right;
            if (variant !== word && !seen.has(variant)) {
                seen.add(variant);
                out.push(variant);
            }
        }
    }
    return out;
}
export function compactAlnum(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
/** True when `a` is a likely mistype of `b`, not two unrelated nearby-key words. */
export function typoDistance(a, b) {
    if (a === b)
        return 0;
    const dist = keyboardDistance(a, b, 1.35);
    if (dist <= 0.6)
        return dist;
    if (Math.abs(a.length - b.length) === 1 && dist <= 1.3)
        return dist;
    return Number.POSITIVE_INFINITY;
}
