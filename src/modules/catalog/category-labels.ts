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
