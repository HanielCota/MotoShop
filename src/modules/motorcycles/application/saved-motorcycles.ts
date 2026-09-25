import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

async function requireActiveFitment(fitmentId: string) {
  const fitment = await db.motorcycleFitment.findFirst({
    where: { id: fitmentId, motorcycleModel: { active: true, manufacturer: { active: true } } },
    select: { id: true },
  });
  if (!fitment) {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Selecione uma moto disponível na lista." });
  }
}

export async function addSavedMotorcycle(userId: string, fitmentId: string, makePrimary: boolean) {
  await requireActiveFitment(fitmentId);
  await db.$transaction(async (tx) => {
    const alreadySaved = await tx.savedMotorcycle.findUnique({
      where: { userId_motorcycleFitmentId: { userId, motorcycleFitmentId: fitmentId } },
      select: { id: true },
    });
    if (alreadySaved) {
      throw new ApplicationError({ code: "CONFLICT", message: "Esta moto já está na sua lista." });
    }
    const hasPrimary = await tx.savedMotorcycle.findFirst({ where: { userId, isPrimary: true }, select: { id: true } });
    const shouldBePrimary = makePrimary || !hasPrimary;
    if (shouldBePrimary && hasPrimary) {
      await tx.savedMotorcycle.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } });
    }
    await tx.savedMotorcycle.create({
      data: { userId, motorcycleFitmentId: fitmentId, isPrimary: shouldBePrimary },
    });
  }, transactionOptions);
}

export async function changeSavedMotorcycle(userId: string, savedId: string, fitmentId: string) {
  await requireActiveFitment(fitmentId);
  const changed = await db.savedMotorcycle.updateMany({
    where: { id: savedId, userId },
    data: { motorcycleFitmentId: fitmentId },
  });
  if (changed.count === 0) {
    throw new ApplicationError({ code: "NOT_FOUND", message: "Moto salva não encontrada." });
  }
}

export async function setPrimarySavedMotorcycle(userId: string, savedId: string) {
  await db.$transaction(async (tx) => {
    const saved = await tx.savedMotorcycle.findFirst({
      where: { id: savedId, userId },
      select: {
        id: true,
        motorcycleFitment: {
          select: { motorcycleModel: { select: { active: true, manufacturer: { select: { active: true } } } } },
        },
      },
    });
    if (!saved) throw new ApplicationError({ code: "NOT_FOUND", message: "Moto salva não encontrada." });
    if (
      !saved.motorcycleFitment.motorcycleModel.active ||
      !saved.motorcycleFitment.motorcycleModel.manufacturer.active
    ) {
      throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Esta configuração não está mais disponível." });
    }
    await tx.savedMotorcycle.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } });
    await tx.savedMotorcycle.updateMany({ where: { id: savedId, userId }, data: { isPrimary: true } });
  }, transactionOptions);
}

export async function removeSavedMotorcycle(userId: string, savedId: string) {
  await db.$transaction(async (tx) => {
    const saved = await tx.savedMotorcycle.findFirst({
      where: { id: savedId, userId },
      select: { id: true, isPrimary: true },
    });
    if (!saved) throw new ApplicationError({ code: "NOT_FOUND", message: "Moto salva não encontrada." });
    await tx.savedMotorcycle.deleteMany({ where: { id: savedId, userId } });
    if (saved.isPrimary) {
      const next = await tx.savedMotorcycle.findFirst({
        where: { userId, motorcycleFitment: { motorcycleModel: { active: true, manufacturer: { active: true } } } },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (next) await tx.savedMotorcycle.updateMany({ where: { id: next.id, userId }, data: { isPrimary: true } });
    }
  }, transactionOptions);
}
