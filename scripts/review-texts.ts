/**
 * Texts of the demo stores and products, without the "(demonstração)" markers the seeds used to add
 * (owner decision of 23/10/2026: the public site reads as production). The seeds create these texts
 * and scripts/review-clean-texts.ts rewrites rows created before the change.
 */

/** Markers the seeds used to append: " · demonstração" on stores, " (demonstração)" on products and brands. */
const NAME_MARKERS = [/ · demonstração/gu, / \(demonstração\)/gu, / Demonstração$/u] as const;

/** Sentence the seeds appended to every demo product description. */
const PRODUCT_NOTICE = /\s*Produto fictício criado para revisão visual[\s\S]*$/u;

/** What still reads as a demo marker after the cleanup; the cleanup reports any row that keeps one. */
export const DEMO_MARKER = /demonstra|fictíci|ilustrativ/iu;

export function withoutDemoMarkers(text: string): string {
  return NAME_MARKERS.reduce((current, marker) => current.replace(marker, ""), text);
}

export function withoutProductNotice(description: string): string {
  return description.replace(PRODUCT_NOTICE, "");
}

/** True when a stored name is the expected one, with or without the old marker. */
export function isSameDemoName(stored: string, expected: string): boolean {
  return withoutDemoMarkers(stored) === withoutDemoMarkers(expected);
}

export const DEMO_STORE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "review-garagem-mx": "Peças, equipamentos e acessórios de motocross, com atendimento de pista.",
  "review-box-77": "Transmissão, freios e luvas para motocross.",
  "review-oficina-pendente": "Oficina de manutenção e peças de motocross.",
  "review-trilha-forte":
    "Especializada em enduro e trilha: vestuário impermeável, proteções e acessórios para longas distâncias.",
  "review-racing-sul": "Preparação de motor, suspensão e transmissão para pilotos de competição.",
  "review-areia-motos": "Acessórios, óculos e consumíveis para pistas de areia, no Nordeste.",
  "review-cross-center": "Equipamentos de proteção: capacetes, botas, óculos e joelheiras.",
  "review-motopecas-nova": "Peças e acessórios para trilha e motocross.",
  "review-loja-suspensa": "Peças de reposição e pneus para motocross.",
  "review-loja-recusada": "Acessórios e peças para motocross.",
  "demo-pista-norte": "Equipamentos e peças de motocross para pista.",
  "demo-trilha-sul": "Equipamentos e peças para trilha e motocross.",
};

/** Products of scripts/seed-demo-catalog.ts, whose descriptions carried the notice mid-text. */
export const DEMO_CATALOG_PRODUCT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "demo-capacete-off-road-apex":
    "Capacete off-road com pala alongada, queixeira ventilada e acabamento preto fosco com detalhes laranja. Confira a certificação e a tabela de medidas antes de escolher.",
  "demo-botas-off-road-terra":
    "Par de botas off-road com cano alto, fivelas ajustáveis, reforço frontal e sola tratorada.",
  "demo-oculos-off-road-vista": "Óculos de motocross com armação preta, cinta elástica laranja e lente transparente.",
  "demo-disco-de-freio-onda": "Disco de freio dianteiro ondulado em aço.",
};

export function demoStoreDescription(slug: string): string {
  const description = DEMO_STORE_DESCRIPTIONS[slug];
  if (description === undefined) throw new Error(`No demo description for store ${slug}`);

  return description;
}

export function demoCatalogProductDescription(slug: string): string {
  const description = DEMO_CATALOG_PRODUCT_DESCRIPTIONS[slug];
  if (description === undefined) throw new Error(`No demo description for product ${slug}`);

  return description;
}

/** New description of a demo product: the catalog seed's fixed text, or the stored one without the notice. */
export function cleanProductDescription(slug: string, description: string): string {
  const fixed = DEMO_CATALOG_PRODUCT_DESCRIPTIONS[slug];
  if (fixed !== undefined) return fixed;

  return withoutProductNotice(description);
}

export function cleanOptionalText(text: string | null): string | null {
  if (text === null) return null;

  return withoutDemoMarkers(text);
}

/** One text column of one row: what it holds now and what the cleanup writes. */
export type TextFieldPlan = { field: string; current: string | null; next: string | null };

export type TextRowPlan = { table: string; id: string; label: string; fields: TextFieldPlan[] };

export function changedFields(row: TextRowPlan): TextFieldPlan[] {
  return row.fields.filter((field) => field.current !== field.next);
}

/** Fields that would still show a demo marker after the cleanup, for the report. */
export function stillMarkedFields(row: TextRowPlan): TextFieldPlan[] {
  return row.fields.filter((field) => field.next !== null && DEMO_MARKER.test(field.next));
}
