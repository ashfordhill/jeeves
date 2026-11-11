// Index writer (Index writer) in Search indexer: the product hooks its search indexing template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { SearchMapping } from "../../runtime/search-contract.ts";
import type { SearchIndexHooks } from "../../runtime/tile-search.ts";
import { NotImplemented } from "../../runtime/tile-process.ts";

/** A document of the index: exactly the fields its mapping names. */
export type SearchIndexerIndexWriterDocument = Record<string, unknown>;

/** Each hook throws "Not implemented" until written; the process asserts the index once `mapping` is, and the first one a message reaches sends it to .failed. The search query on this index reads `mapping` and `document` too. */
export function searchIndexerIndexWriterHooks(): SearchIndexHooks<SearchIndexerIndexWriterDocument> {
  return {
    /** The index's explicit mapping: its version and each field's type. */
    mapping(): SearchMapping<SearchIndexerIndexWriterDocument> {
      throw new NotImplemented("mapping for Index writer");
    },
    document: {
      /** Parses a document: exactly the mapping's fields, refusing any other. */
      parse(input) {
        throw new NotImplemented("document.parse for Index writer");
      },
      /** A document's ID in the index. */
      id(document) {
        throw new NotImplemented("document.id for Index writer");
      },
      /** A document's version: a repeat or an older one never overwrites a newer one. */
      version(document) {
        throw new NotImplemented("document.version for Index writer");
      },
    },
    /** Parses a message from its events subscriber: its event ID (the message's ID) and its document. */
    event(raw, messageId) {
      throw new NotImplemented("event for Index writer");
    },
  };
}
