/**
 * Datas da promoção em texto (DN-01): dia/mês/ano e hora de 0 a 23, no horário de Brasília.
 * Converte para o formato que o formulário já envia ("aaaa-mm-ddThh:mm"); o servidor continua
 * interpretando esse valor como UTC−03:00 e gravando em UTC.
 */
export type PromotionBound = "start" | "end";

const datePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const timePattern = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const wirePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Valor que o schema recusa com a mensagem de data inválida. */
export const INVALID_PROMOTION_DATE = "invalid";

const defaultTimes: Record<PromotionBound, string> = { start: "00:00", end: "23:59" };

export function toPromotionDateValue(dateText: string, timeText: string, bound: PromotionBound): string {
  const date = dateText.trim();
  const time = timeText.trim();
  if (!date && !time) return "";

  const dateMatch = datePattern.exec(date);
  const timeMatch = timePattern.exec(time || defaultTimes[bound]);
  if (!dateMatch || !timeMatch) return INVALID_PROMOTION_DATE;

  const [, day, month, year] = dateMatch;
  const [, hour = "", minute = ""] = timeMatch;
  return `${year}-${month}-${day}T${hour.padStart(2, "0")}:${minute}`;
}

export function splitPromotionDateValue(value: string | null | undefined): { date: string; time: string } {
  const match = value ? wirePattern.exec(value) : null;
  if (!match) return { date: "", time: "" };
  const [, year, month, day, hour, minute] = match;
  return { date: `${day}/${month}/${year}`, time: `${hour}:${minute}` };
}
