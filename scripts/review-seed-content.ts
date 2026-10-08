/**
 * Conteúdo fictício (catálogo, clientes, textos) do conjunto AMPLIADO de dados de revisão visual.
 * Usado por scripts/seed-review-data.ts. Nada aqui é dado real: lojas, produtos, preços, avaliações
 * e perguntas existem só para revisar as telas do O Moto Shop antes do lançamento.
 */

/** Lojas do conjunto ampliado (as chaves "garagem" e "box77" já existem no seed original). */
export type ReviewStoreCode = "garagem" | "box77" | "trilha" | "racing" | "areia" | "cross";

export type ProductTemplate = {
  /** Parte do slug (`review-<key>`) e base do SKU. */
  key: string;
  name: string;
  description: string;
  store: ReviewStoreCode;
  categorySlug: string;
  /** Marca preferida; se não existir/estiver inativa, o seed usa outra marca ativa. */
  brandSlug: string;
  priceInCents: number;
  weightInGrams: number;
  dimensions: [number, number, number];
  axis: string;
  options: string[];
  color?: string;
  /** Acréscimo de preço por opção (mesma ordem de `options`). */
  priceSteps?: number[];
  status?: "DRAFT" | "SUBMITTED" | "REJECTED" | "ARCHIVED";
  rejectionReason?: string;
  /** Usa compatibilidade com motos (peças). */
  fitment?: boolean;
};

const HELMET = ["P", "M", "G", "GG"];
const BOOT = ["39", "40", "41", "42", "43"];
const APPAREL = ["P", "M", "G", "GG"];

export const productTemplates: ProductTemplate[] = [
  // Capacetes
  { key: "capacete-vortex-carbon", name: "Capacete off-road Vortex Carbon", description: "Casco em fibra de carbono, pala com regulagem sem ferramentas e sistema de liberação rápida das almofadas.", store: "cross", categorySlug: "equipment-helmets", brandSlug: "apex-demo", priceInCents: 289990, weightInGrams: 1350, dimensions: [310, 270, 400], axis: "tamanho", options: HELMET, color: "Branco/preto" },
  { key: "capacete-junior-kid-cross", name: "Capacete infantil Kid Cross", description: "Capacete leve para pilotos mirins, com forração antialérgica e fivela micrométrica.", store: "garagem", categorySlug: "equipment-helmets", brandSlug: "apex-demo", priceInCents: 49990, weightInGrams: 1100, dimensions: [280, 240, 360], axis: "tamanho", options: ["PP", "P", "M"], color: "Azul/amarelo" },
  { key: "capacete-enduro-trail-vision", name: "Capacete enduro Trail Vision com viseira", description: "Capacete com viseira transparente e pala removível para trilhas longas e uso misto.", store: "trilha", categorySlug: "equipment-helmets", brandSlug: "terra-demo", priceInCents: 159990, weightInGrams: 1550, dimensions: [320, 280, 410], axis: "tamanho", options: HELMET, color: "Cinza fosco" },
  { key: "capacete-strike-mips", name: "Capacete off-road Strike com MIPS", description: "Camada de proteção rotacional, ventilação com 14 entradas e forração em tecido respirável.", store: "cross", categorySlug: "equipment-helmets", brandSlug: "apex-demo", priceInCents: 219990, weightInGrams: 1420, dimensions: [310, 270, 400], axis: "tamanho", options: ["M", "G", "GG"], color: "Laranja/preto" },
  { key: "capacete-pro-lite", name: "Capacete off-road Pro Lite", description: "Casco em policarbonato injetado com ótimo custo-benefício para quem está começando.", store: "areia", categorySlug: "equipment-helmets", brandSlug: "apex-demo", priceInCents: 69990, weightInGrams: 1600, dimensions: [310, 270, 400], axis: "tamanho", options: HELMET, color: "Preto fosco" },
  // Botas
  { key: "bota-pro-tech-hinge", name: "Bota off-road Pro Tech com articulação", description: "Articulação lateral com dupla dobradiça, fivelas em alumínio e sola de borracha substituível.", store: "cross", categorySlug: "equipment-boots", brandSlug: "terra-demo", priceInCents: 249990, weightInGrams: 4600, dimensions: [390, 330, 550], axis: "tamanho", options: BOOT, color: "Preto/branco" },
  { key: "bota-junior-rookie", name: "Bota infantil Rookie", description: "Bota para pilotos mirins com três fivelas, biqueira reforçada e entrada facilitada.", store: "garagem", categorySlug: "equipment-boots", brandSlug: "terra-demo", priceInCents: 59990, weightInGrams: 2600, dimensions: [330, 280, 450], axis: "tamanho", options: ["33", "34", "35", "36"], color: "Preto/laranja" },
  { key: "bota-enduro-waterproof", name: "Bota enduro impermeável Dry Trail", description: "Membrana impermeável, forro respirável e cano alto para travessias de rio e lama.", store: "trilha", categorySlug: "equipment-boots", brandSlug: "terra-demo", priceInCents: 139990, weightInGrams: 4200, dimensions: [390, 330, 550], axis: "tamanho", options: BOOT.slice(1), color: "Marrom" },
  { key: "bota-adventure-rally", name: "Bota Adventure Rally", description: "Bota de cano médio para rally e trilhas longas, com zíper lateral e proteção de canela.", store: "racing", categorySlug: "equipment-boots", brandSlug: "apex-demo", priceInCents: 179990, weightInGrams: 3800, dimensions: [380, 320, 520], axis: "tamanho", options: ["40", "41", "42"], color: "Preto" },
  // Óculos
  { key: "oculos-clear-shot", name: "Óculos off-road Clear Shot", description: "Lente transparente antiembaçante, espuma tripla e faixa de silicone antiderrapante.", store: "areia", categorySlug: "equipment-goggles", brandSlug: "terra-demo", priceInCents: 18990, weightInGrams: 380, dimensions: [120, 120, 260], axis: "cor", options: ["Preto", "Branco", "Laranja"] },
  { key: "oculos-mirror-lens", name: "Óculos off-road com lente espelhada", description: "Lente espelhada para dias de sol forte e armação flexível que acompanha o capacete.", store: "cross", categorySlug: "equipment-goggles", brandSlug: "apex-demo", priceInCents: 29990, weightInGrams: 400, dimensions: [120, 120, 260], axis: "lente", options: ["Espelhada azul", "Espelhada dourada", "Fumê"] },
  { key: "oculos-junior-mini", name: "Óculos infantil Mini", description: "Óculos de tamanho reduzido para capacetes infantis, com lente transparente.", store: "garagem", categorySlug: "equipment-goggles", brandSlug: "apex-demo", priceInCents: 11990, weightInGrams: 280, dimensions: [100, 110, 220], axis: "cor", options: ["Azul", "Rosa"] },
  { key: "oculos-roll-off-lama", name: "Óculos com sistema roll-off para lama", description: "Sistema de filme roll-off de 48 mm para provas com muita lama, com lente dupla.", store: "racing", categorySlug: "equipment-goggles", brandSlug: "apex-demo", priceInCents: 42990, weightInGrams: 520, dimensions: [140, 130, 280], axis: "kit", options: ["Óculos + roll-off", "Óculos + roll-off + 6 filmes"], priceSteps: [0, 6000] },
  // Equipamentos (proteções)
  { key: "colete-roost-guard", name: "Colete de proteção Roost Guard", description: "Colete com placas frontais e traseiras ventiladas, compatível com camisa por cima.", store: "trilha", categorySlug: "equipment", brandSlug: "terra-demo", priceInCents: 69990, weightInGrams: 1700, dimensions: [120, 400, 500], axis: "tamanho", options: ["P/M", "G/GG"] },
  { key: "joelheira-articulada-flex", name: "Joelheira articulada Flex", description: "Joelheira com articulação lateral, conchas em polímero e tiras de velcro largas.", store: "cross", categorySlug: "equipment", brandSlug: "apex-demo", priceInCents: 39990, weightInGrams: 900, dimensions: [120, 220, 380], axis: "tamanho", options: ["P/M", "G/GG"] },
  { key: "cinta-lombar-kidney", name: "Cinta lombar Kidney", description: "Cinta de suporte lombar com fecho em velcro duplo e painel respirável.", store: "box77", categorySlug: "equipment", brandSlug: "terra-demo", priceInCents: 15990, weightInGrams: 450, dimensions: [80, 200, 300], axis: "tamanho", options: ["P", "M", "G"] },
  // Vestuário
  { key: "camisa-sprint-air", name: "Camisa de motocross Sprint Air", description: "Camisa em tecido leve com painéis perfurados nas laterais e punhos elásticos.", store: "trilha", categorySlug: "apparel", brandSlug: "terra-demo", priceInCents: 21990, weightInGrams: 250, dimensions: [30, 250, 300], axis: "tamanho", options: APPAREL, color: "Laranja/preto" },
  { key: "calca-race-fit", name: "Calça de motocross Race Fit", description: "Calça com painéis de couro nos joelhos, elastano nas costas e ajuste de cintura com catraca.", store: "cross", categorySlug: "apparel", brandSlug: "apex-demo", priceInCents: 54990, weightInGrams: 700, dimensions: [50, 300, 350], axis: "tamanho", options: ["38", "40", "42", "44"], color: "Preto/branco" },
  { key: "conjunto-infantil-mini-mx", name: "Conjunto infantil Mini MX (camisa + calça)", description: "Conjunto de camisa e calça para pilotos mirins com tecido resistente à abrasão.", store: "garagem", categorySlug: "apparel", brandSlug: "terra-demo", priceInCents: 39990, weightInGrams: 800, dimensions: [60, 300, 350], axis: "tamanho", options: ["6", "8", "10", "12"], color: "Azul/branco" },
  { key: "luva-air-mesh", name: "Luva de motocross Air Mesh", description: "Luva com dorso em malha respirável, palma única sem costuras e dedos com silicone.", store: "box77", categorySlug: "apparel", brandSlug: "terra-demo", priceInCents: 14990, weightInGrams: 120, dimensions: [30, 120, 250], axis: "tamanho", options: ["P", "M", "G"], color: "Preto/laranja" },
  { key: "jaqueta-enduro-impermeavel", name: "Jaqueta enduro impermeável", description: "Jaqueta com mangas removíveis, bolsos de hidratação e costuras seladas.", store: "trilha", categorySlug: "apparel", brandSlug: "apex-demo", priceInCents: 79990, weightInGrams: 1300, dimensions: [80, 350, 450], axis: "tamanho", options: ["M", "G", "GG"], color: "Cinza/laranja" },
  { key: "meia-longa-tecnica", name: "Meia longa técnica para bota", description: "Meia de cano alto com reforço na canela e tecido que reduz o atrito com a bota.", store: "areia", categorySlug: "apparel", brandSlug: "terra-demo", priceInCents: 6990, weightInGrams: 100, dimensions: [20, 100, 300], axis: "tamanho", options: ["39-41", "42-44"] },
  { key: "bermuda-segunda-pele", name: "Bermuda segunda pele com proteção", description: "Bermuda de compressão com espuma no quadril e cóccix para usar por baixo da calça.", store: "racing", categorySlug: "apparel", brandSlug: "terra-demo", priceInCents: 18990, weightInGrams: 300, dimensions: [30, 250, 300], axis: "tamanho", options: ["P", "M", "G"] },
  // Transmissão
  { key: "coroa-aco-50-dentes", name: "Coroa de aço 50 dentes", description: "Coroa em aço tratado termicamente, passo 520, com furação original.", store: "box77", categorySlug: "parts-transmission", brandSlug: "apex-demo", priceInCents: 22990, weightInGrams: 900, dimensions: [20, 250, 250], axis: "dentes", options: ["48", "49", "50", "51"], fitment: true },
  { key: "pinhao-13-dentes", name: "Pinhão de aço passo 520", description: "Pinhão em aço cromo-molibdênio com perfil autolimpante.", store: "box77", categorySlug: "parts-transmission", brandSlug: "terra-demo", priceInCents: 6990, weightInGrams: 150, dimensions: [20, 80, 80], axis: "dentes", options: ["12", "13", "14"], fitment: true },
  { key: "guia-corrente-reforcada", name: "Guia de corrente reforçada", description: "Guia de corrente com corpo em alumínio e deslizador de polietileno de alta densidade.", store: "racing", categorySlug: "parts-transmission", brandSlug: "apex-demo", priceInCents: 18990, weightInGrams: 400, dimensions: [40, 120, 200], axis: "cor", options: ["Preta", "Laranja"], fitment: true },
  { key: "kit-relacao-yz250f", name: "Kit relação YZ250F", description: "Kit com corrente 520 com retentores, coroa e pinhão para a YZ250F.", store: "racing", categorySlug: "parts-transmission", brandSlug: "apex-demo", priceInCents: 49990, weightInGrams: 2600, dimensions: [60, 260, 260], axis: "material", options: ["Aço", "Alumínio"], priceSteps: [0, 8000], fitment: true },
  { key: "deslizador-corrente", name: "Deslizador de corrente da balança", description: "Deslizador em polímero de baixo atrito que protege a balança contra o desgaste da corrente.", store: "garagem", categorySlug: "parts-transmission", brandSlug: "terra-demo", priceInCents: 8990, weightInGrams: 200, dimensions: [30, 60, 300], axis: "cor", options: ["Preto", "Branco"], fitment: true },
  // Suspensão
  { key: "kit-retentor-bengala", name: "Kit retentor e guarda-pó de bengala", description: "Par de retentores e guarda-pós para garfo de 48 mm.", store: "racing", categorySlug: "parts-suspension", brandSlug: "apex-demo", priceInCents: 15990, weightInGrams: 250, dimensions: [40, 120, 120], axis: "medida", options: ["48 mm"], fitment: true },
  { key: "oleo-suspensao-5w", name: "Óleo de suspensão 5W 1 litro", description: "Óleo sintético para garfo com viscosidade estável em altas temperaturas.", store: "box77", categorySlug: "parts-suspension", brandSlug: "terra-demo", priceInCents: 8990, weightInGrams: 1000, dimensions: [80, 80, 250], axis: "viscosidade", options: ["5W", "10W"] },
  { key: "protetor-bengala", name: "Protetor de bengala", description: "Par de protetores plásticos que preservam os tubos do garfo contra pedras e galhos.", store: "areia", categorySlug: "parts-suspension", brandSlug: "apex-demo", priceInCents: 12990, weightInGrams: 500, dimensions: [80, 120, 450], axis: "cor", options: ["Branco", "Preto", "Vermelho"], fitment: true },
  { key: "kit-rolamentos-link", name: "Kit de rolamentos do link da suspensão", description: "Kit completo de rolamentos, buchas e retentores do link da suspensão traseira.", store: "racing", categorySlug: "parts-suspension", brandSlug: "terra-demo", priceInCents: 26990, weightInGrams: 450, dimensions: [40, 120, 160], axis: "kit", options: ["Completo"], fitment: true },
  // Motor
  { key: "vela-ignicao-iridium", name: "Vela de ignição iridium", description: "Vela com eletrodo de iridium para partida mais fácil e queima estável.", store: "garagem", categorySlug: "parts-engine", brandSlug: "apex-demo", priceInCents: 5990, weightInGrams: 60, dimensions: [20, 30, 100], axis: "kit", options: ["Unidade", "Kit com 2"], priceSteps: [0, 5500], fitment: true },
  { key: "kit-pistao-250", name: "Kit pistão forjado 250", description: "Pistão forjado com anéis, pino e travas, medida padrão e sobremedida.", store: "racing", categorySlug: "parts-engine", brandSlug: "terra-demo", priceInCents: 89990, weightInGrams: 600, dimensions: [80, 120, 120], axis: "medida", options: ["76,96 mm", "76,97 mm", "76,98 mm"], fitment: true },
  { key: "filtro-oleo-reutilizavel", name: "Filtro de óleo em inox reutilizável", description: "Filtro lavável em malha de aço inox que substitui o filtro de papel.", store: "box77", categorySlug: "parts-engine", brandSlug: "apex-demo", priceInCents: 12990, weightInGrams: 80, dimensions: [30, 60, 60], axis: "kit", options: ["Unidade"], fitment: true },
  { key: "oleo-motor-4t-10w40", name: "Óleo de motor 4T 10W40 sintético 1 litro", description: "Óleo 100% sintético para motores quatro tempos de alta rotação.", store: "areia", categorySlug: "parts-engine", brandSlug: "terra-demo", priceInCents: 7490, weightInGrams: 1000, dimensions: [80, 80, 250], axis: "embalagem", options: ["1 litro", "Caixa com 4"], priceSteps: [0, 20000] },
  { key: "kit-juntas-cabecote", name: "Kit de juntas do cabeçote", description: "Juntas de cabeçote e tampa de válvulas com anéis de vedação.", store: "garagem", categorySlug: "parts-engine", brandSlug: "terra-demo", priceInCents: 18990, weightInGrams: 200, dimensions: [20, 150, 200], axis: "kit", options: ["Superior"], fitment: true },
  { key: "kit-discos-embreagem", name: "Kit de discos de embreagem", description: "Discos de fricção e separadores com molas reforçadas.", store: "racing", categorySlug: "parts-engine", brandSlug: "apex-demo", priceInCents: 59990, weightInGrams: 1200, dimensions: [40, 150, 150], axis: "kit", options: ["Discos", "Discos + molas"], priceSteps: [0, 9000], fitment: true },
  // Freios
  { key: "disco-traseiro-240", name: "Disco de freio traseiro 240 mm", description: "Disco traseiro ondulado em aço inox com furação original.", store: "box77", categorySlug: "parts-brakes", brandSlug: "terra-demo", priceInCents: 27990, weightInGrams: 700, dimensions: [30, 250, 250], axis: "medida", options: ["240 mm"], fitment: true },
  { key: "pastilha-traseira-sinter", name: "Pastilha de freio traseira sinterizada", description: "Jogo de pastilhas traseiras para uso em barro, areia e pista.", store: "areia", categorySlug: "parts-brakes", brandSlug: "apex-demo", priceInCents: 9990, weightInGrams: 150, dimensions: [20, 80, 100], axis: "composto", options: ["Sinterizada", "Orgânica"], fitment: true },
  { key: "manete-freio-articulada", name: "Manete de freio articulada", description: "Manete em alumínio forjado com ponta articulada que dobra em quedas.", store: "garagem", categorySlug: "parts-brakes", brandSlug: "apex-demo", priceInCents: 13990, weightInGrams: 120, dimensions: [20, 60, 200], axis: "cor", options: ["Preta", "Laranja", "Azul"], fitment: true },
  { key: "flexivel-freio-aeronautico", name: "Flexível de freio aeronáutico", description: "Mangueira em malha de aço com conexões em inox para resposta mais firme.", store: "racing", categorySlug: "parts-brakes", brandSlug: "terra-demo", priceInCents: 16990, weightInGrams: 180, dimensions: [20, 100, 300], axis: "posição", options: ["Dianteiro", "Traseiro"], fitment: true },
  // Acessórios
  { key: "manopla-grip-soft", name: "Manopla Grip Soft", description: "Par de manoplas em composto macio com padrão diamante para menos vibração.", store: "box77", categorySlug: "parts-accessories", brandSlug: "terra-demo", priceInCents: 7990, weightInGrams: 150, dimensions: [40, 80, 150], axis: "dureza", options: ["Macia", "Média"] },
  { key: "pedal-cambio-forjado", name: "Pedal de câmbio forjado", description: "Pedal de câmbio em alumínio forjado com ponteira articulada.", store: "areia", categorySlug: "parts-accessories", brandSlug: "terra-demo", priceInCents: 19990, weightInGrams: 300, dimensions: [30, 60, 250], axis: "cor", options: ["Prata", "Preto"], fitment: true },
  { key: "protetor-carter-aluminio", name: "Protetor de cárter em alumínio", description: "Protetor em alumínio de 4 mm com fixação nos pontos originais do quadro.", store: "trilha", categorySlug: "parts-accessories", brandSlug: "apex-demo", priceInCents: 44990, weightInGrams: 1600, dimensions: [80, 250, 400], axis: "acabamento", options: ["Natural", "Anodizado preto"], priceSteps: [0, 5000], fitment: true },
  { key: "kit-adesivos-graficos", name: "Kit de adesivos gráficos", description: "Kit de adesivos de alta espessura com acabamento brilhante para carenagens.", store: "areia", categorySlug: "parts-accessories", brandSlug: "apex-demo", priceInCents: 64990, weightInGrams: 900, dimensions: [20, 400, 600], axis: "tema", options: ["Laranja", "Azul", "Vermelho"], fitment: true },
  { key: "capa-banco-antiderrapante", name: "Capa de banco antiderrapante", description: "Capa de banco com faixas de aderência e costura dupla.", store: "trilha", categorySlug: "parts-accessories", brandSlug: "terra-demo", priceInCents: 17990, weightInGrams: 400, dimensions: [30, 300, 600], axis: "cor", options: ["Preta", "Preta/laranja"], fitment: true },
  { key: "para-lama-dianteiro", name: "Para-lama dianteiro", description: "Para-lama em polipropileno flexível com cor injetada.", store: "cross", categorySlug: "parts-accessories", brandSlug: "apex-demo", priceInCents: 12990, weightInGrams: 450, dimensions: [80, 200, 500], axis: "cor", options: ["Branco", "Vermelho", "Amarelo"], fitment: true },
  // Peças (geral)
  { key: "kit-ferramentas-pista", name: "Kit de ferramentas de pista", description: "Estojo com chaves T, soquetes e alavancas de pneu para manutenção no box.", store: "garagem", categorySlug: "parts", brandSlug: "terra-demo", priceInCents: 34990, weightInGrams: 2800, dimensions: [100, 250, 450], axis: "kit", options: ["Básico", "Completo"], priceSteps: [0, 15000] },
  { key: "cavalete-elevador", name: "Cavalete elevador de motocross", description: "Cavalete com elevação por alavanca e tampo emborrachado.", store: "cross", categorySlug: "parts", brandSlug: "apex-demo", priceInCents: 39990, weightInGrams: 5200, dimensions: [300, 300, 400], axis: "cor", options: ["Preto", "Laranja"] },

  // Fila de moderação e demais estados (Garagem MX e outras lojas)
  { key: "camisa-pista-rascunho", name: "Camisa de motocross Pista Leve", description: "Rascunho ainda não enviado para aprovação.", store: "garagem", categorySlug: "apparel", brandSlug: "terra-demo", priceInCents: 19990, weightInGrams: 250, dimensions: [30, 250, 300], axis: "tamanho", options: ["M", "G"], status: "DRAFT" },
  { key: "escapamento-rascunho", name: "Ponteira de escapamento Sound", description: "Rascunho com fotos e compatibilidade pendentes.", store: "garagem", categorySlug: "parts-engine", brandSlug: "apex-demo", priceInCents: 129990, weightInGrams: 2200, dimensions: [120, 150, 600], axis: "acabamento", options: ["Alumínio"], status: "DRAFT" },
  { key: "luva-inverno-enviada", name: "Luva de inverno Thermo", description: "Enviada para moderação.", store: "garagem", categorySlug: "apparel", brandSlug: "terra-demo", priceInCents: 17990, weightInGrams: 180, dimensions: [30, 120, 250], axis: "tamanho", options: ["M", "G"], status: "SUBMITTED" },
  { key: "radiador-enviado", name: "Radiador reforçado lado esquerdo", description: "Enviado para moderação com compatibilidade informada.", store: "garagem", categorySlug: "parts-engine", brandSlug: "apex-demo", priceInCents: 74990, weightInGrams: 1900, dimensions: [80, 200, 350], axis: "lado", options: ["Esquerdo"], status: "SUBMITTED", fitment: true },
  { key: "corrente-ouro-enviada", name: "Corrente dourada 120 elos", description: "Enviada para moderação por outra loja.", store: "box77", categorySlug: "parts-transmission", brandSlug: "apex-demo", priceInCents: 31990, weightInGrams: 1800, dimensions: [50, 150, 200], axis: "elos", options: ["120"], status: "SUBMITTED", fitment: true },
  { key: "colete-trilha-enviado", name: "Colete de hidratação Trilha 2 L", description: "Enviado para moderação por outra loja.", store: "trilha", categorySlug: "equipment", brandSlug: "terra-demo", priceInCents: 24990, weightInGrams: 600, dimensions: [80, 250, 450], axis: "capacidade", options: ["2 litros"], status: "SUBMITTED" },
  { key: "farol-led-rejeitado", name: "Farol de LED universal", description: "Produto recusado na moderação.", store: "garagem", categorySlug: "parts-accessories", brandSlug: "apex-demo", priceInCents: 22990, weightInGrams: 500, dimensions: [100, 150, 200], axis: "cor", options: ["Preto"], status: "REJECTED", rejectionReason: "Produto para uso em vias públicas exige certificação. Informe a homologação ou retire a menção a uso urbano." },
  { key: "bota-arquivada", name: "Bota off-road Classic (coleção anterior)", description: "Produto arquivado pelo lojista após o fim da coleção.", store: "garagem", categorySlug: "equipment-boots", brandSlug: "terra-demo", priceInCents: 89990, weightInGrams: 4300, dimensions: [390, 330, 550], axis: "tamanho", options: ["41", "42"], status: "ARCHIVED" },
];

/** Fotos reais disponíveis em public/images/demo, por categoria. */
export const categoryPhotos: Record<string, string> = {
  "equipment-helmets": "capacete-apex.webp",
  "equipment-boots": "botas-terra.webp",
  "equipment-goggles": "oculos-vista.webp",
  "parts-brakes": "disco-onda.webp",
};

export const categoryLabels: Record<string, string> = {
  "equipment-helmets": "Capacete",
  "equipment-boots": "Bota",
  "equipment-goggles": "Óculos",
  equipment: "Proteção",
  apparel: "Vestuário",
  "parts-transmission": "Transmissão",
  "parts-suspension": "Suspensão",
  "parts-engine": "Motor",
  "parts-brakes": "Freio",
  "parts-accessories": "Acessório",
  parts: "Peças",
};

export const extraCustomers: Array<{ email: string; name: string; city: string; state: string; postalCode: string; street: string }> = [
  { email: "review.cliente2@example.test", name: "Lucas Ferreira", city: "Campinas", state: "SP", postalCode: "13010100", street: "Rua Conceição" },
  { email: "review.cliente3@example.test", name: "Mariana Costa", city: "Belo Horizonte", state: "MG", postalCode: "30130000", street: "Rua da Bahia" },
  { email: "review.cliente4@example.test", name: "Thiago Almeida", city: "Curitiba", state: "PR", postalCode: "80010000", street: "Rua XV de Novembro" },
  { email: "review.cliente5@example.test", name: "Fernanda Rocha", city: "Porto Alegre", state: "RS", postalCode: "90010000", street: "Rua dos Andradas" },
  { email: "review.cliente6@example.test", name: "Gabriel Souza", city: "Goiânia", state: "GO", postalCode: "74003010", street: "Avenida Goiás" },
  { email: "review.cliente7@example.test", name: "Patrícia Nunes", city: "Recife", state: "PE", postalCode: "50010000", street: "Rua do Imperador" },
  { email: "review.cliente8@example.test", name: "Rodrigo Carvalho", city: "Florianópolis", state: "SC", postalCode: "88010000", street: "Rua Felipe Schmidt" },
  { email: "review.cliente9@example.test", name: "Aline Ribeiro", city: "Ribeirão Preto", state: "SP", postalCode: "14010000", street: "Rua General Osório" },
  { email: "review.cliente10@example.test", name: "Eduardo Martins", city: "Sorocaba", state: "SP", postalCode: "18035000", street: "Rua da Penha" },
  { email: "review.cliente11@example.test", name: "Camila Barbosa", city: "Londrina", state: "PR", postalCode: "86010000", street: "Avenida Paraná" },
  { email: "review.cliente12@example.test", name: "Vinícius Araújo", city: "Uberlândia", state: "MG", postalCode: "38400000", street: "Avenida Afonso Pena" },
  { email: "review.cliente13@example.test", name: "Juliana Moura", city: "São José dos Campos", state: "SP", postalCode: "12210000", street: "Rua Sete de Setembro" },
];

export const guestCustomers: Array<{ email: string; name: string; phone: string }> = [
  { email: "review.convidado2@example.test", name: "Henrique Dias", phone: "11955550002" },
  { email: "review.convidado3@example.test", name: "Larissa Pires", phone: "21955550003" },
  { email: "review.convidado4@example.test", name: "Otávio Mendes", phone: "31955550004" },
  { email: "review.convidado5@example.test", name: "Bianca Lopes", phone: "41955550005" },
  { email: "review.convidado6@example.test", name: "Sérgio Cardoso", phone: "51955550006" },
];

type ReviewText = { title: string; comment: string };

export const reviewTexts: Record<1 | 2 | 3 | 4 | 5, ReviewText[]> = {
  5: [
    { title: "Superou as expectativas", comment: "Acabamento excelente e chegou antes do prazo. Já usei em três treinos e está perfeito." },
    { title: "Recomendo sem medo", comment: "Produto igual ao anúncio, bem embalado e a loja respondeu rápido no pós-venda." },
    { title: "Valeu cada centavo", comment: "Qualidade de produto de equipe. Montagem simples e nenhum ajuste foi necessário." },
    { title: "Perfeito para a pista", comment: "Usei no fim de semana em pista de terra dura e o desempenho foi muito bom." },
    { title: "Compra certa", comment: "Comparei com outras opções e esta tem o melhor custo-benefício. Voltarei a comprar." },
    { title: "Chegou rapidinho", comment: "Pedido entregue em dois dias, tudo conferido e funcionando." },
    { title: "Muito satisfeito", comment: "Material resistente, já tomou um tombo e continua inteiro." },
    { title: "Nota máxima", comment: "Encaixe perfeito na minha moto e a nota fiscal veio certinha." },
  ],
  4: [
    { title: "Muito bom", comment: "Produto de qualidade, só achei a embalagem simples demais para o preço." },
    { title: "Bom custo-benefício", comment: "Cumpre o que promete. Demorou um dia a mais que o previsto, mas a loja avisou." },
    { title: "Gostei", comment: "Bem acabado e confortável. Tirei uma estrela porque o manual é só em inglês." },
    { title: "Atendeu bem", comment: "Funcionou como esperado. A tabela de medidas poderia ser mais detalhada." },
    { title: "Aprovado", comment: "Uso há um mês em trilha e está aguentando bem. Recomendo." },
    { title: "Quase perfeito", comment: "Ótimo produto, a cor é um pouco mais escura que na foto." },
  ],
  3: [
    { title: "Razoável", comment: "Cumpre a função, mas esperava um acabamento melhor pelo valor." },
    { title: "Ok para o preço", comment: "Serve para treino. Para competição eu escolheria um modelo superior." },
    { title: "Mediano", comment: "Precisei fazer um pequeno ajuste na montagem. Depois disso funcionou." },
    { title: "Nada demais", comment: "Produto simples, entrega dentro do prazo." },
  ],
  2: [
    { title: "Esperava mais", comment: "O tamanho veio diferente da tabela e precisei trocar. A loja resolveu, mas demorou." },
    { title: "Qualidade abaixo", comment: "Começou a desgastar depois de poucos usos." },
    { title: "Entrega atrasada", comment: "O produto é bom, mas chegou uma semana depois do prazo informado." },
  ],
  1: [
    { title: "Não recomendo", comment: "Veio com defeito de fabricação e o processo de troca foi demorado." },
    { title: "Decepcionado", comment: "Não serviu na minha moto, apesar de aparecer como compatível na hora da compra." },
  ],
};

export const sellerReviewTexts: Record<1 | 2 | 3 | 4 | 5, string[]> = {
  5: ["Loja muito atenciosa, embalagem caprichada.", "Envio rápido e rastreio atualizado.", "Respondeu todas as dúvidas antes da compra.", "Excelente atendimento, recomendo a loja."],
  4: ["Boa loja, só demorou um pouco para postar.", "Atendimento cordial, entrega dentro do prazo."],
  3: ["Entrega ok, mas a comunicação poderia ser melhor."],
  2: ["Demoraram para responder sobre a troca."],
  1: ["Não respondeu às mensagens sobre o atraso."],
};

export const questionPool: Record<"fitment" | "size" | "general", string[]> = {
  fitment: [
    "Serve na CRF 250R 2023? Não aparece na lista de compatibilidade.",
    "Esse item encaixa na YZ250F 2025 sem adaptação?",
    "Vocês têm a versão para a CRF 450R?",
    "Precisa trocar algum parafuso para montar na CRF 250R 2024?",
    "É compatível com a versão de enduro da mesma moto?",
  ],
  size: [
    "Uso 42 em tênis, qual tamanho vocês recomendam?",
    "A forma é grande ou pequena? Fico entre M e G.",
    "Tem tabela de medidas em centímetros?",
    "Serve para criança de 9 anos com 1,35 m?",
  ],
  general: [
    "Qual o prazo de envio para Belo Horizonte?",
    "Vocês emitem nota fiscal?",
    "Tem garantia? Por quanto tempo?",
    "A cor laranja é mais clara que na foto?",
    "Vem com manual de instalação em português?",
    "Tem previsão de reposição das opções esgotadas?",
  ],
};

export const answerPool: Record<"fitment" | "size" | "general", string[]> = {
  fitment: [
    "Olá! Pela furação original, serve sim. Confira a lista de compatibilidade antes de finalizar.",
    "Oi! Para essa moto ainda não confirmamos a compatibilidade. Assim que testarmos atualizamos o anúncio.",
    "Encaixa sem adaptação, usando os parafusos originais.",
  ],
  size: [
    "Olá! A forma é justa; se estiver entre dois tamanhos, recomendamos o maior.",
    "Oi! Para essa altura indicamos o tamanho M. A tabela completa está nas fotos.",
    "A tabela de medidas está na descrição; qualquer dúvida, é só perguntar.",
  ],
  general: [
    "Postamos em até 2 dias úteis após a confirmação do pagamento.",
    "Sim, todos os pedidos acompanham nota fiscal.",
    "Garantia de 90 dias contra defeitos de fabricação.",
    "Estamos aguardando reposição para as próximas semanas.",
  ],
};
