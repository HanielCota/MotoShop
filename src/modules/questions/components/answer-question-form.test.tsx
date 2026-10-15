import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ answer: vi.fn() }));
vi.mock("@/modules/questions/actions/question-actions", () => ({ answerProductQuestionAction: mocks.answer }));

import { AnswerQuestionForm } from "./answer-question-form";

afterEach(cleanup);

it("asks for an answer in the browser before calling the server (BUG-011)", async () => {
  render(<AnswerQuestionForm questionId="cmf8w8m4p0000s6o5zj2q8v3k" />);

  fireEvent.click(screen.getByRole("button", { name: "Responder" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Escreva uma resposta.");
  expect(mocks.answer).not.toHaveBeenCalled();
});
