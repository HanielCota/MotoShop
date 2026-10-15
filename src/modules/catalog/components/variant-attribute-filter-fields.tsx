import { DesignSelect } from "@/components/ui/design-select";
import { variantGenderLabels, type VariantGenderValue } from "@/modules/products/domain/variant-attributes";

export type VariantAttributeOptions = {
  genders: VariantGenderValue[];
  colors: string[];
  sizes: string[];
};

export type VariantAttributeValues = {
  gender: VariantGenderValue | null;
  color: string | null;
  size: string | null;
};

/**
 * Gender, color and size selects for the public filter forms. A field without any public value is
 * left out, so customers never see an empty choice.
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
      {options.genders.length > 0 ? (
        <label className={fieldClassName}>
          Gênero
          <DesignSelect aria-label="Gênero" name="gender" defaultValue={values.gender ?? ""}>
            <option value="">Todos os gêneros</option>
            {options.genders.map((gender) => (
              <option key={gender} value={gender}>
                {variantGenderLabels[gender]}
              </option>
            ))}
          </DesignSelect>
        </label>
      ) : null}
      <AttributeSelect
        label="Cor"
        name="color"
        allLabel="Todas as cores"
        choices={options.colors}
        value={values.color}
        fieldClassName={fieldClassName}
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

function AttributeSelect({
  label,
  name,
  allLabel,
  choices,
  value,
  fieldClassName,
}: {
  label: string;
  name: string;
  allLabel: string;
  choices: string[];
  value: string | null;
  fieldClassName: string;
}) {
  if (choices.length === 0) return null;

  return (
    <label className={fieldClassName}>
      {label}
      <DesignSelect aria-label={label} name={name} defaultValue={value ?? ""}>
        <option value="">{allLabel}</option>
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
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
