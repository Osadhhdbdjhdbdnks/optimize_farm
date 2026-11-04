// src/lib/search.ts

import { categories, products, type Product } from "@/data/products";
import { PRODUCT_DETAILS, DEFAULT_DETAIL } from "@/data/product-details";

/**
 * A single searchable entry in the pantry index.
 * Modelled on how Notes-style search works: every record carries a small set
 * of weighted text fields (title / body / tags), and the query is matched
 * against all of them at once.
 */
export type SearchItem = {
  slug: string;
  /** Primary display text — searched with the highest weight (like a note title). */
  title: string;
  /** Free-text content — searched like note body text. */
  body: string;
  /** Category label — searched like notebook/tag facets. */
  category: string;
  image: string;
  score: number;
};

const WEIGHT_TITLE = 8;
const WEIGHT_CATEGORY = 4;
const WEIGHT_BODY = 1;

const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents: "papaya" matches "papaiá"
    .toLowerCase();

/** Build the search index once per server render (static data, cheap to rebuild). */
export function buildSearchIndex(): SearchItem[] {
  const categoryLabels = new Map(categories.map((c) => [c.slug, c.label]));
  return products.map((p: Product) => {
    const d = PRODUCT_DETAILS[p.slug] ?? DEFAULT_DETAIL;
    return {
      slug: p.slug,
      title: p.name,
      body: [p.description, d.lead, d.tips].filter(Boolean).join(" "),
      category: categoryLabels.get(p.category) ?? p.category,
      image: p.image,
      score: 0,
    };
  });
}

/**
 * Score one item against a whitespace-separated query.
 * All terms must appear somewhere (AND semantics, like Notes search);
 * matches in the title count more than matches in the body.
 * Returns 0 when any term is missing.
 */
export function scoreItem(item: SearchItem, normalizedTerms: string[]): number {
  if (!normalizedTerms.length) return 0;
  const title = normalize(item.title);
  const category = normalize(item.category);
  const body = normalize(item.body);
  let score = 0;
  for (const term of normalizedTerms) {
    let termScore = 0;
    if (title.includes(term)) termScore += WEIGHT_TITLE;
    if (category.includes(term)) termScore += WEIGHT_CATEGORY;
    if (body.includes(term)) termScore += WEIGHT_BODY;
    if (termScore === 0) return 0; // AND semantics: every term must match
    score += termScore;
  }
  return score;
}

/** Run a query over the index and return matches sorted by relevance. */
export function searchPantry(query: string, index: SearchItem[]): SearchItem[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return index
    .map((item) => ({ ...item, score: scoreItem(item, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
