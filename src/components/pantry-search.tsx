"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { buildSearchIndex, searchPantry } from "@/lib/search";
import { categories, productsByCategory } from "@/data/products";

/**
 * Pantry search UI, modelled on Apple Notes search:
 * - a search field filters results live as you type
 * - the query is mirrored into the `?q=` URL param (shareable/back button)
 * - empty query shows the normal grouped browse view
 * - no-match state offers a clear action
 */
function PantrySearchInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when the URL changes externally (back button, shared link).
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const index = useMemo(() => buildSearchIndex(), []);
  const results = useMemo(() => searchPantry(query, index), [query, index]);
  const trimmed = query.trim();

  // Debounced replace of ?q= so typing doesn't flood history.
  useEffect(() => {
    const t = setTimeout(() => {
      const url = trimmed ? `${pathname}?q=${encodeURIComponent(trimmed)}` : pathname;
      if (`${window.location.pathname}${window.location.search}` === url) return;
      router.replace(url, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [trimmed, pathname, router]);

  return (
    <>
      <div className="pantry-search">
        <label className="pantry-search__field">
          <svg
            className="pantry-search__icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="pantry-search__input"
            placeholder="Search the pantry…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the pantry"
          />
          {trimmed ? (
            <button
              type="button"
              className="pantry-search__clear"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </label>
      </div>

      {!trimmed ? (
        /* No query → default grouped browse view */
        categories.map((c) => {
          const items = productsByCategory[c.slug] ?? [];
          if (!items.length) return null;
          return (
            <section key={c.slug} className="pantry-category">
              <header className="pantry-category__head">
                <h2 className="pantry-category__title">{c.label}</h2>
                <p className="pantry-category__blurb">{c.blurb}</p>
              </header>
              <div className="pantry-grid">
                {items.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            </section>
          );
        })
      ) : results.length ? (
        <section className="pantry-category">
          <header className="pantry-category__head">
            <h2 className="pantry-category__title">
              {results.length} {results.length === 1 ? "result" : "results"}
            </h2>
            <p className="pantry-category__blurb">
              Matching “{trimmed}” across names, categories and descriptions.
            </p>
          </header>
          <div className="pantry-grid">
            {results.map((r) => (
              <ProductCard
                key={r.slug}
                product={{
                  slug: r.slug,
                  name: r.title,
                  fruit: r.title,
                  category: "",
                  image: r.image,
                  turns: [],
                  model: "",
                  description: r.body,
                }}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="pantry-empty">
          <p className="pantry-empty__title">No matches for “{trimmed}”.</p>
          <button
            type="button"
            className="pantry-empty__reset"
            onClick={() => setQuery("")}
          >
            Clear search
          </button>
        </section>
      )}
    </>
  );
}

export function PantrySearch() {
  return (
    <Suspense fallback={<div className="pantry-search" aria-hidden />}>
      <PantrySearchInner />
    </Suspense>
  );
}
