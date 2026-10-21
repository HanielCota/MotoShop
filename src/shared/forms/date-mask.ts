const SEGMENT_LENGTHS = [2, 2, 4] as const;

/**
 * Formats a date as dd/mm/aaaa while it is typed: the slashes appear on their own. A separator
 * typed after a single digit ("1/") completes that part with a zero ("01/"), so the common ways of
 * typing a date keep working.
 */
export function maskDateTyping(value: string): string {
  const segments = [""];

  for (const character of value) {
    if (segments.length === SEGMENT_LENGTHS.length && isFull(segments)) break;
    if (/\d/.test(character)) {
      addDigit(segments, character);
      continue;
    }
    closeSegment(segments);
  }

  return segments.join("/");
}

function isFull(segments: string[]): boolean {
  const index = segments.length - 1;
  return (segments[index] ?? "").length === SEGMENT_LENGTHS[index];
}

function addDigit(segments: string[], digit: string) {
  if (isFull(segments)) segments.push("");
  segments[segments.length - 1] += digit;
}

/** A typed separator ends the day or the month, padding a single digit. */
function closeSegment(segments: string[]) {
  const index = segments.length - 1;
  const current = segments[index] ?? "";
  if (index >= SEGMENT_LENGTHS.length - 1 || current === "") return;

  segments[index] = current.padStart(2, "0");
  segments.push("");
}
