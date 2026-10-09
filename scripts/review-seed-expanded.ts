/**
 * Conjunto AMPLIADO de dados de revisão visual (usado por scripts/seed-review-data.ts).
 *
 * Tudo aqui usa IDs determinísticos (`reviewId`) e `createMany({ skipDuplicates: true })` em lotes:
 * a segunda execução não cria nada novo e o volume (centenas de linhas) não vira milhares de
 * round-trips para a Neon. Antes de inserir, conflitos de chaves naturais (slug, SKU, número do
 * pedido, storageKey) com linhas que NÃO são do seed abortam a execução.
 */
import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import {
  answerPool,
  categoryLabels,
  categoryPhotos,
  extraCustomers,
  guestCustomers,
  productTemplates,
  questionPool,
  reviewTexts,
  sellerReviewTexts,
  type ProductTemplate,
  type ReviewStoreCode,
} from "./review-seed-content";
import {
  REVIEW_ADDRESS_LABEL_SUFFIX,
  reviewId,
  viewerAddressId,
  viewerCartId,
  viewerSavedMotorcycleId,
} from "./review-seed-ids";
import { must } from "./must";

// ---------------------------------------------------------------------------------------------
// Tipos e utilitários
// ---------------------------------------------------------------------------------------------

type StoreRef = { id: string; sellerId: string; name: string; commissionBps: number };
type SellerOrderStatus =
  "PENDING_PAYMENT" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLATION_REQUESTED" | "CANCELLED";
type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "DELIVERED"
  | "PARTIALLY_CANCELLED"
  | "CANCELLED";
type ShipmentStatus = "PENDING" | "READY_TO_SHIP" | "SHIPPED" | "DELIVERED" | "CANCELLED";
type CancellationStatus = "REQUESTED" | "APPROVED" | "REFUNDED" | "REJECTED";
type ReturnStatus = "REQUESTED" | "UNDER_REVIEW" | "APPROVED" | "WAITING_RETURN" | "RETURNED" | "REFUNDED" | "REJECTED";
type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
type MovementType =
  | "SALE"
  | "RESERVATION"
  | "RESERVATION_RELEASE"
  | "RETURN"
  | "CANCELLATION"
  | "MANUAL_IN"
  | "MANUAL_OUT"
  | "CORRECTION";

export type ExpandedSeedInput = {
  db: PrismaClient;
  now: Date;
  stores: Record<ReviewStoreCode, StoreRef>;
  /** Usuário dono de cada loja (ator de auditoria/respostas). */
  storeOwnerIds: Record<ReviewStoreCode, string>;
  adminUserId: string;
  passwordHash: string;
  shippingByStore: Record<ReviewStoreCode, { name: string; price: number; days: number }>;
  commission: (amountInCents: number, bps: number) => number;
  hashGuestToken: (token: string) => string;
  trackMany: (entity: string, created: number, total: number) => void;
  viewerCustomerEmails: string[];
  viewerSellerEmails: string[];
  notice: string;
};

const DAY = 24 * 60 * 60 * 1000;
const STORE_CODES: ReviewStoreCode[] = ["garagem", "box77", "trilha", "racing", "areia", "cross"];
const SKU_PREFIX: Record<ReviewStoreCode, string> = {
  garagem: "GMX",
  box77: "B77",
  trilha: "TRF",
  racing: "RSM",
  areia: "ARM",
  cross: "CCC",
};

function rngFor(seed: string) {
  let state = Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  const value = list[Math.floor(rng() * list.length)];
  if (value === undefined) throw new Error("Empty list");
  return value;
}

function digits(seed: string, length: number) {
  return (BigInt(`0x${createHash("sha256").update(seed).digest("hex").slice(0, 15)}`) % BigInt(10 ** length))
    .toString()
    .padStart(length, "0");
}

async function insertMany<T>(
  trackMany: ExpandedSeedInput["trackMany"],
  entity: string,
  rows: T[],
  create: (chunk: T[]) => Promise<{ count: number }>,
) {
  let created = 0;
  for (let index = 0; index < rows.length; index += 400)
    created += (await create(rows.slice(index, index + 400))).count;
  trackMany(entity, created, rows.length);
  return created;
}

// ---------------------------------------------------------------------------------------------
// Imagens (SVG -> WebP com sharp). Sem logotipos de marcas: apenas categoria e "Demonstração".
// ---------------------------------------------------------------------------------------------

const INK = "#1c1917";
const BRAND = "#fe6900";
const BRAND_STRONG = "#a63a0b";
const FONT = "Arial, Helvetica, sans-serif";

/** Picks an item from a non-empty list, wrapping the index around its length. */
function cycle<T>(items: readonly T[], index: number): T {
  return must(items[index % items.length], `item ${index} of a ${items.length}-item list`);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapText(text: string, maxChars: number, maxLines: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if (`${current} ${word}`.trim().length > maxChars && current) {
      lines.push(current);
      current = word;
      continue;
    }
    current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
    return kept;
  }
  return lines;
}

function imagePath(storageKey: string) {
  if (!/^demo\/review-[a-z0-9-]+\.webp$/.test(storageKey)) throw new Error(`Unsafe image key ${storageKey}`);
  return join(process.cwd(), "public/images", storageKey);
}

async function writeSvgAsWebp(storageKey: string, svg: string) {
  const target = imagePath(storageKey);
  if (existsSync(target)) return false;
  await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(target);
  return true;
}

const PRODUCT_BACKGROUNDS: Array<{ from: string; to: string; dark: boolean }> = [
  { from: "#fbf6f0", to: "#f0e4d6", dark: false },
  { from: "#f6efe6", to: "#e8d9c6", dark: false },
  { from: "#1c1917", to: "#33302d", dark: true },
  { from: "#fff4eb", to: "#fcdcc0", dark: false },
];

export async function renderProductImage(
  storageKey: string,
  input: { label: string; title: string; caption: string; variant: number },
) {
  const background = cycle(PRODUCT_BACKGROUNDS, input.variant);
  const text = background.dark ? "#fafaf9" : INK;
  const secondary = background.dark ? "#d6d3d1" : "#44403c";
  const muted = background.dark ? "#a8a29e" : "#78716c";
  const caption = background.dark ? BRAND : BRAND_STRONG;
  const titleLines = wrapText(input.title, 30, 3)
    .map(
      (line, index) =>
        `<text x="80" y="${392 + index * 46}" font-family="${FONT}" font-size="36" fill="${secondary}">${escapeXml(line)}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${background.from}"/><stop offset="1" stop-color="${background.to}"/></linearGradient></defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <circle cx="640" cy="170" r="240" fill="${BRAND}" opacity="0.11"/>
  <circle cx="120" cy="720" r="180" fill="${BRAND}" opacity="0.07"/>
  <rect x="80" y="80" rx="22" width="268" height="46" fill="${BRAND}"/>
  <text x="214" y="111" font-family="${FONT}" font-size="22" font-weight="700" fill="#171716" text-anchor="middle" letter-spacing="2">DEMONSTRAÇÃO</text>
  <text x="80" y="318" font-family="${FONT}" font-size="80" font-weight="700" fill="${text}">${escapeXml(input.label)}</text>
  ${titleLines}
  <rect x="80" y="590" width="120" height="8" rx="4" fill="${BRAND}"/>
  <text x="80" y="652" font-family="${FONT}" font-size="30" font-weight="700" fill="${caption}">${escapeXml(input.caption)}</text>
  <text x="80" y="726" font-family="${FONT}" font-size="22" fill="${muted}">O Moto Shop · imagem ilustrativa, produto fictício</text>
</svg>`;
  return writeSvgAsWebp(storageKey, svg);
}

function storeDisplayName(name: string) {
  return name.replace(/ · demonstração$/, "");
}

export async function renderStoreLogo(storageKey: string, storeName: string) {
  const initials = storeDisplayName(storeName)
    .split(/\s+/)
    .filter((word) => /^[A-Za-zÀ-ú0-9]/.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="${INK}"/>
  <circle cx="200" cy="200" r="150" fill="${BRAND}"/>
  <text x="200" y="236" font-family="${FONT}" font-size="110" font-weight="700" fill="#171716" text-anchor="middle">${escapeXml(initials)}</text>
  <text x="200" y="378" font-family="${FONT}" font-size="22" font-weight="700" fill="#e7e5e4" text-anchor="middle" letter-spacing="3">DEMONSTRAÇÃO</text>
</svg>`;
  return writeSvgAsWebp(storageKey, svg);
}

export async function renderStoreBanner(storageKey: string, storeName: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="480" viewBox="0 0 1600 480">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${INK}"/><stop offset="1" stop-color="#44403c"/></linearGradient></defs>
  <rect width="1600" height="480" fill="url(#bg)"/>
  <path d="M1080 480 L1280 0 L1600 0 L1600 480 Z" fill="${BRAND}" opacity="0.9"/>
  <path d="M960 480 L1160 0 L1210 0 L1010 480 Z" fill="${BRAND}" opacity="0.45"/>
  <text x="96" y="236" font-family="${FONT}" font-size="76" font-weight="700" fill="#fafaf9">${escapeXml(storeDisplayName(storeName))}</text>
  <text x="96" y="306" font-family="${FONT}" font-size="32" fill="${BRAND}">Loja de demonstração · dados ilustrativos</text>
</svg>`;
  return writeSvgAsWebp(storageKey, svg);
}

// ---------------------------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------------------------

type NewVariant = {
  id: string;
  sku: string;
  productId: string;
  productName: string;
  sellerId: string;
  store: ReviewStoreCode;
  title: string;
  attributes: Record<string, string>;
  priceInCents: number;
  stock: number;
  weightInGrams: number;
  dimensions: [number, number, number];
  approved: boolean;
  createdAt: Date;
};

type NewProduct = {
  id: string;
  slug: string;
  name: string;
  template: ProductTemplate;
  store: ReviewStoreCode;
  approved: boolean;
  fitment: boolean;
};

const ACTIVE_PROMOTIONS = new Set([0, 3, 7, 10, 16, 19, 24, 29, 33, 41, 45]);
const FUTURE_PROMOTIONS = new Set([12, 27, 38]);
const EXPIRED_PROMOTIONS = new Set([5, 21, 44]);
const STOCK_PATTERN = [12, 3, 0, 7, 1, 15, 5, 0, 9, 2, 20, 4];
const GALLERY_CAPTIONS = ["Foto principal", "Vista lateral", "Detalhe do acabamento", "Embalagem"];

function promoPrice(price: number) {
  return Math.max(990, Math.round((price * 0.85) / 100) * 100 - 10);
}

async function seedCatalog(input: ExpandedSeedInput) {
  const { db, now, stores, adminUserId, trackMany, notice } = input;
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);
  const daysAhead = (days: number) => new Date(now.getTime() + days * DAY);

  const categories = new Map(
    (await db.category.findMany({ where: { active: true }, select: { id: true, slug: true } })).map((category) => [
      category.slug,
      category.id,
    ]),
  );
  let brands = await db.brand.findMany({
    where: { active: true },
    select: { id: true, slug: true },
    orderBy: { name: "asc" },
  });
  if (brands.length < 5) {
    const fallback = ["Pista", "Trilha", "Areia", "Box", "Largada"].map((label) => ({
      id: reviewId("brand", label),
      name: `Marca ${label} (demonstração)`,
      slug: `review-marca-${label.toLowerCase()}`,
    }));
    await insertMany(trackMany, "Brand", fallback.slice(0, 5 - brands.length), (chunk) =>
      db.brand.createMany({ data: chunk, skipDuplicates: true }),
    );
    brands = await db.brand.findMany({
      where: { active: true },
      select: { id: true, slug: true },
      orderBy: { name: "asc" },
    });
  }
  const brandIds = new Map(brands.map((brand) => [brand.slug, brand.id]));

  const fitments = (
    await db.motorcycleFitment.findMany({
      where: { motorcycleModel: { active: true, manufacturer: { active: true } } },
      include: { motorcycleModel: { include: { manufacturer: true } } },
    })
  ).sort((a, b) =>
    `${a.motorcycleModel.manufacturer.name}|${a.motorcycleModel.name}|${a.year}`.localeCompare(
      `${b.motorcycleModel.manufacturer.name}|${b.motorcycleModel.name}|${b.year}`,
    ),
  );
  const manufacturers = [...new Set(fitments.map((fitment) => fitment.motorcycleModel.manufacturerId))];

  const products: NewProduct[] = [];
  const variants: NewVariant[] = [];
  const productRows: Prisma.ProductCreateManyInput[] = [];
  const variantRows: Prisma.ProductVariantCreateManyInput[] = [];
  const imageRows: Prisma.ProductImageCreateManyInput[] = [];
  const compatibilityRows: Prisma.ProductCompatibilityCreateManyInput[] = [];
  const pendingImages: Array<() => Promise<boolean>> = [];
  const photoUsage = new Map<string, number>();
  let approvedIndex = -1;

  for (const [index, template] of productTemplates.entries()) {
    const slug = `review-${template.key}`;
    const name = `${template.name} (demonstração)`;
    if (!/^review-[a-z0-9-]+$/.test(slug) || !name.endsWith("(demonstração)"))
      throw new Error(`Unsafe product ${slug}`);
    const categoryId = categories.get(template.categorySlug);
    if (!categoryId) {
      console.warn(`Categoria ativa ${template.categorySlug} não encontrada; produto ${slug} ignorado.`);
      continue;
    }
    // Demo products must never sit under a real brand on a public storefront.
    const brandId = brandIds.get(template.brandSlug);
    if (!brandId || !/(^review-|-demo$)/.test(template.brandSlug)) {
      throw new Error(`Demo product ${slug} needs a demo brand (got ${template.brandSlug}).`);
    }
    const store = stores[template.store];
    const status = template.status ?? "APPROVED";
    const approved = status === "APPROVED";
    if (approved) approvedIndex += 1;
    const ai = approvedIndex;
    const id = reviewId("product", slug);

    const createdAt =
      status === "APPROVED" || status === "ARCHIVED"
        ? daysAgo(150 - (index % 20))
        : status === "REJECTED"
          ? daysAgo(20)
          : status === "SUBMITTED"
            ? daysAgo(3)
            : daysAgo(5 + (index % 5));
    const submittedAt =
      status === "DRAFT"
        ? null
        : status === "SUBMITTED"
          ? daysAgo(0.5 + (index % 3))
          : new Date(createdAt.getTime() + DAY);
    const reviewed = approved || status === "REJECTED" || status === "ARCHIVED";
    productRows.push({
      id,
      slug,
      name,
      description: `${template.description}${notice}`,
      isDemo: true,
      status,
      rejectionReason: template.rejectionReason ?? null,
      submittedAt,
      reviewedAt: reviewed ? new Date(createdAt.getTime() + 2 * DAY) : null,
      reviewedByUserId: reviewed ? adminUserId : null,
      weightInGrams: template.weightInGrams,
      heightInMillimeters: template.dimensions[0],
      widthInMillimeters: template.dimensions[1],
      lengthInMillimeters: template.dimensions[2],
      sellerId: store.sellerId,
      storeId: store.id,
      categoryId,
      brandId,
      createdAt,
    });
    products.push({ id, slug, name, template, store: template.store, approved, fitment: Boolean(template.fitment) });

    const soldOut = approved && ai % 17 === 5;
    for (const [optionIndex, option] of template.options.entries()) {
      const sku = `REVIEW-${SKU_PREFIX[template.store]}-${template.key.toUpperCase()}-${optionIndex + 1}`;
      const price = template.priceInCents + (template.priceSteps?.[optionIndex] ?? 0);
      const stock = soldOut ? 0 : cycle(STOCK_PATTERN, index * 3 + optionIndex);
      const attributes: Record<string, string> = template.color
        ? { cor: template.color, [template.axis]: option }
        : { [template.axis]: option };
      const title = template.color ? `${template.color} · ${option}` : option;
      const promotion = !approved
        ? null
        : ACTIVE_PROMOTIONS.has(ai)
          ? { startsAt: daysAgo(4), endsAt: daysAhead(10 + (ai % 10)) }
          : FUTURE_PROMOTIONS.has(ai)
            ? { startsAt: daysAhead(5), endsAt: daysAhead(20) }
            : EXPIRED_PROMOTIONS.has(ai)
              ? { startsAt: daysAgo(30), endsAt: daysAgo(3) }
              : null;
      const variantId = reviewId("variant", sku);
      variantRows.push({
        id: variantId,
        productId: id,
        sellerId: store.sellerId,
        sku,
        title,
        attributes,
        priceInCents: price,
        promotionalPriceInCents: promotion ? promoPrice(price) : null,
        promotionStartsAt: promotion?.startsAt ?? null,
        promotionEndsAt: promotion?.endsAt ?? null,
        createdAt,
      });
      variants.push({
        id: variantId,
        sku,
        productId: id,
        productName: name,
        sellerId: store.sellerId,
        store: template.store,
        title,
        attributes,
        priceInCents: price,
        stock,
        weightInGrams: template.weightInGrams,
        dimensions: template.dimensions,
        approved,
        createdAt,
      });
    }

    // Imagens: foto real reaproveitada para algumas categorias; demais geradas. Galeria em parte dos produtos.
    const imageCount =
      status === "DRAFT" ? (index % 2 === 0 ? 0 : 1) : !approved ? 1 : index % 6 === 0 ? 4 : index % 3 === 0 ? 3 : 1;
    const photo = categoryPhotos[template.categorySlug];
    const usage = photoUsage.get(template.categorySlug) ?? 0;
    photoUsage.set(template.categorySlug, usage + 1);
    for (let imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
      const storageKey = `demo/review-${template.key}-${imageIndex + 1}.webp`;
      imageRows.push({
        id: reviewId("image", storageKey),
        productId: id,
        storageKey,
        altText: imageIndex === 0 ? name : `${name} · ${GALLERY_CAPTIONS[imageIndex]}`,
        sortOrder: imageIndex,
        createdAt,
      });
      if (imageIndex === 0 && photo && usage < 2) {
        pendingImages.push(async () => {
          const target = imagePath(storageKey);
          if (existsSync(target)) return false;
          copyFileSync(join(process.cwd(), "public/images/demo", photo), target);
          return true;
        });
        continue;
      }
      pendingImages.push(() =>
        renderProductImage(storageKey, {
          label: categoryLabels[template.categorySlug] ?? "Produto",
          title: template.name,
          caption: GALLERY_CAPTIONS[imageIndex] ?? "Foto",
          variant: (index + imageIndex) % PRODUCT_BACKGROUNDS.length,
        }),
      );
    }

    if (template.fitment && fitments.length > 0) {
      const manufacturerId = manufacturers[index % Math.max(1, manufacturers.length)];
      const subset =
        index % 3 === 0
          ? fitments
          : fitments.filter((fitment) => fitment.motorcycleModel.manufacturerId === manufacturerId);
      for (const fitment of subset.length > 0 ? subset : fitments)
        compatibilityRows.push({
          id: reviewId("compatibility", `${slug}:${fitment.id}`),
          productId: id,
          motorcycleFitmentId: fitment.id,
          sellerId: store.sellerId,
        });
    }
  }

  // Segurança: nenhuma chave natural pode pertencer a linhas que não são deste seed.
  const conflictingProducts = await db.product.findMany({
    where: {
      slug: { in: productRows.map((row) => row.slug) },
      id: { notIn: productRows.map((row) => must(row.id, `product ${row.slug} id`)) },
    },
    select: { slug: true },
  });
  const [conflictingProduct] = conflictingProducts;
  if (conflictingProduct) throw new Error(`Refusing to touch unrelated product ${conflictingProduct.slug}`);
  const conflictingVariants = await db.productVariant.findMany({
    where: {
      sku: { in: variantRows.map((row) => row.sku) },
      id: { notIn: variantRows.map((row) => must(row.id, `variant ${row.sku} id`)) },
    },
    select: { sku: true, sellerId: true },
  });
  const unsafeVariant = conflictingVariants.find((variant) =>
    variantRows.some((row) => row.sku === variant.sku && row.sellerId === variant.sellerId),
  );
  if (unsafeVariant) throw new Error(`SKU ${unsafeVariant.sku} belongs to another product`);
  const conflictingImages = await db.productImage.findMany({
    where: {
      storageKey: { in: imageRows.map((row) => row.storageKey) },
      id: { notIn: imageRows.map((row) => must(row.id, `image ${row.storageKey} id`)) },
    },
    select: { storageKey: true },
  });
  const [conflictingImage] = conflictingImages;
  if (conflictingImage) throw new Error(`Image key ${conflictingImage.storageKey} belongs to another product`);

  let generatedFiles = 0;
  for (const render of pendingImages) if (await render()) generatedFiles += 1;
  trackMany("ImageFile", generatedFiles, pendingImages.length);

  await insertMany(trackMany, "Product", productRows, (chunk) =>
    db.product.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "ProductVariant", variantRows, (chunk) =>
    db.productVariant.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "ProductImage", imageRows, (chunk) =>
    db.productImage.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "ProductCompatibility", compatibilityRows, (chunk) =>
    db.productCompatibility.createMany({ data: chunk, skipDuplicates: true }),
  );
  return { products, variants, fitments };
}

// ---------------------------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------------------------

type Buyer = {
  kind: "customer" | "viewer" | "guest";
  userId: string | null;
  email: string;
  name: string;
  phone: string;
  address: {
    recipient: string;
    postalCode: string;
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
  };
};

type PartPlan = { store: ReviewStoreCode; status: SellerOrderStatus; items?: number };

type OrderPlan = {
  orderNumber: string;
  daysAgo: number;
  buyer: Buyer;
  parts: PartPlan[];
  cancelledBeforePayment?: boolean;
  coupon?: string;
  cancellation?: CancellationStatus;
  returnStatus?: ReturnStatus;
  dispute?: DisputeStatus;
  reviews: "all" | "most" | "none";
};

type InventoryEvent = {
  key: string;
  variantId: string;
  at: Date;
  type: MovementType;
  quantity: number;
  orderId: string;
  orderNumber: string;
};

type CouponInfo = {
  id: string;
  code: string;
  ownerType: string;
  discountType: string;
  percentageBps: number | null;
  fixedAmountInCents: number | null;
  minimumPurchaseInCents: number;
  fundedBy: string;
  sellerId: string | null;
};

function deriveOrderStatus(statuses: SellerOrderStatus[]): OrderStatus {
  if (statuses.every((status) => status === "CANCELLED")) return "CANCELLED";
  const live = statuses.filter((status) => status !== "CANCELLED");
  const someCancelled = live.length < statuses.length;
  if (live.every((status) => status === "PENDING_PAYMENT")) return "PENDING_PAYMENT";
  const shipped = live.filter((status) => status === "SHIPPED" || status === "DELIVERED").length;
  if (shipped === live.length) {
    if (someCancelled) return "PARTIALLY_CANCELLED";
    return live.every((status) => status === "DELIVERED") ? "DELIVERED" : "SHIPPED";
  }
  if (shipped > 0) return "PARTIALLY_SHIPPED";
  if (someCancelled) return "PARTIALLY_CANCELLED";
  return live.some((status) => status === "PROCESSING") ? "PROCESSING" : "PAID";
}

function shipmentStatusFor(status: SellerOrderStatus): ShipmentStatus {
  if (status === "PROCESSING") return "READY_TO_SHIP";
  if (status === "SHIPPED" || status === "DELIVERED" || status === "CANCELLED") return status;
  return "PENDING";
}

function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum === 0 || total === 0) return weights.map(() => 0);
  const result = weights.map((weight) => Math.floor((total * weight) / sum));
  const lastIndex = result.length - 1;
  result[lastIndex] =
    must(result[lastIndex], "last allocation") + (total - result.reduce((acc, value) => acc + value, 0));
  return result;
}

function buildPlans(
  input: ExpandedSeedInput,
  customerIds: Map<string, string>,
  viewers: Array<{ id: string; email: string; name: string }>,
) {
  const plans: OrderPlan[] = [];
  const other: Array<{
    parts: PartPlan[];
    daysAgo: number;
    cancelledBeforePayment?: boolean;
    cancellation?: CancellationStatus;
    dispute?: DisputeStatus;
  }> = [
    { parts: [{ store: "garagem", status: "PENDING_PAYMENT" }], daysAgo: 0.2 },
    { parts: [{ store: "trilha", status: "PAID" }], daysAgo: 1 },
    { parts: [{ store: "cross", status: "PROCESSING" }], daysAgo: 2 },
    { parts: [{ store: "racing", status: "SHIPPED" }], daysAgo: 4 },
    { parts: [{ store: "areia", status: "CANCELLED" }], daysAgo: 9, cancelledBeforePayment: true },
    {
      parts: [
        { store: "garagem", status: "SHIPPED" },
        { store: "cross", status: "PAID" },
      ],
      daysAgo: 3,
    },
    { parts: [{ store: "box77", status: "CANCELLATION_REQUESTED" }], daysAgo: 1.5, cancellation: "REQUESTED" },
    { parts: [{ store: "trilha", status: "SHIPPED" }], daysAgo: 8, dispute: "UNDER_REVIEW" },
    { parts: [{ store: "racing", status: "CANCELLED" }], daysAgo: 6, cancellation: "REFUNDED" },
    { parts: [{ store: "garagem", status: "PROCESSING" }], daysAgo: 5, cancellation: "REJECTED" },
    {
      parts: [
        { store: "cross", status: "CANCELLED" },
        { store: "areia", status: "PAID" },
      ],
      daysAgo: 3,
      cancellation: "APPROVED",
    },
    { parts: [{ store: "box77", status: "DELIVERED" }], daysAgo: 9 },
  ];
  const returns: ReturnStatus[] = [
    "UNDER_REVIEW",
    "APPROVED",
    "WAITING_RETURN",
    "RETURNED",
    "REFUNDED",
    "REJECTED",
    "REQUESTED",
  ];
  const deliveredDisputes: Partial<Record<number, DisputeStatus>> = { 8: "RESOLVED", 9: "REJECTED", 10: "OPEN" };

  for (const [c, customer] of extraCustomers.entries()) {
    const userId = customerIds.get(customer.email);
    if (!userId) continue;
    const n = c + 2;
    const buyer: Buyer = {
      kind: "customer",
      userId,
      email: customer.email,
      name: customer.name,
      phone: `119${String(70000000 + c * 1234567).slice(0, 8)}`,
      address: {
        recipient: customer.name,
        postalCode: customer.postalCode,
        street: customer.street,
        number: String(100 + c * 37),
        complement: c % 2 === 0 ? "Casa" : null,
        neighborhood: "Centro",
        city: customer.city,
        state: customer.state,
      },
    };
    const delivered = c < 6 ? 5 : 4;
    for (let k = 1; k <= delivered; k += 1) {
      const orderNumber = `MS-REVIEW-C${n}-${String(k).padStart(4, "0")}`;
      const rng = rngFor(orderNumber);
      const first = k === 2 && c % 4 === 1 ? "trilha" : pick(rng, STORE_CODES);
      const parts: PartPlan[] = [{ store: first, status: "DELIVERED", items: 1 + Math.floor(rng() * 3) }];
      if (rng() < 0.3) {
        const second = pick(
          rng,
          STORE_CODES.filter((code) => code !== first),
        );
        parts.push({ store: second, status: "DELIVERED", items: 1 + Math.floor(rng() * 2) });
      }
      const coupon = k === 2 && c % 4 === 1 ? "REVIEW-TRILHA10" : k === 3 && c % 3 === 0 ? "REVIEW-MX10" : undefined;
      const returnStatus = k === 1 ? returns[c] : undefined;
      const dispute = k === 2 ? deliveredDisputes[c] : undefined;
      plans.push({
        orderNumber,
        daysAgo: k === 1 ? 14 + c * 3 : Math.round((25 + rng() * 95) * 10) / 10,
        buyer,
        parts,
        ...(coupon ? { coupon } : {}),
        ...(returnStatus ? { returnStatus } : {}),
        ...(dispute ? { dispute } : {}),
        reviews: "most",
      });
    }
    const extra = cycle(other, c);
    plans.push({
      orderNumber: `MS-REVIEW-C${n}-${String(delivered + 1).padStart(4, "0")}`,
      daysAgo: extra.daysAgo,
      buyer,
      parts: extra.parts,
      ...(extra.cancelledBeforePayment ? { cancelledBeforePayment: true } : {}),
      ...(extra.cancellation ? { cancellation: extra.cancellation } : {}),
      ...(extra.dispute ? { dispute: extra.dispute } : {}),
      reviews: "most",
    });
  }

  const guestStatuses: Array<{
    status: SellerOrderStatus;
    store: ReviewStoreCode;
    daysAgo: number;
    cancelledBeforePayment?: boolean;
    cancellation?: CancellationStatus;
  }> = [
    { status: "PENDING_PAYMENT", store: "trilha", daysAgo: 0.05 },
    { status: "PENDING_PAYMENT", store: "cross", daysAgo: 0.3 },
    { status: "PAID", store: "racing", daysAgo: 0.6 },
    { status: "PAID", store: "areia", daysAgo: 1.2 },
    { status: "CANCELLED", store: "box77", daysAgo: 2, cancellation: "REFUNDED" },
    { status: "PROCESSING", store: "garagem", daysAgo: 2.5 },
    { status: "PROCESSING", store: "trilha", daysAgo: 3.5 },
    { status: "SHIPPED", store: "cross", daysAgo: 5 },
    { status: "SHIPPED", store: "areia", daysAgo: 6 },
    { status: "CANCELLED", store: "racing", daysAgo: 7, cancelledBeforePayment: true },
  ];
  for (const [index, entry] of guestStatuses.entries()) {
    const guest = cycle(guestCustomers, index);
    plans.push({
      orderNumber: `MS-REVIEW-G-${String(index + 1).padStart(4, "0")}`,
      daysAgo: entry.daysAgo,
      buyer: {
        kind: "guest",
        userId: null,
        email: guest.email,
        name: guest.name,
        phone: guest.phone,
        address: {
          recipient: guest.name,
          postalCode: "13015100",
          street: "Rua Barão de Jaguara",
          number: String(200 + index * 11),
          complement: null,
          neighborhood: "Centro",
          city: "Campinas",
          state: "SP",
        },
      },
      parts: [{ store: entry.store, status: entry.status }],
      ...(entry.cancelledBeforePayment ? { cancelledBeforePayment: true } : {}),
      ...(entry.cancellation ? { cancellation: entry.cancellation } : {}),
      reviews: "none",
    });
  }

  for (const [index, viewer] of viewers.entries()) {
    const n = index + 1;
    const buyer: Buyer = {
      kind: "viewer",
      userId: viewer.id,
      email: viewer.email,
      name: viewer.name,
      phone: "11900000000",
      address: {
        recipient: viewer.name,
        postalCode: "01310100",
        street: "Avenida Paulista",
        number: "1578",
        complement: "Endereço de demonstração",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
      },
    };
    const viewerPlans: Array<Omit<OrderPlan, "orderNumber" | "buyer">> = [
      { daysAgo: 0.1, parts: [{ store: "garagem", status: "PENDING_PAYMENT", items: 2 }], reviews: "none" },
      { daysAgo: 1, parts: [{ store: "trilha", status: "PAID" }], reviews: "none" },
      { daysAgo: 2, parts: [{ store: "box77", status: "PROCESSING", items: 2 }], reviews: "none" },
      { daysAgo: 4, parts: [{ store: "cross", status: "SHIPPED" }], reviews: "none" },
      { daysAgo: 20, parts: [{ store: "garagem", status: "DELIVERED", items: 2 }], reviews: "all" },
      { daysAgo: 45, parts: [{ store: "racing", status: "DELIVERED" }], reviews: "all" },
      { daysAgo: 12, parts: [{ store: "areia", status: "CANCELLED" }], cancelledBeforePayment: true, reviews: "none" },
      {
        daysAgo: 3,
        parts: [
          { store: "garagem", status: "SHIPPED" },
          { store: "box77", status: "PAID" },
        ],
        coupon: "REVIEW-MX10",
        reviews: "none",
      },
      {
        daysAgo: 16,
        parts: [{ store: "trilha", status: "DELIVERED", items: 2 }],
        returnStatus: "REQUESTED",
        reviews: "all",
      },
      {
        daysAgo: 1,
        parts: [{ store: "cross", status: "CANCELLATION_REQUESTED" }],
        cancellation: "REQUESTED",
        reviews: "none",
      },
      { daysAgo: 9, parts: [{ store: "garagem", status: "SHIPPED" }], dispute: "OPEN", reviews: "none" },
    ];
    for (const [k, plan] of viewerPlans.entries())
      plans.push({ ...plan, orderNumber: `MS-REVIEW-V${n}-${String(k + 1).padStart(4, "0")}`, buyer });
  }
  return plans;
}

async function seedOrders(
  input: ExpandedSeedInput,
  catalog: Awaited<ReturnType<typeof seedCatalog>>,
  customerIds: Map<string, string>,
  viewers: Array<{ id: string; email: string; name: string }>,
) {
  const { db, now, stores, storeOwnerIds, adminUserId, shippingByStore, trackMany } = input;
  const clamp = (date: Date) =>
    date.getTime() > now.getTime() - 20 * 60 * 1000 ? new Date(now.getTime() - 20 * 60 * 1000) : date;
  const plus = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

  const pools = new Map<ReviewStoreCode, NewVariant[]>();
  for (const variant of catalog.variants.filter((entry) => entry.approved))
    pools.set(variant.store, [...(pools.get(variant.store) ?? []), variant]);
  const productById = new Map(catalog.products.map((product) => [product.id, product]));

  const coupons = new Map<string, CouponInfo>(
    (
      await db.coupon.findMany({
        where: { code: { in: ["REVIEW-MX10", "REVIEW-TRILHA10"] } },
        select: {
          id: true,
          code: true,
          ownerType: true,
          discountType: true,
          percentageBps: true,
          fixedAmountInCents: true,
          minimumPurchaseInCents: true,
          fundedBy: true,
          sellerId: true,
        },
      })
    ).map((coupon) => [coupon.code, coupon]),
  );

  const plans = buildPlans(input, customerIds, viewers);

  const existingOrders = await db.order.findMany({
    where: { orderNumber: { in: plans.map((plan) => plan.orderNumber) } },
    select: { id: true, orderNumber: true, customerEmail: true },
  });
  const existingByNumber = new Map(existingOrders.map((order) => [order.orderNumber, order]));
  for (const plan of plans) {
    const existing = existingByNumber.get(plan.orderNumber);
    if (
      existing &&
      (existing.id !== reviewId("order", plan.orderNumber) || existing.customerEmail !== plan.buyer.email)
    )
      throw new Error(
        `Order ${plan.orderNumber} already exists for another customer. Keep REVIEW_VIEWER_CUSTOMER_EMAILS in the same order as the first run.`,
      );
  }

  const rows = {
    orders: [] as Prisma.OrderCreateManyInput[],
    addresses: [] as Prisma.OrderAddressCreateManyInput[],
    sellerOrders: [] as Prisma.SellerOrderCreateManyInput[],
    shipments: [] as Prisma.ShipmentCreateManyInput[],
    items: [] as Prisma.OrderItemCreateManyInput[],
    payments: [] as Prisma.PaymentCreateManyInput[],
    transactions: [] as Prisma.PaymentTransactionCreateManyInput[],
    redemptions: [] as Prisma.CouponRedemptionCreateManyInput[],
    returns: [] as Prisma.ReturnRequestCreateManyInput[],
    returnItems: [] as Prisma.ReturnItemCreateManyInput[],
    cancellations: [] as Prisma.CancellationRequestCreateManyInput[],
    disputes: [] as Prisma.DisputeCreateManyInput[],
    productReviews: [] as Prisma.ProductReviewCreateManyInput[],
    sellerReviews: [] as Prisma.SellerReviewCreateManyInput[],
  };
  const events: InventoryEvent[] = [];
  const refs = {
    cancellations: [] as Array<{ id: string; status: CancellationStatus; store: ReviewStoreCode; orderNumber: string }>,
    returns: [] as Array<{ id: string; status: ReturnStatus; store: ReviewStoreCode; orderNumber: string }>,
    disputes: [] as Array<{ id: string; status: DisputeStatus; store: ReviewStoreCode; orderNumber: string }>,
    shipped: [] as Array<{
      sellerOrderId: string;
      store: ReviewStoreCode;
      orderNumber: string;
      recipient: string;
      status: SellerOrderStatus;
      at: Date;
    }>,
    payments: [] as Array<{ orderNumber: string; externalId: string | null; status: string; at: Date; email: string }>,
  };

  // Estoque: reserva no pedido, baixa no pagamento, devolução ao estoque em cancelamento/devolução.
  const lineInventoryEvents = (input: {
    base: Pick<InventoryEvent, "variantId" | "quantity" | "orderId" | "orderNumber">;
    itemId: string;
    plan: OrderPlan;
    placedAt: Date;
    paidAt: Date;
    deliveredAt: Date | null;
    isPaid: boolean;
    isFirstPart: boolean;
    isReturnedLine: boolean;
  }): InventoryEvent[] => {
    const { base, itemId, plan, placedAt } = input;
    const lineEvents: InventoryEvent[] = [{ ...base, key: `${itemId}:RESERVATION`, at: placedAt, type: "RESERVATION" }];
    if (plan.cancelledBeforePayment) {
      lineEvents.push({
        ...base,
        key: `${itemId}:RESERVATION_RELEASE`,
        at: clamp(plus(placedAt, 1)),
        type: "RESERVATION_RELEASE",
      });
    }
    if (!plan.cancelledBeforePayment && input.isPaid) {
      lineEvents.push({ ...base, key: `${itemId}:SALE`, at: input.paidAt, type: "SALE" });
    }
    if (input.isFirstPart && (plan.cancellation === "REFUNDED" || plan.cancellation === "APPROVED")) {
      lineEvents.push({ ...base, key: `${itemId}:CANCELLATION`, at: clamp(plus(placedAt, 0.8)), type: "CANCELLATION" });
    }

    const returnedToStock = plan.returnStatus === "RETURNED" || plan.returnStatus === "REFUNDED";
    if (input.isReturnedLine && returnedToStock && input.deliveredAt) {
      lineEvents.push({ ...base, key: `${itemId}:RETURN`, at: clamp(plus(input.deliveredAt, 6)), type: "RETURN" });
    }

    return lineEvents;
  };

  // Avaliações de compra verificada (somente pedidos entregues com conta).
  const addPurchaseReviews = (input: {
    plan: OrderPlan;
    userId: string;
    orderId: string;
    sellerId: string;
    sellerOrderId: string;
    deliveredAt: Date;
    lines: ReadonlyArray<{ variant: { productId: string } }>;
    itemIds: readonly string[];
    returnedItemId: string | null;
  }) => {
    const { plan, deliveredAt } = input;
    const reviewRng = rngFor(`${input.sellerOrderId}:reviews`);
    let starSum = 0;
    let reviewed = 0;
    for (const [lineIndex, line] of input.lines.entries()) {
      const itemId = must(input.itemIds[lineIndex], "order item id");
      if (itemId === input.returnedItemId) continue;
      if (plan.reviews === "most" && reviewRng() > 0.93) continue;
      const roll = reviewRng();
      const star = (
        plan.reviews === "all"
          ? roll < 0.6
            ? 5
            : 4
          : roll < 0.45
            ? 5
            : roll < 0.75
              ? 4
              : roll < 0.87
                ? 3
                : roll < 0.94
                  ? 2
                  : 1
      ) as 1 | 2 | 3 | 4 | 5;
      const tenths = star * 10 - (star > 1 && star < 5 && reviewRng() < 0.3 ? 5 : 0);
      const text = pick(reviewRng, reviewTexts[star]);
      starSum += star;
      reviewed += 1;
      rows.productReviews.push({
        id: reviewId("product-review", itemId),
        ratingTenths: tenths,
        title: text.title,
        comment: text.comment,
        productId: line.variant.productId,
        sellerId: input.sellerId,
        orderId: input.orderId,
        orderItemId: itemId,
        userId: input.userId,
        createdAt: clamp(plus(deliveredAt, 1 + reviewRng() * 4)),
      });
    }

    if (plan.reviews !== "all" && reviewRng() >= 0.6) return;

    const star = (reviewed > 0 ? Math.max(1, Math.min(5, Math.round(starSum / reviewed))) : 5) as 1 | 2 | 3 | 4 | 5;
    rows.sellerReviews.push({
      id: reviewId("seller-review", input.sellerOrderId),
      rating: star,
      comment: pick(reviewRng, sellerReviewTexts[star]),
      sellerId: input.sellerId,
      orderId: input.orderId,
      userId: input.userId,
      createdAt: clamp(plus(deliveredAt, 2 + reviewRng() * 3)),
    });
  };

  for (const plan of plans) {
    const rng = rngFor(`${plan.orderNumber}:items`);
    const orderId = reviewId("order", plan.orderNumber);
    const placedAt = new Date(now.getTime() - plan.daysAgo * DAY);
    const paidAt = new Date(placedAt.getTime() + 4 * 60 * 1000);
    const pending = plan.parts.every((part) => part.status === "PENDING_PAYMENT");

    const parts = plan.parts.map((part, partIndex) => {
      const pool = pools.get(part.store) ?? [];
      if (pool.length === 0) throw new Error(`No approved demo products for store ${part.store}`);
      const chosen: NewVariant[] = [];
      const count = Math.min(part.items ?? 1, new Set(pool.map((variant) => variant.productId)).size);
      while (chosen.length < count) {
        const candidate = pick(rng, pool);
        if (!chosen.some((entry) => entry.productId === candidate.productId)) chosen.push(candidate);
      }
      let status = part.status;
      if (plan.cancelledBeforePayment) status = "CANCELLED";
      if (partIndex === 0 && plan.cancellation)
        status =
          plan.cancellation === "REQUESTED"
            ? "CANCELLATION_REQUESTED"
            : plan.cancellation === "REJECTED"
              ? part.status
              : "CANCELLED";
      const lines = chosen.map((variant) => ({
        variant,
        quantity: variant.priceInCents < 10000 && rng() < 0.35 ? 2 : 1,
      }));
      const subtotal = lines.reduce((sum, line) => sum + line.variant.priceInCents * line.quantity, 0);
      return {
        part,
        partIndex,
        status,
        lines,
        subtotal,
        store: stores[part.store],
        shipping: shippingByStore[part.store],
      };
    });

    // Cupom (mesma regra do checkout: marketplace rateado; seller só na própria loja).
    const coupon = plan.coupon ? coupons.get(plan.coupon) : undefined;
    let discounts = parts.map(() => 0);
    if (coupon) {
      const base =
        coupon.ownerType === "SELLER"
          ? (parts.find((p) => p.store.sellerId === coupon.sellerId)?.subtotal ?? 0)
          : parts.reduce((sum, p) => sum + p.subtotal, 0);
      const amount =
        base < coupon.minimumPurchaseInCents
          ? 0
          : coupon.discountType === "PERCENTAGE"
            ? input.commission(base, coupon.percentageBps ?? 0)
            : Math.min(base, coupon.fixedAmountInCents ?? 0);
      discounts =
        coupon.ownerType === "SELLER"
          ? parts.map((p) => (p.store.sellerId === coupon.sellerId ? amount : 0))
          : allocate(
              amount,
              parts.map((p) => p.subtotal),
            );
    }
    const couponApplied = Boolean(coupon) && discounts.some((value) => value > 0);

    const statuses = parts.map((p) => p.status);
    const partTotals = parts.map((p, index) => p.subtotal - must(discounts[index], "part discount") + p.shipping.price);
    const itemsSubtotal = parts.reduce((sum, p) => sum + p.subtotal, 0);
    const discountTotal = discounts.reduce((sum, value) => sum + value, 0);
    const shippingTotal = parts.reduce((sum, p) => sum + p.shipping.price, 0);
    const total = itemsSubtotal - discountTotal + shippingTotal;

    const paymentStatus = plan.cancelledBeforePayment
      ? "CANCELLED"
      : pending
        ? "PENDING"
        : plan.cancellation === "REFUNDED"
          ? parts.length === 1
            ? "REFUNDED"
            : "PARTIALLY_REFUNDED"
          : plan.returnStatus === "REFUNDED"
            ? "PARTIALLY_REFUNDED"
            : "APPROVED";
    const isPaid = !plan.cancelledBeforePayment && !pending;

    rows.orders.push({
      id: orderId,
      orderNumber: plan.orderNumber,
      status: deriveOrderStatus(statuses),
      customerName: plan.buyer.name,
      customerEmail: plan.buyer.email,
      customerPhone: plan.buyer.phone,
      guestAccessTokenHash: plan.buyer.kind === "guest" ? input.hashGuestToken(randomBytes(32).toString("hex")) : null,
      userId: plan.buyer.userId,
      itemsSubtotalInCents: itemsSubtotal,
      discountAmountInCents: discountTotal,
      shippingAmountInCents: shippingTotal,
      customerShippingAmountInCents: shippingTotal,
      totalAmountInCents: total,
      placedAt,
      createdAt: placedAt,
    });
    rows.addresses.push({
      id: reviewId("order-address", plan.orderNumber),
      orderId,
      ...plan.buyer.address,
      createdAt: placedAt,
    });

    let returnedItemId: string | null = null;
    for (const p of parts) {
      const sellerOrderId = reviewId("seller-order", `${plan.orderNumber}:${p.part.store}`);
      const discount = must(discounts[p.partIndex], "part discount");
      const commissionInCents = input.commission(p.subtotal, p.store.commissionBps);
      const sellerFunded = coupon?.fundedBy === "SELLER" ? discount : 0;
      rows.sellerOrders.push({
        id: sellerOrderId,
        orderId,
        sellerId: p.store.sellerId,
        storeId: p.store.id,
        storeNameSnapshot: p.store.name,
        status: p.status,
        itemsSubtotalInCents: p.subtotal,
        discountAmountInCents: discount,
        marketplaceDiscountInCents: coupon?.fundedBy === "MARKETPLACE" ? discount : 0,
        sellerDiscountInCents: sellerFunded,
        shippingAmountInCents: p.shipping.price,
        customerShippingAmountInCents: p.shipping.price,
        commissionBps: p.store.commissionBps,
        marketplaceCommissionInCents: commissionInCents,
        sellerNetAmountInCents: p.subtotal - sellerFunded - commissionInCents,
        createdAt: placedAt,
      });
      const shipmentStatus = shipmentStatusFor(p.status);
      const wasShipped = shipmentStatus === "SHIPPED" || shipmentStatus === "DELIVERED";
      const shippedAt = wasShipped ? clamp(plus(placedAt, 1.6)) : null;
      const deliveredAt = shipmentStatus === "DELIVERED" ? clamp(plus(placedAt, 4.5)) : null;
      rows.shipments.push({
        id: reviewId("shipment", sellerOrderId),
        sellerOrderId,
        provider: "OWN",
        serviceCode: `own:review-${p.part.store}`,
        carrier: p.store.name.replace(" · demonstração", ""),
        service: p.shipping.name,
        priceInCents: p.shipping.price,
        estimatedDeliveryDays: p.shipping.days,
        status: shipmentStatus,
        trackingCode: wasShipped ? `RV${digits(sellerOrderId, 9)}BR` : null,
        shippedAt,
        deliveredAt,
        createdAt: placedAt,
      });
      if (wasShipped && shippedAt)
        refs.shipped.push({
          sellerOrderId,
          store: p.part.store,
          orderNumber: plan.orderNumber,
          recipient: plan.buyer.email,
          status: p.status,
          at: deliveredAt ?? shippedAt,
        });

      const itemDiscounts = allocate(
        discount,
        p.lines.map((line) => line.variant.priceInCents * line.quantity),
      );
      const itemIds: string[] = [];
      for (const [lineIndex, line] of p.lines.entries()) {
        const itemId = reviewId("order-item", `${plan.orderNumber}:${line.variant.sku}`);
        itemIds.push(itemId);
        const gross = line.variant.priceInCents * line.quantity;
        const itemDiscount = must(itemDiscounts[lineIndex], "item discount");
        rows.items.push({
          id: itemId,
          sellerOrderId,
          sellerId: p.store.sellerId,
          productId: line.variant.productId,
          variantId: line.variant.id,
          productNameSnapshot: line.variant.productName,
          variantDescriptionSnapshot: line.variant.title,
          skuSnapshot: line.variant.sku,
          attributesSnapshot: line.variant.attributes,
          weightInGramsSnapshot: line.variant.weightInGrams,
          heightInMillimetersSnapshot: line.variant.dimensions[0],
          widthInMillimetersSnapshot: line.variant.dimensions[1],
          lengthInMillimetersSnapshot: line.variant.dimensions[2],
          unitPriceInCents: line.variant.priceInCents,
          quantity: line.quantity,
          discountAmountInCents: itemDiscount,
          totalAmountInCents: gross - itemDiscount,
          createdAt: placedAt,
        });

        const isReturnedLine = p.partIndex === 0 && lineIndex === 0 && Boolean(plan.returnStatus);
        returnedItemId = isReturnedLine ? itemId : returnedItemId;
        events.push(
          ...lineInventoryEvents({
            base: { variantId: line.variant.id, quantity: line.quantity, orderId, orderNumber: plan.orderNumber },
            itemId,
            plan,
            placedAt,
            paidAt,
            deliveredAt,
            isPaid,
            isFirstPart: p.partIndex === 0,
            isReturnedLine,
          }),
        );
      }

      // Pós-venda.
      const actorDate = clamp(plus(placedAt, 0.4));
      if (p.partIndex === 0 && plan.cancellation) {
        const id = reviewId("cancellation", plan.orderNumber);
        rows.cancellations.push({
          id,
          idempotencyKey: `review-cancel-${plan.orderNumber}`,
          status: plan.cancellation,
          reason: pick(rngFor(id), [
            "Comprei o tamanho errado",
            "Encontrei o item em outra loja",
            "Prazo de entrega muito longo",
            "Pedido duplicado",
          ]),
          customerMessage: "Gostaria de cancelar este pedido antes do envio, por favor.",
          adminNote:
            plan.cancellation === "REJECTED"
              ? "Pedido já separado e etiquetado pela loja; orientado a solicitar devolução após o recebimento."
              : plan.cancellation === "REQUESTED"
                ? null
                : "Cancelamento aprovado antes do envio.",
          amountInCents: must(partTotals[0], "first part total"),
          previousSellerOrderStatus: plan.cancellation === "REJECTED" ? "PROCESSING" : "PAID",
          orderId,
          sellerOrderId,
          sellerId: p.store.sellerId,
          requesterUserId: plan.buyer.userId,
          createdAt: actorDate,
        });
        refs.cancellations.push({ id, status: plan.cancellation, store: p.part.store, orderNumber: plan.orderNumber });
      }
      if (p.partIndex === 0 && plan.returnStatus && deliveredAt && returnedItemId) {
        const id = reviewId("return", plan.orderNumber);
        const line = must(p.lines[0], "first order line");
        rows.returns.push({
          id,
          idempotencyKey: `review-return-${plan.orderNumber}`,
          status: plan.returnStatus,
          reason: pick(rngFor(id), [
            "Produto diferente do anunciado",
            "Tamanho não serviu",
            "Produto com defeito",
            "Não é compatível com a minha moto",
          ]),
          amountInCents: line.variant.priceInCents * line.quantity - must(itemDiscounts[0], "first item discount"),
          customerMessage: "Recebi o produto, mas ele não atendeu ao que eu precisava. Envio fotos se necessário.",
          adminNote:
            plan.returnStatus === "REJECTED" ? "Produto com sinais de uso fora do prazo de arrependimento." : null,
          orderId,
          sellerOrderId,
          sellerId: p.store.sellerId,
          requesterUserId: plan.buyer.userId,
          createdAt: clamp(plus(deliveredAt, 2)),
        });
        rows.returnItems.push({
          id: reviewId("return-item", id),
          returnRequestId: id,
          orderItemId: returnedItemId,
          quantity: line.quantity,
          sellerOrderId,
          sellerId: p.store.sellerId,
          createdAt: clamp(plus(deliveredAt, 2)),
        });
        refs.returns.push({ id, status: plan.returnStatus, store: p.part.store, orderNumber: plan.orderNumber });
      }
      if (p.partIndex === 0 && plan.dispute && shippedAt) {
        const id = reviewId("dispute", plan.orderNumber);
        const resolved = plan.dispute === "RESOLVED" || plan.dispute === "REJECTED";
        rows.disputes.push({
          id,
          idempotencyKey: `review-dispute-${plan.orderNumber}`,
          status: plan.dispute,
          reason: pick(rngFor(id), [
            "Rastreamento sem atualização",
            "Produto chegou danificado",
            "Item faltando na embalagem",
            "Loja não responde",
          ]),
          description:
            "Abri a disputa porque não consegui resolver diretamente com a loja. Aguardo a mediação do Moto Shop.",
          resolutionNote:
            plan.dispute === "RESOLVED"
              ? "Loja enviou o item faltante com novo rastreio; cliente confirmou o recebimento."
              : plan.dispute === "REJECTED"
                ? "Entrega comprovada pelo rastreio e foto do recebimento."
                : null,
          resolvedByUserId: resolved ? adminUserId : null,
          orderId,
          sellerOrderId,
          sellerId: p.store.sellerId,
          requesterUserId: plan.buyer.userId,
          createdAt: clamp(plus(deliveredAt ?? shippedAt, 2)),
        });
        refs.disputes.push({ id, status: plan.dispute, store: p.part.store, orderNumber: plan.orderNumber });
      }

      if (p.status === "DELIVERED" && deliveredAt && plan.buyer.userId && plan.reviews !== "none") {
        addPurchaseReviews({
          plan,
          userId: plan.buyer.userId,
          orderId,
          sellerId: p.store.sellerId,
          sellerOrderId,
          deliveredAt,
          lines: p.lines,
          itemIds,
          returnedItemId,
        });
      }
    }

    // Pagamento e transações.
    const paymentId = reviewId("payment", plan.orderNumber);
    const externalId = pending ? null : `REVIEW-PAY-${plan.orderNumber}`;
    rows.payments.push({
      id: paymentId,
      orderId,
      provider: "MERCADO_PAGO",
      externalId,
      method: pick(rngFor(`${plan.orderNumber}:method`), ["pix", "pix", "visa", "master", "elo"]),
      status: paymentStatus,
      amountInCents: total,
      providerMetadata: { source: "review-seed", note: "Pagamento fictício para revisão visual" },
      authorizedAt: isPaid ? paidAt : null,
      paidAt: isPaid ? paidAt : null,
      failedAt: plan.cancelledBeforePayment ? clamp(plus(placedAt, 1)) : null,
      createdAt: placedAt,
    });
    rows.transactions.push({
      id: reviewId("payment-transaction", `${plan.orderNumber}:AUTHORIZATION`),
      paymentId,
      type: "AUTHORIZATION",
      status: pending ? "PENDING" : plan.cancelledBeforePayment ? "FAILED" : "SUCCEEDED",
      idempotencyKey: `review-tx-${plan.orderNumber}`,
      amountInCents: total,
      processedAt: pending ? null : plan.cancelledBeforePayment ? clamp(plus(placedAt, 1)) : paidAt,
      createdAt: placedAt,
    });
    const refundAmount =
      plan.cancellation === "REFUNDED" || plan.cancellation === "APPROVED"
        ? must(partTotals[0], "first part total")
        : plan.returnStatus === "REFUNDED"
          ? (rows.returns.at(-1)?.amountInCents ?? 0)
          : 0;
    if (refundAmount > 0)
      rows.transactions.push({
        id: reviewId("payment-transaction", `${plan.orderNumber}:REFUND`),
        paymentId,
        type: "REFUND",
        status: plan.cancellation === "APPROVED" ? "PENDING" : "SUCCEEDED",
        idempotencyKey: `review-refund-${plan.orderNumber}`,
        amountInCents: refundAmount,
        processedAt: plan.cancellation === "APPROVED" ? null : clamp(plus(placedAt, plan.returnStatus ? 14 : 1)),
        createdAt: clamp(plus(placedAt, plan.returnStatus ? 13 : 0.8)),
      });
    refs.payments.push({
      orderNumber: plan.orderNumber,
      externalId,
      status: paymentStatus,
      at: isPaid ? paidAt : placedAt,
      email: plan.buyer.email,
    });

    if (coupon && couponApplied)
      rows.redemptions.push({
        id: reviewId("coupon-redemption", plan.orderNumber),
        couponId: coupon.id,
        orderId,
        userId: plan.buyer.userId,
        customerEmailSnapshot: plan.buyer.email,
        discountAmountInCents: discountTotal,
        redeemedAt: placedAt,
      });
  }

  // Moderação: duas avaliações de 1 estrela ocultadas pelo Admin.
  for (const review of rows.productReviews.filter((entry) => entry.ratingTenths === 10).slice(0, 2))
    review.hiddenAt = clamp(plus(review.createdAt as Date, 1));

  // Estoque das variantes do conjunto ampliado (criado junto com o histórico rastreável).
  const existingInventories = new Set(
    (
      await db.inventory.findMany({
        where: { variantId: { in: catalog.variants.map((variant) => variant.id) } },
        select: { variantId: true },
      })
    ).map((inventory) => inventory.variantId),
  );
  const newOrderIds = new Set(
    rows.orders
      .filter((order) => !existingByNumber.has(order.orderNumber))
      .map((order) => must(order.id, `order ${order.orderNumber} id`)),
  );
  const inventoryRows: Prisma.InventoryCreateManyInput[] = [];
  const movementRows: Prisma.InventoryMovementCreateManyInput[] = [];
  const incremental: Array<{ variant: NewVariant; events: InventoryEvent[] }> = [];
  const eventsByVariant = new Map<string, InventoryEvent[]>();
  for (const event of events)
    eventsByVariant.set(event.variantId, [...(eventsByVariant.get(event.variantId) ?? []), event]);
  const effects = (type: MovementType, quantity: number) => ({
    available: type === "RESERVATION" ? -quantity : type === "SALE" ? 0 : quantity,
    reserved: type === "RESERVATION" ? quantity : type === "SALE" || type === "RESERVATION_RELEASE" ? -quantity : 0,
  });
  const reasons: Record<string, string> = {
    RESERVATION: "Reserva do pedido",
    SALE: "Payment approved",
    RESERVATION_RELEASE: "Pagamento cancelado",
    CANCELLATION: "Cancelamento aprovado",
    RETURN: "Devolução recebida",
  };

  for (const variant of catalog.variants) {
    const variantEvents = (eventsByVariant.get(variant.id) ?? []).sort(
      (a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key),
    );
    const owner = storeOwnerIds[variant.store];
    if (existingInventories.has(variant.id)) {
      const added = variantEvents.filter((event) => newOrderIds.has(event.orderId));
      if (added.length > 0) incremental.push({ variant, events: added });
      continue;
    }
    const totalAvailable = variantEvents.reduce((sum, event) => sum + effects(event.type, event.quantity).available, 0);
    const reserved = variantEvents.reduce((sum, event) => sum + effects(event.type, event.quantity).reserved, 0);
    const start = variant.stock - totalAvailable;
    let running = start;
    let minimum = start;
    for (const event of variantEvents) {
      running += effects(event.type, event.quantity).available;
      minimum = Math.min(minimum, running);
    }
    const buffer = Math.max(0, -minimum);
    const inventoryId = reviewId("inventory", variant.sku);
    const movement = (
      key: string,
      data: Omit<Prisma.InventoryMovementCreateManyInput, "id" | "inventoryId" | "variantId" | "sellerId">,
    ) =>
      movementRows.push({
        id: reviewId("movement", `${variant.sku}:${key}`),
        inventoryId,
        variantId: variant.id,
        sellerId: variant.sellerId,
        ...data,
      });
    let available = start + buffer;
    let reservedNow = 0;
    const recordInitialStock = (quantity: number) => {
      if (quantity > 0) {
        movement("initial", {
          type: "MANUAL_IN",
          quantityChange: quantity,
          availableQuantityAfter: quantity,
          reservedQuantityAfter: 0,
          referenceType: "REVIEW_SEED",
          referenceId: variant.productId,
          reason: "Estoque inicial (dados de revisão)",
          actorUserId: owner,
          createdAt: variant.createdAt,
        });
        return;
      }

      movement("initial", {
        type: "MANUAL_IN",
        quantityChange: 2,
        availableQuantityAfter: 2,
        reservedQuantityAfter: 0,
        referenceType: "REVIEW_SEED",
        referenceId: variant.productId,
        reason: "Estoque inicial (dados de revisão)",
        actorUserId: owner,
        createdAt: variant.createdAt,
      });
      movement("damage", {
        type: "MANUAL_OUT",
        quantityChange: -2,
        availableQuantityAfter: 0,
        reservedQuantityAfter: 0,
        referenceType: "REVIEW_SEED",
        referenceId: variant.productId,
        reason: "Avaria identificada na conferência",
        actorUserId: owner,
        createdAt: new Date(variant.createdAt.getTime() + 10 * DAY),
      });
    };
    recordInitialStock(available);
    let last = variant.createdAt;
    for (const event of variantEvents) {
      const effect = effects(event.type, event.quantity);
      available += effect.available;
      reservedNow += effect.reserved;
      last = event.at;
      movement(event.key, {
        type: event.type,
        quantityChange: event.type === "RESERVATION" || event.type === "SALE" ? -event.quantity : event.quantity,
        availableQuantityAfter: available,
        reservedQuantityAfter: reservedNow,
        referenceType: "ORDER",
        referenceId: event.orderId,
        reason: `${reasons[event.type] ?? event.type} ${event.orderNumber}`,
        createdAt: event.at,
      });
    }
    if (buffer > 0) {
      available -= buffer;
      movement("correction", {
        type: "CORRECTION",
        quantityChange: -buffer,
        availableQuantityAfter: available,
        reservedQuantityAfter: reservedNow,
        referenceType: "REVIEW_SEED",
        referenceId: variant.productId,
        reason: "Correção após inventário físico",
        actorUserId: owner,
        createdAt: new Date(last.getTime() + 60 * 1000),
      });
    }
    inventoryRows.push({
      id: inventoryId,
      variantId: variant.id,
      sellerId: variant.sellerId,
      availableQuantity: variant.stock,
      reservedQuantity: reserved,
      version: movementRows.filter((row) => row.inventoryId === inventoryId).length,
    });
  }

  await insertMany(trackMany, "Inventory", inventoryRows, (chunk) =>
    db.inventory.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "InventoryMovement", movementRows, (chunk) =>
    db.inventoryMovement.createMany({ data: chunk, skipDuplicates: true }),
  );

  await insertMany(trackMany, "Order", rows.orders, (chunk) =>
    db.order.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "OrderAddress", rows.addresses, (chunk) =>
    db.orderAddress.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "SellerOrder", rows.sellerOrders, (chunk) =>
    db.sellerOrder.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "Shipment", rows.shipments, (chunk) =>
    db.shipment.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "OrderItem", rows.items, (chunk) =>
    db.orderItem.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "Payment", rows.payments, (chunk) =>
    db.payment.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "PaymentTransaction", rows.transactions, (chunk) =>
    db.paymentTransaction.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "CouponRedemption", rows.redemptions, (chunk) =>
    db.couponRedemption.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "ReturnRequest", rows.returns, (chunk) =>
    db.returnRequest.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "ReturnItem", rows.returnItems, (chunk) =>
    db.returnItem.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "CancellationRequest", rows.cancellations, (chunk) =>
    db.cancellationRequest.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "Dispute", rows.disputes, (chunk) =>
    db.dispute.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "ProductReview", rows.productReviews, (chunk) =>
    db.productReview.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertMany(trackMany, "SellerReview", rows.sellerReviews, (chunk) =>
    db.sellerReview.createMany({ data: chunk, skipDuplicates: true }),
  );

  // Pedidos novos de variantes cujo estoque já existia (ex.: conta de visualização adicionada depois):
  // aplica o efeito no estoque atual e registra as movimentações correspondentes.
  for (const { variant, events: added } of incremental) {
    for (const event of added) {
      const effect = effects(event.type, event.quantity);
      const inventory = await db.inventory.update({
        where: { variantId: variant.id },
        data: {
          availableQuantity: { increment: effect.available },
          reservedQuantity: { increment: effect.reserved },
          version: { increment: 1 },
        },
      });
      await db.inventoryMovement.createMany({
        data: [
          {
            id: reviewId("movement", `${variant.sku}:${event.key}`),
            type: event.type,
            quantityChange: event.type === "RESERVATION" || event.type === "SALE" ? -event.quantity : event.quantity,
            availableQuantityAfter: inventory.availableQuantity,
            reservedQuantityAfter: inventory.reservedQuantity,
            referenceType: "ORDER",
            referenceId: event.orderId,
            reason: `${reasons[event.type] ?? event.type} ${event.orderNumber}`,
            inventoryId: inventory.id,
            variantId: variant.id,
            sellerId: variant.sellerId,
            createdAt: event.at,
          },
        ],
        skipDuplicates: true,
      });
      trackMany("InventoryMovement", 1, 1);
    }
  }

  return { plans, rows, refs, productById };
}

// ---------------------------------------------------------------------------------------------
// Perguntas, operação e contas de visualização
// ---------------------------------------------------------------------------------------------

async function seedQuestions(
  input: ExpandedSeedInput,
  catalog: Awaited<ReturnType<typeof seedCatalog>>,
  customerIds: Map<string, string>,
) {
  const { db, now, stores, storeOwnerIds, trackMany } = input;
  const approved = catalog.products.filter((product) => product.approved);
  const rows: Prisma.ProductQuestionCreateManyInput[] = [];
  for (let q = 0; q < 60; q += 1) {
    const product = cycle(approved, q * 7);
    const customer = cycle(extraCustomers, q);
    const askedByUserId = customerIds.get(customer.email);
    if (!askedByUserId) continue;
    const sizeCategory = ["equipment-helmets", "equipment-boots", "apparel", "equipment"].includes(
      product.template.categorySlug,
    );
    const kind = q % 2 === 1 ? "general" : product.fitment ? "fitment" : sizeCategory ? "size" : "general";
    const answered = q % 3 !== 2;
    const createdAt = new Date(now.getTime() - (2 + ((q * 37) % 110)) * DAY);
    rows.push({
      id: reviewId("question", `${product.slug}:${q}`),
      question: cycle(questionPool[kind], q),
      answer: answered ? cycle(answerPool[kind], q) : null,
      answeredAt: answered ? new Date(createdAt.getTime() + 0.6 * DAY) : null,
      productId: product.id,
      sellerId: stores[product.store].sellerId,
      askedByUserId,
      answeredByUserId: answered ? storeOwnerIds[product.store] : null,
      createdAt,
      hiddenAt: q === 59 ? new Date(createdAt.getTime() + DAY) : null,
    });
  }
  await insertMany(trackMany, "ProductQuestion", rows, (chunk) =>
    db.productQuestion.createMany({ data: chunk, skipDuplicates: true }),
  );
}

async function seedOperations(
  input: ExpandedSeedInput,
  catalog: Awaited<ReturnType<typeof seedCatalog>>,
  orders: Awaited<ReturnType<typeof seedOrders>>,
) {
  const { db, now, stores, storeOwnerIds, adminUserId, trackMany } = input;
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);
  const daysAhead = (days: number) => new Date(now.getTime() + days * DAY);

  const subscriptions: Prisma.SellerSubscriptionCreateManyInput[] = [
    {
      id: reviewId("subscription", "trilha:active"),
      sellerId: stores.trilha.sellerId,
      plan: "VIP",
      status: "ACTIVE",
      startsAt: daysAgo(20),
      endsAt: daysAhead(10),
    },
    {
      id: reviewId("subscription", "cross:active"),
      sellerId: stores.cross.sellerId,
      plan: "VIP",
      status: "ACTIVE",
      startsAt: daysAgo(5),
      endsAt: daysAhead(25),
    },
    {
      id: reviewId("subscription", "racing:expired"),
      sellerId: stores.racing.sellerId,
      plan: "VIP",
      status: "EXPIRED",
      startsAt: daysAgo(70),
      endsAt: daysAgo(40),
    },
    {
      id: reviewId("subscription", "garagem:expired"),
      sellerId: stores.garagem.sellerId,
      plan: "VIP",
      status: "EXPIRED",
      startsAt: daysAgo(45),
      endsAt: daysAgo(15),
    },
    {
      id: reviewId("subscription", "box77:cancelled"),
      sellerId: stores.box77.sellerId,
      plan: "VIP",
      status: "CANCELLED",
      startsAt: daysAgo(50),
      endsAt: daysAgo(20),
      cancelledAt: daysAgo(35),
    },
  ];
  await insertMany(trackMany, "SellerSubscription", subscriptions, (chunk) =>
    db.sellerSubscription.createMany({ data: chunk, skipDuplicates: true }),
  );

  const otherSellers = await db.store.findMany({
    where: { slug: { in: ["review-loja-suspensa", "review-loja-recusada"] } },
    select: { slug: true, sellerId: true },
  });
  const suspended = otherSellers.find((store) => store.slug === "review-loja-suspensa")?.sellerId;
  const rejected = otherSellers.find((store) => store.slug === "review-loja-recusada")?.sellerId;

  type AuditInput = {
    key: string;
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Prisma.InputJsonValue;
    at: Date;
  };
  const audits: AuditInput[] = [];
  const meta = (extra: Record<string, Prisma.InputJsonValue | null> = {}) => ({ source: "review-seed", ...extra });
  for (const code of ["trilha", "racing", "areia", "cross"] as const)
    audits.push({
      key: `approve:${code}`,
      actor: adminUserId,
      action: "SELLER_APPROVED",
      entityType: "Seller",
      entityId: stores[code].sellerId,
      metadata: meta({ previousStatus: "PENDING" }),
      at: daysAgo(148),
    });
  if (suspended)
    audits.push({
      key: "suspend",
      actor: adminUserId,
      action: "SELLER_SUSPENDED",
      entityType: "Seller",
      entityId: suspended,
      metadata: meta({ reason: "Reclamações recorrentes de atraso" }),
      at: daysAgo(12),
    });
  if (rejected)
    audits.push({
      key: "reject",
      actor: adminUserId,
      action: "SELLER_REJECTED",
      entityType: "Seller",
      entityId: rejected,
      metadata: meta({ reason: "Documentação incompleta" }),
      at: daysAgo(30),
    });
  audits.push({
    key: "commission:racing",
    actor: adminUserId,
    action: "SELLER_COMMISSION_UPDATED",
    entityType: "Seller",
    entityId: stores.racing.sellerId,
    metadata: meta({ previousCommissionBps: null, commissionBps: 800 }),
    at: daysAgo(140),
  });
  audits.push({
    key: "vip:trilha",
    actor: adminUserId,
    action: "SELLER_VIP_ACTIVATED",
    entityType: "Seller",
    entityId: stores.trilha.sellerId,
    metadata: meta({ plan: "VIP" }),
    at: daysAgo(20),
  });
  audits.push({
    key: "vip:cross",
    actor: adminUserId,
    action: "SELLER_VIP_ACTIVATED",
    entityType: "Seller",
    entityId: stores.cross.sellerId,
    metadata: meta({ plan: "VIP" }),
    at: daysAgo(5),
  });
  audits.push({
    key: "vip:garagem",
    actor: adminUserId,
    action: "SELLER_VIP_RENEWED",
    entityType: "Seller",
    entityId: stores.garagem.sellerId,
    metadata: meta({ plan: "VIP" }),
    at: daysAgo(10),
  });
  for (const product of catalog.products.filter((entry) => entry.approved).slice(0, 10))
    audits.push({
      key: `product-approved:${product.slug}`,
      actor: adminUserId,
      action: "PRODUCT_APPROVED",
      entityType: "Product",
      entityId: product.id,
      metadata: meta(),
      at: daysAgo(128),
    });
  for (const product of catalog.products.filter((entry) => entry.template.status === "REJECTED"))
    audits.push({
      key: `product-rejected:${product.slug}`,
      actor: adminUserId,
      action: "PRODUCT_REJECTED",
      entityType: "Product",
      entityId: product.id,
      metadata: meta({ reason: product.template.rejectionReason ?? null }),
      at: daysAgo(17),
    });
  for (const product of catalog.products.filter((entry) => entry.template.status === "ARCHIVED"))
    audits.push({
      key: `product-archived:${product.slug}`,
      actor: storeOwnerIds[product.store],
      action: "PRODUCT_ARCHIVED",
      entityType: "Product",
      entityId: product.id,
      metadata: meta(),
      at: daysAgo(25),
    });
  for (const entry of orders.refs.cancellations.filter((item) => item.status !== "REQUESTED"))
    audits.push({
      key: `cancel:${entry.id}`,
      actor: adminUserId,
      action:
        entry.status === "REJECTED"
          ? "CANCELLATION_REJECTED"
          : entry.status === "APPROVED"
            ? "CANCELLATION_APPROVED"
            : "CANCELLATION_REFUNDED",
      entityType: "CancellationRequest",
      entityId: entry.id,
      metadata: meta({ orderNumber: entry.orderNumber }),
      at: daysAgo(1),
    });
  for (const entry of orders.refs.returns.filter((item) => item.status === "RETURNED" || item.status === "REFUNDED"))
    audits.push({
      key: `return:${entry.id}`,
      actor: adminUserId,
      action: entry.status === "REFUNDED" ? "RETURN_REFUNDED" : "RETURN_RETURNED",
      entityType: "ReturnRequest",
      entityId: entry.id,
      metadata: meta({ orderNumber: entry.orderNumber }),
      at: daysAgo(2),
    });
  for (const entry of orders.refs.disputes.filter((item) => item.status === "RESOLVED"))
    audits.push({
      key: `dispute:${entry.id}`,
      actor: adminUserId,
      action: "DISPUTE_RESOLVED",
      entityType: "Dispute",
      entityId: entry.id,
      metadata: meta({ orderNumber: entry.orderNumber }),
      at: daysAgo(3),
    });
  for (const entry of orders.refs.shipped.slice(0, 6))
    audits.push({
      key: `ship:${entry.sellerOrderId}`,
      actor: storeOwnerIds[entry.store],
      action: "OWN_SHIPPING_STATUS_CHANGED",
      entityType: "SellerOrder",
      entityId: entry.sellerOrderId,
      metadata: meta({ from: "PAID", to: entry.status }),
      at: entry.at,
    });
  for (const review of orders.rows.productReviews.filter((entry) => entry.hiddenAt))
    audits.push({
      key: `hidden:${review.id}`,
      actor: adminUserId,
      action: "PUBLIC_CONTENT_HIDDEN",
      entityType: "ProductReview",
      entityId: must(review.id, "hidden review id"),
      metadata: meta({ reason: "Linguagem inadequada" }),
      at: review.hiddenAt as Date,
    });
  const couponRows = await db.coupon.findMany({
    where: { code: { in: ["REVIEW-MX10", "REVIEW-CROSS5-INATIVO"] } },
    select: { id: true, code: true },
  });
  for (const coupon of couponRows)
    audits.push(
      coupon.code === "REVIEW-MX10"
        ? {
            key: `coupon:${coupon.code}`,
            actor: adminUserId,
            action: "COUPON_CREATED",
            entityType: "Coupon",
            entityId: coupon.id,
            metadata: meta({ code: coupon.code }),
            at: daysAgo(130),
          }
        : {
            key: `coupon:${coupon.code}`,
            actor: storeOwnerIds.cross,
            action: "SELLER_COUPON_DEACTIVATED",
            entityType: "Coupon",
            entityId: coupon.id,
            metadata: meta({ code: coupon.code }),
            at: daysAgo(15),
          },
    );
  await insertMany(
    trackMany,
    "AuditLog",
    audits.map((audit) => ({
      id: reviewId("audit", audit.key),
      actorUserId: audit.actor,
      action: audit.action,
      entityType: audit.entityType,
      entityId: audit.entityId,
      metadata: audit.metadata,
      createdAt: audit.at,
    })),
    (chunk) => db.auditLog.createMany({ data: chunk, skipDuplicates: true }),
  );

  // Notificações: somente destinatários fictícios (@example.test), nunca as contas reais de visualização.
  const fictitious = orders.refs.payments.filter((payment) => payment.email.endsWith("@example.test"));
  const notifications: Prisma.NotificationDeliveryCreateManyInput[] = [];
  for (const [index, payment] of fictitious
    .filter((entry) => entry.status === "APPROVED")
    .slice(0, 7)
    .entries())
    notifications.push({
      id: reviewId("notification", `payment:${payment.orderNumber}`),
      eventKey: `review-notification:payment:${payment.orderNumber}`,
      kind: "ORDER_PAYMENT_APPROVED",
      recipientEmail: payment.email,
      subject: `Pagamento aprovado · ${payment.orderNumber}`,
      status: index === 3 ? "FAILED" : "SENT",
      providerId: index === 3 ? null : `review-email-${index}`,
      error: index === 3 ? "Provider de e-mail recusou o envio (dados de revisão)." : null,
      sentAt: index === 3 ? null : payment.at,
      createdAt: payment.at,
    });
  for (const [index, shipped] of orders.refs.shipped
    .filter((entry) => entry.recipient.endsWith("@example.test"))
    .slice(0, 6)
    .entries())
    notifications.push({
      id: reviewId("notification", `shipped:${shipped.sellerOrderId}`),
      eventKey: `review-notification:${shipped.sellerOrderId}:${shipped.status}`,
      kind: "SELLER_ORDER_SHIPPED",
      recipientEmail: shipped.recipient,
      subject: `Atualização do pedido ${shipped.orderNumber}`,
      status: index % 3 === 2 ? "FAILED" : "SENT",
      providerId: index % 3 === 2 ? null : `review-email-ship-${index}`,
      error: index % 3 === 2 ? "Tempo limite ao contatar o provider (dados de revisão)." : null,
      sentAt: index % 3 === 2 ? null : shipped.at,
      createdAt: shipped.at,
    });
  notifications.push({
    id: reviewId("notification", "processing"),
    eventKey: "review-notification:processing:1",
    kind: "REFUNDED",
    recipientEmail: "review.cliente10@example.test",
    subject: "Reembolso em processamento",
    status: "PROCESSING",
    createdAt: daysAgo(0.1),
  });
  notifications.push({
    id: reviewId("notification", "password"),
    eventKey: "review-notification:password:1",
    kind: "AUTH_PASSWORD_RESET",
    recipientEmail: "review.cliente3@example.test",
    subject: "Redefinição de senha",
    status: "SENT",
    providerId: "review-email-auth",
    sentAt: daysAgo(6),
    createdAt: daysAgo(6),
  });
  await insertMany(trackMany, "NotificationDelivery", notifications, (chunk) =>
    db.notificationDelivery.createMany({ data: chunk, skipDuplicates: true }),
  );

  // Webhooks: apenas metadados (sem payload real do provider).
  const webhooks: Prisma.WebhookEventCreateManyInput[] = orders.refs.payments
    .filter((payment) => payment.externalId)
    .slice(0, 10)
    .map((payment, index) => ({
      id: reviewId("webhook", payment.orderNumber),
      provider: "MERCADO_PAGO",
      externalId: `review-webhook-${payment.orderNumber}`,
      type: "payment",
      payload: { source: "review-seed", action: "payment.updated", data: { id: payment.externalId } },
      status: index === 4 || index === 8 ? "FAILED" : index === 9 ? "RECEIVED" : "PROCESSED",
      receivedAt: payment.at,
      processedAt: index === 4 || index === 8 || index === 9 ? null : new Date(payment.at.getTime() + 2000),
      error:
        index === 4
          ? "Assinatura inválida (evento fictício de revisão)."
          : index === 8
            ? "Pagamento não encontrado no provider (evento fictício de revisão)."
            : null,
    }));
  await insertMany(trackMany, "WebhookEvent", webhooks, (chunk) =>
    db.webhookEvent.createMany({ data: chunk, skipDuplicates: true }),
  );

  // Outbox: eventos com falha terminal (nome não suportado: um reenvio manual falha sem efeitos externos).
  const outbox: Prisma.OutboxEventCreateManyInput[] = orders.refs.payments.slice(0, 3).map((payment, index) => ({
    id: reviewId("outbox", payment.orderNumber),
    eventKey: `review-outbox:${payment.orderNumber}`,
    eventName: "review.demo.order-notification",
    aggregateType: "Order",
    aggregateId: reviewId("order", payment.orderNumber),
    payload: { source: "review-seed", orderNumber: payment.orderNumber },
    status: "FAILED",
    attempts: 8,
    availableAt: daysAgo(1 + index),
    lastError:
      index === 0
        ? "Inngest indisponível (falha simulada de revisão)"
        : "Persisted outbox event has an unsupported name or invalid payload.",
    createdAt: daysAgo(1 + index),
  }));
  await insertMany(trackMany, "OutboxEvent", outbox, (chunk) =>
    db.outboxEvent.createMany({ data: chunk, skipDuplicates: true }),
  );
}

async function seedViewers(
  input: ExpandedSeedInput,
  catalog: Awaited<ReturnType<typeof seedCatalog>>,
  viewers: Array<{ id: string; email: string; name: string }>,
) {
  const { db, trackMany } = input;
  const approvedProducts = catalog.products.filter((product) => product.approved);
  const inStock = catalog.variants.filter((variant) => variant.approved && variant.stock > 0);

  for (const viewer of viewers) {
    const existingAddresses = await db.customerAddress.findMany({
      where: { userId: viewer.id },
      select: { id: true, isDefault: true },
    });
    const hasDefault = existingAddresses.some(
      (address) => address.isDefault && address.id !== viewerAddressId(viewer.id, 1),
    );
    await insertMany(
      trackMany,
      "CustomerAddress",
      [
        {
          id: viewerAddressId(viewer.id, 1),
          userId: viewer.id,
          label: `Casa${REVIEW_ADDRESS_LABEL_SUFFIX}`,
          recipient: viewer.name,
          postalCode: "01310100",
          street: "Avenida Paulista",
          number: "1578",
          complement: "Endereço fictício",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          isDefault: !hasDefault,
        },
        {
          id: viewerAddressId(viewer.id, 2),
          userId: viewer.id,
          label: `Trabalho${REVIEW_ADDRESS_LABEL_SUFFIX}`,
          recipient: viewer.name,
          postalCode: "04538133",
          street: "Avenida Brigadeiro Faria Lima",
          number: "3477",
          complement: "Endereço fictício",
          neighborhood: "Itaim Bibi",
          city: "São Paulo",
          state: "SP",
          isDefault: false,
        },
      ],
      (chunk) => db.customerAddress.createMany({ data: chunk, skipDuplicates: true }),
    );

    // Motos salvas: nunca duplica uma configuração que o usuário já salvou e só define a principal se não houver.
    const saved = await db.savedMotorcycle.findMany({
      where: { userId: viewer.id },
      select: { id: true, motorcycleFitmentId: true, isPrimary: true },
    });
    let hasPrimary = saved.some((entry) => entry.isPrimary);
    const motorcycleRows: Prisma.SavedMotorcycleCreateManyInput[] = [];
    for (const fitment of catalog.fitments.slice(-2).reverse()) {
      const ownRow = saved.find((entry) => entry.motorcycleFitmentId === fitment.id);
      if (ownRow) continue;
      motorcycleRows.push({
        id: viewerSavedMotorcycleId(viewer.id, fitment.id),
        userId: viewer.id,
        motorcycleFitmentId: fitment.id,
        isPrimary: !hasPrimary,
      });
      hasPrimary = true;
    }
    await insertMany(trackMany, "SavedMotorcycle", motorcycleRows, (chunk) =>
      db.savedMotorcycle.createMany({ data: chunk, skipDuplicates: true }),
    );

    await insertMany(
      trackMany,
      "Favorite",
      [0, 6, 13, 21, 30]
        .map((index) => cycle(approvedProducts, index))
        .map((product) => ({
          id: reviewId("viewer-favorite", `${viewer.id}:${product.id}`),
          userId: viewer.id,
          productId: product.id,
        })),
      (chunk) => db.favorite.createMany({ data: chunk, skipDuplicates: true }),
    );

    // Carrinho: só cria se não houver carrinho ativo do próprio usuário (nunca mistura com itens reais).
    const activeCart = await db.cart.findFirst({
      where: { userId: viewer.id, status: "ACTIVE" },
      select: { id: true },
    });
    if (activeCart && activeCart.id !== viewerCartId(viewer.id)) {
      console.log(`Carrinho ativo existente para uma conta de visualização; itens de demonstração não adicionados.`);
      trackMany("Cart (skipped)", 0, 1);
      continue;
    }

    if (!activeCart)
      await db.cart.create({ data: { id: viewerCartId(viewer.id), userId: viewer.id, status: "ACTIVE" } });
    trackMany("Cart", activeCart ? 0 : 1, 1);
    const picks = [
      inStock.find((variant) => variant.store === "garagem"),
      inStock.find((variant) => variant.store === "trilha"),
      inStock.find((variant) => variant.store === "cross" && variant.priceInCents < 50000),
    ].filter((variant): variant is NewVariant => Boolean(variant));
    await insertMany(
      trackMany,
      "CartItem",
      picks.map((variant, index) => ({
        id: reviewId("viewer-cart-item", `${viewer.id}:${variant.id}`),
        cartId: viewerCartId(viewer.id),
        variantId: variant.id,
        quantity: index === 1 ? 2 : 1,
      })),
      (chunk) => db.cartItem.createMany({ data: chunk, skipDuplicates: true }),
    );
  }
}

async function seedSellerViewers(input: ExpandedSeedInput) {
  const { db, stores, trackMany } = input;
  for (const email of input.viewerSellerEmails) {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, memberships: { select: { sellerId: true } } },
    });
    if (!user) {
      console.warn(`Conta de visualização (lojista) não encontrada; nada foi criado para ela.`);
      continue;
    }
    if (user.memberships.some((membership) => membership.sellerId === stores.garagem.sellerId)) {
      trackMany("SellerMember (viewer)", 0, 1);
      continue;
    }
    if (user.memberships.length > 0) {
      console.log(
        "Conta de visualização (lojista) já pertence a outra loja; vínculo com a Garagem MX ignorado (um seller por usuário).",
      );
      trackMany("SellerMember (viewer skipped)", 0, 1);
      continue;
    }
    await db.sellerMember.create({
      data: {
        id: reviewId("viewer-seller-member", user.id),
        sellerId: stores.garagem.sellerId,
        userId: user.id,
        role: "ADMIN",
      },
    });
    trackMany("SellerMember (viewer)", 1, 1);
  }
}

async function ensureExtraCustomers(input: ExpandedSeedInput) {
  const { db, trackMany, passwordHash } = input;
  for (const customer of extraCustomers)
    if (!customer.email.startsWith("review.") || !customer.email.endsWith("@example.test"))
      throw new Error(`Unsafe e-mail ${customer.email}`);
  const emails = extraCustomers.map((customer) => customer.email);
  const existing = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
  const existingEmails = new Set(existing.map((user) => user.email));
  await insertMany(
    trackMany,
    "User",
    extraCustomers
      .filter((customer) => !existingEmails.has(customer.email))
      .map((customer) => ({
        id: reviewId("user", customer.email),
        email: customer.email,
        name: customer.name,
        emailVerified: true,
        createdAt: new Date(input.now.getTime() - 140 * DAY),
      })),
    (chunk) => db.user.createMany({ data: chunk, skipDuplicates: true }),
  );
  trackMany("User", 0, existing.length);
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
  const accounts = await db.account.findMany({
    where: { userId: { in: users.map((user) => user.id) }, providerId: "credential" },
    select: { userId: true },
  });
  const withAccount = new Set(accounts.map((account) => account.userId));
  await insertMany(
    trackMany,
    "Account",
    users
      .filter((user) => !withAccount.has(user.id))
      .map((user) => ({
        id: reviewId("account", user.email),
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      })),
    (chunk) => db.account.createMany({ data: chunk, skipDuplicates: true }),
  );
  trackMany("Account", 0, withAccount.size);
  return new Map(users.map((user) => [user.email, user.id]));
}

/** Produtos aprovados do seed original sem foto recebem uma imagem gerada (todo card aprovado tem imagem). */
async function ensureLegacyProductImages(input: ExpandedSeedInput) {
  const { db, trackMany } = input;
  const products = await db.product.findMany({
    where: { slug: { startsWith: "review-" }, isDemo: true, status: "APPROVED", images: { none: {} } },
    select: { id: true, slug: true, name: true, category: { select: { slug: true } } },
  });
  const rows: Prisma.ProductImageCreateManyInput[] = [];
  for (const [index, product] of products.entries()) {
    const storageKey = `demo/${product.slug}-1.webp`;
    await renderProductImage(storageKey, {
      label: categoryLabels[product.category.slug] ?? "Produto",
      title: product.name.replace(/ \(demonstração\)$/, ""),
      caption: "Foto principal",
      variant: index % PRODUCT_BACKGROUNDS.length,
    });
    rows.push({
      id: reviewId("image", storageKey),
      productId: product.id,
      storageKey,
      altText: product.name,
      sortOrder: 0,
    });
  }
  await insertMany(trackMany, "ProductImage (legacy)", rows, (chunk) =>
    db.productImage.createMany({ data: chunk, skipDuplicates: true }),
  );
}

export async function seedExpandedData(input: ExpandedSeedInput) {
  await ensureLegacyProductImages(input);
  const customerIds = await ensureExtraCustomers(input);

  const viewers: Array<{ id: string; email: string; name: string }> = [];
  for (const email of input.viewerCustomerEmails) {
    const user = await input.db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
    if (!user) {
      console.warn("Conta de visualização (cliente) não encontrada; nada foi criado para ela.");
      continue;
    }
    viewers.push({ id: user.id, email: user.email, name: user.name || "Cliente" });
  }

  const catalog = await seedCatalog(input);
  const orders = await seedOrders(input, catalog, customerIds, viewers);
  await seedQuestions(input, catalog, customerIds);
  await seedOperations(input, catalog, orders);
  await seedViewers(input, catalog, viewers);
  await seedSellerViewers(input);
  return {
    viewerCustomers: viewers.length,
    approvedProducts: catalog.products.filter((product) => product.approved).length,
    orders: orders.plans.length,
  };
}
