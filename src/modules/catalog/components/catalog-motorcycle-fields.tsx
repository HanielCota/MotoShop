"use client";

import { useState } from "react";

import { DesignSelect } from "@/components/ui/design-select";
import {
  findFirstFitmentForManufacturer,
  findFirstFitmentForModel,
  formatFitmentVariantLabel,
  getFitmentCascade,
  type FitmentOption,
} from "@/modules/motorcycles/domain/fitment-options";

/**
 * Motorcycle filter as three linked fields (manufacturer → model → year/version), like the home finder.
 * The form still submits a single `moto` value: the selected fitment, or "all" when none is chosen.
 */
export function CatalogMotorcycleFields({
  fitments,
  defaultFitmentId,
  fieldClassName,
}: {
  fitments: FitmentOption[];
  defaultFitmentId: string;
  fieldClassName: string;
}) {
  const [selectedId, setSelectedId] = useState(defaultFitmentId);
  const selected = fitments.find((fitment) => fitment.id === selectedId);
  const { manufacturers, models, variants } = getFitmentCascade(fitments, selected);

  function chooseManufacturer(manufacturer: string) {
    setSelectedId(manufacturer ? (findFirstFitmentForManufacturer(fitments, manufacturer)?.id ?? "") : "");
  }

  function chooseModel(model: string) {
    if (!selected) return;
    setSelectedId(findFirstFitmentForModel(fitments, selected.manufacturer, model)?.id ?? selected.id);
  }

  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="mb-2 text-sm font-semibold">Compatibilidade com moto</legend>
      <input type="hidden" name="moto" value={selected ? selected.id : "all"} />
      <label className={fieldClassName}>
        Fabricante
        <DesignSelect
          aria-label="Fabricante"
          value={selected?.manufacturer ?? ""}
          onValueChange={(value) => chooseManufacturer(String(value))}
        >
          <option value="">Todos os fabricantes</option>
          {manufacturers.map((manufacturer) => (
            <option key={manufacturer} value={manufacturer}>
              {manufacturer}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className={fieldClassName}>
        Modelo
        <DesignSelect
          aria-label="Modelo"
          disabled={!selected}
          value={selected?.model ?? ""}
          onValueChange={(value) => chooseModel(String(value))}
        >
          {selected ? null : <option value="">Todos os modelos</option>}
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className={fieldClassName}>
        Ano e versão
        <DesignSelect
          aria-label="Ano e versão"
          disabled={!selected}
          value={selected?.id ?? ""}
          onValueChange={(value) => setSelectedId(String(value))}
        >
          {selected ? null : <option value="">Todos os anos</option>}
          {variants.map((fitment) => (
            <option key={fitment.id} value={fitment.id}>
              {formatFitmentVariantLabel(fitment)}
            </option>
          ))}
        </DesignSelect>
      </label>
    </fieldset>
  );
}
