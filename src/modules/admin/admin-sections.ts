export const adminSections = [
  {
    slug: "sales",
    title: "Vendas",
    description: "Vendas confirmadas de todas as lojas no período.",
    group: "Marketplace",
  },
  { slug: "sellers", title: "Lojistas", description: "Cadastro, aprovação e equipe das lojas.", group: "Marketplace" },
  {
    slug: "products",
    title: "Produtos",
    description: "Revisão dos anúncios enviados pelas lojas.",
    group: "Marketplace",
  },
  {
    slug: "catalog",
    title: "Catálogo e motos",
    description: "Categorias, marcas e compatibilidade.",
    group: "Marketplace",
  },
  { slug: "coupons", title: "Cupons", description: "Campanhas financiadas pelo Moto Shop.", group: "Marketplace" },
  { slug: "vip", title: "Plano VIP", description: "Ativação e exposição das lojas.", group: "Marketplace" },
  { slug: "commission", title: "Comissão", description: "Percentual padrão do marketplace.", group: "Marketplace" },
  { slug: "orders", title: "Pedidos", description: "Acompanhamento de compras e envios.", group: "Operação" },
  {
    slug: "cancellations",
    title: "Cancelamentos",
    description: "Solicitações de clientes por pedido.",
    group: "Operação",
  },
  { slug: "returns", title: "Devoluções", description: "Itens devolvidos e reembolsos.", group: "Operação" },
  { slug: "disputes", title: "Disputas", description: "Mediação entre cliente e loja.", group: "Operação" },
  { slug: "moderation", title: "Moderação", description: "Perguntas e avaliações públicas.", group: "Operação" },
  {
    slug: "shipping-recovery",
    title: "Conferir etiquetas",
    description: "Tentativas de frete sem confirmação.",
    group: "Operação",
  },
  { slug: "integrations", title: "Integrações", description: "Estado dos serviços externos.", group: "Sistema" },
  { slug: "webhooks", title: "Webhooks", description: "Eventos recebidos e falhas.", group: "Sistema" },
  { slug: "emails", title: "E-mails", description: "Entregas de notificações.", group: "Sistema" },
  { slug: "audit", title: "Auditoria", description: "Histórico de alterações administrativas.", group: "Sistema" },
  { slug: "outbox", title: "Eventos pendentes", description: "Eventos que exigem atenção.", group: "Sistema" },
] as const;

export type AdminSection = (typeof adminSections)[number]["slug"];

export const adminWorkspaceSections = [
  "sales",
  "sellers",
  "products",
  "catalog",
  "coupons",
  "vip",
  "commission",
  "orders",
  "cancellations",
  "returns",
  "disputes",
  "integrations",
  "webhooks",
  "emails",
  "audit",
] as const satisfies readonly AdminSection[];

export function isAdminWorkspaceSection(value: string): value is (typeof adminWorkspaceSections)[number] {
  return adminWorkspaceSections.some((section) => section === value);
}
