// A revision means the draft has already become a cloud record. It must never
// be restored as a new-card request, or retry protection reopens that record.
export function isCompletedNewDraft(draft: unknown): boolean {
  return typeof draft === "object" && draft !== null &&
    "revision" in draft && typeof draft.revision === "number" &&
    Number.isInteger(draft.revision) && draft.revision >= 0;
}
