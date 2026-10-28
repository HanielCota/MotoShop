/**
 * Remove as lojas de demonstração que o `db:remove:review` não alcança, por lista exata de identificadores:
 *
 * - Bloco B: o catálogo demo antigo (`seed-demo-catalog.ts`), lojas `demo-*`, e as marcas Apex Demo e
 *   Terra Demo quando nenhum produto as usa mais.
 * - Bloco C: lojas de testes de QA e de integração que ficaram no banco.
 *
 * De cada loja saem o seller, os membros, os produtos e tudo deles, e os pedidos que só têm partes dessas
 * lojas. As contas de usuário NUNCA são apagadas: só o vínculo com a loja. Nada de
 * `demo-removal-protection.ts` sai (lojas e contas protegidas); loja com membro de e-mail real só sai
 * com `--confirm-stores=<identificador>`. Categorias e a base de motos nunca são tocadas.
 *
 * Executa tudo em uma transação; qualquer referência inesperada aborta sem apagar nada.
 *
 * Uso: node node_modules/tsx/dist/cli.mjs scripts/remove-demo-leftovers.ts [--dry-run | --rehearse] [--confirm-stores=a,b]
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { requireScriptDatabaseUrl } from "./database-guard";
import {
  assertNothingProtected,
  assertStoresConfirmed,
  countProtectedAccountRows,
  describeStore,
  findProtectedUserIds,
  parseConfirmedStores,
  readDemoRemovalProtection,
  readRunMode,
  runRemoval,
  storesNeedingConfirmation,
} from "./demo-removal-protection";
import { DEMO_BRAND_SLUGS, leftoverStoreWhere } from "./demo-leftovers-scope";

config({ path: ".env.local", quiet: true });

const databaseUrl = requireScriptDatabaseUrl(process.env, "db:remove:leftovers");
const protection = readDemoRemovalProtection(process.env);
const confirmedStores = parseConfirmedStores(process.argv);
const mode = readRunMode(process.argv);
const dryRun = mode === "dry-run";

const RUN_HEADLINE = {
  "dry-run": "DRY RUN: nada foi removido. O que seria removido:",
  rehearse: "ENSAIO: tudo foi apagado dentro da transação e desfeito no fim. Nada mudou:",
  apply: "Removido:",
} as const;
const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

type Transaction = Prisma.TransactionClient;

async function loadStores(tx: Transaction) {
  const stores = await tx.store.findMany({
    where: leftoverStoreWhere(),
    select: {
      slug: true,
      name: true,
      sellerId: true,
      seller: { select: { status: true, members: { select: { user: { select: { email: true } } } } } },
    },
    orderBy: { slug: "asc" },
  });

  return stores.map((store) => ({
    slug: store.slug,
    name: store.name,
    sellerId: store.sellerId,
    sellerStatus: store.seller.status,
    memberEmails: store.seller.members.map((member) => member.user.email.toLowerCase()),
  }));
}

/** Orders with a part in the scope; one with a part from another store aborts the run. */
async function loadOrders(tx: Transaction, sellerIds: string[]) {
  const orders = await tx.order.findMany({
    where: { sellerOrders: { some: { sellerId: { in: sellerIds } } } },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      sellerOrders: { select: { sellerId: true } },
      payments: { select: { provider: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const mixed = orders.find((order) =>
    order.sellerOrders.some((sellerOrder) => sellerIds.includes(sellerOrder.sellerId) === false),
  );
  if (mixed != null) throw new Error(`Order ${mixed.orderNumber} also has a part from another store. Aborting.`);

  return orders;
}

async function main() {
  const report = await runRemoval(db, mode, async (tx) => {
    const counts: Record<string, number> = {};
    const apply = async (name: string, count: () => Promise<number>, remove: () => Promise<{ count: number }>) => {
      counts[name] = (counts[name] ?? 0) + (dryRun ? await count() : (await remove()).count);
    };

    const stores = await loadStores(tx);
    assertNothingProtected(protection, { stores, deletedUserEmails: [] });
    if (dryRun === false) assertStoresConfirmed(stores, confirmedStores);

    const sellerIds = stores.map((store) => store.sellerId);
    const products = await tx.product.findMany({
      where: { sellerId: { in: sellerIds } },
      select: { id: true, slug: true, isDemo: true, sellerId: true },
    });
    const productIds = products.map((product) => product.id);
    const orders = await loadOrders(tx, sellerIds);
    const orderIds = orders.map((order) => order.id);
    const coupons = await tx.coupon.findMany({ where: { sellerId: { in: sellerIds } }, select: { id: true } });
    const couponIds = coupons.map((coupon) => coupon.id);
    const protectedAccountRows = await countProtectedAccountRows(tx, {
      protectedUserIds: await findProtectedUserIds(tx, protection),
      sellerIds,
      productIds,
      orderIds,
    });

    const orderScope = { OR: [{ orderId: { in: orderIds } }, { sellerId: { in: sellerIds } }] };
    const productReviewWhere = { OR: [...orderScope.OR, { productId: { in: productIds } }] };
    await apply(
      "ProductReview",
      () => tx.productReview.count({ where: productReviewWhere }),
      () => tx.productReview.deleteMany({ where: productReviewWhere }),
    );
    await apply(
      "SellerReview",
      () => tx.sellerReview.count({ where: orderScope }),
      () => tx.sellerReview.deleteMany({ where: orderScope }),
    );
    const questionWhere = { OR: [{ productId: { in: productIds } }, { sellerId: { in: sellerIds } }] };
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
    const orderIdWhere = { orderId: { in: orderIds } };
    await apply(
      "Payment",
      () => tx.payment.count({ where: orderIdWhere }),
      () => tx.payment.deleteMany({ where: orderIdWhere }),
    );
    await apply(
      "Shipment",
      () => tx.shipment.count({ where: { sellerOrder: orderScope } }),
      () => tx.shipment.deleteMany({ where: { sellerOrder: orderScope } }),
    );
    await apply(
      "OrderItem",
      () => tx.orderItem.count({ where: { sellerOrder: orderScope } }),
      () => tx.orderItem.deleteMany({ where: { sellerOrder: orderScope } }),
    );
    await apply(
      "SellerOrder",
      () => tx.sellerOrder.count({ where: orderScope }),
      () => tx.sellerOrder.deleteMany({ where: orderScope }),
    );
    await apply(
      "OrderAddress",
      () => tx.orderAddress.count({ where: orderIdWhere }),
      () => tx.orderAddress.deleteMany({ where: orderIdWhere }),
    );
    const orderWhere = { id: { in: orderIds } };
    await apply(
      "Order",
      () => tx.order.count({ where: orderWhere }),
      () => tx.order.deleteMany({ where: orderWhere }),
    );

    const cartItemWhere = { variant: { sellerId: { in: sellerIds } } };
    await apply(
      "CartItem",
      () => tx.cartItem.count({ where: cartItemWhere }),
      () => tx.cartItem.deleteMany({ where: cartItemWhere }),
    );
    const favoriteWhere = { productId: { in: productIds } };
    await apply(
      "Favorite",
      () => tx.favorite.count({ where: favoriteWhere }),
      () => tx.favorite.deleteMany({ where: favoriteWhere }),
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

    const participationWhere = { OR: [{ couponId: { in: couponIds } }, sellerScope] };
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
    await apply(
      "SellerMember",
      () => tx.sellerMember.count({ where: sellerScope }),
      () => tx.sellerMember.deleteMany({ where: sellerScope }),
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

    // In a dry run the products still exist, so the brand check excludes the ones in scope.
    const brandWhere = { slug: { in: [...DEMO_BRAND_SLUGS] }, products: { none: { id: { notIn: productIds } } } };
    const brands = await tx.brand.findMany({ where: brandWhere, select: { slug: true } });
    await apply(
      "Brand",
      async () => brands.length,
      () => tx.brand.deleteMany({ where: brandWhere }),
    );

    return {
      stores: stores.map((store) => ({
        ...describeStore(protection, store),
        name: store.name,
        sellerStatus: store.sellerStatus,
        products: products.filter((product) => product.sellerId === store.sellerId).length,
        orders: orders.filter((order) => order.sellerOrders.some((part) => part.sellerId === store.sellerId)).length,
      })),
      storesNeedingConfirmation: storesNeedingConfirmation(stores).map((store) => describeStore(protection, store)),
      orders: orders.map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt.toISOString().slice(0, 10),
        payments: order.payments.map((payment) => `${payment.provider}:${payment.status}`),
      })),
      nonDemoProducts: products.filter((product) => product.isDemo === false).map((product) => product.slug),
      brands: brands.map((brand) => brand.slug),
      protectedAccountRows,
      counts,
    };
  });

  console.log(RUN_HEADLINE[mode]);
  console.log(JSON.stringify(report, null, 2));
}

try {
  await main();
} finally {
  await db.$disconnect();
}
