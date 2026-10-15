import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectionStatusNotice } from "./connection-status-notice";

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ConnectionStatusNotice", () => {
  it("shows nothing while the browser is online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<ConnectionStatusNotice />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("warns when the connection drops and goes away when it returns", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<ConnectionStatusNotice />);

    setOnline(false);
    expect(screen.getByRole("status")).toHaveTextContent("Sem conexão com a internet.");

    setOnline(true);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
