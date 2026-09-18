import { ApplicationError } from "@/shared/errors/application-error";

const BASIS_POINTS_DIVISOR = BigInt(10_000);
const HALF_BASIS_POINT_DIVISOR = BASIS_POINTS_DIVISOR / BigInt(2);
const MAX_PRISMA_INT = 2_147_483_647;

export function assertMoneyInCents(value: number, fieldName = "amountInCents"): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_PRISMA_INT) {
    throw new ApplicationError({
      code: "INVALID_MONEY",
      message: `${fieldName} must be a non-negative integer supported by PostgreSQL INTEGER.`,
      statusCode: 400,
    });
  }
}

export function calculateCommissionInCents(amountInCents: number, commissionBps: number): number {
  assertMoneyInCents(amountInCents);
  assertBasisPoints(commissionBps);

  const roundedCommission =
    (BigInt(amountInCents) * BigInt(commissionBps) + HALF_BASIS_POINT_DIVISOR) / BASIS_POINTS_DIVISOR;

  return toPrismaInteger(roundedCommission, "commissionInCents");
}

export function multiplyMoneyInCents(unitAmountInCents: number, quantity: number): number {
  assertMoneyInCents(unitAmountInCents, "unitAmountInCents");

  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new ApplicationError({
      code: "INVALID_MONEY",
      message: "quantity must be a positive integer.",
      statusCode: 400,
    });
  }

  return toPrismaInteger(BigInt(unitAmountInCents) * BigInt(quantity), "lineSubtotalInCents");
}

export function sumMoneyInCents(amountsInCents: readonly number[]): number {
  const total = amountsInCents.reduce((sum, amountInCents) => {
    assertMoneyInCents(amountInCents);
    return sum + BigInt(amountInCents);
  }, BigInt(0));

  return toPrismaInteger(total, "totalAmountInCents");
}

function assertBasisPoints(commissionBps: number): void {
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new ApplicationError({
      code: "INVALID_MONEY",
      message: "commissionBps must be an integer between 0 and 10000.",
      statusCode: 400,
    });
  }
}

function toPrismaInteger(value: bigint, fieldName: string): number {
  if (value > BigInt(MAX_PRISMA_INT)) {
    throw new ApplicationError({
      code: "INVALID_MONEY",
      message: `${fieldName} exceeds the PostgreSQL INTEGER limit.`,
      statusCode: 400,
    });
  }

  return Number(value);
}
