import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ScrollableTabs } from "./scrollable-tabs";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderTabs() {
  return render(
    <ScrollableTabs aria-label="Abas">
      <a href="#a" aria-current="page">
        A
      </a>
    </ScrollableTabs>,
  );
}

it("observes the tab strip itself and stops on unmount (DS-25)", () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    },
  );

  const { unmount } = renderTabs();

  expect(observe).toHaveBeenCalledWith(screen.getByRole("navigation", { name: "Abas" }));
  unmount();
  expect(disconnect).toHaveBeenCalled();
});

it("falls back to the window resize event without ResizeObserver", () => {
  vi.stubGlobal("ResizeObserver", undefined);
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");

  const { unmount } = renderTabs();
  unmount();

  expect(add).toHaveBeenCalledWith("resize", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
});
