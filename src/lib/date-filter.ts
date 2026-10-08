/** Parses the date format shown in Portuguese filter fields without relying on browser locale. */
export function parseDateFilter(value: string | null | undefined, endOfDay = false) {
  const input = value?.trim();
  if (!input) return undefined;

  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  const year = Number(brazilian?.[3] ?? iso?.[1]);
  const month = Number(brazilian?.[2] ?? iso?.[2]);
  const day = Number(brazilian?.[1] ?? iso?.[3]);
  if (!brazilian && !iso) return undefined;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined;
  }
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export function formatDateFilter(value: string | null | undefined) {
  if (!value) return "";
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (brazilian) return value;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value;
}
