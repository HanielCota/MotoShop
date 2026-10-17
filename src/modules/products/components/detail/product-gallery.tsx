"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type GalleryImage = { id: string; url: string; alt: string };

export function ProductGallery({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  return (
    <div className="min-w-0">
      <div className="border-border bg-surface-sunken relative aspect-[6/5] overflow-hidden rounded-3xl border sm:aspect-square">
        {active ? (
          <Image
            key={active.id}
            src={active.url}
            alt={active.alt}
            fill
            loading={activeIndex === 0 ? "eager" : "lazy"}
            fetchPriority={activeIndex === 0 ? "high" : "auto"}
            unoptimized
            sizes="(max-width: 767px) 100vw, 50vw"
            className="object-contain"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm">
            Imagem do produto em preparação
          </div>
        )}
      </div>
      {images.length > 1 ? (
        <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5" aria-label="Imagens do produto">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Ver imagem ${index + 1} de ${images.length} de ${productName}`}
                aria-pressed={index === activeIndex}
                className={cn(
                  "bg-surface-sunken relative block aspect-square w-full overflow-hidden rounded-xl border transition-[border-color,box-shadow]",
                  "focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none",
                  index === activeIndex
                    ? "border-moto-brand ring-moto-brand/30 ring-2"
                    : "border-border hover:border-foreground/30",
                )}
              >
                <Image src={image.url} alt="" fill unoptimized sizes="120px" className="object-contain" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
