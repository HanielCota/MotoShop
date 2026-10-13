const categoryLabels: Record<string, string> = {
  parts: "Peças",
  apparel: "Vestuário",
  equipment: "Equipamentos",
  "parts-engine": "Motor",
  "parts-transmission": "Transmissão",
  "parts-suspension": "Suspensão",
  "parts-brakes": "Freios",
  "parts-accessories": "Acessórios",
  "equipment-helmets": "Capacetes",
  "equipment-boots": "Botas",
  "equipment-goggles": "Óculos",
};

export function getCategoryLabel(category: { slug: string; name: string }) {
  return categoryLabels[category.slug] ?? category.name;
}

type LabeledCategory = { slug: string; name: string; parent?: { slug: string; name: string } | null };

/** Label shown in category pickers: "Parent / Child" for subcategories, so each stays next to its parent. */
export function getCategoryOptionLabel(category: LabeledCategory) {
  const label = getCategoryLabel(category);
  return category.parent ? `${getCategoryLabel(category.parent)} / ${label}` : label;
}

/** Alphabetical by the Portuguese label customers see, not by the admin sort order. */
export function sortCategoriesByOptionLabel<T extends LabeledCategory>(categories: readonly T[]): T[] {
  return [...categories].sort((first, second) =>
    getCategoryOptionLabel(first).localeCompare(getCategoryOptionLabel(second), "pt-BR"),
  );
}
