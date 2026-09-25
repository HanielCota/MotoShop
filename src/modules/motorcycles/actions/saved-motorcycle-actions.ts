"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import {
  addSavedMotorcycle,
  changeSavedMotorcycle,
  removeSavedMotorcycle,
  setPrimarySavedMotorcycle,
} from "@/modules/motorcycles/application/saved-motorcycles";
import { ApplicationError } from "@/shared/errors/application-error";

export type SavedMotorcycleActionState = { error?: string; success?: string };

const fitmentSchema = z.object({ motorcycleFitmentId: z.cuid() });
const savedIdSchema = z.cuid();

function revalidateMotorcyclePages() {
  revalidatePath("/account/motorcycles");
  revalidatePath("/products");
  revalidatePath("/");
}

function actionError(error: unknown): SavedMotorcycleActionState {
  if (error instanceof ApplicationError) return { error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { error: "Esta moto já está na sua lista. Escolha outra configuração." };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return { error: "Sua lista mudou ao mesmo tempo. Tente novamente." };
  }
  return { error: "Não foi possível atualizar suas motos. Tente novamente." };
}

export async function addSavedMotorcycleAction(
  _state: SavedMotorcycleActionState,
  formData: FormData,
): Promise<SavedMotorcycleActionState> {
  const session = await requireAuthenticatedUser("/account/motorcycles");
  const parsed = fitmentSchema.safeParse({ motorcycleFitmentId: formData.get("motorcycleFitmentId") });
  if (!parsed.success) return { error: "Selecione uma moto válida." };
  try {
    await addSavedMotorcycle(session.user.id, parsed.data.motorcycleFitmentId, formData.get("makePrimary") === "on");
    revalidateMotorcyclePages();
    return { success: "Moto salva na sua conta." };
  } catch (error) {
    return actionError(error);
  }
}

export async function changeSavedMotorcycleAction(
  savedId: string,
  _state: SavedMotorcycleActionState,
  formData: FormData,
): Promise<SavedMotorcycleActionState> {
  const session = await requireAuthenticatedUser("/account/motorcycles");
  const parsedId = savedIdSchema.safeParse(savedId);
  const parsed = fitmentSchema.safeParse({ motorcycleFitmentId: formData.get("motorcycleFitmentId") });
  if (!parsedId.success || !parsed.success) return { error: "Selecione uma moto válida." };
  try {
    await changeSavedMotorcycle(session.user.id, parsedId.data, parsed.data.motorcycleFitmentId);
    revalidateMotorcyclePages();
    return { success: "Configuração atualizada." };
  } catch (error) {
    return actionError(error);
  }
}

export async function setPrimarySavedMotorcycleAction(
  savedId: string,
  _state: SavedMotorcycleActionState,
): Promise<SavedMotorcycleActionState> {
  void _state;
  const session = await requireAuthenticatedUser("/account/motorcycles");
  const parsedId = savedIdSchema.safeParse(savedId);
  if (!parsedId.success) return { error: "Moto inválida." };
  try {
    await setPrimarySavedMotorcycle(session.user.id, parsedId.data);
    revalidateMotorcyclePages();
    return { success: "Moto principal atualizada." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeSavedMotorcycleAction(
  savedId: string,
  _state: SavedMotorcycleActionState,
): Promise<SavedMotorcycleActionState> {
  void _state;
  const session = await requireAuthenticatedUser("/account/motorcycles");
  const parsedId = savedIdSchema.safeParse(savedId);
  if (!parsedId.success) return { error: "Moto inválida." };
  try {
    await removeSavedMotorcycle(session.user.id, parsedId.data);
    revalidateMotorcyclePages();
    return { success: "Moto removida." };
  } catch (error) {
    return actionError(error);
  }
}
