import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../src/generated/prisma/client";
config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("A development DATABASE_URL is required for integration tests.");
export const testDb = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

// Only delete exact fixture IDs/emails recorded by this test run. Never reset the database.
export async function cleanupFixtures(input: {
  sellerIds: string[];
  userIds: string[];
  emails: string[];
  cartIds?: string[];
  couponIds?: string[];
}) {
  if (input.emails.some((email) => !email.endsWith("@example.test")))
    throw new Error("Refusing to clean non-test accounts");
  const orders = await testDb.order.findMany({ where: { customerEmail: { in: input.emails } }, select: { id: true } });
  const orderIds = orders.map((order) => order.id);
  await testDb.$transaction(
    async (tx) => {
      await tx.auditLog.deleteMany({
        where: { OR: [{ actorUserId: { in: input.userIds } }, { entityId: { in: orderIds } }] },
      });
      await tx.paymentTransaction.deleteMany({ where: { payment: { orderId: { in: orderIds } } } });
      await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.shipment.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
      await tx.orderItem.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
      await tx.sellerOrder.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.orderAddress.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      await tx.cartItem.deleteMany({
        where: { OR: [{ variant: { sellerId: { in: input.sellerIds } } }, { cartId: { in: input.cartIds ?? [] } }] },
      });
      await tx.cart.deleteMany({
        where: { OR: [{ id: { in: input.cartIds ?? [] } }, { userId: { in: input.userIds } }] },
      });
      await tx.inventoryMovement.deleteMany({ where: { sellerId: { in: input.sellerIds } } });
      await tx.inventory.deleteMany({ where: { sellerId: { in: input.sellerIds } } });
      await tx.productImage.deleteMany({ where: { product: { sellerId: { in: input.sellerIds } } } });
      await tx.productCompatibility.deleteMany({ where: { sellerId: { in: input.sellerIds } } });
      await tx.productVariant.deleteMany({ where: { sellerId: { in: input.sellerIds } } });
      await tx.product.deleteMany({ where: { sellerId: { in: input.sellerIds } } });
      await tx.coupon.deleteMany({ where: { id: { in: input.couponIds ?? [] } } });
      await tx.store.deleteMany({ where: { sellerId: { in: input.sellerIds } } });
      await tx.seller.deleteMany({ where: { id: { in: input.sellerIds } } });
      await tx.user.deleteMany({ where: { id: { in: input.userIds } } });
    },
    { timeout: 30_000 },
  );
}
