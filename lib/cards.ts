import "server-only";
import { getPublishedBySlug, incrementPublishedViews } from "./published";
import type { CardRecord } from "./types";

/** Fetch one published card by slug. Returns null if not found. */
export const getCardBySlug = (slug: string) => getPublishedBySlug<CardRecord>("cards", slug);
export const incrementViews = (slug: string) => incrementPublishedViews("cards", slug);
