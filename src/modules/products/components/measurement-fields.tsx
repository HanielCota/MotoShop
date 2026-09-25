import { measurementFields, type Measurements } from "../domain/product-commercial-fields";

export function MeasurementFields({ values = {}, variant = false }: { values?: Measurements; variant?: boolean }) {
  return (
    <fieldset className="grid min-w-0 gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-sm font-medium">
        {variant ? "Embalagem desta variação" : "Embalagem padrão para envio"}
      </legend>
      <p className="text-muted-foreground text-xs sm:col-span-2">
        {variant
          ? "Deixe em branco para usar o valor padrão do produto."
          : "Informe o produto já embalado. Campos opcionais no rascunho; necessários para uma cotação precisa."}{" "}
        1 kg = 1.000 g · 1 cm = 10 mm.
      </p>
      {measurementFields.map(({ name, label }) => (
        <label key={name} className="flex min-w-0 flex-col gap-2 text-xs font-medium">
          {label}
          <input
            name={variant ? `variant_${name}` : name}
            type="number"
            min="1"
            max="2147483647"
            step="1"
            defaultValue={values[name] ?? ""}
            className="border-input bg-background focus:ring-ring/40 h-10 w-full min-w-0 rounded-md border px-3 text-sm outline-none focus:ring-3"
          />
        </label>
      ))}
    </fieldset>
  );
}
