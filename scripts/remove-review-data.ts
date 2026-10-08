/**
 * Remove SOMENTE os dados criados por scripts/seed-review-data.ts.
 *
 * Escopo: usuários `review.*@example.test`, lojas `review-*` com nome " · demonstração" (e tudo
 * dos sellers delas), produtos demo `review-*`, cupons `REVIEW-*`, pedidos `MS-REVIEW-*`, eventos
 * de webhook/notificação de revisão e as linhas que referenciam esses registros.
 * Executa tudo em uma transação; qualquer referência inesperada aborta sem apagar nada.
 *
 * Uso: node node_modules/tsx/dist/cli.mjs scripts/remove-review-data.ts
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

const REVIEW_USER_WHERE = { email: { startsWith: "review.", endsWith: "@example.test" } };

async function main() {
  const counts = await db.$transaction(
    async (tx) => {
      const result: Record<string, number> = {};
      const record = (name: string, count: number) => (result[name] = (result[name] ?? 0) + count);

      const users = await tx.user.findMany({ where: REVIEW_USER_WHERE, select: { id: true, email: true } });
      const userIds = users.map((user) => user.id);
      const reviewEmails = users.map((user) => user.email);

      const stores = await tx.store.findMany({
        where: { slug: { startsWith: "review-" }, name: { endsWith: " · demonstração" } },
        select: { sellerId: true },
      });
      const sellerIds = stores.map((store) => store.sellerId);

      const products = await tx.product.findMany({
        where: { OR: [{ sellerId: { in: sellerIds } }, { slug: { startsWith: "review-" }, isDemo: true }] },
        select: { id: true, slug: true, isDemo: true, sellerId: true },
      });
      const unsafe = products.find((product) => !product.isDemo || !product.slug.startsWith("review-") || !sellerIds.includes(product.sellerId));
      if (unsafe) throw new Error(`Unexpected product in review scope: ${unsafe.slug}. Aborting.`);
      const productIds = products.map((product) => product.id);

      const orders = await tx.order.findMany({
        where: { orderNumber: { startsWith: "MS-REVIEW-" } },
        select: { id: true, customerEmail: true },
      });
      if (orders.some((order) => !order.customerEmail.startsWith("review.") || !order.customerEmail.endsWith("@example.test")))
        throw new Error("Unexpected order in review scope. Aborting.");
      const orderIds = orders.map((order) => order.id);

      const coupons = await tx.coupon.findMany({ where: { code: { startsWith: "REVIEW-" } }, select: { id: true, sellerId: true } });
      if (coupons.some((coupon) => coupon.sellerId && !sellerIds.includes(coupon.sellerId)))
        throw new Error("Unexpected coupon in review scope. Aborting.");
      const couponIds = coupons.map((coupon) => coupon.id);

      // AuditLog.actor é onDelete: Restrict — remover primeiro.
      record("AuditLog", (await tx.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } })).count);
      record(
        "NotificationDelivery",
        (
          await tx.notificationDelivery.deleteMany({
            where: { OR: [{ eventKey: { startsWith: "review-notification:" } }, { recipientEmail: { in: reviewEmails } }] },
          })
        ).count,
      );
      record("WebhookEvent", (await tx.webhookEvent.deleteMany({ where: { externalId: { startsWith: "review-webhook-" } } })).count);

      const orderScope = { OR: [{ orderId: { in: orderIds } }, { sellerId: { in: sellerIds } }] };
      record(
        "ProductReview",
        (await tx.productReview.deleteMany({ where: { OR: [...orderScope.OR, { productId: { in: productIds } }, { userId: { in: userIds } }] } })).count,
      );
      record(
        "SellerReview",
        (await tx.sellerReview.deleteMany({ where: { OR: [...orderScope.OR, { userId: { in: userIds } }] } })).count,
      );
      record(
        "ProductQuestion",
        (
          await tx.productQuestion.deleteMany({
            where: { OR: [{ productId: { in: productIds } }, { sellerId: { in: sellerIds } }, { askedByUserId: { in: userIds } }] },
          })
        ).count,
      );
      record("ReturnItem", (await tx.returnItem.deleteMany({ where: { returnRequest: orderScope } })).count);
      record("ReturnRequest", (await tx.returnRequest.deleteMany({ where: orderScope })).count);
      record("CancellationRequest", (await tx.cancellationRequest.deleteMany({ where: orderScope })).count);
      record("Dispute", (await tx.dispute.deleteMany({ where: orderScope })).count);
      record(
        "CouponRedemption",
        (await tx.couponRedemption.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { couponId: { in: couponIds } }] } })).count,
      );

      record("PaymentTransaction", (await tx.paymentTransaction.deleteMany({ where: { payment: { orderId: { in: orderIds } } } })).count);
      record("Payment", (await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } })).count);
      const sellerOrderScope = { OR: [{ orderId: { in: orderIds } }, { sellerId: { in: sellerIds } }] };
      record("Shipment", (await tx.shipment.deleteMany({ where: { sellerOrder: sellerOrderScope } })).count);
      record("OrderItem", (await tx.orderItem.deleteMany({ where: { sellerOrder: sellerOrderScope } })).count);
      record("SellerOrder", (await tx.sellerOrder.deleteMany({ where: sellerOrderScope })).count);
      record("OrderAddress", (await tx.orderAddress.deleteMany({ where: { orderId: { in: orderIds } } })).count);
      record("Order", (await tx.order.deleteMany({ where: { id: { in: orderIds } } })).count);

      record(
        "CartItem",
        (await tx.cartItem.deleteMany({ where: { OR: [{ variant: { sellerId: { in: sellerIds } } }, { cart: { userId: { in: userIds } } }] } })).count,
      );
      record("Cart", (await tx.cart.deleteMany({ where: { userId: { in: userIds } } })).count);
      record(
        "Favorite",
        (await tx.favorite.deleteMany({ where: { OR: [{ productId: { in: productIds } }, { userId: { in: userIds } }] } })).count,
      );
      record("SavedMotorcycle", (await tx.savedMotorcycle.deleteMany({ where: { userId: { in: userIds } } })).count);
      record("CustomerAddress", (await tx.customerAddress.deleteMany({ where: { userId: { in: userIds } } })).count);

      record("InventoryMovement", (await tx.inventoryMovement.deleteMany({ where: { sellerId: { in: sellerIds } } })).count);
      record("Inventory", (await tx.inventory.deleteMany({ where: { sellerId: { in: sellerIds } } })).count);
      record("ProductCompatibility", (await tx.productCompatibility.deleteMany({ where: { productId: { in: productIds } } })).count);
      record("ProductImage", (await tx.productImage.deleteMany({ where: { productId: { in: productIds } } })).count);
      record("ProductVariant", (await tx.productVariant.deleteMany({ where: { productId: { in: productIds } } })).count);
      record("Product", (await tx.product.deleteMany({ where: { id: { in: productIds } } })).count);
      record("Coupon", (await tx.coupon.deleteMany({ where: { id: { in: couponIds } } })).count);

      record("SellerSubscription", (await tx.sellerSubscription.deleteMany({ where: { sellerId: { in: sellerIds } } })).count);
      record("SellerShippingMethod", (await tx.sellerShippingMethod.deleteMany({ where: { sellerId: { in: sellerIds } } })).count);
      record("SellerShippingIntegration", (await tx.sellerShippingIntegration.deleteMany({ where: { sellerId: { in: sellerIds } } })).count);
      record(
        "SellerMember",
        (await tx.sellerMember.deleteMany({ where: { OR: [{ sellerId: { in: sellerIds } }, { userId: { in: userIds } }] } })).count,
      );
      record("Store", (await tx.store.deleteMany({ where: { sellerId: { in: sellerIds } } })).count);
      record("Seller", (await tx.seller.deleteMany({ where: { id: { in: sellerIds } } })).count);

      record("Session", (await tx.session.deleteMany({ where: { userId: { in: userIds } } })).count);
      record("Account", (await tx.account.deleteMany({ where: { userId: { in: userIds } } })).count);
      record("User", (await tx.user.deleteMany({ where: { id: { in: userIds } } })).count);
      return result;
    },
    { timeout: 60_000 },
  );

  // Imagens locais copiadas pelo seed.
  const imageDir = join(process.cwd(), "public/images/demo");
  let files = 0;
  if (existsSync(imageDir))
    for (const file of readdirSync(imageDir).filter((name) => /^review-[a-z0-9-]+\.webp$/.test(name))) {
      unlinkSync(join(imageDir, file));
      files += 1;
    }

  console.log(JSON.stringify({ ...counts, localImageFiles: files }, null, 2));
}

try {
  await main();
} finally {
  await db.$disconnect();
}
