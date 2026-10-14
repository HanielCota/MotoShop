/**
 * Dados de REVISÃO VISUAL do Moto Shop.
 *
 * Cria contas, lojas, produtos, pedidos e pós-venda fictícios para revisar todas as telas
 * (storefront, conta do cliente, Central do Lojista e Admin). Tudo é isolado por:
 * - e-mails `review.*@example.test`;
 * - slugs `review-*`, SKUs/códigos `REVIEW-*` e pedidos `MS-REVIEW-*`;
 * - lojas com nome terminado em " · demonstração" e produtos `isDemo: true`;
 * - IDs determinísticos `czrvw…` (scripts/review-seed-ids.ts) no conjunto ampliado.
 *
 * Idempotente: pode ser executado várias vezes. Nunca apaga nem altera dados que não
 * foram criados por este script. Para remover: `scripts/remove-review-data.ts`.
 *
 * Variável obrigatória:
 * - REVIEW_ACCOUNTS_PASSWORD  senha de todas as contas `review.*`; é regravada a cada execução.
 *
 * Variáveis opcionais:
 * - REVIEW_PUBLISH_STORES=true  publica as lojas aprovadas/ativas (padrão: PENDING, invisíveis);
 * - REVIEW_VIEWER_CUSTOMER_EMAILS  contas EXISTENTES que recebem histórico de cliente fictício
 *   (endereços, motos, favoritos, carrinho e pedidos `MS-REVIEW-V<n>-*`);
 * - REVIEW_VIEWER_SELLER_EMAILS  contas EXISTENTES adicionadas como ADMIN da loja Garagem MX.
 * As contas de visualização nunca são criadas, apagadas ou têm senha/e-mail alterados.
 *
 * Uso: node node_modules/tsx/dist/cli.mjs scripts/seed-review-data.ts
 */
import { config } from "dotenv";
import { requireScriptDatabaseUrl } from "./database-guard";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hashPassword } from "better-auth/crypto";
import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import type { ReviewStoreCode } from "./review-seed-content";
import { ensureReviewCouponsAndCampaign, ensureReviewVariantColumns } from "./review-seed-catalog-extras";
import { renderStoreBanner, renderStoreLogo, seedExpandedData } from "./review-seed-expanded";
import { must, requireEnv } from "./must";
import { parseEmailList } from "./review-seed-ids";

export const REVIEW_EMAIL_DOMAIN = "@example.test";
export const REVIEW_ORDER_PREFIX = "MS-REVIEW-";
const APP_BASE_URL = "http://localhost:3001";
// The DATABASE_URL in .env.local is also read by production (motoshopbrasil.com.br). Publishing the demo
// stores there (REVIEW_PUBLISH_STORES=true) is an explicit owner decision, valid only until launch.
const PUBLISH_STORES = process.env.REVIEW_PUBLISH_STORES === "true";

config({ path: ".env.local", quiet: true });

const databaseUrl = requireScriptDatabaseUrl(process.env, "db:seed:review");

const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

const now = new Date();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);
const daysAhead = (days: number) => new Date(now.getTime() + days * DAY);

// ---------------------------------------------------------------------------------------------
// Definições
// ---------------------------------------------------------------------------------------------

const users = {
  admin: { email: "review.admin@example.test", name: "Renata Admin (revisão)" },
  lojista: { email: "review.lojista@example.test", name: "Rafael Moreira" },
  catalogo: { email: "review.catalogo@example.test", name: "Juliana Prado" },
  pendente: { email: "review.pendente@example.test", name: "Diego Santos" },
  cliente: { email: "review.cliente@example.test", name: "Carla Mendes" },
  lojista2: { email: "review.lojista2@example.test", name: "Bruno Teixeira" },
  lojista3: { email: "review.lojista3@example.test", name: "Paula Guimarães" },
  lojista4: { email: "review.lojista4@example.test", name: "André Kowalski" },
  lojista5: { email: "review.lojista5@example.test", name: "Severino Albuquerque" },
  lojista6: { email: "review.lojista6@example.test", name: "Marcelo Tavares" },
  lojista7: { email: "review.lojista7@example.test", name: "Igor Fontana" },
  lojista8: { email: "review.lojista8@example.test", name: "Rogério Batista" },
  lojista9: { email: "review.lojista9@example.test", name: "Débora Lins" },
} as const;
type UserKey = keyof typeof users;

type StoreKey = ReviewStoreCode | "pendente" | "nova" | "suspensa" | "recusada";
const storeDefinitions: Record<
  StoreKey,
  {
    slug: string;
    name: string;
    description: string;
    sellerType: "INDIVIDUAL" | "COMPANY";
    sellerStatus: "PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "REJECTED";
    commissionBpsOverride: number | null;
    owner: UserKey;
    extra: Partial<Prisma.StoreUncheckedCreateInput>;
  }
> = {
  garagem: {
    slug: "review-garagem-mx",
    name: "Garagem MX · demonstração",
    description:
      "Loja fictícia para revisão visual: peças, equipamentos e acessórios de motocross com atendimento de pista. Preços, estoque e pedidos são ilustrativos.",
    sellerType: "COMPANY",
    sellerStatus: "ACTIVE",
    commissionBpsOverride: null,
    owner: "lojista",
    extra: {
      instagramUrl: "https://www.instagram.com/example",
      youtubeUrl: "https://www.youtube.com/@example",
      whatsappUrl: "https://wa.me/5511900000000",
      originPostalCode: "04571010",
      originName: "Garagem MX Demonstração",
      originEmail: "review.lojista@example.test",
      originPhone: "11900000000",
      originStreet: "Rua das Pistas",
      originNumber: "77",
      originComplement: "Galpão 2",
      originNeighborhood: "Brooklin",
      originCity: "São Paulo",
      originState: "SP",
    },
  },
  box77: {
    slug: "review-box-77",
    name: "Box 77 · demonstração",
    description:
      "Loja fictícia de transmissão, freios e luvas para revisar o carrinho e o checkout com várias lojas. Dados ilustrativos.",
    sellerType: "INDIVIDUAL",
    sellerStatus: "APPROVED",
    commissionBpsOverride: 1000,
    owner: "lojista2",
    extra: {
      instagramUrl: "https://www.instagram.com/example",
      originPostalCode: "13010000",
      originCity: "Campinas",
      originState: "SP",
    },
  },
  pendente: {
    slug: "review-oficina-pendente",
    name: "Oficina Pendente · demonstração",
    description: "Cadastro fictício aguardando aprovação do Admin (fila de sellers).",
    sellerType: "COMPANY",
    sellerStatus: "PENDING",
    commissionBpsOverride: null,
    owner: "pendente",
    extra: {},
  },
  trilha: {
    slug: "review-trilha-forte",
    name: "Trilha Forte Motopeças · demonstração",
    description:
      "Loja fictícia especializada em enduro e trilha: vestuário impermeável, proteções e acessórios para longas distâncias. Dados ilustrativos.",
    sellerType: "COMPANY",
    sellerStatus: "ACTIVE",
    commissionBpsOverride: null,
    owner: "lojista3",
    extra: {
      instagramUrl: "https://www.instagram.com/example",
      facebookUrl: "https://www.facebook.com/example",
      whatsappUrl: "https://wa.me/5531900000000",
      originPostalCode: "30130000",
      originCity: "Belo Horizonte",
      originState: "MG",
    },
  },
  racing: {
    slug: "review-racing-sul",
    name: "Racing Sul MX · demonstração",
    description:
      "Loja fictícia de preparação: motor, suspensão e transmissão para pilotos de competição. Preços e estoque ilustrativos.",
    sellerType: "COMPANY",
    sellerStatus: "APPROVED",
    commissionBpsOverride: 800,
    owner: "lojista4",
    extra: {
      youtubeUrl: "https://www.youtube.com/@example",
      originPostalCode: "80010000",
      originCity: "Curitiba",
      originState: "PR",
    },
  },
  areia: {
    slug: "review-areia-motos",
    name: "Areia Motos Off-Road · demonstração",
    description:
      "Loja fictícia do Nordeste com acessórios, óculos e consumíveis para pistas de areia. Dados ilustrativos.",
    sellerType: "INDIVIDUAL",
    sellerStatus: "ACTIVE",
    commissionBpsOverride: null,
    owner: "lojista5",
    extra: {
      instagramUrl: "https://www.instagram.com/example",
      whatsappUrl: "https://wa.me/5581900000000",
      originPostalCode: "50010000",
      originCity: "Recife",
      originState: "PE",
    },
  },
  cross: {
    slug: "review-cross-center",
    name: "Cross Center Campinas · demonstração",
    description:
      "Loja fictícia de equipamentos de proteção: capacetes, botas, óculos e joelheiras. Dados ilustrativos.",
    sellerType: "COMPANY",
    sellerStatus: "APPROVED",
    commissionBpsOverride: null,
    owner: "lojista6",
    extra: {
      instagramUrl: "https://www.instagram.com/example",
      youtubeUrl: "https://www.youtube.com/@example",
      facebookUrl: "https://www.facebook.com/example",
      originPostalCode: "13015000",
      originCity: "Campinas",
      originState: "SP",
    },
  },
  nova: {
    slug: "review-motopecas-nova",
    name: "Motopeças Nova Era · demonstração",
    description: "Cadastro fictício recente aguardando análise do Admin.",
    sellerType: "INDIVIDUAL",
    sellerStatus: "PENDING",
    commissionBpsOverride: null,
    owner: "lojista7",
    extra: { originPostalCode: "69005000", originCity: "Manaus", originState: "AM" },
  },
  suspensa: {
    slug: "review-loja-suspensa",
    name: "Pit Stop Suspensa · demonstração",
    description: "Loja fictícia suspensa pelo Admin (exemplo da fila de sellers).",
    sellerType: "COMPANY",
    sellerStatus: "SUSPENDED",
    commissionBpsOverride: null,
    owner: "lojista8",
    extra: { originPostalCode: "40010000", originCity: "Salvador", originState: "BA" },
  },
  recusada: {
    slug: "review-loja-recusada",
    name: "Moto Garage Recusada · demonstração",
    description: "Cadastro fictício recusado por documentação incompleta (exemplo da fila de sellers).",
    sellerType: "INDIVIDUAL",
    sellerStatus: "REJECTED",
    commissionBpsOverride: null,
    owner: "lojista9",
    extra: { originPostalCode: "60010000", originCity: "Fortaleza", originState: "CE" },
  },
};

const PUBLIC_STORE_STATUSES = new Set(["APPROVED", "ACTIVE"]);
/** Approved/active demo stores stay PENDING unless the owner explicitly publishes them. */
function initialSellerStatus(status: (typeof storeDefinitions)[StoreKey]["sellerStatus"]) {
  return PUBLIC_STORE_STATUSES.has(status) && !PUBLISH_STORES ? "PENDING" : status;
}

type VariantDefinition = {
  sku: string;
  title: string;
  attributes: Record<string, string>;
  priceInCents: number;
  promotionalPriceInCents?: number;
  stock: number;
};

type ProductDefinition = {
  slug: string;
  name: string;
  description: string;
  store: StoreKey;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ARCHIVED";
  rejectionReason?: string;
  categorySlug: string;
  brandSlug: string;
  image?: { source: string; key: string };
  weightInGrams: number;
  dimensions: [number, number, number];
  fitments?: Array<{ model: string; year: number }>;
  promotion?: { startsAt: Date; endsAt: Date };
  variants: VariantDefinition[];
};

const NOTICE =
  " Produto fictício criado para revisão visual do Moto Shop; preço, estoque e compatibilidade são ilustrativos.";

const products: ProductDefinition[] = [
  {
    slug: "review-capacete-apex-pro",
    name: "Capacete off-road Apex Pro (demonstração)",
    description:
      "Capacete off-road com casco em fibra composta, pala ajustável, forração removível e ventilação frontal ampla." +
      NOTICE,
    store: "garagem",
    status: "APPROVED",
    categorySlug: "equipment-helmets",
    brandSlug: "apex-demo",
    image: { source: "capacete-apex.webp", key: "demo/review-capacete-apex-pro.webp" },
    weightInGrams: 1750,
    dimensions: [310, 270, 400],
    promotion: { startsAt: daysAgo(3), endsAt: daysAhead(12) },
    variants: [
      {
        sku: "REVIEW-GMX-APEX-P",
        title: "Preto/laranja · P",
        attributes: { cor: "Preto/laranja", tamanho: "P" },
        priceInCents: 89990,
        promotionalPriceInCents: 79990,
        stock: 4,
      },
      {
        sku: "REVIEW-GMX-APEX-M",
        title: "Preto/laranja · M",
        attributes: { cor: "Preto/laranja", tamanho: "M" },
        priceInCents: 89990,
        promotionalPriceInCents: 79990,
        stock: 8,
      },
      {
        sku: "REVIEW-GMX-APEX-G",
        title: "Preto/laranja · G",
        attributes: { cor: "Preto/laranja", tamanho: "G" },
        priceInCents: 89990,
        promotionalPriceInCents: 79990,
        stock: 2,
      },
    ],
  },
  {
    slug: "review-botas-terra-trail",
    name: "Botas off-road Terra Trail (demonstração)",
    description:
      "Botas de cano alto com quatro fivelas, proteção de tornozelo articulada e sola de borracha tratorada." + NOTICE,
    store: "garagem",
    status: "APPROVED",
    categorySlug: "equipment-boots",
    brandSlug: "terra-demo",
    image: { source: "botas-terra.webp", key: "demo/review-botas-terra-trail.webp" },
    weightInGrams: 4300,
    dimensions: [390, 330, 550],
    variants: [
      {
        sku: "REVIEW-GMX-TRAIL-40",
        title: "Preto · 40",
        attributes: { cor: "Preto", tamanho: "40" },
        priceInCents: 109990,
        stock: 3,
      },
      {
        sku: "REVIEW-GMX-TRAIL-41",
        title: "Preto · 41",
        attributes: { cor: "Preto", tamanho: "41" },
        priceInCents: 109990,
        stock: 0,
      },
      {
        sku: "REVIEW-GMX-TRAIL-42",
        title: "Preto · 42",
        attributes: { cor: "Preto", tamanho: "42" },
        priceInCents: 109990,
        stock: 6,
      },
    ],
  },
  {
    slug: "review-oculos-vista-pro",
    name: "Óculos off-road Vista Pro (demonstração)",
    description:
      "Óculos com armação flexível, espuma tripla e lente transparente antiembaçante com pinos para tear-off." + NOTICE,
    store: "garagem",
    status: "APPROVED",
    categorySlug: "equipment-goggles",
    brandSlug: "apex-demo",
    image: { source: "oculos-vista.webp", key: "demo/review-oculos-vista-pro.webp" },
    weightInGrams: 420,
    dimensions: [120, 120, 260],
    variants: [
      {
        sku: "REVIEW-GMX-VISTA-UN",
        title: "Preto/laranja · único",
        attributes: { cor: "Preto/laranja", tamanho: "Único" },
        priceInCents: 24990,
        stock: 15,
      },
    ],
  },
  {
    slug: "review-disco-freio-onda-260",
    name: "Disco de freio dianteiro Onda 260 mm (demonstração)",
    description: "Disco de freio dianteiro ondulado de 260 mm em aço inox temperado." + NOTICE,
    store: "garagem",
    status: "APPROVED",
    categorySlug: "parts-brakes",
    brandSlug: "terra-demo",
    image: { source: "disco-onda.webp", key: "demo/review-disco-freio-onda-260.webp" },
    weightInGrams: 950,
    dimensions: [35, 280, 280],
    fitments: [
      { model: "CRF 250R", year: 2024 },
      { model: "CRF 250R", year: 2025 },
    ],
    variants: [
      {
        sku: "REVIEW-GMX-ONDA-260",
        title: "Aço inox · 260 mm",
        attributes: { material: "Aço inox", diametro: "260 mm" },
        priceInCents: 32990,
        stock: 1,
      },
    ],
  },
  {
    slug: "review-kit-relacao-crf-250r",
    name: "Kit relação CRF 250R (demonstração)",
    description: "Kit de transmissão com corrente 520 com retentores, coroa e pinhão." + NOTICE,
    store: "garagem",
    status: "APPROVED",
    categorySlug: "parts-transmission",
    brandSlug: "terra-demo",
    weightInGrams: 2600,
    dimensions: [60, 260, 260],
    fitments: [
      { model: "CRF 250R", year: 2024 },
      { model: "CRF 250R", year: 2025 },
    ],
    variants: [
      {
        sku: "REVIEW-GMX-KIT-1349-ACO",
        title: "Aço · 13/49",
        attributes: { material: "Aço", relacao: "13/49" },
        priceInCents: 45990,
        stock: 5,
      },
      {
        sku: "REVIEW-GMX-KIT-1350-ALU",
        title: "Alumínio · 13/50",
        attributes: { material: "Alumínio", relacao: "13/50" },
        priceInCents: 52990,
        stock: 0,
      },
    ],
  },
  {
    slug: "review-filtro-ar-yz250f",
    name: "Filtro de ar em espuma YZ250F (demonstração)",
    description: "Filtro de ar em espuma de dupla camada, pré-lubrificado." + NOTICE,
    store: "garagem",
    status: "APPROVED",
    categorySlug: "parts-engine",
    brandSlug: "apex-demo",
    weightInGrams: 180,
    dimensions: [90, 150, 180],
    fitments: [{ model: "YZ250F", year: 2025 }],
    variants: [
      {
        sku: "REVIEW-GMX-FILTRO-YZ",
        title: "Espuma dupla camada",
        attributes: { material: "Espuma" },
        priceInCents: 8990,
        stock: 25,
      },
    ],
  },
  {
    slug: "review-mola-garfo-crf-250r",
    name: "Molas de garfo CRF 250R (demonstração)",
    description: "Par de molas de garfo para ajuste de carga conforme o peso do piloto." + NOTICE,
    store: "garagem",
    status: "APPROVED",
    categorySlug: "parts-suspension",
    brandSlug: "terra-demo",
    weightInGrams: 1900,
    dimensions: [80, 80, 480],
    fitments: [{ model: "CRF 250R", year: 2025 }],
    variants: [
      {
        sku: "REVIEW-GMX-MOLA-046",
        title: "0,46 kg/mm",
        attributes: { carga: "0,46 kg/mm" },
        priceInCents: 64990,
        stock: 2,
      },
      {
        sku: "REVIEW-GMX-MOLA-048",
        title: "0,48 kg/mm",
        attributes: { carga: "0,48 kg/mm" },
        priceInCents: 64990,
        stock: 3,
      },
    ],
  },
  {
    slug: "review-protetor-mao-race",
    name: "Protetor de mão Race (demonstração)",
    description: "Par de protetores de mão com alma de alumínio e defletor plástico." + NOTICE,
    store: "garagem",
    status: "APPROVED",
    categorySlug: "parts-accessories",
    brandSlug: "apex-demo",
    weightInGrams: 600,
    dimensions: [100, 180, 300],
    variants: [
      { sku: "REVIEW-GMX-PROT-PRETO", title: "Preto", attributes: { cor: "Preto" }, priceInCents: 15990, stock: 10 },
      {
        sku: "REVIEW-GMX-PROT-LARANJA",
        title: "Laranja",
        attributes: { cor: "Laranja" },
        priceInCents: 15990,
        stock: 4,
      },
    ],
  },
  {
    slug: "review-camisa-motocross-rascunho",
    name: "Camisa de motocross Sprint (demonstração)",
    description: "Camisa leve em poliéster com punhos elásticos. Rascunho ainda não enviado para aprovação." + NOTICE,
    store: "garagem",
    status: "DRAFT",
    categorySlug: "apparel",
    brandSlug: "terra-demo",
    weightInGrams: 250,
    dimensions: [30, 250, 300],
    variants: [
      {
        sku: "REVIEW-GMX-CAMISA-M",
        title: "Laranja · M",
        attributes: { cor: "Laranja", tamanho: "M" },
        priceInCents: 18990,
        stock: 0,
      },
    ],
  },
  {
    slug: "review-calca-motocross-enviada",
    name: "Calça de motocross Sprint (demonstração)",
    description: "Calça com painéis de couro nos joelhos e ajuste na cintura. Enviada para moderação." + NOTICE,
    store: "garagem",
    status: "SUBMITTED",
    categorySlug: "apparel",
    brandSlug: "terra-demo",
    weightInGrams: 700,
    dimensions: [50, 300, 350],
    variants: [
      {
        sku: "REVIEW-GMX-CALCA-38",
        title: "Preto · 38",
        attributes: { cor: "Preto", tamanho: "38" },
        priceInCents: 39990,
        stock: 4,
      },
      {
        sku: "REVIEW-GMX-CALCA-40",
        title: "Preto · 40",
        attributes: { cor: "Preto", tamanho: "40" },
        priceInCents: 39990,
        stock: 5,
      },
    ],
  },
  {
    slug: "review-pedaleira-rejeitada",
    name: "Pedaleira forjada (demonstração)",
    description: "Par de pedaleiras forjadas com dentes autolimpantes." + NOTICE,
    store: "garagem",
    status: "REJECTED",
    rejectionReason:
      "Fotos insuficientes e compatibilidade sem ano informado. Envie imagens nítidas e selecione os modelos/anos compatíveis.",
    categorySlug: "parts-accessories",
    brandSlug: "apex-demo",
    weightInGrams: 800,
    dimensions: [60, 120, 200],
    variants: [
      {
        sku: "REVIEW-GMX-PEDAL-UN",
        title: "Titânio · único",
        attributes: { material: "Titânio" },
        priceInCents: 74990,
        stock: 3,
      },
    ],
  },
  {
    slug: "review-guidao-arquivado",
    name: "Guidão 7/8 Classic (demonstração)",
    description: "Guidão de aço 7/8 polegadas. Produto arquivado pelo lojista." + NOTICE,
    store: "garagem",
    status: "ARCHIVED",
    categorySlug: "parts-accessories",
    brandSlug: "terra-demo",
    weightInGrams: 1100,
    dimensions: [60, 120, 820],
    variants: [
      {
        sku: "REVIEW-GMX-GUIDAO-78",
        title: "Aço · 7/8",
        attributes: { material: "Aço" },
        priceInCents: 19990,
        stock: 2,
      },
    ],
  },
  {
    slug: "review-luva-box77-grip",
    name: "Luva de motocross Grip (demonstração)",
    description: "Luva leve com palma em couro sintético e punho de neoprene." + NOTICE,
    store: "box77",
    status: "APPROVED",
    categorySlug: "apparel",
    brandSlug: "apex-demo",
    weightInGrams: 150,
    dimensions: [30, 120, 250],
    variants: [
      {
        sku: "REVIEW-B77-LUVA-M",
        title: "Preto · M",
        attributes: { cor: "Preto", tamanho: "M" },
        priceInCents: 12990,
        stock: 6,
      },
      {
        sku: "REVIEW-B77-LUVA-G",
        title: "Preto · G",
        attributes: { cor: "Preto", tamanho: "G" },
        priceInCents: 12990,
        stock: 4,
      },
    ],
  },
  {
    slug: "review-corrente-box77-520",
    name: "Corrente 520 com retentor 120 elos (demonstração)",
    description: "Corrente de transmissão 520 com retentores, 120 elos e emenda de rebite." + NOTICE,
    store: "box77",
    status: "APPROVED",
    categorySlug: "parts-transmission",
    brandSlug: "terra-demo",
    weightInGrams: 1800,
    dimensions: [50, 150, 200],
    fitments: [
      { model: "CRF 250R", year: 2025 },
      { model: "YZ250F", year: 2025 },
    ],
    variants: [
      {
        sku: "REVIEW-B77-CORRENTE-520",
        title: "Dourada · 120 elos",
        attributes: { cor: "Dourada", elos: "120" },
        priceInCents: 27990,
        stock: 7,
      },
    ],
  },
  {
    slug: "review-pastilha-box77-sinter",
    name: "Pastilha de freio sinterizada (demonstração)",
    description: "Jogo de pastilhas sinterizadas para uso em lama e areia." + NOTICE,
    store: "box77",
    status: "APPROVED",
    categorySlug: "parts-brakes",
    brandSlug: "apex-demo",
    weightInGrams: 200,
    dimensions: [20, 80, 100],
    fitments: [{ model: "YZ250F", year: 2025 }],
    variants: [
      {
        sku: "REVIEW-B77-PASTILHA-DIANT",
        title: "Dianteira",
        attributes: { posicao: "Dianteira" },
        priceInCents: 11990,
        stock: 9,
      },
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function assertReviewEmail(email: string) {
  if (!email.startsWith("review.") || !email.endsWith(REVIEW_EMAIL_DOMAIN)) throw new Error(`Unsafe e-mail: ${email}`);
}

function hashGuestToken(token: string): string {
  // Idêntico a src/modules/cart/infrastructure/cart-access.ts#hashGuestToken (não importável: "server-only").
  return createHash("sha256").update(token).digest("hex");
}

function commission(amountInCents: number, bps: number): number {
  // Mesmo arredondamento de calculateCommissionInCents (meio para cima).
  return Number((BigInt(amountInCents) * BigInt(bps) + BigInt(5000)) / BigInt(10000));
}

const counts: Record<string, { created: number; existing: number }> = {};
function track(entity: string, created: boolean) {
  trackMany(entity, created ? 1 : 0, 1);
}
function trackMany(entity: string, created: number, total: number) {
  counts[entity] ??= { created: 0, existing: 0 };
  counts[entity].created += created;
  counts[entity].existing += total - created;
}

// ---------------------------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------------------------

async function ensureUsers(passwordHash: string) {
  const ids = {} as Record<UserKey, string>;
  for (const [key, definition] of Object.entries(users) as Array<[UserKey, (typeof users)[UserKey]]>) {
    assertReviewEmail(definition.email);
    const existing = await db.user.findUnique({ where: { email: definition.email } });
    const user =
      existing ??
      (await db.user.create({ data: { email: definition.email, name: definition.name, emailVerified: true } }));
    track("User", !existing);
    ids[key] = user.id;

    track("Account", await ensureCredentialAccount(user.id, passwordHash));
  }
  return ids;
}

/** Sets the review password on the user's credential account; returns true when the account was created. */
async function ensureCredentialAccount(userId: string, passwordHash: string) {
  const account = await db.account.findFirst({ where: { userId, providerId: "credential" } });
  if (account) {
    await db.account.update({ where: { id: account.id }, data: { password: passwordHash } });
    return false;
  }

  await db.account.create({
    data: { userId, providerId: "credential", accountId: userId, password: passwordHash },
  });
  return true;
}

async function findOrCreateReviewStore(key: StoreKey, definition: (typeof storeDefinitions)[StoreKey]) {
  const store = await db.store.findUnique({
    where: { slug: definition.slug },
    include: { seller: { select: { status: true } } },
  });
  if (store && store.name !== definition.name) throw new Error(`Refusing to touch unrelated store ${definition.slug}`);
  if (store) {
    track("Seller", false);
    track("Store", false);
    // Publishing later (second run with the flag) only promotes demo stores still PENDING.
    if (PUBLISH_STORES && store.seller.status === "PENDING" && PUBLIC_STORE_STATUSES.has(definition.sellerStatus)) {
      await db.seller.update({ where: { id: store.sellerId }, data: { status: definition.sellerStatus } });
      track("SellerPublished", true);
    }
    return store;
  }

  const seller = await db.seller.create({
    data: {
      type: definition.sellerType,
      // AGENTS.md: demo stores stay PENDING unless REVIEW_PUBLISH_STORES=true (explicit owner decision).
      status: initialSellerStatus(definition.sellerStatus),
      commissionBpsOverride: definition.commissionBpsOverride,
      createdAt: ["pendente", "nova"].includes(key)
        ? daysAgo(key === "nova" ? 3 : 1)
        : daysAgo(key === "garagem" || key === "box77" ? 60 : 150),
    },
  });
  const created = await db.store.create({
    data: {
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      sellerId: seller.id,
      ...definition.extra,
    },
    include: { seller: { select: { status: true } } },
  });
  track("Seller", true);
  track("Store", true);
  return created;
}

async function ensureStores(userIds: Record<UserKey, string>) {
  const result = {} as Record<StoreKey, { id: string; sellerId: string; name: string; commissionBps: number }>;
  const configuration = await db.marketplaceConfiguration.findUnique({ where: { key: "default" } });
  const defaultBps = configuration?.defaultCommissionBps ?? 1200;

  for (const [key, definition] of Object.entries(storeDefinitions) as Array<
    [StoreKey, (typeof storeDefinitions)[StoreKey]]
  >) {
    const store = await findOrCreateReviewStore(key, definition);

    // Logo e banner gerados localmente (public/images/demo, ignorado pelo git) só para lojas de revisão.
    const needsBranding = !store.logoStorageKey || !store.bannerStorageKey;
    if (needsBranding) {
      const base = definition.slug.replace(/^review-/, "");
      const logoKey = `demo/review-loja-${base}-logo.webp`;
      const bannerKey = `demo/review-loja-${base}-banner.webp`;
      await renderStoreLogo(logoKey, definition.name);
      await renderStoreBanner(bannerKey, definition.name);
      await db.store.update({
        where: { id: store.id },
        data: {
          logoStorageKey: store.logoStorageKey ?? logoKey,
          bannerStorageKey: store.bannerStorageKey ?? bannerKey,
        },
      });
    }
    track("StoreBranding", needsBranding);

    const members: Array<[UserKey, "OWNER" | "CATALOG"]> = [[definition.owner, "OWNER"]];
    if (key === "garagem") members.push(["catalogo", "CATALOG"]);
    for (const [userKey, role] of members) {
      const where = { sellerId_userId: { sellerId: store.sellerId, userId: userIds[userKey] } };
      const existing = await db.sellerMember.findUnique({ where });
      if (!existing)
        await db.sellerMember.create({ data: { sellerId: store.sellerId, userId: userIds[userKey], role } });
      track("SellerMember", !existing);
    }

    result[key] = {
      id: store.id,
      sellerId: store.sellerId,
      name: definition.name,
      commissionBps: definition.commissionBpsOverride ?? defaultBps,
    };
  }

  // VIP ativo para a loja principal.
  const garagem = result.garagem;
  const vip = await db.sellerSubscription.findFirst({ where: { sellerId: garagem.sellerId, plan: "VIP" } });
  if (!vip)
    await db.sellerSubscription.create({
      data: { sellerId: garagem.sellerId, plan: "VIP", status: "ACTIVE", startsAt: daysAgo(10), endsAt: daysAhead(20) },
    });
  track("SellerSubscription", !vip);

  const methods: Array<{
    store: StoreKey;
    name: string;
    start: string;
    end: string;
    price: number;
    days: number;
    active: boolean;
  }> = [
    {
      store: "garagem",
      name: "Entrega própria · Grande São Paulo",
      start: "01000000",
      end: "09999999",
      price: 1990,
      days: 3,
      active: true,
    },
    {
      store: "garagem",
      name: "Motoboy expresso · Centro (desativado)",
      start: "01000000",
      end: "01599999",
      price: 2990,
      days: 1,
      active: false,
    },
    {
      store: "box77",
      name: "Entrega própria · Sudeste",
      start: "01000000",
      end: "39999999",
      price: 2490,
      days: 5,
      active: true,
    },
    {
      store: "trilha",
      name: "Entrega própria · Minas Gerais",
      start: "30000000",
      end: "39999999",
      price: 1790,
      days: 2,
      active: true,
    },
    {
      store: "trilha",
      name: "Transportadora parceira · Brasil",
      start: "01000000",
      end: "99999999",
      price: 3490,
      days: 7,
      active: true,
    },
    {
      store: "racing",
      name: "Entrega própria · Sul",
      start: "80000000",
      end: "99999999",
      price: 2290,
      days: 4,
      active: true,
    },
    {
      store: "racing",
      name: "Retirada no box (desativada)",
      start: "80000000",
      end: "80999999",
      price: 0,
      days: 1,
      active: false,
    },
    {
      store: "areia",
      name: "Entrega própria · Nordeste",
      start: "40000000",
      end: "65999999",
      price: 2690,
      days: 6,
      active: true,
    },
    {
      store: "cross",
      name: "Entrega própria · Interior de SP",
      start: "11000000",
      end: "19999999",
      price: 1590,
      days: 3,
      active: true,
    },
    {
      store: "cross",
      name: "Entrega própria · Brasil",
      start: "01000000",
      end: "99999999",
      price: 2990,
      days: 8,
      active: true,
    },
  ];
  for (const method of methods) {
    const sellerId = result[method.store].sellerId;
    const existing = await db.sellerShippingMethod.findFirst({ where: { sellerId, name: method.name } });
    if (!existing)
      await db.sellerShippingMethod.create({
        data: {
          sellerId,
          name: method.name,
          postalCodeStart: method.start,
          postalCodeEnd: method.end,
          priceInCents: method.price,
          estimatedDeliveryDays: method.days,
          active: method.active,
        },
      });
    track("SellerShippingMethod", !existing);
  }
  return result;
}

type VariantRef = {
  id: string;
  productId: string;
  sellerId: string;
  sku: string;
  title: string;
  attributes: Record<string, string>;
  priceInCents: number;
  productName: string;
  weightInGrams: number;
  dimensions: [number, number, number];
  inventoryId: string;
};

async function ensureProducts(stores: Awaited<ReturnType<typeof ensureStores>>, userIds: Record<UserKey, string>) {
  const categories = new Map(
    (await db.category.findMany({ where: { slug: { in: [...new Set(products.map((p) => p.categorySlug))] } } })).map(
      (c) => [c.slug, c.id],
    ),
  );
  const brands = new Map(
    (await db.brand.findMany({ where: { slug: { in: [...new Set(products.map((p) => p.brandSlug))] } } })).map((b) => [
      b.slug,
      b.id,
    ]),
  );
  const fitments = await db.motorcycleFitment.findMany({ include: { motorcycleModel: true } });
  const findFitment = (model: string, year: number) =>
    fitments.find((fitment) => fitment.motorcycleModel.name === model && fitment.year === year);

  const variants = new Map<string, VariantRef>();
  const productIds = new Map<string, string>();

  for (const definition of products) {
    if (!definition.slug.startsWith("review-") || !definition.name.endsWith("(demonstração)"))
      throw new Error("Unsafe product");
    const store = stores[definition.store];
    const categoryId = categories.get(definition.categorySlug);
    const brandId = brands.get(definition.brandSlug);
    if (!categoryId) throw new Error(`Missing category ${definition.categorySlug}; run the regular seed first.`);
    if (!brandId)
      throw new Error(`Missing brand ${definition.brandSlug}; run scripts/seed-demo-catalog.ts --apply first.`);

    let product = await db.product.findUnique({ where: { slug: definition.slug } });
    const productExisted = Boolean(product);
    if (product && (!product.isDemo || product.sellerId !== store.sellerId))
      throw new Error(`Refusing to touch unrelated product ${definition.slug}`);
    if (!product) {
      const reviewed = ["APPROVED", "REJECTED", "ARCHIVED"].includes(definition.status);
      product = await db.product.create({
        data: {
          slug: definition.slug,
          name: definition.name,
          description: definition.description,
          isDemo: true,
          status: definition.status,
          rejectionReason: definition.rejectionReason ?? null,
          submittedAt: definition.status === "DRAFT" ? null : daysAgo(definition.status === "SUBMITTED" ? 1 : 40),
          reviewedAt: reviewed ? daysAgo(38) : null,
          reviewedByUserId: reviewed ? userIds.admin : null,
          weightInGrams: definition.weightInGrams,
          heightInMillimeters: definition.dimensions[0],
          widthInMillimeters: definition.dimensions[1],
          lengthInMillimeters: definition.dimensions[2],
          sellerId: store.sellerId,
          storeId: store.id,
          categoryId,
          brandId,
          createdAt: daysAgo(definition.status === "SUBMITTED" ? 2 : 45),
        },
      });
    }
    track("Product", !productExisted);
    productIds.set(definition.slug, product.id);

    if (definition.image) {
      const target = join(process.cwd(), "public/images", definition.image.key);
      if (!existsSync(target)) copyFileSync(join(process.cwd(), "public/images/demo", definition.image.source), target);
      const image = await db.productImage.findUnique({ where: { storageKey: definition.image.key } });
      if (!image)
        await db.productImage.create({
          data: { productId: product.id, storageKey: definition.image.key, altText: definition.name, sortOrder: 0 },
        });
      track("ProductImage", !image);
    }

    for (const entry of definition.variants) {
      if (!entry.sku.startsWith("REVIEW-")) throw new Error("Unsafe SKU");
      let variant = await db.productVariant.findUnique({
        where: { sellerId_sku: { sellerId: store.sellerId, sku: entry.sku } },
      });
      if (variant && variant.productId !== product.id) throw new Error(`SKU ${entry.sku} belongs to another product`);
      track("ProductVariant", !variant);
      if (!variant) {
        variant = await db.productVariant.create({
          data: {
            productId: product.id,
            sellerId: store.sellerId,
            sku: entry.sku,
            title: entry.title,
            attributes: entry.attributes,
            priceInCents: entry.priceInCents,
            promotionalPriceInCents: entry.promotionalPriceInCents ?? null,
            promotionStartsAt: entry.promotionalPriceInCents ? (definition.promotion?.startsAt ?? null) : null,
            promotionEndsAt: entry.promotionalPriceInCents ? (definition.promotion?.endsAt ?? null) : null,
          },
        });
      }

      let inventory = await db.inventory.findUnique({ where: { variantId: variant.id } });
      track("Inventory", !inventory);
      if (!inventory) {
        const initial = entry.stock + 3;
        inventory = await db.inventory.create({
          data: { variantId: variant.id, sellerId: store.sellerId, availableQuantity: entry.stock },
        });
        // Histórico rastreável: entrada inicial e uma venda/ajuste que levam ao saldo atual.
        await db.inventoryMovement.createMany({
          data: [
            {
              type: "MANUAL_IN",
              quantityChange: initial,
              availableQuantityAfter: initial,
              reservedQuantityAfter: 0,
              referenceType: "REVIEW_SEED",
              referenceId: product.id,
              reason: "Estoque inicial (dados de revisão)",
              inventoryId: inventory.id,
              variantId: variant.id,
              sellerId: store.sellerId,
              actorUserId: userIds[storeDefinitions[definition.store].owner],
              createdAt: daysAgo(44),
            },
            {
              type: entry.stock === 0 ? "MANUAL_OUT" : "CORRECTION",
              quantityChange: -3,
              availableQuantityAfter: entry.stock,
              reservedQuantityAfter: 0,
              referenceType: "REVIEW_SEED",
              referenceId: product.id,
              reason: entry.stock === 0 ? "Avaria identificada na conferência" : "Correção após inventário físico",
              inventoryId: inventory.id,
              variantId: variant.id,
              sellerId: store.sellerId,
              actorUserId: userIds[storeDefinitions[definition.store].owner],
              createdAt: daysAgo(20),
            },
          ],
        });
        track("InventoryMovement", true);
        track("InventoryMovement", true);
      }

      variants.set(entry.sku, {
        id: variant.id,
        productId: product.id,
        sellerId: store.sellerId,
        sku: entry.sku,
        title: entry.title,
        attributes: entry.attributes,
        priceInCents: entry.priceInCents,
        productName: definition.name,
        weightInGrams: definition.weightInGrams,
        dimensions: definition.dimensions,
        inventoryId: inventory.id,
      });
    }

    for (const fitmentRef of definition.fitments ?? []) {
      const fitment = findFitment(fitmentRef.model, fitmentRef.year);
      if (!fitment) {
        console.warn(`Fitment ${fitmentRef.model} ${fitmentRef.year} not found; skipping compatibility.`);
        continue;
      }
      const where = { productId_motorcycleFitmentId: { productId: product.id, motorcycleFitmentId: fitment.id } };
      const existing = await db.productCompatibility.findUnique({ where });
      if (!existing)
        await db.productCompatibility.create({
          data: { productId: product.id, motorcycleFitmentId: fitment.id, sellerId: store.sellerId },
        });
      track("ProductCompatibility", !existing);
    }
  }
  return { variants, productIds, findFitment };
}

async function ensureCustomerData(
  clienteId: string,
  variants: Map<string, VariantRef>,
  productIds: Map<string, string>,
  findFitment: (model: string, year: number) => { id: string } | undefined,
) {
  const addresses = [
    {
      label: "Casa",
      recipient: "Carla Mendes",
      postalCode: "01310100",
      street: "Avenida Paulista",
      number: "1000",
      complement: "Apto 52",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      isDefault: true,
    },
    {
      label: "Trabalho",
      recipient: "Carla Mendes",
      postalCode: "04538133",
      street: "Avenida Brigadeiro Faria Lima",
      number: "3477",
      complement: "10º andar",
      neighborhood: "Itaim Bibi",
      city: "São Paulo",
      state: "SP",
      isDefault: false,
    },
  ];
  for (const address of addresses) {
    const existing = await db.customerAddress.findFirst({ where: { userId: clienteId, label: address.label } });
    if (!existing) await db.customerAddress.create({ data: { userId: clienteId, ...address } });
    track("CustomerAddress", !existing);
  }

  const motorcycles: Array<[string, number, boolean]> = [
    ["CRF 250R", 2025, true],
    ["YZ250F", 2025, false],
  ];
  for (const [model, year, isPrimary] of motorcycles) {
    const fitment = findFitment(model, year);
    if (!fitment) continue;
    const where = { userId_motorcycleFitmentId: { userId: clienteId, motorcycleFitmentId: fitment.id } };
    const existing = await db.savedMotorcycle.findUnique({ where });
    if (!existing)
      await db.savedMotorcycle.create({ data: { userId: clienteId, motorcycleFitmentId: fitment.id, isPrimary } });
    track("SavedMotorcycle", !existing);
  }

  for (const slug of ["review-capacete-apex-pro", "review-kit-relacao-crf-250r", "review-luva-box77-grip"]) {
    const productId = must(productIds.get(slug), `product ${slug}`);
    const where = { userId_productId: { userId: clienteId, productId } };
    const existing = await db.favorite.findUnique({ where });
    if (!existing) await db.favorite.create({ data: { userId: clienteId, productId } });
    track("Favorite", !existing);
  }

  const existingCart = await db.cart.findFirst({ where: { userId: clienteId, status: "ACTIVE" } });
  const cart = existingCart ?? (await db.cart.create({ data: { userId: clienteId, status: "ACTIVE" } }));
  track("Cart", !existingCart);
  for (const [sku, quantity] of [
    ["REVIEW-GMX-VISTA-UN", 1],
    ["REVIEW-GMX-PROT-LARANJA", 2],
    ["REVIEW-B77-PASTILHA-DIANT", 1],
  ] as const) {
    const variantId = must(variants.get(sku), `variant ${sku}`).id;
    const where = { cartId_variantId: { cartId: cart.id, variantId } };
    const existing = await db.cartItem.findUnique({ where });
    if (!existing) await db.cartItem.create({ data: { cartId: cart.id, variantId, quantity } });
    track("CartItem", !existing);
  }
}

type OrderPart = {
  store: StoreKey;
  status: "PENDING_PAYMENT" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLATION_REQUESTED" | "CANCELLED";
  shipment: { status: "PENDING" | "READY_TO_SHIP" | "SHIPPED" | "DELIVERED" | "CANCELLED"; trackingCode?: string };
  items: Array<{ sku: string; quantity: number; unitPriceInCents?: number; discountInCents?: number }>;
  marketplaceDiscountInCents?: number;
};

type OrderSpec = {
  orderNumber: string;
  status: "PENDING_PAYMENT" | "PAID" | "PROCESSING" | "PARTIALLY_SHIPPED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  placedDaysAgo: number;
  guest?: { name: string; email: string; phone: string };
  payment: { status: "PENDING" | "APPROVED" | "CANCELLED"; method: "pix" | "visa" | "master" };
  couponCode?: string;
  parts: OrderPart[];
};

const shippingByStore: Record<StoreKey, { name: string; price: number; days: number }> = {
  garagem: { name: "Entrega própria · Grande São Paulo", price: 1990, days: 3 },
  box77: { name: "Entrega própria · Sudeste", price: 2490, days: 5 },
  trilha: { name: "Transportadora parceira · Brasil", price: 3490, days: 7 },
  racing: { name: "Entrega própria · Sul", price: 2290, days: 4 },
  areia: { name: "Entrega própria · Nordeste", price: 2690, days: 6 },
  cross: { name: "Entrega própria · Brasil", price: 2990, days: 8 },
  pendente: { name: "-", price: 0, days: 0 },
  nova: { name: "-", price: 0, days: 0 },
  suspensa: { name: "-", price: 0, days: 0 },
  recusada: { name: "-", price: 0, days: 0 },
};

const orders: OrderSpec[] = [
  {
    orderNumber: "MS-REVIEW-0001",
    status: "PENDING_PAYMENT",
    placedDaysAgo: 0,
    payment: { status: "PENDING", method: "pix" },
    parts: [
      {
        store: "garagem",
        status: "PENDING_PAYMENT",
        shipment: { status: "PENDING" },
        items: [{ sku: "REVIEW-GMX-FILTRO-YZ", quantity: 2 }],
      },
    ],
  },
  {
    orderNumber: "MS-REVIEW-0002",
    status: "PAID",
    placedDaysAgo: 1,
    payment: { status: "APPROVED", method: "visa" },
    parts: [
      {
        store: "garagem",
        status: "CANCELLATION_REQUESTED",
        shipment: { status: "PENDING" },
        items: [{ sku: "REVIEW-GMX-MOLA-046", quantity: 1 }],
      },
    ],
  },
  {
    orderNumber: "MS-REVIEW-0003",
    status: "PROCESSING",
    placedDaysAgo: 2,
    payment: { status: "APPROVED", method: "pix" },
    parts: [
      {
        store: "garagem",
        status: "PROCESSING",
        shipment: { status: "READY_TO_SHIP" },
        items: [
          { sku: "REVIEW-GMX-PROT-PRETO", quantity: 1 },
          { sku: "REVIEW-GMX-VISTA-UN", quantity: 1 },
        ],
      },
    ],
  },
  {
    orderNumber: "MS-REVIEW-0004",
    status: "SHIPPED",
    placedDaysAgo: 6,
    payment: { status: "APPROVED", method: "master" },
    parts: [
      {
        store: "garagem",
        status: "SHIPPED",
        shipment: { status: "SHIPPED", trackingCode: "RV123456785BR" },
        items: [{ sku: "REVIEW-GMX-TRAIL-42", quantity: 1 }],
      },
    ],
  },
  {
    orderNumber: "MS-REVIEW-0005",
    status: "DELIVERED",
    placedDaysAgo: 12,
    payment: { status: "APPROVED", method: "visa" },
    parts: [
      {
        store: "garagem",
        status: "DELIVERED",
        shipment: { status: "DELIVERED", trackingCode: "RV987654321BR" },
        items: [
          { sku: "REVIEW-GMX-APEX-M", quantity: 1 },
          { sku: "REVIEW-GMX-ONDA-260", quantity: 1 },
        ],
      },
    ],
  },
  {
    orderNumber: "MS-REVIEW-0006",
    status: "CANCELLED",
    placedDaysAgo: 15,
    payment: { status: "CANCELLED", method: "pix" },
    parts: [
      {
        store: "garagem",
        status: "CANCELLED",
        shipment: { status: "CANCELLED" },
        items: [{ sku: "REVIEW-GMX-KIT-1349-ACO", quantity: 1 }],
      },
    ],
  },
  {
    // Multi-seller com cupom do marketplace (R$ 20,00 rateado: 561 + 1439).
    orderNumber: "MS-REVIEW-0007",
    status: "PARTIALLY_SHIPPED",
    placedDaysAgo: 4,
    payment: { status: "APPROVED", method: "pix" },
    couponCode: "REVIEW-PRIMEIRA20",
    parts: [
      {
        store: "garagem",
        status: "SHIPPED",
        shipment: { status: "SHIPPED", trackingCode: "RV555444333BR" },
        marketplaceDiscountInCents: 561,
        items: [{ sku: "REVIEW-GMX-PROT-LARANJA", quantity: 1, discountInCents: 561 }],
      },
      {
        store: "box77",
        status: "PAID",
        shipment: { status: "PENDING" },
        marketplaceDiscountInCents: 1439,
        items: [
          { sku: "REVIEW-B77-LUVA-M", quantity: 1, discountInCents: 456 },
          { sku: "REVIEW-B77-CORRENTE-520", quantity: 1, discountInCents: 983 },
        ],
      },
    ],
  },
  {
    orderNumber: "MS-REVIEW-0008",
    status: "PAID",
    placedDaysAgo: 1,
    guest: { name: "Marcos Lima", email: "review.convidado@example.test", phone: "11955554444" },
    payment: { status: "APPROVED", method: "pix" },
    parts: [
      {
        store: "box77",
        status: "PAID",
        shipment: { status: "PENDING" },
        items: [{ sku: "REVIEW-B77-PASTILHA-DIANT", quantity: 2 }],
      },
    ],
  },
];

async function ensureCoupons(stores: Awaited<ReturnType<typeof ensureStores>>) {
  const coupons: Prisma.CouponUncheckedCreateInput[] = [
    {
      code: "REVIEW-PRIMEIRA20",
      ownerType: "MARKETPLACE",
      discountType: "FIXED_AMOUNT",
      fixedAmountInCents: 2000,
      minimumPurchaseInCents: 15000,
      startsAt: daysAgo(30),
      endsAt: daysAhead(60),
      globalUsageLimit: 500,
      perCustomerUsageLimit: 1,
      fundedBy: "MARKETPLACE",
    },
    {
      code: "REVIEW-GARAGEM15",
      ownerType: "SELLER",
      discountType: "PERCENTAGE",
      percentageBps: 1500,
      minimumPurchaseInCents: 30000,
      startsAt: daysAgo(5),
      endsAt: daysAhead(25),
      globalUsageLimit: 100,
      perCustomerUsageLimit: 1,
      fundedBy: "SELLER",
      sellerId: stores.garagem.sellerId,
    },
    {
      code: "REVIEW-NATAL-GARAGEM",
      ownerType: "SELLER",
      discountType: "FIXED_AMOUNT",
      fixedAmountInCents: 5000,
      minimumPurchaseInCents: 40000,
      startsAt: daysAhead(30),
      endsAt: daysAhead(60),
      fundedBy: "SELLER",
      sellerId: stores.garagem.sellerId,
    },
    // Conjunto ampliado: marketplace e lojas, ativos/futuros/expirados/inativos, % e valor fixo.
    {
      code: "REVIEW-MX10",
      ownerType: "MARKETPLACE",
      discountType: "PERCENTAGE",
      percentageBps: 1000,
      minimumPurchaseInCents: 10000,
      startsAt: daysAgo(130),
      endsAt: daysAhead(45),
      globalUsageLimit: 1000,
      perCustomerUsageLimit: 1,
      fundedBy: "MARKETPLACE",
    },
    {
      code: "REVIEW-FRETE15-EXPIRADO",
      ownerType: "MARKETPLACE",
      discountType: "FIXED_AMOUNT",
      fixedAmountInCents: 1500,
      minimumPurchaseInCents: 8000,
      startsAt: daysAgo(90),
      endsAt: daysAgo(10),
      globalUsageLimit: 300,
      perCustomerUsageLimit: 1,
      fundedBy: "MARKETPLACE",
    },
    {
      code: "REVIEW-BLACKFRIDAY20",
      ownerType: "MARKETPLACE",
      discountType: "PERCENTAGE",
      percentageBps: 2000,
      minimumPurchaseInCents: 30000,
      startsAt: daysAhead(45),
      endsAt: daysAhead(50),
      globalUsageLimit: 2000,
      perCustomerUsageLimit: 1,
      fundedBy: "MARKETPLACE",
    },
    {
      code: "REVIEW-BOASVINDAS-INATIVO",
      ownerType: "MARKETPLACE",
      discountType: "FIXED_AMOUNT",
      fixedAmountInCents: 3000,
      minimumPurchaseInCents: 20000,
      active: false,
      fundedBy: "MARKETPLACE",
    },
    {
      code: "REVIEW-TRILHA10",
      ownerType: "SELLER",
      discountType: "PERCENTAGE",
      percentageBps: 1000,
      minimumPurchaseInCents: 0,
      startsAt: daysAgo(120),
      endsAt: daysAhead(30),
      globalUsageLimit: 200,
      perCustomerUsageLimit: 2,
      fundedBy: "SELLER",
      sellerId: stores.trilha.sellerId,
    },
    {
      code: "REVIEW-RACING50-EXPIRADO",
      ownerType: "SELLER",
      discountType: "FIXED_AMOUNT",
      fixedAmountInCents: 5000,
      minimumPurchaseInCents: 50000,
      startsAt: daysAgo(60),
      endsAt: daysAgo(20),
      fundedBy: "SELLER",
      sellerId: stores.racing.sellerId,
    },
    {
      code: "REVIEW-CROSS5-INATIVO",
      ownerType: "SELLER",
      discountType: "PERCENTAGE",
      percentageBps: 500,
      minimumPurchaseInCents: 0,
      active: false,
      fundedBy: "SELLER",
      sellerId: stores.cross.sellerId,
    },
  ];
  const ids = new Map<string, string>();
  for (const coupon of coupons) {
    const existing = await db.coupon.findUnique({ where: { code: coupon.code } });
    const row = existing ?? (await db.coupon.create({ data: coupon }));
    track("Coupon", !existing);
    ids.set(coupon.code, row.id);
  }
  return ids;
}

async function ensureOrders(
  stores: Awaited<ReturnType<typeof ensureStores>>,
  variants: Map<string, VariantRef>,
  clienteId: string,
  couponIds: Map<string, string>,
) {
  const cliente = users.cliente;
  const result = new Map<
    string,
    { orderId: string; sellerOrders: Map<StoreKey, { id: string; itemIds: Map<string, string>; amount: number }> }
  >();
  let guestLink = "";

  for (const spec of orders) {
    if (!spec.orderNumber.startsWith(REVIEW_ORDER_PREFIX)) throw new Error("Unsafe order number");
    const existing = await db.order.findUnique({
      where: { orderNumber: spec.orderNumber },
      include: { sellerOrders: { include: { items: true, store: true } } },
    });

    if (existing) {
      if (!existing.customerEmail.endsWith(REVIEW_EMAIL_DOMAIN)) throw new Error(`Unrelated order ${spec.orderNumber}`);
      track("Order", false);
      const sellerOrders = new Map<StoreKey, { id: string; itemIds: Map<string, string>; amount: number }>();
      for (const so of existing.sellerOrders) {
        const key = must(
          (Object.keys(storeDefinitions) as StoreKey[]).find((k) => storeDefinitions[k].slug === so.store.slug),
          `store key for ${so.store.slug}`,
        );
        sellerOrders.set(key, {
          id: so.id,
          itemIds: new Map(so.items.map((item) => [item.skuSnapshot, item.id])),
          amount: so.itemsSubtotalInCents - so.discountAmountInCents,
        });
      }
      result.set(spec.orderNumber, { orderId: existing.id, sellerOrders });
      if (spec.guest) {
        const token = randomBytes(32).toString("hex");
        await db.order.update({ where: { id: existing.id }, data: { guestAccessTokenHash: hashGuestToken(token) } });
        guestLink = `${APP_BASE_URL}/orders/${spec.orderNumber}?accessToken=${token}`;
      }
      continue;
    }

    const placedAt = daysAgo(spec.placedDaysAgo);
    const guestToken = spec.guest ? randomBytes(32).toString("hex") : null;
    const partTotals = spec.parts.map((part) => {
      const lines = part.items.map((item) => {
        const variant = must(variants.get(item.sku), `variant ${item.sku}`);
        const unit = item.unitPriceInCents ?? variant.priceInCents;
        const gross = unit * item.quantity;
        const discount = item.discountInCents ?? 0;
        return { item, variant, unit, gross, discount, total: gross - discount };
      });
      const subtotal = lines.reduce((sum, line) => sum + line.gross, 0);
      const discount = lines.reduce((sum, line) => sum + line.discount, 0);
      if (discount !== (part.marketplaceDiscountInCents ?? 0))
        throw new Error(`Discount mismatch in ${spec.orderNumber}`);
      const shipping = shippingByStore[part.store];
      const bps = stores[part.store].commissionBps;
      const commissionInCents = commission(subtotal, bps);
      return { part, lines, subtotal, discount, shipping, bps, commissionInCents };
    });
    const itemsSubtotal = partTotals.reduce((sum, p) => sum + p.subtotal, 0);
    const discountTotal = partTotals.reduce((sum, p) => sum + p.discount, 0);
    const shippingTotal = partTotals.reduce((sum, p) => sum + p.shipping.price, 0);
    const total = itemsSubtotal - discountTotal + shippingTotal;

    const created = await db.$transaction(
      async (tx) => {
        const order = await tx.order.create({
          data: {
            orderNumber: spec.orderNumber,
            status: spec.status,
            customerName: spec.guest?.name ?? cliente.name,
            customerEmail: spec.guest?.email ?? cliente.email,
            customerPhone: spec.guest?.phone ?? "11987654321",
            guestAccessTokenHash: guestToken ? hashGuestToken(guestToken) : null,
            userId: spec.guest ? null : clienteId,
            itemsSubtotalInCents: itemsSubtotal,
            discountAmountInCents: discountTotal,
            shippingAmountInCents: shippingTotal,
            customerShippingAmountInCents: shippingTotal,
            totalAmountInCents: total,
            placedAt,
            createdAt: placedAt,
            shippingAddress: {
              create: spec.guest
                ? {
                    recipient: spec.guest.name,
                    postalCode: "13015100",
                    street: "Rua Barão de Jaguara",
                    number: "900",
                    neighborhood: "Centro",
                    city: "Campinas",
                    state: "SP",
                  }
                : {
                    recipient: cliente.name,
                    postalCode: "01310100",
                    street: "Avenida Paulista",
                    number: "1000",
                    complement: "Apto 52",
                    neighborhood: "Bela Vista",
                    city: "São Paulo",
                    state: "SP",
                  },
            },
          },
        });

        const sellerOrders = new Map<StoreKey, { id: string; itemIds: Map<string, string>; amount: number }>();
        for (const p of partTotals) {
          const store = stores[p.part.store];
          const sellerOrder = await tx.sellerOrder.create({
            data: {
              orderId: order.id,
              sellerId: store.sellerId,
              storeId: store.id,
              storeNameSnapshot: store.name,
              status: p.part.status,
              itemsSubtotalInCents: p.subtotal,
              discountAmountInCents: p.discount,
              marketplaceDiscountInCents: p.discount,
              sellerDiscountInCents: 0,
              shippingAmountInCents: p.shipping.price,
              customerShippingAmountInCents: p.shipping.price,
              commissionBps: p.bps,
              marketplaceCommissionInCents: p.commissionInCents,
              sellerNetAmountInCents: p.subtotal - p.commissionInCents,
              createdAt: placedAt,
            },
          });
          const shipped = ["SHIPPED", "DELIVERED"].includes(p.part.shipment.status);
          await tx.shipment.create({
            data: {
              sellerOrderId: sellerOrder.id,
              provider: "OWN",
              serviceCode: `own:review-${p.part.store}`,
              carrier: store.name.replace(" · demonstração", ""),
              service: p.shipping.name,
              priceInCents: p.shipping.price,
              estimatedDeliveryDays: p.shipping.days,
              status: p.part.shipment.status,
              trackingCode: p.part.shipment.trackingCode ?? null,
              shippedAt: shipped ? new Date(placedAt.getTime() + 2 * DAY) : null,
              deliveredAt: p.part.shipment.status === "DELIVERED" ? new Date(placedAt.getTime() + 5 * DAY) : null,
              createdAt: placedAt,
            },
          });
          const itemIds = new Map<string, string>();
          for (const line of p.lines) {
            const item = await tx.orderItem.create({
              data: {
                sellerOrderId: sellerOrder.id,
                sellerId: store.sellerId,
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
                unitPriceInCents: line.unit,
                quantity: line.item.quantity,
                discountAmountInCents: line.discount,
                totalAmountInCents: line.total,
                createdAt: placedAt,
              },
            });
            itemIds.set(line.variant.sku, item.id);
          }
          sellerOrders.set(p.part.store, { id: sellerOrder.id, itemIds, amount: p.subtotal - p.discount });
        }

        const approved = spec.payment.status === "APPROVED";
        const paidAt = approved ? new Date(placedAt.getTime() + 5 * 60 * 1000) : null;
        await tx.payment.create({
          data: {
            orderId: order.id,
            provider: "MERCADO_PAGO",
            externalId: spec.payment.status === "PENDING" ? null : `REVIEW-PAY-${spec.orderNumber.slice(-4)}`,
            method: spec.payment.method,
            status: spec.payment.status,
            amountInCents: total,
            providerMetadata: { source: "review-seed", note: "Pagamento fictício para revisão visual" },
            authorizedAt: paidAt,
            paidAt,
            failedAt: spec.payment.status === "CANCELLED" ? new Date(placedAt.getTime() + DAY) : null,
            createdAt: placedAt,
            transactions: {
              create: {
                type: "AUTHORIZATION",
                status:
                  spec.payment.status === "PENDING"
                    ? "PENDING"
                    : spec.payment.status === "APPROVED"
                      ? "SUCCEEDED"
                      : "FAILED",
                idempotencyKey: `review-tx-${spec.orderNumber}`,
                amountInCents: total,
                processedAt: spec.payment.status === "PENDING" ? null : (paidAt ?? new Date(placedAt.getTime() + DAY)),
                createdAt: placedAt,
              },
            },
          },
        });

        if (spec.couponCode) {
          await tx.couponRedemption.create({
            data: {
              couponId: must(couponIds.get(spec.couponCode), `coupon ${spec.couponCode}`),
              orderId: order.id,
              userId: spec.guest ? null : clienteId,
              customerEmailSnapshot: spec.guest?.email ?? cliente.email,
              discountAmountInCents: discountTotal,
              redeemedAt: placedAt,
            },
          });
          track("CouponRedemption", true);
        }

        // Pedido aguardando pagamento mantém reserva rastreável do estoque.
        if (spec.status === "PENDING_PAYMENT") {
          for (const line of partTotals.flatMap((p) => p.lines)) {
            const inventory = await tx.inventory.update({
              where: { id: line.variant.inventoryId },
              data: {
                availableQuantity: { decrement: line.item.quantity },
                reservedQuantity: { increment: line.item.quantity },
                version: { increment: 1 },
              },
            });
            await tx.inventoryMovement.create({
              data: {
                type: "RESERVATION",
                quantityChange: -line.item.quantity,
                availableQuantityAfter: inventory.availableQuantity,
                reservedQuantityAfter: inventory.reservedQuantity,
                referenceType: "ORDER",
                referenceId: order.id,
                reason: `Reserva do pedido ${spec.orderNumber}`,
                inventoryId: inventory.id,
                variantId: line.variant.id,
                sellerId: line.variant.sellerId,
              },
            });
            track("InventoryMovement", true);
          }
        }
        return { orderId: order.id, sellerOrders };
      },
      { timeout: 30_000 },
    );
    track("Order", true);
    result.set(spec.orderNumber, created);
    if (guestToken) guestLink = `${APP_BASE_URL}/orders/${spec.orderNumber}?accessToken=${guestToken}`;
  }
  return { orders: result, guestLink };
}

async function ensurePostSale(
  stores: Awaited<ReturnType<typeof ensureStores>>,
  userIds: Record<UserKey, string>,
  orderRefs: Awaited<ReturnType<typeof ensureOrders>>["orders"],
  productIds: Map<string, string>,
) {
  const clienteId = userIds.cliente;
  const garagem = stores.garagem;
  const delivered = must(orderRefs.get("MS-REVIEW-0005"), "order MS-REVIEW-0005");
  const deliveredSo = must(delivered.sellerOrders.get("garagem"), "garagem seller order");
  const paid = must(orderRefs.get("MS-REVIEW-0002"), "order MS-REVIEW-0002");
  const paidSo = must(paid.sellerOrders.get("garagem"), "garagem seller order");
  const shipped = must(orderRefs.get("MS-REVIEW-0004"), "order MS-REVIEW-0004");
  const shippedSo = must(shipped.sellerOrders.get("garagem"), "garagem seller order");

  // Devolução solicitada (por item) no pedido entregue.
  const discoItemId = must(deliveredSo.itemIds.get("REVIEW-GMX-ONDA-260"), "order item REVIEW-GMX-ONDA-260");
  const returnKey = "review-return-MS-REVIEW-0005";
  const existingReturn = await db.returnRequest.findUnique({ where: { idempotencyKey: returnKey } });
  if (!existingReturn)
    await db.returnRequest.create({
      data: {
        idempotencyKey: returnKey,
        status: "REQUESTED",
        reason: "Produto diferente do anunciado",
        customerMessage: "O disco chegou com furação diferente da foto e não encaixou na CRF 250R 2025.",
        amountInCents: 32990,
        orderId: delivered.orderId,
        sellerOrderId: deliveredSo.id,
        sellerId: garagem.sellerId,
        requesterUserId: clienteId,
        createdAt: daysAgo(2),
        items: {
          create: { orderItemId: discoItemId, quantity: 1, sellerOrderId: deliveredSo.id, sellerId: garagem.sellerId },
        },
      },
    });
  track("ReturnRequest", !existingReturn);

  // Solicitação de cancelamento no pedido pago.
  const cancelKey = "review-cancel-MS-REVIEW-0002";
  const existingCancel = await db.cancellationRequest.findUnique({ where: { idempotencyKey: cancelKey } });
  if (!existingCancel)
    await db.cancellationRequest.create({
      data: {
        idempotencyKey: cancelKey,
        status: "REQUESTED",
        reason: "Comprei a carga errada",
        customerMessage: "Preciso da mola 0,48 kg/mm. Posso cancelar e refazer o pedido?",
        amountInCents: paidSo.amount + shippingByStore.garagem.price,
        previousSellerOrderStatus: "PAID",
        orderId: paid.orderId,
        sellerOrderId: paidSo.id,
        sellerId: garagem.sellerId,
        requesterUserId: clienteId,
        createdAt: daysAgo(0.5),
      },
    });
  track("CancellationRequest", !existingCancel);

  // Disputa aberta no pedido enviado.
  const disputeKey = "review-dispute-MS-REVIEW-0004";
  const existingDispute = await db.dispute.findUnique({ where: { idempotencyKey: disputeKey } });
  if (!existingDispute)
    await db.dispute.create({
      data: {
        idempotencyKey: disputeKey,
        status: "OPEN",
        reason: "Rastreamento sem atualização",
        description: "O rastreio não muda há três dias e a loja ainda não respondeu às perguntas sobre a entrega.",
        orderId: shipped.orderId,
        sellerOrderId: shippedSo.id,
        sellerId: garagem.sellerId,
        requesterUserId: clienteId,
        createdAt: daysAgo(1),
      },
    });
  track("Dispute", !existingDispute);

  // Avaliações de compra verificada.
  const helmetItemId = must(deliveredSo.itemIds.get("REVIEW-GMX-APEX-M"), "order item REVIEW-GMX-APEX-M");
  const existingProductReview = await db.productReview.findUnique({ where: { orderItemId: helmetItemId } });
  if (!existingProductReview)
    await db.productReview.create({
      data: {
        ratingTenths: 45,
        title: "Confortável e bem ventilado",
        comment: "Usei em duas baterias com calor forte e a ventilação deu conta. O tamanho M ficou certinho.",
        productId: must(productIds.get("review-capacete-apex-pro"), "product review-capacete-apex-pro"),
        sellerId: garagem.sellerId,
        orderId: delivered.orderId,
        orderItemId: helmetItemId,
        userId: clienteId,
        createdAt: daysAgo(3),
      },
    });
  track("ProductReview", !existingProductReview);

  const sellerReviewWhere = {
    orderId_sellerId_userId: { orderId: delivered.orderId, sellerId: garagem.sellerId, userId: clienteId },
  };
  const existingSellerReview = await db.sellerReview.findUnique({ where: sellerReviewWhere });
  if (!existingSellerReview)
    await db.sellerReview.create({
      data: {
        rating: 5,
        comment: "Entrega rápida e embalagem caprichada.",
        sellerId: garagem.sellerId,
        orderId: delivered.orderId,
        userId: clienteId,
        createdAt: daysAgo(3),
      },
    });
  track("SellerReview", !existingSellerReview);

  // Perguntas públicas.
  const questions = [
    {
      slug: "review-capacete-apex-pro",
      question: "Dá para usar óculos de grau por baixo dos óculos de motocross com esse capacete?",
      answer:
        "Oi, Carla! A abertura frontal é ampla e funciona com a maioria dos óculos OTG. Recomendamos o tamanho exato da tabela.",
    },
    {
      slug: "review-kit-relacao-crf-250r",
      question: "Serve na CRF 250R 2023? Não aparece na compatibilidade.",
      answer: null,
    },
  ];
  for (const entry of questions) {
    const productId = must(productIds.get(entry.slug), `product ${entry.slug}`);
    const existing = await db.productQuestion.findFirst({
      where: { productId, askedByUserId: clienteId, question: entry.question },
    });
    if (!existing)
      await db.productQuestion.create({
        data: {
          productId,
          sellerId: garagem.sellerId,
          askedByUserId: clienteId,
          question: entry.question,
          answer: entry.answer,
          answeredAt: entry.answer ? daysAgo(4) : null,
          answeredByUserId: entry.answer ? userIds.lojista : null,
          createdAt: daysAgo(entry.answer ? 5 : 1),
        },
      });
    track("ProductQuestion", !existing);
  }

  // Auditoria administrativa e operacional.
  const audits: Array<{
    actor: UserKey;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Prisma.InputJsonValue;
    daysAgo: number;
  }> = [
    {
      actor: "admin",
      action: "SELLER_APPROVED",
      entityType: "Seller",
      entityId: garagem.sellerId,
      metadata: { source: "review-seed", previousStatus: "PENDING", status: "ACTIVE" },
      daysAgo: 59,
    },
    {
      actor: "admin",
      action: "SELLER_APPROVED",
      entityType: "Seller",
      entityId: stores.box77.sellerId,
      metadata: { source: "review-seed", previousStatus: "PENDING", status: "APPROVED" },
      daysAgo: 58,
    },
    {
      actor: "admin",
      action: "SELLER_COMMISSION_UPDATED",
      entityType: "Seller",
      entityId: stores.box77.sellerId,
      metadata: { source: "review-seed", previousCommissionBps: null, commissionBps: 1000 },
      daysAgo: 57,
    },
    {
      actor: "admin",
      action: "SELLER_VIP_ACTIVATED",
      entityType: "Seller",
      entityId: garagem.sellerId,
      metadata: { source: "review-seed", plan: "VIP" },
      daysAgo: 10,
    },
    {
      actor: "admin",
      action: "PRODUCT_APPROVED",
      entityType: "Product",
      entityId: must(productIds.get("review-capacete-apex-pro"), "product review-capacete-apex-pro"),
      metadata: { source: "review-seed" },
      daysAgo: 38,
    },
    {
      actor: "admin",
      action: "PRODUCT_REJECTED",
      entityType: "Product",
      entityId: must(productIds.get("review-pedaleira-rejeitada"), "product review-pedaleira-rejeitada"),
      metadata: { source: "review-seed", reason: "Fotos insuficientes" },
      daysAgo: 38,
    },
    {
      actor: "lojista",
      action: "PRODUCT_ARCHIVED",
      entityType: "Product",
      entityId: must(productIds.get("review-guidao-arquivado"), "product review-guidao-arquivado"),
      metadata: { source: "review-seed" },
      daysAgo: 20,
    },
    {
      actor: "lojista",
      action: "SELLER_ORDER_STATUS_CHANGED",
      entityType: "SellerOrder",
      entityId: shippedSo.id,
      metadata: { source: "review-seed", from: "PAID", to: "SHIPPED" },
      daysAgo: 4,
    },
    {
      actor: "lojista",
      action: "SELLER_MEMBER_ADDED",
      entityType: "SellerMember",
      entityId: userIds.catalogo,
      metadata: { source: "review-seed", role: "CATALOG" },
      daysAgo: 30,
    },
  ];
  for (const audit of audits) {
    const actorUserId = userIds[audit.actor];
    const existing = await db.auditLog.findFirst({
      where: { actorUserId, action: audit.action, entityId: audit.entityId },
    });
    if (!existing)
      await db.auditLog.create({
        data: {
          actorUserId,
          action: audit.action,
          entityType: audit.entityType,
          entityId: audit.entityId,
          metadata: audit.metadata,
          createdAt: daysAgo(audit.daysAgo),
        },
      });
    track("AuditLog", !existing);
  }

  // Notificações (uma enviada, uma com falha) e webhook com falha (somente metadados).
  const notifications: Prisma.NotificationDeliveryCreateInput[] = [
    {
      eventKey: `review-notification:${shippedSo.id}:SHIPPED`,
      kind: "SELLER_ORDER_SHIPPED",
      recipientEmail: users.cliente.email,
      subject: "Seu pedido MS-REVIEW-0004 foi enviado",
      status: "FAILED",
      error: "Provider de e-mail não configurado (dados de revisão).",
      createdAt: daysAgo(4),
    },
    {
      eventKey: `review-notification:${delivered.orderId}:PAYMENT_APPROVED`,
      kind: "ORDER_PAYMENT_APPROVED",
      recipientEmail: users.cliente.email,
      subject: "Pagamento aprovado · MS-REVIEW-0005",
      status: "SENT",
      providerId: "review-email-0005",
      sentAt: daysAgo(12),
      createdAt: daysAgo(12),
    },
  ];
  for (const notification of notifications) {
    const existing = await db.notificationDelivery.findUnique({ where: { eventKey: notification.eventKey } });
    if (!existing) await db.notificationDelivery.create({ data: notification });
    track("NotificationDelivery", !existing);
  }

  const webhookWhere = { provider_externalId: { provider: "MERCADO_PAGO", externalId: "review-webhook-0001" } };
  const existingWebhook = await db.webhookEvent.findUnique({ where: webhookWhere });
  if (!existingWebhook)
    await db.webhookEvent.create({
      data: {
        provider: "MERCADO_PAGO",
        externalId: "review-webhook-0001",
        type: "payment",
        payload: { source: "review-seed", action: "payment.updated", data: { id: "REVIEW-PAY-0002" } },
        status: "FAILED",
        error: "Pagamento não encontrado no provider (evento fictício de revisão).",
        receivedAt: daysAgo(1),
      },
    });
  track("WebhookEvent", !existingWebhook);
}

async function main() {
  const passwordHash = await hashPassword(requireEnv("REVIEW_ACCOUNTS_PASSWORD"));
  const userIds = await ensureUsers(passwordHash);
  const stores = await ensureStores(userIds);
  const { variants, productIds, findFitment } = await ensureProducts(stores, userIds);
  await ensureCustomerData(userIds.cliente, variants, productIds, findFitment);
  const couponIds = await ensureCoupons(stores);
  const { orders: orderRefs, guestLink } = await ensureOrders(stores, variants, userIds.cliente, couponIds);
  await ensurePostSale(stores, userIds, orderRefs, productIds);

  // Conjunto ampliado: mais lojas/produtos/pedidos/avaliações e histórico das contas de visualização.
  const expanded = await seedExpandedData({
    db,
    now,
    stores: {
      garagem: stores.garagem,
      box77: stores.box77,
      trilha: stores.trilha,
      racing: stores.racing,
      areia: stores.areia,
      cross: stores.cross,
    },
    storeOwnerIds: {
      garagem: userIds.lojista,
      box77: userIds.lojista2,
      trilha: userIds.lojista3,
      racing: userIds.lojista4,
      areia: userIds.lojista5,
      cross: userIds.lojista6,
    },
    adminUserId: userIds.admin,
    passwordHash,
    shippingByStore,
    commission,
    hashGuestToken,
    trackMany,
    viewerCustomerEmails: parseEmailList(process.env.REVIEW_VIEWER_CUSTOMER_EMAILS),
    viewerSellerEmails: parseEmailList(process.env.REVIEW_VIEWER_SELLER_EMAILS),
    notice: NOTICE,
  });

  // 13/10/2026: variant gender/color/size, coupons shown on the product page and one campaign.
  await ensureReviewVariantColumns(db, trackMany);
  await ensureReviewCouponsAndCampaign(db, {
    sellers: { garagem: stores.garagem.sellerId, box77: stores.box77.sellerId },
    now,
    track: trackMany,
  });

  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase());
  console.log(JSON.stringify(counts, null, 2));
  console.log(
    `\nContas: ${Object.values(users)
      .map((user) => user.email)
      .join(", ")}`,
  );
  console.log("Senha: valor de REVIEW_ACCOUNTS_PASSWORD (.env.local).");
  if (!adminEmails.includes(users.admin.email))
    console.log(
      `Admin: para revisar /admin num servidor local, adicione ${users.admin.email} em ADMIN_EMAILS do .env.local e reinicie. Nunca coloque contas review.* em ADMIN_EMAILS da produção.`,
    );
  console.log(`\nAcompanhamento do pedido convidado (token renovado a cada execução):\n${guestLink}`);
  console.log(
    `\nConjunto ampliado: ${expanded.approvedProducts} produtos aprovados novos, ${expanded.orders} pedidos planejados, ` +
      `${expanded.viewerCustomers} conta(s) de visualização de cliente. Lojas publicadas: ${PUBLISH_STORES ? "sim" : "não (PENDING)"}.`,
  );
  console.log("Clientes extras: review.cliente2 … review.cliente13@example.test (mesma senha).");
}

try {
  await main();
} finally {
  await db.$disconnect();
}
