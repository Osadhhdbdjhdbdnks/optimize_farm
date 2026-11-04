import type { Metadata } from "next";
import { PantrySearch } from "@/components/pantry-search";

export const metadata: Metadata = {
  title: "Pantry | Microbe Farm",
  description:
    "Browse the Microbe Farm pantry: fresh fruit, tropical goodness and savoury produce, grouped by category.",
};

export default function PantryPage() {
  return (
    <>
      <section className="pantry-hero">
        <p className="story-kicker">Pantry</p>
        <h1 className="pantry-hero__title">The harvest, shelved.</h1>
        <p className="pantry-hero__lead">
          Every fruit begins in our orchards. Browse the pantry by category and
          discover the flavour of Sicily at its source.
        </p>
      </section>

      <PantrySearch />
    </>
  );
}