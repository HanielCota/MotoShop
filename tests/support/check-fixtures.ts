import { testDb } from "./database";

try {
  const [users, stores, orders] = await Promise.all([
    testDb.user.count({ where: { email: { endsWith: "@example.test" } } }),
    testDb.store.count({ where: { OR: [{ slug: { startsWith: "e2e-" } }, { slug: { startsWith: "integration-" } }] } }),
    testDb.order.count({ where: { customerEmail: { endsWith: "@example.test" } } }),
  ]);
  console.log(JSON.stringify({ testUsers: users, testStores: stores, testOrders: orders }));
  if (process.argv.includes("--details")) {
    console.log(
      JSON.stringify({
        users: await testDb.user.findMany({
          where: { email: { endsWith: "@example.test" } },
          select: { id: true, email: true, createdAt: true },
        }),
        stores: await testDb.store.findMany({
          where: { OR: [{ slug: { startsWith: "e2e-" } }, { slug: { startsWith: "integration-" } }] },
          select: { sellerId: true, slug: true, createdAt: true },
        }),
      }),
    );
  }
} finally {
  await testDb.$disconnect();
}
