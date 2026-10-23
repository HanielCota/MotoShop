import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    <img src={src} alt={alt} onError={onError} />
  ),
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
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} expiresAt={Date.now() + 60_000} />);

  expect(screen.getByRole("link", { name: "Abrir foto 1 em tamanho real" })).toHaveAttribute(
    "href",
    "https://ik.example/a.jpg?ik-s=1",
  );
  expect(screen.queryByText("Os links das fotos expiraram.")).not.toBeInTheDocument();
});

it("says the links expired when their time is up, and asks the server for fresh ones", () => {
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} expiresAt={Date.now() + 60_000} />);

  act(() => {
    vi.advanceTimersByTime(60_000);
  });

  expect(screen.getByText("Os links das fotos expiraram.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mostrar as fotos de novo" }));
  expect(refresh).toHaveBeenCalledOnce();
});

it("renews the links instead of opening an expired photo", () => {
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} expiresAt={Date.now() - 1} />);
  act(() => {
    vi.advanceTimersByTime(0);
  });

  const opened = fireEvent.click(screen.getByRole("link", { name: "Abrir foto 1 em tamanho real" }));

  expect(opened).toBe(false);
  expect(refresh).toHaveBeenCalledOnce();
});

it("treats a thumbnail that fails to load as an expired link", () => {
  render(<ReturnPhotoLinks title="Fotos do cliente" photos={photos} expiresAt={Date.now() + 60_000} />);

  fireEvent.error(screen.getByRole("img", { name: "Foto 1 da devolução" }));

  expect(screen.getByText("Os links das fotos expiraram.")).toBeInTheDocument();
});
