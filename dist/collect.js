import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const KINDS = new Set(["leaf", "hub", "section", "item"]);
function walkMarkdown(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        if (name.startsWith("."))
            continue;
        const path = join(dir, name);
        const st = statSync(path);
        if (st.isDirectory())
            out.push(...walkMarkdown(path));
        else if (name.endsWith(".md") || name.endsWith(".mdx"))
            out.push(path);
    }
    return out;
}
function parseFrontmatter(raw) {
    if (!raw.startsWith("---"))
        return { data: {}, body: raw };
    const end = raw.indexOf("\n---", 3);
    if (end === -1)
        return { data: {}, body: raw };
    const yaml = raw.slice(4, end);
    const body = raw.slice(end + 4).replace(/^\s*\n/, "");
    const data = {};
    for (const line of yaml.split("\n")) {
        const m = line.match(/^([A-Za-z][\w]*)\s*:\s*(.*)$/);
        if (!m)
            continue;
        data[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return { data, body };
}
export function stripMarkdown(text) {
    return text
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`[^`]+`/g, " ")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^\s*\|.*\|$/gm, (row) => row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
        .join(" "))
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/[*_~]+/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/[|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function snippetOf(text, max = 160) {
    const clean = stripMarkdown(text);
    if (clean.length <= max)
        return clean;
    const cut = clean.slice(0, max);
    const sp = cut.lastIndexOf(" ");
    return `${sp > 80 ? cut.slice(0, sp) : cut}…`;
}
function humanize(slug) {
    return slug
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
function urlFromPath(rel) {
    const noExt = rel.replace(/\.mdx?$/, "");
    const trimmed = noExt.replace(/\/index$/, "").replace(/^index$/, "");
    if (!trimmed)
        return "/";
    return `/${trimmed}/`;
}
function titleFromPath(rel) {
    const parts = rel.replace(/\.mdx?$/, "").split("/");
    const name = parts[parts.length - 1] ?? "page";
    if (name === "index") {
        const parent = parts[parts.length - 2];
        return parent ? humanize(parent) : "Home";
    }
    return humanize(name);
}
function kindOf(value) {
    if (value && KINDS.has(value))
        return value;
    return "leaf";
}
function sectionOf(rel, data) {
    if (data.section)
        return data.section;
    const parts = rel.split("/");
    if (parts.length > 1 && parts[0])
        return humanize(parts[0]);
    return "Pages";
}
/**
 * One document per markdown file.
 *
 * Frontmatter may set `title`, `url`, `section`, `description`, `heading`, and
 * `kind` (`leaf`, `hub`, `section`, `item`). Missing `url` is derived from the
 * file path. This collector does not apply site URL maps. Pass your own
 * `CollectFn` when pages, hubs, or profiles need custom addresses.
 */
export function collectMarkdown(contentDir) {
    const docs = [];
    for (const path of walkMarkdown(contentDir)) {
        const rel = relative(contentDir, path).replaceAll("\\", "/");
        const raw = readFileSync(path, "utf8");
        const { data, body } = parseFrontmatter(raw);
        const stripped = stripMarkdown(body);
        const title = data.title || titleFromPath(rel);
        const description = data.description ?? "";
        const heading = data.heading || title;
        const titleText = title.trim();
        const bodyText = stripped.trim();
        if (titleText.length + bodyText.length < 12)
            continue;
        docs.push({
            title: title.trim(),
            url: data.url || urlFromPath(rel),
            section: sectionOf(rel, data),
            heading: heading.trim(),
            snippet: snippetOf(description || stripped),
            kind: kindOf(data.kind),
            titleText,
            description: description.trim(),
            bodyText,
        });
    }
    return docs;
}
