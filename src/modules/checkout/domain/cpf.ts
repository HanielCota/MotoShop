export function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

  for (let index = 9; index < 11; index += 1) {
    const sum = Array.from(value.slice(0, index)).reduce(
      (total, digit, digitIndex) => total + Number(digit) * (index + 1 - digitIndex),
      0,
    );
    const checkDigit = (sum * 10) % 11;
    if ((checkDigit === 10 ? 0 : checkDigit) !== Number(value[index])) return false;
  }

  return true;
}
