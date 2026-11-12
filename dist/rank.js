import { wordsOf } from "./embed";
import { compactAlnum, typoDistance } from "./qwerty";
const GENERIC_IDENTITY = new Set(["team", "law", "index", "html", "other", "legal", "news"]);
const FIRST_EXACT = 400;
const FIRST_PREFIX = 300;
const OTHER_EXACT = 220;
const OTHER_PREFIX = 160;
const IDENTITY_EXACT = 80;
const IDENTITY_PREFIX = 50;
const FUZZY_FIRST = 250;
const FUZZY_OTHER = 170;
const HUB_PREFIX_BONUS = 35;
const LEAF_MATCH_BONUS = 25;
const ITEM_PENALTY = 20;
const QUERY_LEN_STEP = 8;
function identityToken(url) {
    const segs = url.split("/").filter(Boolean);
    const last = segs[segs.length - 1] ?? "";
    const first = last.split("-")[0] ?? "";
    if (!first || GENERIC_IDENTITY.has(first))
        return "";
    return first;
}
function buildLexicon(docs) {
    const set = new Set();
    for (const doc of docs) {
        for (const w of wordsOf(doc.title)) {
            if (w.length >= 4)
                set.add(w);
        }
        const id = identityToken(doc.url);
        if (id.length >= 4)
            set.add(id);
    }
    return [...set];
}
/**
 * If the compact query is not already a prefix of a known title/slug word,
 * map it onto the closest lexicon entry (keyboard-aware edit distance).
 */
export function correctCompact(compact, lexicon) {
    if (compact.length < 4)
        return null;
    for (const w of lexicon) {
        if (w === compact || w.startsWith(compact))
            return null;
    }
    let best = null;
    for (const w of lexicon) {
        if (Math.abs(w.length - compact.length) > 2)
            continue;
        const dist = typoDistance(compact, w);
        if (!Number.isFinite(dist))
            continue;
        if (!best || dist < best.dist)
            best = { word: w, dist };
    }
    return best && best.dist > 0 ? best.word : null;
}
function wordScore(query, word, first, wholeQuery) {
    if (!query || !word)
        return 0;
    if (word === query)
        return first ? FIRST_EXACT : OTHER_EXACT;
    if (word.startsWith(query) && query.length >= 2) {
        if (query.length < 3 && !(wholeQuery && first))
            return 0;
        return (first ? FIRST_PREFIX : OTHER_PREFIX) + query.length * QUERY_LEN_STEP;
    }
    if (query.length >= 4 && Math.abs(word.length - query.length) <= 2) {
        const dist = typoDistance(query, word);
        if (Number.isFinite(dist)) {
            const base = first ? FUZZY_FIRST : FUZZY_OTHER;
            return Math.max(0, base - dist * 40);
        }
    }
    return 0;
}
function lexicalScore(query, corrected, doc) {
    const titleWords = wordsOf(doc.title);
    const compact = compactAlnum(query);
    const forms = [compact];
    if (corrected && !forms.includes(corrected))
        forms.push(corrected);
    for (const w of wordsOf(query)) {
        if (!forms.includes(w))
            forms.push(w);
    }
    let best = 0;
    let identityBoost = 0;
    const id = identityToken(doc.url);
    for (const form of forms) {
        for (let i = 0; i < titleWords.length; i++) {
            best = Math.max(best, wordScore(form, titleWords[i], i === 0, form === compact));
        }
        if (!id)
            continue;
        if (id === form)
            identityBoost = Math.max(identityBoost, IDENTITY_EXACT);
        else if (form.length >= 2 && id.startsWith(form) && (form.length >= 3 || form === compact)) {
            identityBoost = Math.max(identityBoost, IDENTITY_PREFIX + form.length * QUERY_LEN_STEP);
        }
        else if (form.length >= 4) {
            const dist = typoDistance(form, id);
            if (Number.isFinite(dist)) {
                identityBoost = Math.max(identityBoost, Math.max(0, 70 - dist * 40));
            }
        }
    }
    return best + identityBoost;
}
function kindBonus(doc, lexical, queryLen) {
    if (lexical < 50)
        return doc.kind === "item" ? -ITEM_PENALTY : 0;
    if (doc.kind === "item")
        return -ITEM_PENALTY;
    if (doc.kind === "hub")
        return HUB_PREFIX_BONUS;
    if (doc.kind === "leaf" && (queryLen >= 3 || lexical >= FIRST_PREFIX))
        return LEAF_MATCH_BONUS;
    return 0;
}
function mentions(doc, needles) {
    if (needles.length === 0)
        return false;
    const hay = `${doc.title} ${doc.heading} ${doc.snippet} ${doc.url}`.toLowerCase();
    return needles.some((n) => hay.includes(n));
}
export function rankHits(query, docs, cosine, k, lexicon) {
    const trimmed = query.trim();
    if (!trimmed)
        return [];
    const compact = compactAlnum(trimmed);
    const corrected = correctCompact(compact, lexicon);
    const cosineWeight = compact.length < 4 ? 0.5 : 4;
    const minCosine = compact.length < 3 ? 0.22 : 0.12;
    const needles = [compact, corrected].filter((n) => Boolean(n && n.length >= 4));
    const scored = [];
    let maxLex = 0;
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const lex = lexicalScore(trimmed, corrected, doc);
        const cos = cosine[i] ?? 0;
        if (lex > maxLex)
            maxLex = lex;
        scored.push({ doc, lex, cos });
    }
    const lexFloor = maxLex >= FIRST_PREFIX ? 80 : maxLex >= OTHER_EXACT ? OTHER_EXACT - 5 : 0;
    const ranked = [];
    for (const row of scored) {
        if (row.lex < lexFloor)
            continue;
        if (row.lex < 50) {
            if (needles.length > 0) {
                if (!mentions(row.doc, needles) && row.cos < 0.38)
                    continue;
            }
            else if (row.cos < minCosine) {
                continue;
            }
        }
        const score = row.lex + kindBonus(row.doc, row.lex, compact.length) + row.cos * cosineWeight;
        ranked.push({ ...row.doc, score, cosine: row.cos });
    }
    ranked.sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        if (a.kind !== b.kind) {
            const order = { leaf: 0, hub: 1, section: 2, item: 3 };
            return order[a.kind] - order[b.kind];
        }
        if (a.title.length !== b.title.length)
            return a.title.length - b.title.length;
        return a.url.localeCompare(b.url);
    });
    const hits = [];
    const seen = new Set();
    for (const row of ranked) {
        if (seen.has(row.url))
            continue;
        seen.add(row.url);
        hits.push(row);
        if (hits.length >= k)
            break;
    }
    return hits;
}
export function makeLexicon(docs) {
    return buildLexicon(docs);
}
