# Changelog — O Moto Shop

Mudanças relevantes do projeto, da mais recente para a mais antiga. O app é publicado continuamente; não há versões
semânticas. As regras vigentes ficam no [AGENTS.md](AGENTS.md); este arquivo registra o histórico.

## Não lançado

Trabalho da branch `codex/moto-shop-readiness`, preparando a versão candidata ao lançamento.

### Auditorias e documentação

- Auditoria de lógica de negócio, segurança e UI/UX ([docs/auditoria-2026-10.md](docs/auditoria-2026-10.md)) e
  auditoria do repositório ([docs/auditoria-repositorio-2026-10.md](docs/auditoria-repositorio-2026-10.md)).
- Matrizes de prontidão: fluxos críticos, rotas manuais, inventário da versão e checklist do MVP.
- Guia de telas com contas de demonstração ([docs/guia-de-telas.md](docs/guia-de-telas.md)).
- Governança do repositório: `SECURITY.md`, `CONTRIBUTING.md`, templates de PR/issue, `CODEOWNERS` e este changelog.

### Correções de negócio e segurança

- Pagamentos: recuperação de cobranças não enviadas (`paymentRequestState`), estornos/chargebacks não explicados
  marcados para revisão financeira, validação do valor reembolsado.
- Checkout: teto da taxa do marketplace por seller, rate limit de cotação de frete e disponibilidade de pagamento
  derivada do serviço de checkout.
- Frete: substituição de etiquetas canceladas, ressincronização na reconciliação e 4xx do Melhor Envio tratados como
  definitivos; bloqueio de compra duplicada de etiqueta.
- Pedidos: vínculo de pedido guest exige e-mail verificado e gera auditoria; sincronização de fulfillment e status
  agregado sem regressão.
- Devoluções: retry de reembolso por tentativa com chave idempotente; regras de pós-venda fora das Server Actions.
- Recuperação de senha e verificação de e-mail; acesso guest e transições pós-venda endurecidos.
- Banco: migrations de outbox durável e segurança na geração de envios; schema de configurações do seller e
  integração de frete.

### Design system e experiência

- Tokens e primitivas de UI consolidados; header, rodapé e card de produto compartilhados por todo o storefront.
- Conta do cliente com shell compartilhado, abas roláveis e "Sair"; formulário de autenticação acessível.
- Central do Lojista: fluxo de edição de produto com React Hook Form, configurações auditadas, links sociais públicos.
- Admin: dashboard por seções, cancelamento de etiqueta, reenvio de e-mail e títulos sem repetir a marca.
- Menu mobile com atalhos, busca no header sem zoom no iOS, formulários de pós-venda recolhidos em disclosures.
- Filtro da moto principal explícito na URL do catálogo.

### Dados de demonstração e testes

- Catálogo demo (`isDemo`) e seed de revisão idempotente com script de remoção e `dev:review`; lojas de revisão ficam
  `PENDING` salvo publicação explícita; contas de visualização vinculadas por variável de ambiente.
- Bancos de integração e navegador isolados; specs E2E alinhadas às novas rotas.

### Infraestrutura e ferramentas

- Storage migrado de Cloudflare R2 para ImageKit Forever Free.
- Integração com o sandbox do Melhor Envio.
- Configuração de ferramentas (lint, formatação, ignores de diretórios locais do Next) e CI em preparação.

## Histórico do MVP

Fases registradas durante a construção do MVP, da mais recente para a mais antiga.

### Fases 136–145: vitrines, avaliações e catálogos

- **145** Busca de produtos na vitrine da loja (nome, marca, categoria, SKU), com filtros e paginação na URL.
- **144** Filtro de promoções na vitrine da loja, com a mesma regra de pricing do storefront.
- **143** Filtro de disponibilidade na vitrine da loja, validado no servidor.
- **142** Filtro de promoções ativas no catálogo do seller (datas e preço persistidos na variante).
- **141** Filtro de estoque (em estoque, baixo, esgotado) no catálogo do seller por variantes ativas.
- **140** Busca por nome ou SKU do item congelado nas filas pós-venda do Admin.
- **139** Ordenação do histórico do cliente por valor total.
- **138** Filtro de promoções nas páginas de categoria, marca e moto.
- **137** Ordenação das avaliações na vitrine da loja.
- **136** Ordenação das avaliações de produto, mantendo filtro de nota e paginação.

### Fases 121–135: ordenação e disponibilidade

- **135** Busca de endereços salvos, restrita ao usuário autenticado.
- **134** Ordenação de perguntas públicas de produto.
- **131–133** Ordenação por criação nas filas administrativas de devoluções, cancelamentos e disputas.
- **130** Ordenação de cupons (criação, validade, código).
- **129** Ordenação do catálogo do seller (atualização ou nome).
- **128** Filtro de disponibilidade nos catálogos de categoria, marca e moto.
- **127** Ordenação dos catálogos públicos (relevância, novidade, preço).
- **126** Paginação server-side dos catálogos de categoria, marca e moto.
- **125** Ordenação da fila administrativa de sellers.
- **124** Ordenação do catálogo da loja pública, com paginação independente de avaliações.
- **123** Ordenação do histórico de estoque.
- **122** Ordenação de favoritos.
- **121** Filtro de disponibilidade nos favoritos, recalculado no servidor.

### Fases 106–120: buscas por snapshot e paginação

- **119–120** Ordenação dos monitores de webhooks e de notificações.
- **118** Busca no histórico de estoque por produto, variante ou SKU.
- **117** Busca de favoritos por produto, marca, categoria ou loja.
- **116** Paginação server-side de favoritos (só produtos aprovados de sellers ativos/aprovados).
- **115** Paginação do catálogo público da loja.
- **114** Ordenação da moderação por submissão, com desempate pela criação.
- **113** Ordenação da auditoria.
- **112** Ordenação das perguntas do seller.
- **111** Busca do cliente pelo SKU congelado no item.
- **110** Avaliações da loja pública em páginas de seis, com média e total completos.
- **108–109** Ordenação dos pedidos do seller e do monitor administrativo.
- **106–107** Busca de pedidos (seller e Admin) por nome do produto ou SKU do snapshot.

### Fases 91–105: períodos e filtros por seller

- **105** Faixa de valor total no histórico do cliente.
- **104** Filtro de nota nas avaliações do produto, com média, contagem e paginação no mesmo recorte.
- **101–103** Período de criação nos pedidos do seller, no monitor administrativo e (por `submittedAt`) na moderação.
- **100** Busca por ator (nome ou e-mail) na auditoria.
- **99** Faixa de preço em centavos no catálogo do seller.
- **98** Busca do storefront ampliada para SKU, marca, categoria e loja.
- **97** Período nas perguntas do seller.
- **96** Período nas filas pós-venda do Admin, em UTC.
- **95** Período no histórico de estoque, com limite final exclusivo em UTC.
- **94** Ordenação do histórico de pedidos do cliente.
- **91–93** Filtro por seller nas filas de devoluções, cancelamentos e disputas.

### Fases 76–90: filtros operacionais

- **90** Tipo de movimentação no histórico de estoque.
- **89** Período no histórico do cliente.
- **88** Período no monitor de notificações.
- **87** Período na auditoria (`createdAt`, UTC).
- **86** Filtro por seller na moderação de produtos.
- **85** Janela temporal UTC no monitor de webhooks.
- **84** Filtros de categoria e marca na moderação.
- **83** Filtro de ofertas no storefront pela regra central de preço vigente.
- **82** Busca no histórico do cliente pelo nome do produto no snapshot.
- **81** Filtro de marca no catálogo do seller.
- **80** Filtro de tipo de notificação.
- **79** Filtro de provider no monitor de webhooks.
- **78** Filtro de loja (aprovada ou ativa) no storefront.
- **77** Filtro de categoria no catálogo do seller.
- **76** Filtro de status de envio no histórico do cliente.

### Fases 61–75: monitoramento e filtros

- **75** Filtro de cupons futuros.
- **74** Faixa de preço em centavos no storefront, pelo preço vigente das variantes ativas.
- **73** Busca por e-mail do cliente nas perguntas do seller.
- **72** Busca por loja no histórico do cliente.
- **71** Filtro de status de envio no monitor administrativo.
- **70** Filtro de disponibilidade no storefront, aplicado no banco antes do ranking.
- **69** Busca por ID de entidade na auditoria.
- **68** Filtro de status de pagamento no histórico do cliente.
- **67** Filtro por loja no monitor administrativo de pedidos.
- **66** Filtro de status do `Shipment` nos pedidos do seller.
- **65** Resumo estimado no checkout (itens, subtotal, frete, total), sempre recalculado no servidor.
- **64** Filtro de validade dos cupons (vigentes e expirados).
- **63** Comissão padrão configurável em basis points, auditada e sem retroagir sobre pedidos.
- **62** Histórico de movimentações de estoque do seller.
- **61** Retry administrativo de webhooks `FAILED`, com auditoria e volta a `FAILED` se o enqueue falhar.

### Fases 46–60: operação do Admin e do seller

- **60** Validade dos cupons visível nas listas.
- **59** Monitor de entregas de e-mail transacional.
- **58** Monitor paginado de webhooks sem serializar o payload bruto.
- **57** Busca por número no histórico do cliente.
- **56** Filtro de estoque (todos, baixo, esgotado) na interface do catálogo do seller.
- **55** Status do último pagamento no histórico do cliente.
- **54** Busca de perguntas do seller por texto ou produto.
- **53** Busca no monitor de pedidos por número, cliente ou loja.
- **52** Busca na moderação de produtos por nome, slug, SKU ou loja.
- **51** Busca de sellers no Admin por loja, membro ou e-mail.
- **50** Reconsulta segura de pagamento pendente (sessão ou token guest), com reconciliação transacional.
- **49** Histórico de pagamentos e transações no detalhe do pedido.
- **48** Contagem de resgates e limite global nas listas de cupons (`_count`).
- **47** Restauração de produto arquivado para `DRAFT` pelo seller dono, com auditoria.
- **46** Suspensão e reativação de sellers, auditadas e refletidas no acesso à Central do Lojista.

### Fases 31–45: filas, cupons e auditoria

- **45** Filtro de estoque baixo ou esgotado no catálogo do seller.
- **44** Aprovação e rejeição de sellers e produtos em transação com `AuditLog`.
- **43** Busca nas filas de pós-venda por pedido, cliente, loja ou motivo.
- **41–42** Cupons do seller e do marketplace paginados e filtráveis.
- **40** Estoque e ajuste manual por todas as variantes ativas.
- **39** Filtros de status e paginação nas filas de devoluções, cancelamentos e disputas.
- **37–38** Ativação e desativação de cupons do seller e do marketplace, com ownership e auditoria.
- **36** Busca de pedidos do seller por número, nome ou e-mail do cliente.
- **35** Paginação independente de avaliações e perguntas no produto, com média calculada no servidor.
- **34** Monitor administrativo consolidado de `SellerOrder`.
- **33** Alerta de estoque baixo (até cinco unidades) para o seller.
- **32** Resumo financeiro do seller a partir dos snapshots dos pedidos.
- **31** Auditoria consultável no Admin.

### Fases 16–30: fulfillment, notificações e paginação

- **30** Filtro de status e paginação na fila de aprovação de produtos.
- **29** Fila de sellers do Admin com filtro e paginação.
- **28** Perguntas do seller separadas por respondidas/pendentes, paginadas.
- **27** Histórico de pedidos do cliente filtrável e paginado.
- **26** Catálogo do seller paginado, com busca por nome, slug ou SKU.
- **25** Linha do tempo de entrega e links de rastreio, inclusive para guests com token.
- **24** Filtro de status dos pedidos do seller pela URL.
- **23** Paginação server-side (20 por página) em `/seller/orders`.
- **22** Auditoria das transições de `SellerOrder` e `Order` causadas pelo fulfillment.
- **21** Preferências de e-mail de atualização em `/account/notifications`.
- **20** Notificações de fulfillment pelo Inngest, idempotentes por `sellerOrderId + status`.
- **19** Estados de fulfillment: etiqueta move o `SellerOrder` para processamento; rastreio sincroniza
  `PROCESSING`/`SHIPPED`/`DELIVERED` e recalcula o `Order`.
- **18** Reordenação e remoção de imagens de produtos em rascunho/rejeitados; a primeira é a capa; limpeza
  best-effort do objeto no storage (na época R2, hoje ImageKit).
- **17** Nota média e até seis avaliações recentes na vitrine da loja.
- **16** Primeira imagem do produto nos cards públicos, com fallback acessível.

### Fases 2–15: catálogo, seller e storefront

- **15** Logo e banner da loja com upload direto para o ImageKit.
- **14** Perfil público da loja (nome, slug, descrição) editável, auditado e com revalidação de URLs e sitemap.
- **13** Vitrines públicas em `/loja/[slug]` para sellers aprovados/ativos.
- **12** SEO técnico: metadata, canonical, JSON-LD `Product`, `sitemap.xml` só com conteúdo aprovado e `robots.txt`
  bloqueando áreas privadas.
- **11** Páginas públicas `/categoria/[slug]`, `/marca/[slug]` e `/moto/[fabricante]/[modelo]/[ano]`.
- **10** Múltiplas variantes por produto (título, SKU, preço, estoque); remoções desativam em vez de apagar.
- **9** Histórico de pedidos em `/orders`; detalhe em `/orders/[orderNumber]` por `userId` ou token guest.
- **8** Endereços do cliente em `/account/addresses`; o checkout grava snapshot próprio em `OrderAddress`.
- **7** Favoritos em `/favorites`, únicos por usuário e produto.
- **6** Busca e navegação do storefront em `/products` com estado na URL e 12 produtos por página.
- **5** Equipe e permissões do seller (administrador, catálogo, pedidos, financeiro), sem convites por e-mail.
- **4** Imagens de produto (até oito, JPG/PNG/WebP, 5 MB) com upload direto para o ImageKit e validação do asset.
- **3** Governança de catálogo: categorias, marcas, fabricantes, modelos e fitments no Admin; compatibilidade
  estruturada `Product -> ProductCompatibility -> MotorcycleFitment`.
- **2** Catálogo operacional: conta → solicitação de loja → aprovação no Admin (`ADMIN_EMAILS`) → produto com
  variante e estoque → aprovação → publicação. Preços em centavos.

### Fundação

- **Núcleo comercial do banco:** catálogo multi-lojista, estoque auditável por variante, compatibilidade estruturada,
  carrinho autenticado ou guest, `Order` dividido em `SellerOrder`, pagamentos, fretes, cupons e comissão
  configurável. Decisões: dinheiro em centavos e percentuais em basis points; SKU único por seller e `sellerId` nas
  relações comerciais; atributos de variante em JSON validado, dimensões de frete em colunas; snapshots comerciais e
  comissão aplicada no pedido; exclusões históricas com `Restrict`/`SetNull`; `CHECK` constraints para saldos não
  negativos e reconciliação de totais.
- **Notificações transacionais:** pagamentos confirmados ou recusados geram evento no Inngest, e-mail pelo Resend e
  registro em `notification_deliveries`, com chave única contra envio duplicado e sem afetar o estado financeiro.
- **Pós-compra e devoluções:** acompanhamento por seller em `/orders/[orderNumber]` (sessão ou token guest);
  devolução por item (`REQUESTED -> APPROVED -> RETURNED -> REFUNDED` ou `REJECTED`), com movimento de estoque
  `RETURN` e reembolso só após o recebimento. Etiquetas e rastreio em `/seller/orders` exigem origem da loja e
  peso/dimensões dos produtos. Cancelamento por `SellerOrder` antes da postagem, decidido no Admin, com reembolso do
  valor do seller, movimento `CANCELLATION` e `Order` em `CANCELLED` ou `PARTIALLY_CANCELLED`.
- **Disputas e mediação:** abertas por `SellerOrder` (inclusive guest), fluxo `OPEN -> UNDER_REVIEW -> RESOLVED` ou
  `REJECTED`, com `AuditLog`, sem chat privado nem reembolso automático.
- **Cupons e promoções:** cupons globais (financiados pelo O Moto Shop) e de seller (reduzem o saldo do seller); um
  cupom por pedido, desconto recalculado no servidor, limites global e por cliente; promoções de variante respeitam
  datas em todas as telas e no checkout.
- **Plano VIP:** ativação/renovação administrativa em `seller_subscriptions`, sem cobrança recorrente simulada; selo
  `Patrocinado · VIP` e sinal pequeno de ranking, sem garantir o primeiro resultado.
