import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const database = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

const stores = [
  {
    slug: "demo-pista-norte",
    name: "Pista Norte · demonstração",
    description: "Loja fictícia criada para apresentar a experiência da Moto Shop.",
  },
  {
    slug: "demo-trilha-sul",
    name: "Trilha Sul · demonstração",
    description: "Loja fictícia de equipamentos e peças para testes visuais do marketplace.",
  },
] as const;

const products = [
  {
    slug: "demo-capacete-off-road-apex",
    name: "Capacete off-road Apex preto e laranja",
    description:
      "Capacete off-road demonstrativo com pala alongada, queixeira ventilada e acabamento preto fosco com detalhes laranja. Imagem, preço e disponibilidade são ilustrativos; não há produto físico à venda. Confira sempre certificação e tabela de medidas antes de escolher um capacete real.",
    storeSlug: stores[0].slug,
    categorySlug: "equipment-helmets",
    brandSlug: "apex-demo",
    image: "demo/capacete-apex.webp",
    weightInGrams: 1800,
    dimensions: [310, 260, 410] as const,
    variants: [
      {
        sku: "DEMO-APEX-P",
        title: "Preto/laranja · P",
        priceInCents: 69990,
        promotionalPriceInCents: 62990,
        quantity: 3,
        size: "P",
      },
      {
        sku: "DEMO-APEX-M",
        title: "Preto/laranja · M",
        priceInCents: 69990,
        promotionalPriceInCents: 62990,
        quantity: 6,
        size: "M",
      },
      {
        sku: "DEMO-APEX-G",
        title: "Preto/laranja · G",
        priceInCents: 69990,
        promotionalPriceInCents: 62990,
        quantity: 4,
        size: "G",
      },
    ],
  },
  {
    slug: "demo-botas-off-road-terra",
    name: "Botas off-road Terra pretas e laranja",
    description:
      "Par de botas off-road demonstrativas com cano alto, fivelas ajustáveis, reforço frontal e sola tratorada. Fotografia gerada para testes do catálogo; numeração, preço e estoque são ilustrativos. Não há produto físico à venda.",
    storeSlug: stores[0].slug,
    categorySlug: "equipment-boots",
    brandSlug: "terra-demo",
    image: "demo/botas-terra.webp",
    weightInGrams: 4200,
    dimensions: [390, 330, 550] as const,
    variants: [
      {
        sku: "DEMO-TERRA-40",
        title: "Preto/laranja · 40",
        priceInCents: 87990,
        promotionalPriceInCents: null,
        quantity: 2,
        size: "40",
      },
      {
        sku: "DEMO-TERRA-41",
        title: "Preto/laranja · 41",
        priceInCents: 87990,
        promotionalPriceInCents: null,
        quantity: 5,
        size: "41",
      },
      {
        sku: "DEMO-TERRA-42",
        title: "Preto/laranja · 42",
        priceInCents: 87990,
        promotionalPriceInCents: null,
        quantity: 4,
        size: "42",
      },
    ],
  },
  {
    slug: "demo-oculos-off-road-vista",
    name: "Óculos off-road Vista com lente transparente",
    description:
      "Óculos de motocross demonstrativos com armação preta, cinta elástica laranja e lente transparente. A foto representa apenas o visual do item; não especifica certificação, tratamento da lente ou produto real. Preço e estoque são ilustrativos.",
    storeSlug: stores[1].slug,
    categorySlug: "equipment-goggles",
    brandSlug: "apex-demo",
    image: "demo/oculos-vista.webp",
    weightInGrams: 450,
    dimensions: [120, 120, 260] as const,
    variants: [
      {
        sku: "DEMO-VISTA-UN",
        title: "Preto/laranja · tamanho único",
        priceInCents: 21990,
        promotionalPriceInCents: null,
        quantity: 12,
        size: "Único",
      },
    ],
  },
  {
    slug: "demo-disco-de-freio-onda",
    name: "Disco de freio dianteiro Onda",
    description:
      "Disco de freio dianteiro ondulado demonstrativo em aço, fotografado isoladamente. Medidas, aplicação e compatibilidade não foram verificadas e não devem orientar a compra de uma peça real. Imagem, preço e estoque são apenas para apresentação.",
    storeSlug: stores[1].slug,
    categorySlug: "parts-brakes",
    brandSlug: "terra-demo",
    image: "demo/disco-onda.webp",
    weightInGrams: 900,
    dimensions: [35, 280, 280] as const,
    variants: [
      {
        sku: "DEMO-ONDA-UN",
        title: "Aço · aplicação a confirmar",
        priceInCents: 28990,
        promotionalPriceInCents: null,
        quantity: 7,
        size: "Único",
      },
    ],
  },
] as const;

async function main() {
  if (process.argv.includes("--verify")) {
    const rows = await database.product.findMany({
      where: { slug: { in: products.map((product) => product.slug) } },
      include: {
        seller: { include: { store: true } },
        brand: true,
        category: true,
        images: true,
        variants: { include: { inventory: true } },
      },
    });
    if (rows.length !== products.length)
      throw new Error(`Expected ${products.length} demo products; found ${rows.length}.`);
    for (const row of rows) {
      const definition = products.find((product) => product.slug === row.slug)!;
      if (
        !row.isDemo ||
        row.images[0]?.storageKey !== definition.image ||
        row.variants.length !== definition.variants.length ||
        row.variants.some((variant) => !variant.inventory) ||
        !existsSync(join(process.cwd(), "public/images", definition.image))
      ) {
        throw new Error(`Incomplete demo product: ${row.slug}`);
      }
    }
    console.log(
      JSON.stringify(
        rows.map((row) => ({
          slug: row.slug,
          name: row.name,
          store: row.seller.store?.name,
          sellerStatus: row.seller.status,
          category: row.category.slug,
          brand: row.brand.name,
          image: row.images[0]?.storageKey,
          variants: row.variants.map((variant) => ({
            sku: variant.sku,
            priceInCents: variant.priceInCents,
            stock: variant.inventory?.availableQuantity,
          })),
        })),
        null,
        2,
      ),
    );
    return;
  }

  if (process.argv.includes("--hide")) {
    const result = await database.seller.updateMany({
      where: { store: { slug: { in: stores.map((store) => store.slug) } } },
      data: { status: "PENDING" },
    });
    console.log(JSON.stringify({ mode: "hidden", sellers: result.count }));
    return;
  }

  if (process.argv.includes("--publish")) {
    const result = await database.$transaction(async (tx) => {
      const demoStores = await tx.store.findMany({
        where: { slug: { in: stores.map((store) => store.slug) } },
        select: { slug: true, name: true, sellerId: true, seller: { select: { status: true } } },
      });
      if (
        demoStores.length !== stores.length ||
        demoStores.some((store) =>
          store.name !== stores.find((definition) => definition.slug === store.slug)?.name ||
          store.seller.status !== "PENDING",
        )
      ) {
        throw new Error("Demo stores are missing or not pending; refusing to publish.");
      }
      const demoProducts = await tx.product.findMany({
        where: { slug: { in: products.map((product) => product.slug) } },
        select: { slug: true, isDemo: true, sellerId: true, status: true, images: true, variants: { include: { inventory: true } } },
      });
      if (
        demoProducts.length !== products.length ||
        demoProducts.some((product) => {
          const definition = products.find((entry) => entry.slug === product.slug);
          const store = demoStores.find((entry) => entry.slug === definition?.storeSlug);
          return !definition || !store || !product.isDemo || product.sellerId !== store.sellerId ||
            product.status !== "APPROVED" || product.images[0]?.storageKey !== definition.image ||
            product.variants.length !== definition.variants.length ||
            product.variants.some((variant) => !variant.inventory);
        })
      ) {
        throw new Error("Demo products are incomplete; refusing to publish.");
      }
      const updated = await tx.seller.updateMany({
        where: { id: { in: demoStores.map((store) => store.sellerId) }, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      if (updated.count !== stores.length) throw new Error("Not all demo stores were published.");
      return updated.count;
    });
    console.log(JSON.stringify({ mode: "published", sellers: result }));
    return;
  }

  const existing = await database.product.findMany({
    where: { slug: { in: products.map((product) => product.slug) } },
    select: { slug: true, isDemo: true },
  });
  const collision = existing.find((product) => !product.isDemo);
  if (collision) throw new Error(`Refusing to modify non-demo product: ${collision.slug}`);

  const storeCollisions = await database.store.findMany({
    where: { slug: { in: stores.map((store) => store.slug) } },
    select: { slug: true, name: true },
  });
  for (const store of storeCollisions) {
    if (store.name !== stores.find((item) => item.slug === store.slug)?.name) {
      throw new Error(`Refusing to modify unrelated store: ${store.slug}`);
    }
  }

  if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          stores: stores.map((store) => store.slug),
          products: products.map((product) => product.slug),
          existingDemoProducts: existing.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  await database.$transaction(
    async (tx) => {
      const storeBySlug = new Map<string, { id: string; sellerId: string }>();
      for (const definition of stores) {
        const current = await tx.store.findUnique({ where: { slug: definition.slug } });
        if (current) {
          storeBySlug.set(definition.slug, { id: current.id, sellerId: current.sellerId });
          continue;
        }
        const seller = await tx.seller.create({ data: { type: "COMPANY", status: "PENDING" } });
        const store = await tx.store.create({
          data: {
            slug: definition.slug,
            name: definition.name,
            description: definition.description,
            sellerId: seller.id,
          },
        });
        storeBySlug.set(definition.slug, { id: store.id, sellerId: seller.id });
      }

      const categories = new Map<string, string>();
      for (const slug of ["equipment-helmets", "equipment-boots", "equipment-goggles", "parts-brakes"] as const) {
        const category = await tx.category.findUnique({ where: { slug }, select: { id: true } });
        if (!category) throw new Error(`Missing category ${slug}; run the regular database seed first.`);
        categories.set(slug, category.id);
      }
      const brands = new Map<string, string>();
      for (const [slug, name] of [
        ["apex-demo", "Apex Demo"],
        ["terra-demo", "Terra Demo"],
      ] as const) {
        const brand = await tx.brand.upsert({ where: { slug }, update: {}, create: { slug, name } });
        brands.set(slug, brand.id);
      }

      for (const definition of products) {
        const store = storeBySlug.get(definition.storeSlug)!;
        const data = {
          name: definition.name,
          description: definition.description,
          isDemo: true,
          status: "APPROVED" as const,
          weightInGrams: definition.weightInGrams,
          heightInMillimeters: definition.dimensions[0],
          widthInMillimeters: definition.dimensions[1],
          lengthInMillimeters: definition.dimensions[2],
          categoryId: categories.get(definition.categorySlug)!,
          brandId: brands.get(definition.brandSlug)!,
        };
        const product = await tx.product.upsert({
          where: { slug: definition.slug },
          create: {
            slug: definition.slug,
            sellerId: store.sellerId,
            storeId: store.id,
            submittedAt: new Date(),
            reviewedAt: new Date(),
            ...data,
          },
          update: data,
        });
        if (product.sellerId !== store.sellerId)
          throw new Error(`Demo product belongs to another seller: ${product.slug}`);

        await tx.productImage.upsert({
          where: { storageKey: definition.image },
          create: { productId: product.id, storageKey: definition.image, altText: definition.name, sortOrder: 0 },
          update: { altText: definition.name, sortOrder: 0 },
        });

        for (const entry of definition.variants) {
          const variant = await tx.productVariant.upsert({
            where: { sellerId_sku: { sellerId: store.sellerId, sku: entry.sku } },
            create: {
              productId: product.id,
              sellerId: store.sellerId,
              sku: entry.sku,
              title: entry.title,
              attributes: { size: entry.size },
              priceInCents: entry.priceInCents,
              promotionalPriceInCents: entry.promotionalPriceInCents,
            },
            update: {
              title: entry.title,
              attributes: { size: entry.size },
              priceInCents: entry.priceInCents,
              promotionalPriceInCents: entry.promotionalPriceInCents,
            },
          });
          if (variant.productId !== product.id) throw new Error(`Demo SKU belongs to another product: ${entry.sku}`);
          const inventory = await tx.inventory.findUnique({ where: { variantId: variant.id } });
          if (!inventory) {
            const created = await tx.inventory.create({
              data: { variantId: variant.id, sellerId: store.sellerId, availableQuantity: entry.quantity },
            });
            await tx.inventoryMovement.create({
              data: {
                inventoryId: created.id,
                variantId: variant.id,
                sellerId: store.sellerId,
                type: "MANUAL_IN",
                quantityChange: entry.quantity,
                availableQuantityAfter: entry.quantity,
                reservedQuantityAfter: 0,
                referenceType: "DEMO_SEED",
                referenceId: product.id,
                reason: "Estoque ilustrativo do catálogo de demonstração",
              },
            });
          }
        }
      }
    },
    { timeout: 30_000 },
  );

  console.log(
    JSON.stringify({
      mode: "applied",
      stores: stores.length,
      products: products.length,
      variants: products.reduce((count, product) => count + product.variants.length, 0),
    }),
  );
}

try {
  await main();
} finally {
  await database.$disconnect();
}
