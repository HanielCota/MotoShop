"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAuthenticatedUser, requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

const questionSchema = z.object({ question: z.string().trim().min(5, "Escreva uma pergunta maior.").max(500) });
const answerSchema = z.object({ answer: z.string().trim().min(2, "Escreva uma resposta.").max(1000) });

export type QuestionActionState = { error?: string; success?: string };

export async function askProductQuestionAction(
  productId: string,
  _previousState: QuestionActionState,
  formData: FormData,
): Promise<QuestionActionState> {
  const session = await requireAuthenticatedUser("/products");
  const parsed = questionSchema.safeParse({ question: formData.get("question") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira sua pergunta." };

  try {
    const product = await db.product.findFirst({
      where: { id: productId, status: "APPROVED" },
      select: { id: true, slug: true, sellerId: true },
    });
    if (!product) throw new ApplicationError({ code: "NOT_FOUND", message: "Produto não encontrado." });
    await db.productQuestion.create({
      data: {
        question: parsed.data.question,
        productId: product.id,
        sellerId: product.sellerId,
        askedByUserId: session.user.id,
      },
    });
    revalidatePath(`/products/${product.slug}`);
    revalidatePath("/seller/questions");
    return { success: "Pergunta enviada ao seller." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function answerProductQuestionAction(
  questionId: string,
  _previousState: QuestionActionState,
  formData: FormData,
): Promise<QuestionActionState> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const parsed = answerSchema.safeParse({ answer: formData.get("answer") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira sua resposta." };

  try {
    const question = await db.productQuestion.findFirst({
      where: { id: questionId, sellerId: context.seller.id },
      include: { product: { select: { slug: true } } },
    });
    if (!question) throw new ApplicationError({ code: "NOT_FOUND", message: "Pergunta não encontrada." });
    await db.productQuestion.update({
      where: { id: question.id },
      data: { answer: parsed.data.answer, answeredAt: new Date(), answeredByUserId: context.session.user.id },
    });
    revalidatePath(`/products/${question.product.slug}`);
    revalidatePath("/seller/questions");
    return { success: "Resposta publicada." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
