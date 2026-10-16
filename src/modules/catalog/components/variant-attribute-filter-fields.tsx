import type { ReactNode } from "react";

import { DesignSelect } from "@/components/ui/design-select";
import {
  variantGenderLabels,
  variantGenderValues,
  type VariantGenderValue,
} from "@/modules/products/domain/variant-attributes";

import { colorSwatchBackground } from "../domain/color-swatch";

export type VariantAttributeOptions = {
  colors: string[];
  sizes: string[];
};

export type VariantAttributeValues = {
  gender: VariantGenderValue | null;
  color: string | null;
  size: string | null;
};

/**
 * Gender, color and size selects for the public filter forms. Gender always offers Masculino,
 * Feminino and Unissex; color and size are left out when no public product has a value,
 * so customers never see an empty choice.
 */
export function VariantAttributeFilterFields({
  options,
  values,
  fieldClassName,
}: {
  options: VariantAttributeOptions;
  values: VariantAttributeValues;
  fieldClassName: string;
}) {
  return (
    <>
      <label className={fieldClassName}>
        Gênero
        <DesignSelect aria-label="Gênero" name="gender" defaultValue={values.gender ?? ""}>
          <option value="">Todos os gêneros</option>
          {variantGenderValues.map((gender) => (
            <option key={gender} value={gender}>
              {variantGenderLabels[gender]}
            </option>
          ))}
        </DesignSelect>
      </label>
      <AttributeSelect
        label="Cor"
        name="color"
        allLabel="Todas as cores"
        choices={options.colors}
        value={values.color}
        fieldClassName={fieldClassName}
        renderChoice={(color) => <ColorChoice name={color} />}
      />
      <AttributeSelect
        label="Tamanho"
        name="size"
        allLabel="Todos os tamanhos"
        choices={options.sizes}
        value={values.size}
        fieldClassName={fieldClassName}
      />
    </>
  );
}

/** Color name with a small swatch; the swatch is decorative, the name is what is read and sent. */
function ColorChoice({ name }: { name: string }) {
  const background = colorSwatchBackground(name);
  if (!background) return name;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        data-testid="color-swatch"
        className="border-foreground/25 inline-block size-3.5 shrink-0 rounded-[3px] border"
        style={{ background }}
      />
      {name}
    </span>
  );
}

function AttributeSelect({
  label,
  name,
  allLabel,
  choices,
  value,
  fieldClassName,
  renderChoice,
}: {
  label: string;
  name: string;
  allLabel: string;
  choices: string[];
  value: string | null;
  fieldClassName: string;
  renderChoice?: (choice: string) => ReactNode;
}) {
  if (choices.length === 0) return null;

  return (
    <label className={fieldClassName}>
      {label}
      <DesignSelect aria-label={label} name={name} defaultValue={value ?? ""}>
        <option value="">{allLabel}</option>
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {renderChoice ? renderChoice(choice) : choice}
          </option>
        ))}
      </DesignSelect>
    </label>
  );
}

/** Active-filter chip labels, e.g. "Cor: Preto". */
export function variantAttributeChipLabels(values: VariantAttributeValues) {
  return {
    gender: values.gender ? `Gênero: ${variantGenderLabels[values.gender]}` : null,
    color: values.color ? `Cor: ${values.color}` : null,
    size: values.size ? `Tamanho: ${values.size}` : null,
  };
}
