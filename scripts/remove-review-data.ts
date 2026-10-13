/**
 * Remove SOMENTE os dados criados por scripts/seed-review-data.ts.
 *
 * Escopo: usuários `review.*@example.test`, lojas `review-*` com nome " · demonstração" (e tudo
 * dos sellers delas), produtos demo `review-*`, cupons `REVIEW-*`, pedidos `MS-REVIEW-*`, eventos
 * de webhook/notificação/outbox de revisão e as linhas que referenciam esses registros.
 *
 * Contas de visualização (REVIEW_VIEWER_*_EMAILS) NUNCA são apagadas: saem apenas os vínculos e
 * dados fictícios ligados a elas (vínculo com loja de revisão, pedidos `MS-REVIEW-V*`, favoritos e
 * itens de carrinho de produtos de revisão, endereços/motos/carrinho com ID determinístico do seed).
 *
 * Executa tudo em uma transação; qualquer referência inesperada aborta sem apagar nada.
 *
 * Uso: node node_modules/tsx/dist/cli.mjs scripts/remove-review-data.ts [--dry-run]
 *   --dry-run  apenas conta o que seria removido (nenhuma escrita no banco nem nos arquivos).
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  parseEmailList,
  REVIEW_ADDRESS_LABEL_SUFFIX,
  REVIEW_ID_PREFIX,
  viewerAddressId,
  viewerCartId,
  viewerSavedMotorcycleId,
} from "./review-seed-ids";

config({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const dryRun = process.argv.includes("--dry-run");
const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

const REVIEW_USER_WHERE = { email: { startsWith: "review.", endsWith: "@example.test" } };
const isReviewEmail = (email: string) => email.startsWith("review.") && email.endsWith("@example.test");

async function main() {
  const counts = await db.$transaction(
    async (tx) => {
      const result: Record<string, number> = {};
      const apply = async (name: string, count: () => Promise<number>, remove: () => Promise<{ count: number }>) => {
        result[name] = (result[name] ?? 0) + (dryRun ? await count() : (await remove()).count);
      };

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
      const unsafe = products.find(
        (product) => !product.isDemo || !product.slug.startsWith("review-") || !sellerIds.includes(product.sellerId),
      );
      if (unsafe) throw new Error(`Unexpected product in review scope: ${unsafe.slug}. Aborting.`);
      const productIds = products.map((product) => product.id);

      // Pedidos de contas de visualização (MS-REVIEW-V*) têm e-mail real, mas todas as partes são de lojas de revisão.
      const orders = await tx.order.findMany({
        where: { orderNumber: { startsWith: "MS-REVIEW-" } },
        select: { id: true, orderNumber: true, customerEmail: true, sellerOrders: { select: { sellerId: true } } },
      });
      const unexpectedOrder = orders.find(
        (order) =>
          !isReviewEmail(order.customerEmail) &&
          (!order.orderNumber.startsWith("MS-REVIEW-V") ||
            order.sellerOrders.length === 0 ||
            order.sellerOrders.some((sellerOrder) => !sellerIds.includes(sellerOrder.sellerId))),
      );
      if (unexpectedOrder)
        throw new Error(`Unexpected order in review scope: ${unexpectedOrder.orderNumber}. Aborting.`);
      const orderIds = orders.map((order) => order.id);

      const coupons = await tx.coupon.findMany({
        where: { code: { startsWith: "REVIEW-" } },
        select: { id: true, sellerId: true },
      });
      if (coupons.some((coupon) => coupon.sellerId && !sellerIds.includes(coupon.sellerId)))
        throw new Error("Unexpected coupon in review scope. Aborting.");
      const couponIds = coupons.map((coupon) => coupon.id);

      // Linhas criadas pelo seed para contas de visualização: o ID precisa bater com o ID determinístico recalculado.
      const viewerAddresses = (
        await tx.customerAddress.findMany({
          where: {
            id: { startsWith: REVIEW_ID_PREFIX },
            label: { endsWith: REVIEW_ADDRESS_LABEL_SUFFIX },
            userId: { notIn: userIds },
          },
          select: { id: true, userId: true },
        })
      ).filter((address) => [1, 2].some((index) => address.id === viewerAddressId(address.userId, index)));
      const viewerMotorcycles = (
        await tx.savedMotorcycle.findMany({
          where: { id: { startsWith: REVIEW_ID_PREFIX }, userId: { notIn: userIds } },
          select: { id: true, userId: true, motorcycleFitmentId: true },
        })
      ).filter((saved) => saved.id === viewerSavedMotorcycleId(saved.userId, saved.motorcycleFitmentId));
      const viewerCarts = (
        await tx.cart.findMany({
          where: { id: { startsWith: REVIEW_ID_PREFIX }, userId: { notIn: userIds } },
          select: { id: true, userId: true, items: { select: { variant: { select: { sellerId: true } } } } },
        })
      )
        // Se a pessoa colocou itens reais no carrinho, o carrinho fica (só os itens de revisão saem).
        .filter(
          (cart) =>
            cart.userId &&
            cart.id === viewerCartId(cart.userId) &&
            cart.items.every((item) => sellerIds.includes(item.variant.sellerId)),
        );

      // AuditLog.actor é onDelete: Restrict — remover primeiro.
      const auditWhere = { actorUserId: { in: userIds } };
      await apply(
        "AuditLog",
        () => tx.auditLog.count({ where: auditWhere }),
        () => tx.auditLog.deleteMany({ where: auditWhere }),
      );
      const notificationWhere = {
        OR: [{ eventKey: { startsWith: "review-notification:" } }, { recipientEmail: { in: reviewEmails } }],
      };
      await apply(
        "NotificationDelivery",
        () => tx.notificationDelivery.count({ where: notificationWhere }),
        () => tx.notificationDelivery.deleteMany({ where: notificationWhere }),
      );
      const webhookWhere = { externalId: { startsWith: "review-webhook-" } };
      await apply(
        "WebhookEvent",
        () => tx.webhookEvent.count({ where: webhookWhere }),
        () => tx.webhookEvent.deleteMany({ where: webhookWhere }),
      );
      const outboxWhere = { eventKey: { startsWith: "review-outbox:" } };
      await apply(
        "OutboxEvent",
        () => tx.outboxEvent.count({ where: outboxWhere }),
        () => tx.outboxEvent.deleteMany({ where: outboxWhere }),
      );

      const orderScope = { OR: [{ orderId: { in: orderIds } }, { sellerId: { in: sellerIds } }] };
      const productReviewWhere = {
        OR: [...orderScope.OR, { productId: { in: productIds } }, { userId: { in: userIds } }],
      };
      await apply(
        "ProductReview",
        () => tx.productReview.count({ where: productReviewWhere }),
        () => tx.productReview.deleteMany({ where: productReviewWhere }),
      );
      const sellerReviewWhere = { OR: [...orderScope.OR, { userId: { in: userIds } }] };
      await apply(
        "SellerReview",
        () => tx.sellerReview.count({ where: sellerReviewWhere }),
        () => tx.sellerReview.deleteMany({ where: sellerReviewWhere }),
      );
      const questionWhere = {
        OR: [{ productId: { in: productIds } }, { sellerId: { in: sellerIds } }, { askedByUserId: { in: userIds } }],
      };
      await apply(
        "ProductQuestion",
        () => tx.productQuestion.count({ where: questionWhere }),
        () => tx.productQuestion.deleteMany({ where: questionWhere }),
      );
      const returnItemWhere = { returnRequest: orderScope };
      await apply(
        "ReturnItem",
        () => tx.returnItem.count({ where: returnItemWhere }),
        () => tx.returnItem.deleteMany({ where: returnItemWhere }),
      );
      await apply(
        "ReturnRequest",
        () => tx.returnRequest.count({ where: orderScope }),
        () => tx.returnRequest.deleteMany({ where: orderScope }),
      );
      await apply(
        "CancellationRequest",
        () => tx.cancellationRequest.count({ where: orderScope }),
        () => tx.cancellationRequest.deleteMany({ where: orderScope }),
      );
      await apply(
        "Dispute",
        () => tx.dispute.count({ where: orderScope }),
        () => tx.dispute.deleteMany({ where: orderScope }),
      );
      const redemptionWhere = { OR: [{ orderId: { in: orderIds } }, { couponId: { in: couponIds } }] };
      await apply(
        "CouponRedemption",
        () => tx.couponRedemption.count({ where: redemptionWhere }),
        () => tx.couponRedemption.deleteMany({ where: redemptionWhere }),
      );

      const transactionWhere = { payment: { orderId: { in: orderIds } } };
      await apply(
        "PaymentTransaction",
        () => tx.paymentTransaction.count({ where: transactionWhere }),
        () => tx.paymentTransaction.deleteMany({ where: transactionWhere }),
      );
      const paymentWhere = { orderId: { in: orderIds } };
      await apply(
        "Payment",
        () => tx.payment.count({ where: paymentWhere }),
        () => tx.payment.deleteMany({ where: paymentWhere }),
      );
      const sellerOrderScope = { OR: [{ orderId: { in: orderIds } }, { sellerId: { in: sellerIds } }] };
      await apply(
        "Shipment",
        () => tx.shipment.count({ where: { sellerOrder: sellerOrderScope } }),
        () => tx.shipment.deleteMany({ where: { sellerOrder: sellerOrderScope } }),
      );
      await apply(
        "OrderItem",
        () => tx.orderItem.count({ where: { sellerOrder: sellerOrderScope } }),
        () => tx.orderItem.deleteMany({ where: { sellerOrder: sellerOrderScope } }),
      );
      await apply(
        "SellerOrder",
        () => tx.sellerOrder.count({ where: sellerOrderScope }),
        () => tx.sellerOrder.deleteMany({ where: sellerOrderScope }),
      );
      await apply(
        "OrderAddress",
        () => tx.orderAddress.count({ where: paymentWhere }),
        () => tx.orderAddress.deleteMany({ where: paymentWhere }),
      );
      const orderWhere = { id: { in: orderIds } };
      await apply(
        "Order",
        () => tx.order.count({ where: orderWhere }),
        () => tx.order.deleteMany({ where: orderWhere }),
      );

      const cartItemWhere = {
        OR: [
          { variant: { sellerId: { in: sellerIds } } },
          { cart: { userId: { in: userIds } } },
          { cartId: { in: viewerCarts.map((cart) => cart.id) } },
        ],
      };
      await apply(
        "CartItem",
        () => tx.cartItem.count({ where: cartItemWhere }),
        () => tx.cartItem.deleteMany({ where: cartItemWhere }),
      );
      const cartWhere = { OR: [{ userId: { in: userIds } }, { id: { in: viewerCarts.map((cart) => cart.id) } }] };
      await apply(
        "Cart",
        () => tx.cart.count({ where: cartWhere }),
        () => tx.cart.deleteMany({ where: cartWhere }),
      );
      const favoriteWhere = { OR: [{ productId: { in: productIds } }, { userId: { in: userIds } }] };
      await apply(
        "Favorite",
        () => tx.favorite.count({ where: favoriteWhere }),
        () => tx.favorite.deleteMany({ where: favoriteWhere }),
      );
      const savedWhere = {
        OR: [{ userId: { in: userIds } }, { id: { in: viewerMotorcycles.map((saved) => saved.id) } }],
      };
      await apply(
        "SavedMotorcycle",
        () => tx.savedMotorcycle.count({ where: savedWhere }),
        () => tx.savedMotorcycle.deleteMany({ where: savedWhere }),
      );
      const addressWhere = {
        OR: [{ userId: { in: userIds } }, { id: { in: viewerAddresses.map((address) => address.id) } }],
      };
      await apply(
        "CustomerAddress",
        () => tx.customerAddress.count({ where: addressWhere }),
        () => tx.customerAddress.deleteMany({ where: addressWhere }),
      );

      const sellerScope = { sellerId: { in: sellerIds } };
      await apply(
        "InventoryMovement",
        () => tx.inventoryMovement.count({ where: sellerScope }),
        () => tx.inventoryMovement.deleteMany({ where: sellerScope }),
      );
      await apply(
        "Inventory",
        () => tx.inventory.count({ where: sellerScope }),
        () => tx.inventory.deleteMany({ where: sellerScope }),
      );
      const productScope = { productId: { in: productIds } };
      await apply(
        "ProductCompatibility",
        () => tx.productCompatibility.count({ where: productScope }),
        () => tx.productCompatibility.deleteMany({ where: productScope }),
      );
      await apply(
        "ProductImage",
        () => tx.productImage.count({ where: productScope }),
        () => tx.productImage.deleteMany({ where: productScope }),
      );
      await apply(
        "ProductVariant",
        () => tx.productVariant.count({ where: productScope }),
        () => tx.productVariant.deleteMany({ where: productScope }),
      );
      const productWhere = { id: { in: productIds } };
      await apply(
        "Product",
        () => tx.product.count({ where: productWhere }),
        () => tx.product.deleteMany({ where: productWhere }),
      );
      // Marcas de revisão só existem se o banco tinha menos de 5 marcas ativas; nunca apaga marca em uso.
      const brandWhere = {
        slug: { startsWith: "review-marca-" },
        name: { endsWith: "(demonstração)" },
        products: { none: { id: { notIn: productIds } } },
      };
      await apply(
        "Brand",
        () => tx.brand.count({ where: brandWhere }),
        () => tx.brand.deleteMany({ where: brandWhere }),
      );
      // Seller opt-ins to campaigns reference both coupons and sellers of the review scope.
      const participationWhere = { OR: [{ couponId: { in: couponIds } }, { sellerId: { in: sellerIds } }] };
      await apply(
        "CouponSellerParticipation",
        () => tx.couponSellerParticipation.count({ where: participationWhere }),
        () => tx.couponSellerParticipation.deleteMany({ where: participationWhere }),
      );
      const couponWhere = { id: { in: couponIds } };
      await apply(
        "Coupon",
        () => tx.coupon.count({ where: couponWhere }),
        () => tx.coupon.deleteMany({ where: couponWhere }),
      );

      await apply(
        "SellerSubscription",
        () => tx.sellerSubscription.count({ where: sellerScope }),
        () => tx.sellerSubscription.deleteMany({ where: sellerScope }),
      );
      await apply(
        "SellerShippingMethod",
        () => tx.sellerShippingMethod.count({ where: sellerScope }),
        () => tx.sellerShippingMethod.deleteMany({ where: sellerScope }),
      );
      await apply(
        "SellerShippingIntegration",
        () => tx.sellerShippingIntegration.count({ where: sellerScope }),
        () => tx.sellerShippingIntegration.deleteMany({ where: sellerScope }),
      );
      const memberWhere = { OR: [{ sellerId: { in: sellerIds } }, { userId: { in: userIds } }] };
      await apply(
        "SellerMember",
        () => tx.sellerMember.count({ where: memberWhere }),
        () => tx.sellerMember.deleteMany({ where: memberWhere }),
      );
      await apply(
        "Store",
        () => tx.store.count({ where: sellerScope }),
        () => tx.store.deleteMany({ where: sellerScope }),
      );
      const sellerWhere = { id: { in: sellerIds } };
      await apply(
        "Seller",
        () => tx.seller.count({ where: sellerWhere }),
        () => tx.seller.deleteMany({ where: sellerWhere }),
      );

      const userScope = { userId: { in: userIds } };
      await apply(
        "Session",
        () => tx.session.count({ where: userScope }),
        () => tx.session.deleteMany({ where: userScope }),
      );
      await apply(
        "Account",
        () => tx.account.count({ where: userScope }),
        () => tx.account.deleteMany({ where: userScope }),
      );
      const userWhere = { id: { in: userIds } };
      await apply(
        "User",
        () => tx.user.count({ where: userWhere }),
        () => tx.user.deleteMany({ where: userWhere }),
      );

      // Prova de segurança: nenhuma conta fora de `review.*@example.test` está no escopo de remoção.
      const viewerEmails = parseEmailList(
        `${process.env.REVIEW_VIEWER_CUSTOMER_EMAILS ?? ""},${process.env.REVIEW_VIEWER_SELLER_EMAILS ?? ""}`,
      );
      result["UsersOutsideReviewDomain"] = users.filter((user) => !isReviewEmail(user.email)).length;
      result["ViewerUsersInDeleteScope"] = users.filter((user) =>
        viewerEmails.includes(user.email.toLowerCase()),
      ).length;
      return result;
    },
    { timeout: 120_000 },
  );

  // Imagens locais copiadas/geradas pelo seed.
  const imageDir = join(process.cwd(), "public/images/demo");
  let files = 0;
  if (existsSync(imageDir))
    for (const file of readdirSync(imageDir).filter((name) => /^review-[a-z0-9-]+\.webp$/.test(name))) {
      if (!dryRun) unlinkSync(join(imageDir, file));
      files += 1;
    }

  console.log(dryRun ? "DRY RUN: nada foi removido. Contagem do que seria removido:" : "Removido:");
  console.log(JSON.stringify({ ...counts, localImageFiles: files }, null, 2));
  // The generated images are versioned while the site is a demo: deleting them locally is not enough.
  if (!dryRun && files > 0)
    console.log(
      "As imagens public/images/demo/review-*.webp são versionadas: commite a remoção (git add -A public/images/demo).",
    );
}

try {
  await main();
} finally {
  await db.$disconnect();
}
