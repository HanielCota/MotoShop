"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

const reviewSchema = z.object({
  orderItemId: z.cuid(),
  productRating: z.coerce.number().int().min(1).max(5),
  sellerRating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
});

export type ReviewActionState = { error?: string; success?: string };

export async function createReviewAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const session = await requireAuthenticatedUser("/orders");
  const parsed = reviewSchema.safeParse({
    orderItemId: formData.get("orderItemId"),
    productRating: formData.get("productRating"),
    sellerRating: formData.get("sellerRating") || undefined,
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira sua avaliação." };

  try {
    const orderItem = await db.orderItem.findFirst({
      where: {
        id: parsed.data.orderItemId,
        sellerOrder: {
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
          order: { userId: session.user.id },
        },
      },
      include: {
        sellerOrder: { include: { order: { select: { orderNumber: true } } } },
        product: true,
      },
    });
    if (!orderItem?.product) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "Compra elegível para avaliação não encontrada." });
    }
    const product = orderItem.product;

    await db.$transaction(async (tx) => {
      const existingSellerReview = await tx.sellerReview.findUnique({
        where: {
          orderId_sellerId_userId: {
            orderId: orderItem.sellerOrder.orderId,
            sellerId: orderItem.sellerId,
            userId: session.user.id,
          },
        },
      });
      if (!existingSellerReview && parsed.data.sellerRating === undefined) {
        throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Informe também a nota para o seller." });
      }

      await tx.productReview.create({
        data: {
          rating: parsed.data.productRating,
          ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
          productId: product.id,
          sellerId: orderItem.sellerId,
          orderId: orderItem.sellerOrder.orderId,
          orderItemId: orderItem.id,
          userId: session.user.id,
        },
      });
      if (!existingSellerReview && parsed.data.sellerRating !== undefined) {
        await tx.sellerReview.create({
          data: {
            rating: parsed.data.sellerRating,
            ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
            sellerId: orderItem.sellerId,
            orderId: orderItem.sellerOrder.orderId,
            userId: session.user.id,
          },
        });
      }
    });
    revalidatePath(`/products/${product.slug}`);
    revalidatePath(`/orders/${orderItem.sellerOrder.order.orderNumber}`);
    return { success: "Avaliação publicada. Obrigado pelo feedback." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Este item já foi avaliado." };
    }
    return { error: asApplicationError(error).message };
  }
}
