"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ScrollableTabsProps = {
  "aria-label": string;
  children: ReactNode;
  /** Classes for the scrolling <nav>. */
  className?: string;
  /** Classes for the outer wrapper (e.g. negative margins to bleed to the screen edge). */
  wrapperClassName?: string;
  /** Changes whenever the active tab may change (usually the pathname). */
  activeKey?: string;
  /** Tailwind `from-*` color of the edge fades; must match the background behind the tabs. */
  fadeFromClassName?: string;
};

/**
 * Horizontal tab strip for small screens: keeps the `aria-current="page"` item centred,
 * hides the scrollbar and fades the edge that has more tabs to scroll to.
 */
export function ScrollableTabs({
  children,
  className,
  wrapperClassName,
  activeKey,
  fadeFromClassName = "from-background",
  ...props
}: ScrollableTabsProps) {
  const navRef = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const updateOverflow = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const start = nav.scrollLeft > 4;
    const end = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4;
    setOverflow((current) => (current.start === start && current.end === end ? current : { start, end }));
  }, []);

  // Keeps the active tab visible without scrolling the page vertically.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active && nav.scrollWidth > nav.clientWidth) {
      const left = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
      if (typeof nav.scrollTo === "function") nav.scrollTo({ left: Math.max(0, left) });
    }
    updateOverflow();
  }, [activeKey, updateOverflow]);

  // Observa a própria faixa (DS-25): também reage quando o contêiner muda de largura sem a janela mudar.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOverflow);
      return () => window.removeEventListener("resize", updateOverflow);
    }
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [updateOverflow]);

  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r to-transparent transition-opacity",
          fadeFromClassName,
          overflow.start ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l to-transparent transition-opacity",
          fadeFromClassName,
          overflow.end ? "opacity-100" : "opacity-0",
        )}
      />
      <nav
        ref={navRef}
        onScroll={updateOverflow}
        aria-label={props["aria-label"]}
        className={cn(
          "flex [scrollbar-width:none] overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {children}
      </nav>
    </div>
  );
}
