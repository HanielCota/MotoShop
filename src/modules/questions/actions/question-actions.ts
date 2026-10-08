"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAuthenticatedUser, requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";

const questionSchema = z.object({ question: z.string().trim().min(5, "Escreva uma pergunta maior.").max(500) });
const idSchema = z.string().cuid();
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
  const parsedProductId = idSchema.safeParse(productId);
  if (!parsedProductId.success) return { error: "Produto não encontrado." };

  try {
    await assertRateLimit({ key: `question:${session.user.id}`, windowSeconds: 60, max: 5 });
    const product = await db.product.findFirst({
      where: {
        id: parsedProductId.data,
        status: "APPROVED",
        seller: { status: { in: ["APPROVED", "ACTIVE"] } },
      },
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
    return { success: "Pergunta enviada ao lojista." };
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
  const parsedQuestionId = idSchema.safeParse(questionId);
  if (!parsedQuestionId.success) return { error: "Pergunta não encontrada." };

  try {
    const { slug, edited } = await db.$transaction(async (tx) => {
      const question = await tx.productQuestion.findFirst({
        where: { id: parsedQuestionId.data, sellerId: context.seller.id, hiddenAt: null },
        include: { product: { select: { slug: true } } },
      });
      if (!question) throw new ApplicationError({ code: "NOT_FOUND", message: "Pergunta não encontrada." });
      // Editing a published answer is allowed, but the write is conditional on
      // the answer read above so a concurrent edit is not silently overwritten.
      const updated = await tx.productQuestion.updateMany({
        where: { id: question.id, sellerId: context.seller.id, hiddenAt: null, answer: question.answer },
        data: { answer: parsed.data.answer, answeredAt: new Date(), answeredByUserId: context.session.user.id },
      });
      if (updated.count !== 1)
        throw new ApplicationError({
          code: "CONFLICT",
          message: "A pergunta não está mais disponível ou foi alterada por outra pessoa. Recarregue a página.",
        });
      const previousAnswer = question.answer;
      if (previousAnswer !== null) {
        await tx.auditLog.create({
          data: {
            action: "PRODUCT_QUESTION_ANSWER_UPDATED",
            entityType: "ProductQuestion",
            entityId: question.id,
            actorUserId: context.session.user.id,
            metadata: {
              sellerId: context.seller.id,
              previousAnswer,
              previousAnsweredByUserId: question.answeredByUserId ?? null,
              nextAnswer: parsed.data.answer,
            },
          },
        });
      }
      return { slug: question.product.slug, edited: previousAnswer !== null };
    });
    revalidatePath(`/products/${slug}`);
    revalidatePath("/seller/questions");
    return { success: edited ? "Resposta atualizada." : "Resposta publicada." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
