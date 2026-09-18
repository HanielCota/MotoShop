import "dotenv/config";

import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const database = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: databaseUrl }),
});

async function seed() {
  await database.marketplaceConfiguration.upsert({
    where: { key: "default" },
    update: {},
    create: { key: "default", defaultCommissionBps: 1_200 },
  });

  const [parts, equipment] = await Promise.all([
    upsertCategory({ name: "Parts", slug: "parts", sortOrder: 10 }),
    upsertCategory({ name: "Equipment", slug: "equipment", sortOrder: 20 }),
    upsertCategory({ name: "Apparel", slug: "apparel", sortOrder: 30 }),
  ]);

  await Promise.all([
    upsertCategory({ name: "Engine", slug: "parts-engine", sortOrder: 10, parentId: parts.id }),
    upsertCategory({ name: "Transmission", slug: "parts-transmission", sortOrder: 20, parentId: parts.id }),
    upsertCategory({ name: "Suspension", slug: "parts-suspension", sortOrder: 30, parentId: parts.id }),
    upsertCategory({ name: "Brakes", slug: "parts-brakes", sortOrder: 40, parentId: parts.id }),
    upsertCategory({ name: "Helmets", slug: "equipment-helmets", sortOrder: 10, parentId: equipment.id }),
    upsertCategory({ name: "Boots", slug: "equipment-boots", sortOrder: 20, parentId: equipment.id }),
    upsertCategory({ name: "Goggles", slug: "equipment-goggles", sortOrder: 30, parentId: equipment.id }),
  ]);

  await Promise.all([
    upsertBrand("Fox", "fox"),
    upsertBrand("Alpinestars", "alpinestars"),
    upsertBrand("Renthal", "renthal"),
  ]);

  const [honda, yamaha] = await Promise.all([
    upsertMotorcycleManufacturer("Honda", "honda"),
    upsertMotorcycleManufacturer("Yamaha", "yamaha"),
  ]);
  const [crf250r, yz250f] = await Promise.all([
    upsertMotorcycleModel(honda.id, "CRF 250R", "crf-250r"),
    upsertMotorcycleModel(yamaha.id, "YZ250F", "yz250f"),
  ]);

  await database.motorcycleFitment.createMany({
    data: [
      { motorcycleModelId: crf250r.id, displacementCc: 250, year: 2024 },
      { motorcycleModelId: crf250r.id, displacementCc: 250, year: 2025 },
      { motorcycleModelId: yz250f.id, displacementCc: 250, year: 2025 },
    ],
    skipDuplicates: true,
  });
}

type CategorySeed = {
  name: string;
  slug: string;
  sortOrder: number;
  parentId?: string;
};

function upsertCategory(input: CategorySeed) {
  return database.category.upsert({
    where: { slug: input.slug },
    update: {
      name: input.name,
      sortOrder: input.sortOrder,
      ...(input.parentId ? { parentId: input.parentId } : {}),
    },
    create: input,
  });
}

function upsertBrand(name: string, slug: string) {
  return database.brand.upsert({
    where: { slug },
    update: { name, active: true },
    create: { name, slug },
  });
}

function upsertMotorcycleManufacturer(name: string, slug: string) {
  return database.motorcycleManufacturer.upsert({
    where: { slug },
    update: { name, active: true },
    create: { name, slug },
  });
}

function upsertMotorcycleModel(manufacturerId: string, name: string, slug: string) {
  return database.motorcycleModel.upsert({
    where: { manufacturerId_slug: { manufacturerId, slug } },
    update: { name, active: true },
    create: { manufacturerId, name, slug },
  });
}

try {
  await seed();
} finally {
  await database.$disconnect();
}
