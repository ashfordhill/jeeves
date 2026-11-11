// Video search (Search query) in Search API: the product hooks its search query template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { SearchQueryPreset } from "../../runtime/search-query.ts";
import type { SearchQueryHooks } from "../../runtime/tile-search.ts";
import type { SearchIndexerIndexWriterDocument } from "../search-indexer/search-indexer-index-writer.hooks.ts";
import { NotImplemented } from "../../runtime/tile-process.ts";

/** A document of the index: Index writer's, whose hooks file holds its mapping. */
type Document = SearchIndexerIndexWriterDocument;

/** Each hook throws "Not implemented" until written; a search reaches Index writer's `mapping` first, then these; the first one it reaches answers 501. */
export function searchApiVideoSearchHooks(): SearchQueryHooks<Document> {
  return {
    /** The compiled query preset: the query for a search's text and page, and its sort. */
    preset(): SearchQueryPreset {
      throw new NotImplemented("preset for Video search");
    },
    /** What each hit answers: a document of the index, as a search shows it. */
    hit(document) {
      throw new NotImplemented("hit for Video search");
    },
  };
}
