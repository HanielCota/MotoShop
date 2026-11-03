import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/shared/storage/public-storage-url", () => ({ getPublicStorageUrl: () => null }));

import { ProductReviewsSection } from "./product-reviews-section";

afterEach(cleanup);

const params = {
  reviewRating: null,
  reviewSort: "newest",
  reviewPage: 1,
  questionPage: 1,
  questionSort: "newest",
} as const;
const distribution = ([5, 4, 3, 2, 1] as const).map((stars) => ({ stars, count: 0, percentage: 0 }));

function renderSection(reviewCount: number, reviewRating: number | null = null) {
  render(
    <ProductReviewsSection
      slug="capacete"
      params={{ ...params, reviewRating }}
      reviews={[]}
      average={reviewCount > 0 ? 4.5 : null}
      reviewCount={reviewCount}
      distribution={distribution}
      page={1}
      pageCount={1}
    />,
  );
}

it("hides the rating filter and sort while there are only a few reviews", () => {
  renderSection(4);

  expect(screen.queryByText("Nota mínima")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Aplicar" })).not.toBeInTheDocument();
});

it("shows filter and sort without an apply button from eleven reviews on", () => {
  renderSection(11);

  expect(screen.getByText("Nota mínima")).toBeInTheDocument();
  expect(screen.getByText("Ordenar avaliações")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Aplicar" })).not.toBeInTheDocument();
});

it("hides filter and sort with ten reviews or fewer, where they take more room than the reviews", () => {
  renderSection(10);

  expect(screen.queryByText("Nota mínima")).not.toBeInTheDocument();
});

it("keeps the filter visible while one is applied, so it can be removed", () => {
  renderSection(1, 5);

  expect(screen.getByText("Nota mínima")).toBeInTheDocument();
});
