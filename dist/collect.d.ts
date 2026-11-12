import type { SearchMeta } from "./format";
/** One searchable document. Site-specific collectors should return this shape. */
export type CollectedDoc = SearchMeta & {
    titleText: string;
    description: string;
    bodyText: string;
};
export type CollectFn = (contentDir: string) => CollectedDoc[];
export declare function stripMarkdown(text: string): string;
/**
 * One document per markdown file.
 *
 * Frontmatter may set `title`, `url`, `section`, `description`, `heading`, and
 * `kind` (`leaf`, `hub`, `section`, `item`). Missing `url` is derived from the
 * file path. This collector does not apply site URL maps. Pass your own
 * `CollectFn` when pages, hubs, or profiles need custom addresses.
 */
export declare function collectMarkdown(contentDir: string): CollectedDoc[];
