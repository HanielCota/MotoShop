import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
type ImageMockProps = { src: string; alt: string; onError?: () => void };
vi.mock("next/image", () => ({
  // oxlint-disable-next-line nextjs/no-img-element
  default: ({ src, alt, onError }: ImageMockProps) => <img src={src} alt={alt} onError={onError} />,
}));

import { ReturnPhotoLinks } from "./return-photo-links";

const photos = [
  {
    id: "photo-1",
    thumbnailUrl: "https://ik.example/tr:w-160/a.jpg?ik-s=1",
    fullUrl: "https://ik.example/a.jpg?ik-s=1",
  },
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  refresh.mockReset();
});

it("keeps the photos clickable while the signed links are valid", () => {
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} validForMs={60_000} />);

  expect(screen.getByRole("link", { name: "Abrir foto 1 em tamanho real" })).toHaveAttribute(
    "href",
    "https://ik.example/a.jpg?ik-s=1",
  );
  expect(screen.queryByText("Os links das fotos expiraram.")).not.toBeInTheDocument();
});

it("says the links expired when their time is up, and asks the server for fresh ones", () => {
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} validForMs={60_000} />);

  act(() => {
    vi.advanceTimersByTime(60_000);
  });

  expect(screen.getByText("Os links das fotos expiraram.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mostrar as fotos de novo" }));
  expect(refresh).toHaveBeenCalledOnce();
});

it("renews the links instead of opening an expired photo", () => {
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} validForMs={0} />);
  act(() => {
    vi.advanceTimersByTime(0);
  });

  const opened = fireEvent.click(screen.getByRole("link", { name: "Abrir foto 1 em tamanho real" }));

  expect(opened).toBe(false);
  expect(refresh).toHaveBeenCalledOnce();
});

it("treats a thumbnail that fails to load as an expired link", () => {
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} validForMs={60_000} />);

  fireEvent.error(screen.getByRole("img", { name: "Foto 1 da devolução" }));

  expect(screen.getByText("Os links das fotos expiraram.")).toBeInTheDocument();
});

it("ignores the device clock: a phone set ten minutes ahead still shows the fresh photos", () => {
  vi.setSystemTime(Date.now() + 10 * 60_000);
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} validForMs={60_000} />);

  act(() => {
    vi.advanceTimersByTime(59_000);
  });

  expect(screen.queryByText("Os links das fotos expiraram.")).not.toBeInTheDocument();
});

it("renews the links on click when the device slept past their validity and the timer stood still", () => {
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} validForMs={60_000} />);

  // The wall clock moves on while the device sleeps; the pending timer does not fire.
  vi.setSystemTime(Date.now() + 11 * 60_000);
  const opened = fireEvent.click(screen.getByRole("link", { name: "Abrir foto 1 em tamanho real" }));

  expect(opened).toBe(false);
  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.getByText("Os links das fotos expiraram.")).toBeInTheDocument();
});

it("says the links expired as soon as the page comes back after their validity", () => {
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} validForMs={60_000} />);

  vi.setSystemTime(Date.now() + 11 * 60_000);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(screen.getByText("Os links das fotos expiraram.")).toBeInTheDocument();
});

it("keeps the photos clickable when the page comes back within their validity", () => {
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} validForMs={60_000} />);

  vi.setSystemTime(Date.now() + 30_000);
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
  const opened = fireEvent.click(screen.getByRole("link", { name: "Abrir foto 1 em tamanho real" }));

  expect(opened).toBe(true);
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.queryByText("Os links das fotos expiraram.")).not.toBeInTheDocument();
});
