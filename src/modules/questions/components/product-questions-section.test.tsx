import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("./ask-question-form", () => ({ AskQuestionForm: () => null }));

import { ProductQuestionsSection } from "./product-questions-section";

const params = {
  reviewRating: null,
  reviewSort: "newest" as const,
  reviewPage: 1,
  questionPage: 1,
  questionSort: "newest" as const,
};

function renderSection(questionCount: number, questionSort: "newest" | "oldest" = "newest") {
  render(
    <ProductQuestionsSection
      slug="bota"
      productId="product-1"
      params={{ ...params, questionSort }}
      questions={[]}
      questionCount={questionCount}
      page={1}
      pageCount={1}
      signedIn={false}
    />,
  );
}

it("hides the sort with ten questions or fewer, where it takes more room than it helps", () => {
  renderSection(10);

  expect(screen.queryByLabelText("Ordenar perguntas")).not.toBeInTheDocument();
});

it("shows the sort from eleven questions on", () => {
  renderSection(11);
  expect(screen.getAllByLabelText("Ordenar perguntas").length).toBeGreaterThan(0);
});

it("keeps the sort while one is applied, even with few questions", () => {
  renderSection(2, "oldest");
  expect(screen.getAllByLabelText("Ordenar perguntas").length).toBeGreaterThan(0);
});
