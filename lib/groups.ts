import "server-only";
import { getPublishedBySlug, incrementPublishedViews } from "./published";
import type { GroupRecord } from "./types";

/** Fetch one published group by slug. Returns null if not found. */
export const getGroupBySlug = (slug: string) => getPublishedBySlug<GroupRecord>("groups", slug);
export const incrementGroupViews = (slug: string) => incrementPublishedViews("groups", slug);
