/** Opção de moto (fabricante → modelo → ano/versão) usada no seletor "Comprar por moto". */
export type FitmentOption = {
  id: string;
  manufacturer: string;
  model: string;
  version: string;
  displacementCc: number;
  year: number;
};

/**
 * Uma única moto é a fonte de verdade de todos os campos do seletor. A seleção
 * explícita da URL tem prioridade sobre a moto principal salva; ids desconhecidos
 * caem para a moto principal e depois para a primeira opção disponível.
 */
export function resolveSelectedFitment(
  fitments: FitmentOption[],
  selectedId: string | null | undefined,
  primaryId?: string | null,
): FitmentOption | undefined {
  return (
    fitments.find((fitment) => fitment.id === selectedId) ??
    fitments.find((fitment) => fitment.id === primaryId) ??
    fitments[0]
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export type FitmentCascade = {
  manufacturers: string[];
  models: string[];
  /** Variações (ano/versão/cilindrada) do modelo selecionado. */
  variants: FitmentOption[];
};

export function getFitmentCascade(fitments: FitmentOption[], selected: FitmentOption | undefined): FitmentCascade {
  if (!selected)
    return { manufacturers: unique(fitments.map((fitment) => fitment.manufacturer)), models: [], variants: [] };
  const manufacturerFitments = fitments.filter((fitment) => fitment.manufacturer === selected.manufacturer);
  return {
    manufacturers: unique(fitments.map((fitment) => fitment.manufacturer)),
    models: unique(manufacturerFitments.map((fitment) => fitment.model)),
    variants: manufacturerFitments.filter((fitment) => fitment.model === selected.model),
  };
}

/** Primeira moto do fabricante escolhido — ao trocar o fabricante, modelo e ano acompanham. */
export function findFirstFitmentForManufacturer(fitments: FitmentOption[], manufacturer: string) {
  return fitments.find((fitment) => fitment.manufacturer === manufacturer);
}

/** Primeira moto do modelo escolhido, sem herdar o ano/versão de outro modelo. */
export function findFirstFitmentForModel(fitments: FitmentOption[], manufacturer: string, model: string) {
  return fitments.find((fitment) => fitment.manufacturer === manufacturer && fitment.model === model);
}

/** Rótulo do campo "Ano e versão", ex.: "2025 · Special · 250 cc". */
export function formatFitmentVariantLabel(fitment: FitmentOption) {
  return [fitment.year, fitment.version, `${fitment.displacementCc} cc`].filter(Boolean).join(" · ");
}
