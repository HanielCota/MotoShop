/**
 * Removes the "(demonstração)" and "· demonstração" markers and the "Produto fictício..." notice
 * from demo data created before the seeds dropped them (owner decision of 23/10/2026).
 *
 * Scope: review stores (scripts/review-scope.ts), the two stores of scripts/seed-demo-catalog.ts, their
 * demo products, product images and fallback brands, and the store and product names copied into
 * their orders and shipments. Images themselves are not touched. Runs in one transaction and aborts on
 * any row outside that scope.
 *
 *   pnpm db:review:clean-texts --dry-run   lists each change and writes nothing
 *   pnpm db:review:clean-texts             writes the changes
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { requireScriptDatabaseUrl } from "./database-guard";
import { REVIEW_STORE_WHERE, reviewBrandWhere } from "./review-scope";
import {
  DEMO_STORE_DESCRIPTIONS,
  changedFields,
  cleanOptionalText,
  cleanOriginName,
  cleanProductDescription,
  cleanStoreDescription,
  stillMarkedFields,
  withoutDemoMarkers,
  type TextRowPlan,
} from "./review-texts";

config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");
const databaseUrl = requireScriptDatabaseUrl(process.env, "db:review:clean-texts");
const database = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

const DEMO_CATALOG_STORE_SLUGS = Object.keys(DEMO_STORE_DESCRIPTIONS).filter((slug) => slug.startsWith("demo-"));
const TRANSACTION_TIMEOUT_MS = 300_000;

type Transaction = Prisma.TransactionClient;
type StoreScope = { storeIds: string[]; sellerIds: string[]; rows: TextRowPlan[] };

async function loadStores(tx: Transaction): Promise<StoreScope> {
  const stores = await tx.store.findMany({
    where: { OR: [REVIEW_STORE_WHERE, { slug: { in: DEMO_CATALOG_STORE_SLUGS } }] },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      originName: true,
      sellerId: true,
      seller: { select: { _count: { select: { members: true } } } },
    },
    orderBy: { slug: "asc" },
  });

  // The catalog seed creates its sellers without members; a member means the slug was reused.
  const unexpected = stores.find((store) => store.slug.startsWith("demo-") && store.seller._count.members > 0);
  if (unexpected != null)
    throw new Error(`Store ${unexpected.slug} has members; it is not the catalog seed's. Aborting.`);

  const rows = stores.map((store) => ({
    table: "Store",
    id: store.id,
    label: store.slug,
    fields: [
      { field: "name", current: store.name, next: withoutDemoMarkers(store.name) },
      { field: "description", current: store.description, next: cleanStoreDescription(store.slug, store.description) },
      { field: "originName", current: store.originName, next: cleanOriginName(store.originName) },
    ],
  }));

  return { storeIds: stores.map((store) => store.id), sellerIds: stores.map((store) => store.sellerId), rows };
}

async function loadProducts(tx: Transaction, scope: StoreScope) {
  const products = await tx.product.findMany({
    where: { storeId: { in: scope.storeIds } },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      isDemo: true,
      images: { select: { id: true, storageKey: true, altText: true } },
    },
    orderBy: { slug: "asc" },
  });

  const unexpected = products.find((product) => product.isDemo === false);
  if (unexpected != null) throw new Error(`Product ${unexpected.slug} is not a demo product. Aborting.`);

  const productRows = products.map((product) => ({
    table: "Product",
    id: product.id,
    label: product.slug,
    fields: [
      { field: "name", current: product.name, next: withoutDemoMarkers(product.name) },
      {
        field: "description",
        current: product.description,
        next: cleanProductDescription(product.slug, product.description),
      },
    ],
  }));
  const imageRows = products.flatMap((product) =>
    product.images.map((image) => ({
      table: "ProductImage",
      id: image.id,
      label: image.storageKey,
      fields: [{ field: "altText", current: image.altText, next: cleanOptionalText(image.altText) }],
    })),
  );

  return { productIds: products.map((product) => product.id), rows: [...productRows, ...imageRows] };
}

async function loadBrands(tx: Transaction, productIds: string[]): Promise<TextRowPlan[]> {
  const brands = await tx.brand.findMany({
    where: reviewBrandWhere(productIds),
    select: { id: true, slug: true, name: true },
  });

  return brands.map((brand) => ({
    table: "Brand",
    id: brand.id,
    label: brand.slug,
    fields: [{ field: "name", current: brand.name, next: withoutDemoMarkers(brand.name) }],
  }));
}

async function loadOrderSnapshots(tx: Transaction, sellerIds: string[]): Promise<TextRowPlan[]> {
  const sellerOrders = await tx.sellerOrder.findMany({
    where: { sellerId: { in: sellerIds } },
    select: {
      id: true,
      storeNameSnapshot: true,
      order: { select: { orderNumber: true } },
      items: { select: { id: true, productNameSnapshot: true } },
      shipment: { select: { id: true, carrier: true } },
    },
  });

  return sellerOrders.flatMap((sellerOrder) => {
    const label = sellerOrder.order.orderNumber;
    const store = {
      table: "SellerOrder",
      id: sellerOrder.id,
      label,
      fields: [
        {
          field: "storeNameSnapshot",
          current: sellerOrder.storeNameSnapshot,
          next: withoutDemoMarkers(sellerOrder.storeNameSnapshot),
        },
      ],
    };
    const items = sellerOrder.items.map((item) => ({
      table: "OrderItem",
      id: item.id,
      label,
      fields: [
        {
          field: "productNameSnapshot",
          current: item.productNameSnapshot,
          next: withoutDemoMarkers(item.productNameSnapshot),
        },
      ],
    }));
    const shipment = sellerOrder.shipment;
    if (shipment === null) return [store, ...items];

    const shipmentRow = {
      table: "Shipment",
      id: shipment.id,
      label,
      fields: [{ field: "carrier", current: shipment.carrier, next: withoutDemoMarkers(shipment.carrier) }],
    };

    return [store, ...items, shipmentRow];
  });
}

async function assertBrandNamesFree(tx: Transaction, rows: TextRowPlan[]) {
  const renamed = rows.filter((row) => row.table === "Brand" && changedFields(row).length > 0);
  for (const row of renamed) {
    const name = row.fields.find((field) => field.field === "name")?.next;
    if (name == null) throw new Error(`Brand ${row.label} has no new name`);

    const taken = await tx.brand.findFirst({ where: { name, id: { not: row.id } }, select: { slug: true } });
    if (taken != null) throw new Error(`Brand name "${name}" is already used by ${taken.slug}. Aborting.`);
  }
}

type TextData = Record<string, string | null>;
type RowWriter = (tx: Transaction, id: string, data: TextData) => Promise<unknown>;

const ROW_WRITERS: Readonly<Record<string, RowWriter>> = {
  Store: (tx, id, data) => tx.store.update({ where: { id }, data }),
  Product: (tx, id, data) => tx.product.update({ where: { id }, data }),
  ProductImage: (tx, id, data) => tx.productImage.update({ where: { id }, data }),
  Brand: (tx, id, data) => tx.brand.update({ where: { id }, data }),
  SellerOrder: (tx, id, data) => tx.sellerOrder.update({ where: { id }, data }),
  OrderItem: (tx, id, data) => tx.orderItem.update({ where: { id }, data }),
  Shipment: (tx, id, data) => tx.shipment.update({ where: { id }, data }),
};

async function writeRow(tx: Transaction, row: TextRowPlan, data: TextData) {
  const write = ROW_WRITERS[row.table];
  if (write == null) throw new Error(`Unknown table ${row.table}`);

  await write(tx, row.id, data);
}

function describeChange(row: TextRowPlan) {
  const prefix = dryRun ? "[dry-run] would set" : "setting";
  for (const field of changedFields(row)) {
    console.log(
      `${prefix} ${row.table} ${row.label} ${field.field}: ${JSON.stringify(field.current)} -> ${JSON.stringify(field.next)}`,
    );
  }
}

function summarize(rows: TextRowPlan[]) {
  const changed = rows.filter((row) => changedFields(row).length > 0);
  const perTable = new Map<string, number>();
  for (const row of changed) perTable.set(row.table, (perTable.get(row.table) ?? 0) + 1);
  console.log(`Rows to change: ${changed.length}`, Object.fromEntries(perTable));

  const marked = rows.flatMap((row) =>
    stillMarkedFields(row).map((field) => `${row.table} ${row.label} ${field.field}`),
  );
  console.log(`Still marked after the cleanup: ${marked.length}`);
  for (const entry of marked) console.log(`  ${entry}`);
}

async function main() {
  await database.$transaction(
    async (tx) => {
      const stores = await loadStores(tx);
      const products = await loadProducts(tx, stores);
      const rows = [
        ...stores.rows,
        ...products.rows,
        ...(await loadBrands(tx, products.productIds)),
        ...(await loadOrderSnapshots(tx, stores.sellerIds)),
      ];
      console.log(`Demo stores in scope: ${stores.storeIds.length}. Demo products: ${products.productIds.length}.`);
      await assertBrandNamesFree(tx, rows);

      for (const row of rows) {
        const changes = changedFields(row);
        if (changes.length === 0) continue;

        describeChange(row);
        if (dryRun) continue;

        await writeRow(tx, row, Object.fromEntries(changes.map((field) => [field.field, field.next])));
      }

      summarize(rows);
    },
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_TIMEOUT_MS },
  );

  if (dryRun) console.log("Dry run: nothing was written.");
}

try {
  await main();
} finally {
  await database.$disconnect();
}
