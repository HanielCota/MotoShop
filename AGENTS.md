# AGENTS.md — O Moto Shop

> Fonte principal de contexto técnico e de produto do Moto Shop. Leia por completo antes de criar, alterar, refatorar ou remover qualquer funcionalidade.
> Em conflito com uma sugestão técnica genérica, este documento prevalece, salvo instrução explícita do responsável pelo projeto.
> As decisões pontuais do MVP (regras por domínio tomadas ao longo do projeto) ficam em [`docs/decisions.md`](docs/decisions.md) e têm a mesma autoridade deste arquivo.

---

# 1. Visão do produto

**O Moto Shop** é um marketplace vertical focado exclusivamente no ecossistema de motocross. Nasce como **marketplace multi-lojista**, não como e-commerce de loja única.

Marca: nos textos do site, "O Moto Shop"; nos títulos de aba, `siteName` e OpenGraph, "Moto Shop Brasil" (regras completas em `docs/decisions.md`, seção 1).

Três experiências principais:

1. **Marketplace / Storefront**: navegação pública, busca, categorias, produtos, Minha Moto, carrinho, checkout, pedidos, favoritos, avaliações e perguntas sobre produtos.
2. **Central do Lojista**: cadastro e gestão de produtos, preços, promoções, estoque, variações, pedidos, fretes, cupons, integrações, relatórios, perfil da loja, usuários e permissões.
3. **Admin do Moto Shop**: aprovação de lojistas e produtos; gestão de categorias, marcas, base de motos, pedidos e disputas; configuração de comissão; plano VIP; cupons globais; campanhas; reembolsos; moderação.

---

# 2. Objetivo do MVP

Validar o modelo de negócio com **custo de infraestrutura próximo de zero**, sem criar uma arquitetura descartável.

Prioridades: entregar rápido; código simples de manter; arquitetura modular; custos baixos; segurança financeira; rastreabilidade; boa experiência mobile; evitar dependências desnecessárias e microserviços prematuros.

Não otimizar antecipadamente para milhões de usuários.

---

# 3. Stack oficial

## Aplicação

**Next.js**, **React**, **TypeScript** e **pnpm**, em arquitetura **Next.js fullstack** e **monólito modular**:

- Server Components quando fizer sentido.
- Server Actions para mutations internas.
- Route Handlers para APIs públicas, integrações e webhooks.

Não criar um backend NestJS separado sem uma necessidade real aprovada.

## Banco de dados

**PostgreSQL** (**Neon**) com **Prisma**. O PostgreSQL é a fonte principal da verdade.

Nunca usar Redis como fonte da verdade para pedidos, pagamentos, produtos, estoque, comissão, saldo, devoluções ou usuários.

## Autenticação

**Better Auth**, com autenticação centralizada e sessões seguras. A autorização de negócio continua pertencendo ao Moto Shop: centralizar permissões em vez de espalhar `if (user.role === "admin")` pela aplicação.

## UI

**Tailwind CSS**, **shadcn/ui**, **Lucide** e componentes próprios do Moto Shop. Não adicionar outra biblioteca visual pesada sem necessidade.

## Formulários e validação

**React Hook Form**, **Zod** e **@hookform/resolvers**. Toda entrada externa relevante deve ser validada: formulários, Server Actions, webhooks, query params, APIs externas e payloads de integrações.

React Hook Form é obrigatório em formulário novo ou reescrito. Formulários existentes que validam à mão (ex.: login e checkout) continuam como estão até serem reescritos; não migrar só para cumprir a regra (decisão de 16/10/2026).

## Estado

Usar a ferramenta correta para cada tipo de estado:

- **Server state**: preferir Server Components.
- **Client state**: **Zustand**, apenas quando houver estado de UI realmente compartilhado. Não mover dados do banco para Zustand sem motivo.
- **Estado na URL**: **nuqs**, para filtros, busca, ordenação, paginação, categorias e parâmetros compartilháveis.

## Tabelas

**TanStack Table** quando a tabela precisar de ordenação, seleção de linhas ou filtro no navegador. Até lá, tabela HTML renderizada no servidor com paginação no banco, que é o padrão atual de produtos, pedidos, sellers, devoluções, disputas, cupons e admin (decisão de 16/10/2026).

## Cache e rate limit

**Upstash Redis**, com parcimônia: rate limiting, locks, cache pontual, tokens temporários, proteção contra abuso e controle de concorrência.

## Processamento assíncrono

**Inngest** para e-mails, workflows, eventos de pagamento e de frete, retries, tarefas agendadas, expiração de reservas, processamento de webhooks e notificações. Não executar processos longos dentro de uma request HTTP.

## Storage

**ImageKit Forever Free** para imagens de produto e identidade da loja. Decisão do responsável: não ativar R2 nem plano com cobrança de excedentes.

Uploads vão, quando possível, direto do cliente com autenticação temporária gerada no servidor (`Browser -> autenticação temporária -> ImageKit`), nunca `Browser -> Next.js -> arquivo grande -> ImageKit`. Após o upload, o servidor confere caminho, tipo e tamanho do asset antes de associá-lo ao produto ou à loja.

## Imagens

**Sharp**, gerando versões quando necessário: original, large, medium e thumbnail.

## E-mail

**Resend** e **React Email**. E-mails transacionais não bloqueiam fluxos de pagamento ou pedido: são enviados por jobs/workflows.

## Pagamento

Gateway inicial: **Mercado Pago**. O checkout permanece dentro do Moto Shop: nunca redirecionar o cliente para uma experiência externa do Mercado Pago se houver alternativa compatível com o Checkout Transparente.

Criar abstração própria e não espalhar o SDK pelo projeto. Implementação inicial: `MercadoPagoProvider`.

```ts
interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPayment(id: string): Promise<PaymentResult>;
  refund(input: RefundPaymentInput): Promise<RefundResult>;
}
```

## Frete

Integração inicial: **Melhor Envio**. O sistema suporta Melhor Envio conectado pelo seller e frete próprio do seller. Implementação inicial: `MelhorEnvioProvider`.

```ts
interface ShippingProvider {
  quote(input: ShippingQuoteInput): Promise<ShippingQuote[]>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  track(input: TrackShipmentInput): Promise<TrackingResult>;
}
```

## Observabilidade

**Sentry** e **Pino**, com logs estruturados:

```ts
logger.info({ event: "payment.approved", orderId, sellerId, paymentId });
```

Evitar depender de `console.log("chegou aqui")`.

## Testes

**Vitest** e **Playwright**. Prioridade alta para comissão, cálculo financeiro, checkout, carrinho multi-seller, estoque, cupons, descontos, pagamento, webhooks, idempotência, devoluções e permissões.

---

# 4. Arquitetura obrigatória

O Moto Shop é um **monólito modular**, organizado por domínio e não apenas por tipo técnico:

```text
src/
├── app/
├── modules/
│   ├── auth/  users/  customers/  sellers/  stores/
│   ├── catalog/  products/  categories/  brands/  inventory/
│   ├── motorcycles/  compatibility/  cart/  checkout/  orders/
│   ├── payments/  shipping/  coupons/  promotions/  reviews/
│   ├── questions/  returns/  disputes/  subscriptions/
│   └── notifications/
├── shared/
├── lib/
└── config/
```

Cada módulo pode conter `domain/`, `application/`, `infrastructure/`, `schemas/`, `components/`, `queries/` e `actions/`. Não é obrigatório criar todas as pastas se o módulo ainda for simples. Evitar abstrações vazias.

---

# 5. Regra fundamental de arquitetura

**Route Handlers e Server Actions não contêm regras de negócio complexas.** Validar, identificar o usuário e delegar à camada de aplicação/domínio:

```ts
export async function createProductAction(input: unknown) {
  const data = createProductSchema.parse(input);

  return createProduct.execute({
    userId: await requireUserId(),
    data,
  });
}
```

Errado: uma action que valida usuário, seller, categoria e marca, cria produto, variantes e estoque, envia notificação e registra auditoria no próprio corpo.

---

# 6. Domínio multi-lojista

O Moto Shop nasce com múltiplos sellers. Um carrinho pode conter produtos de vários lojistas; o cliente tem **um checkout unificado** e, internamente, o pedido é dividido:

```text
Order
├── SellerOrder A
│   ├── OrderItem
│   └── Shipment
└── SellerOrder B
    ├── OrderItem
    └── Shipment
```

Nunca modelar o pedido assumindo que existe apenas um seller.

---

# 7. Pedidos

- **Order**: a compra global do cliente (ex.: `MS-202609-0001`).
- **SellerOrder**: a parte do pedido pertencente a um seller.

Cancelamentos, fretes, devoluções e fulfillment podem ser parciais. Não assumir que todo o Order muda de estado junto.

---

# 8. Estoque

O seller controla o estoque pelo Moto Shop, e o sistema o atualiza automaticamente após vendas e ajustes. Estoque existe **por variante** (ex.: Capacete Fox V1 → Preto/P: 3, Preto/M: 8, Branco/M: 4).

Manter histórico em `InventoryMovement` (`SALE`, `MANUAL_IN`, `MANUAL_OUT`, `RETURN`, `CANCEL`, `CORRECTION`). Nunca atualizar estoque sem rastreabilidade.

---

# 9. Produtos

Produtos podem ter nome, slug, descrição, SKU, preço, preço promocional, marca, categoria, imagens, peso, dimensões, seller, status, variantes, estoque e compatibilidade com motos.

Produtos novos precisam de **aprovação do Moto Shop**: `DRAFT -> SUBMITTED -> APPROVED` ou `-> REJECTED`. Autoaprovação de sellers confiáveis pode vir no futuro; não implementar agora sem necessidade.

---

# 10. Categorias e marcas

Categorias e marcas são controladas pelo Moto Shop. Sellers não criam categorias nem marcas livremente, para evitar duplicidade e dados ruins.

---

# 11. Minha Moto

**Funcionalidade central do MVP.** O usuário seleciona fabricante, modelo, versão, cilindrada e ano (ex.: Honda CRF 250R 2025). Produtos podem ser compatíveis com múltiplas motos.

Nunca armazenar compatibilidade como texto livre: usar relacionamento estruturado (`Product → ProductCompatibility → MotorcycleFitment`). A base de motos é controlada pelo Moto Shop; sellers podem sugerir novos modelos, mas não criá-los.

Regras de uso (decisões de 15 e 16/10/2026):

- A moto principal do cliente é um **atalho**, não um filtro automático: busca, categoria e catálogo mostram tudo; a faixa "Minha moto principal" oferece "Ver peças para minha moto".
- **Categoria universal**: uma marcação na categoria, ligada só pelo Admin (capacetes, vestuário, ferramentas). Com filtro de moto ativo, o catálogo mostra os produtos compatíveis mais os de categorias universais, sem exigir compatibilidade por produto. Na página de um produto universal, o texto é "Serve em qualquer moto".
- Na página do produto, o seletor "Sua moto" fica perto do preço.
- No seletor da home, escolher um fabricante preenche o modelo quando ele é o único cadastrado; o ano continua em branco.

---

# 12. Cliente convidado

O cliente pode comprar sem criar conta. O checkout pede **o mínimo necessário**: nome, e-mail, telefone, CPF quando necessário e endereço de entrega. Não obrigar criação de senha.

Depois do pedido, fornecer link seguro para acompanhamento: o link vai por e-mail, o token entra num cookie com validade e a página do pedido deixa de precisar do token na URL (decisão de 15/10/2026). Pedidos guest podem ser vinculados depois a uma conta autenticada, após validação segura do e-mail/identidade. Nunca usar IDs previsíveis como único mecanismo de acesso a pedido guest.

---

# 13. Carrinho

O carrinho suporta vários sellers, é persistente e pode existir para usuário autenticado ou visitante. Não armazenar preço final como verdade apenas no cliente.

No checkout: recalcular preços, revalidar estoque, promoções, cupons e seller, e recalcular frete.

---

# 14. Dinheiro

**Nunca usar `float` para dinheiro.** Valores monetários são armazenados em centavos (`149990` = R$ 1.499,90): preços, desconto, subtotal, frete, comissão, taxa, reembolso e valor do seller.

Comissões percentuais usam basis points (12% = 1200 bps; 10,5% = 1050 bps). Cálculos financeiros devem ter testes.

---

# 15. Comissão

O Moto Shop monetiza por comissão sobre vendas. Existe uma comissão global padrão (ex.: `marketplaceDefaultCommissionBps = 1200`) e cada seller pode ter override individual.

A comissão incide sobre o **valor líquido da loja**: subtotal dos itens do `SellerOrder` menos o desconto de cupom que a própria loja paga (ex.: produto de R$ 100 com cupom de 5% pago pela loja → base R$ 95). Frete fica fora da base; desconto pago pelo Moto Shop não reduz a base.

Não hardcodar comissão: a configuração vem do banco. Registrar no pedido a comissão efetivamente usada naquele momento; mudanças futuras não alteram pedidos antigos.

---

# 16. Plano VIP

No MVP, o VIP é uma **assinatura mensal com ganho de exposição**: destaque na busca, vitrines, produtos recomendados, selo, campanhas e relatórios melhores.

VIP não significa automaticamente "primeiro resultado". O ranking considera relevância, compatibilidade, preço, reputação, disponibilidade, conversão e boost comercial. Conteúdo patrocinado deve ser identificável como patrocinado quando aplicável.

---

# 17. Pagamentos

Gateway inicial: Mercado Pago, com o cliente sempre dentro do Moto Shop. O sistema precisa estar preparado para split de marketplace e considerar **multi-seller desde o princípio**. Não assumir split 1:N automático: a solução final depende da modalidade liberada pelo Mercado Pago para a conta do marketplace.

Toda integração de pagamento é idempotente, auditável, rastreável, resiliente a retries e desacoplada do SDK. Nunca confiar apenas no retorno do navegador: pagamento é confirmado server-side.

---

# 18. Webhooks

Webhooks são persistidos antes do processamento relevante, em `WebhookEvent` (`id`, `provider`, `externalId`, `type`, `payload`, `status`, `receivedAt`, `processedAt`, `error`) com `UNIQUE(provider, externalId)`, para impedir processamento duplicado e permitir retry, auditoria e debug.

Responder rápido; processamento pesado vai para o Inngest.

---

# 19. Idempotência

Obrigatória para pagamento, refund, webhooks, criação de pedido, compra de etiqueta, callbacks externos e jobs críticos. Nunca assumir que uma API externa chamará uma única vez.

---

# 20. Frete

O frete é calculado por seller, e o cliente escolhe um método por seller (ex.: Seller A: Jadlog R$ 20 ou SEDEX R$ 32; Seller B: Jadlog R$ 28 ou SEDEX R$ 43). O frete total é a soma dos fretes. Suportar Melhor Envio e frete próprio do seller.

---

# 21. Cupons

Três tipos (modelo Shopee):

- **Cupom Moto Shop**: criado e pago pelo Moto Shop, vale em todas as lojas.
- **Campanha com adesão**: criada pelo Moto Shop e paga por cada loja que aderir; vale só nos itens das lojas aderentes, e o desconto sai do valor delas. É o padrão ao criar cupom no Admin.
- **Cupom da loja**: criado e pago pelo seller, vale só nos itens dele. Tem início e fim de validade opcionais (decisão de 16/10/2026).

Registrar claramente owner, desconto, limite, período, escopo e responsável financeiro pelo desconto. Nunca perder a informação de quem subsidiou o desconto.

---

# 22. Frete grátis

Pode ser financiado pelo seller, pelo Moto Shop ou por ambos, com valores registrados separadamente:

```text
shippingAmount = 3000
sellerSubsidy = 2000
marketplaceSubsidy = 1000
customerShippingAmount = 0
```

---

# 23. Promoções

O seller define preço normal, preço promocional, data inicial e data final. Guardar histórico quando necessário para auditoria e regras comerciais. Promoção é validada server-side.

---

# 24. Devoluções

O cliente solicita devolução dentro do Moto Shop, por item, com até 3 fotos opcionais, enviadas direto ao ImageKit como as fotos de produto e visíveis para o Admin e para o lojista (decisão de 16/10/2026). Status: `REQUESTED`, `UNDER_REVIEW`, `APPROVED`, `WAITING_RETURN`, `RETURNED`, `REFUNDED`, `REJECTED`.

---

# 25. Cancelamento

O cliente não cancela automaticamente: faz uma **solicitação de cancelamento**. A operação considera status do pagamento, envio, etiqueta, seller, estoque e reembolso. Se já enviado, normalmente tratar como devolução.

---

# 26. Disputas

O Moto Shop faz a mediação entre cliente e seller. O Admin precisa de dados suficientes para analisar: pedido, item, produto, SKU, fotos, rastreamento, seller, cliente, histórico, pagamento e mensagens.

A nota de resolução do Admin é interna (Admin e auditoria); o cliente vê o resultado, não a nota. O lojista vê, no card do pedido na Central, motivo, itens e status de devolução, cancelamento e disputa, sem ações: a mediação continua no Admin (decisões de 15 e 16/10/2026).

---

# 27. Avaliações

Avaliação de produto (`ProductReview`) e de seller (`SellerReview`) são entidades diferentes; não misturar as duas reputações. Somente compradores válidos avaliam. A nota é inteira, de 1 a 5 (a casa decimal só aparece na média); a avaliação aceita fotos, não vídeo; o servidor recusa nota quebrada e vídeo.

---

# 28. Perguntas sobre produto

Perguntas públicas sobre produtos entram no MVP (ex.: "Serve na CRF 250F 2025?") e o seller responde. Isso substitui o chat privado no MVP.

Não implementar chat privado cliente-seller inicialmente, por causa de moderação, spam, venda por fora, anexos, denúncias, notificações e complexidade.

---

# 29. Motos completas

No MVP, motos completas não entram no checkout tradicional. O marketplace prioriza peças, equipamentos, acessórios, vestuário, ferramentas, manutenção, componentes e consumíveis.

Motos completas poderão existir no futuro como módulo de anúncios/leads. Não misturar a compra de uma moto completa com o checkout normal de peças sem decisão explícita.

---

# 30. Seller

O seller pode ser CPF ou CNPJ e o cadastro precisa de aprovação do Moto Shop. Status: `PENDING`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `BLOCKED`, `REJECTED`. Um seller pode ter múltiplos usuários.

---

# 31. Permissões de seller

Preparar o sistema para múltiplos membros por seller, com roles (`OWNER`, `ADMIN`, `CATALOG`, `ORDERS`, `FINANCE`) e, internamente, permissions granulares (`PRODUCT_CREATE`, `PRODUCT_UPDATE`, `PRODUCT_DELETE`, `ORDER_READ`, `ORDER_UPDATE`, `FINANCE_READ`, `SELLER_MANAGE`).

A entrada na equipe é por convite com aceite: o lojista convida por e-mail e a pessoa só vira membro ao aceitar com a conta daquele e-mail verificado (`SellerMemberInvite`). Ninguém é adicionado sem consentimento.

---

# 32. Segurança multi-tenant

**Requisito crítico.** Toda query de seller valida tenant/seller; nunca confiar somente em IDs recebidos do cliente. Seller A nunca lê nem altera dados privados do Seller B.

Errado, quando o seller está editando:

```ts
db.product.update({ where: { id: productId }, data });
```

Preferir validar ownership:

```ts
const product = await db.product.findFirst({
  where: { id: productId, sellerId: session.sellerId },
});
```

Criar testes específicos para isolamento multi-tenant.

---

# 33. Segurança

Nunca expor secrets, tokens OAuth, access/refresh tokens, credenciais ou dados sensíveis desnecessários. Secrets ficam apenas no servidor; nunca usar `NEXT_PUBLIC_*` para segredo.

Validar permissões server-side. UI escondida nunca é mecanismo de segurança.

---

# 34. Dados sensíveis

Guardar somente dados necessários e nunca dados completos de cartão. Não logar senha, token, cartão, CVV, segredo OAuth nem cookies de sessão; mascarar em logs quando necessário.

---

# 35. Prisma

Prisma é o ORM principal; não criar padrões concorrentes de acesso ao banco. Raw SQL pode ser usado para consulta complexa, performance, busca, relatório ou recurso específico do PostgreSQL, mas encapsulado e documentado.

---

# 36. Transações

Usar transações em operações que precisam ser atômicas: criação de pedido, reserva/baixa de estoque, movimentação financeira interna, refund + atualização de estado e operações relacionadas que não podem ficar pela metade.

Evitar transações longas com chamadas de rede externas (`BEGIN -> banco -> Mercado Pago -> Melhor Envio -> COMMIT`). Separar efeitos externos usando estados e workflows.

---

# 37. Estados e máquinas de estado

Pedidos, pagamentos, envios e devoluções têm estados, sem transições arbitrárias (ex.: `PENDING_PAYMENT -> PAID -> PROCESSING -> SHIPPED -> DELIVERED`). Cancelar apenas quando a transição fizer sentido. Centralizar as regras de transição.

---

# 38. Server Components

Preferir Server Components para leitura de produto, categorias, páginas de SEO, detalhes, dashboards server-rendered e listagens que não precisam ser altamente interativas. Não transformar tudo em `"use client"`; usar Client Components só onde houver necessidade real.

---

# 39. Server Actions

Usar para mutations internas do app. Toda Action deve:

1. autenticar quando necessário;
2. validar input;
3. verificar autorização;
4. chamar application service/use case;
5. retornar resultado previsível.

Action não é lugar para regra complexa.

---

# 40. Route Handlers

Usar para webhooks, callbacks OAuth, endpoints públicos, integrações e APIs consumidas externamente. Não criar `/api/*` para toda leitura interna se um Server Component pode consultar a camada de aplicação diretamente.

---

# 41. Busca

No MVP, preferir PostgreSQL (full-text search, `pg_trgm`, índices apropriados). Não adicionar Elasticsearch, Algolia, Meilisearch ou Typesense sem necessidade comprovada. Criar abstração se a busca começar a ficar complexa.

---

# 42. SEO

O storefront é desenvolvido pensando em SEO para produtos, categorias, marcas, motos e páginas de compatibilidade. URLs legíveis (`/produto/capacete-fox-v1`, `/categoria/capacetes`, `/moto/honda/crf-250r/2025`), metadata adequada e nenhum conteúdo importante disponível só depois de JavaScript client-side.

---

# 43. Performance

Prioridades: Server Components, cache consciente, imagens otimizadas, queries indexadas, evitar N+1, paginação, lazy loading quando apropriado e bundles pequenos. Não criar cache prematuro de tudo: primeiro medir.

---

# 44. Mobile first

A experiência do cliente é prioritariamente mobile. Checkout, busca, filtros e página de produto devem funcionar muito bem em telas pequenas. Não construir desktop primeiro e "adaptar depois".

---

# 45. Acessibilidade

Componentes interativos consideram teclado, foco, labels, aria quando necessário, contraste e estados disabled/loading/error. Preferir primitives acessíveis do shadcn/Radix.

---

# 46. Padrões TypeScript

TypeScript strict. Evitar `any` (se inevitável, justificar localmente); preferir `unknown` em entradas externas e validar. Não duplicar tipos que podem ser derivados de schemas quando isso reduzir inconsistência.

Padrões de código do projeto:

- **Nunca usar `else`.** Retorno antecipado (early return) para validações, permissões e casos vazios; `continue` em laços; ternário curto ou função extraída quando os dois caminhos calculam um valor.
- **Assíncrono sempre com `async`/`await`**, nunca `.then()`. Única exceção: o fallback de uma linha sobre uma promessa aguardada (`await response.json().catch(() => ({}))`). Funções puras e síncronas (cálculo de preço, formatação, componentes de cliente, hooks) continuam síncronas.
- **Null checks explícitos**, sem a afirmação de não nulo (`valor!`): retornar cedo, lançar erro claro ou usar valor padrão. Variáveis de ambiente obrigatórias são lidas por uma função que falha com mensagem quando faltam.
- **No máximo 3 níveis** de blocos aninhados (`if`/`for`/`try`) por função; acima disso, extrair uma função.
- **Espaçamento:** o Prettier define indentação e quebras; separar blocos lógicos (validação, consulta, efeito, retorno) com uma linha em branco, sem linhas em branco duplicadas.

O ESLint aplica as regras verificáveis: `no-restricted-syntax` (`else` e `.then()`), `@typescript-eslint/no-non-null-assertion` e `max-depth: 3`; `pnpm lint` falha se forem violadas.

---

# 47. Naming

Código, banco, interfaces e domínio técnico em inglês (`Product`, `Seller`, `Order`, `Payment`, `Shipment`, `Return`, `Coupon`, `Promotion`). Textos exibidos ao usuário podem ser em português.

---

# 48. Datas

Datas em UTC internamente quando aplicável, convertidas para o timezone adequado na apresentação. Biblioteca: **date-fns**. Não usar Moment.js.

---

# 49. IDs

IDs internos não dependem de sequência pública previsível: UUID, CUID2 ou equivalente. O número visível do pedido pode ser separado do ID interno (`id = cmabc123...`, `orderNumber = MS-202609-01842`). Nunca usar `orderNumber` como mecanismo de autorização.

---

# 50. Auditoria

Operações administrativas importantes são auditáveis: seller aprovado ou suspenso, produto aprovado ou rejeitado, comissão alterada, refund, disputa resolvida, pedido alterado manualmente. Preparar entidade de audit log quando necessário.

---

# 51. Erros

Não expor stack trace ao usuário. Erros de domínio são claros e tipados (`OUT_OF_STOCK`, `INVALID_COUPON`, `SELLER_SUSPENDED`, `PAYMENT_FAILED`, `PRODUCT_NOT_AVAILABLE`). Logs podem ter detalhes técnicos; UI não.

---

# 52. External providers

Toda integração externa fica atrás de um adapter/provider (`PaymentProvider`, `ShippingProvider`, `EmailProvider`, `StorageProvider`). O domínio nunca depende diretamente de detalhes do SDK.

---

# 53. Retries

Toda chamada externa crítica considera timeout, retry, idempotência, rate limit, erro temporário e erro permanente. Não criar loop de retry infinito.

---

# 54. Feature flags

Não adicionar plataforma de feature flags no MVP. Se necessário, usar configuração simples no banco ou ambiente.

---

# 55. Infra de MVP

Objetivo inicial: custo mínimo. App na **Vercel**, banco na **Neon**, Redis na **Upstash**, jobs no **Inngest**, storage no **ImageKit Forever Free**, e-mail no **Resend** e monitoramento no **Sentry**.

Ao atingir limites reais, migrar ou aumentar planos por componente. Não reestruturar a aplicação por medo de escala futura.

---

# 56. Bibliotecas que NÃO devem ser adicionadas sem motivo forte

NestJS, GraphQL, Kafka, RabbitMQ, Kubernetes, Elasticsearch, Temporal, microservices, Redux, Formik, Moment.js, múltiplas libs de UI e múltiplos ORMs. Uma nova dependência deve resolver um problema concreto.

---

# 57. Antes de instalar uma biblioteca

Perguntar: o problema já é resolvido pela stack atual? A biblioteca é realmente necessária, mantida e funciona bem com o Next.js atual? Tem bom suporte TypeScript? Aumenta muito o bundle? Adiciona lock-in? Existe solução simples sem dependência?

Não reinventar funcionalidades complexas de segurança ou infraestrutura só para evitar uma lib madura.

---

# 58. Antes de criar uma nova abstração

Não criar abstração só porque "pode ser útil no futuro". Criar quando existem múltiplas implementações, há chance real de troca, o domínio precisa ficar isolado ou ela reduz acoplamento importante. Faz sentido desde cedo para pagamento, frete, storage e e-mail.

---

# 59. Antes de implementar uma feature

Verificar se ela afeta multi-seller, comissão, estoque, pedido, pagamento ou frete; se precisa de idempotência ou audit log; se precisa ser parcial por seller/item; se exige permission check ou tenant isolation; e se precisa funcionar para guest. Essas perguntas evitam grande parte dos bugs arquiteturais do Moto Shop.

---

# 60. Regra de ouro para IA

Antes de gerar código:

1. localizar o módulo correto;
2. entender as entidades envolvidas;
3. preservar a arquitetura modular;
4. evitar duplicar lógica;
5. verificar impacto multi-seller;
6. verificar segurança;
7. verificar idempotência;
8. verificar concorrência;
9. manter tipos fortes;
10. escrever testes quando a alteração envolver regra de negócio.

---

# 61. Não assumir requisitos

Se uma decisão de produto não estiver definida aqui, em `docs/decisions.md` ou no código existente: não inventar silenciosamente uma regra complexa; escolher a opção mais simples e reversível quando seguro; documentar a suposição; pedir decisão do responsável só quando ela bloquear uma implementação importante.

Não criar features extras por iniciativa própria.

---

# 62. Preservar simplicidade

O Moto Shop deve ser sofisticado no domínio, não na infraestrutura. Preferir uma app Next.js bem organizada a oito serviços distribuídos sem necessidade; PostgreSQL a bancos especializados prematuros; funções simples e testáveis a padrões arquiteturais cerimoniosos sem ganho real.

---

# 63. Fonte da verdade

Ordem de prioridade para decisões:

1. instrução explícita atual do responsável pelo projeto;
2. este `AGENTS.md` e `docs/decisions.md`;
3. regras já consolidadas no código/testes;
4. documentação oficial das tecnologias;
5. padrões genéricos.

Ao alterar uma decisão estrutural importante, atualizar este arquivo ou `docs/decisions.md`.

---

# 64. Checklist antes de PR

- [ ] `corepack pnpm format:check` passa.
- [ ] Lint passa.
- [ ] TypeScript passa sem erros.
- [ ] Testes relevantes passam.
- [ ] `corepack pnpm build` passa.
- [ ] Não existe segredo exposto.
- [ ] Permissões foram verificadas.
- [ ] Multi-tenancy foi considerado.
- [ ] Multi-seller foi considerado.
- [ ] Valores monetários usam centavos.
- [ ] Webhooks críticos são idempotentes.
- [ ] Operações externas possuem tratamento de erro.
- [ ] UI possui loading/error/empty state quando aplicável.
- [ ] Mobile foi validado.
- [ ] Nenhuma dependência desnecessária foi adicionada.
- [ ] Nenhuma regra crítica ficou apenas no client.
- [ ] Alterações estruturais relevantes foram documentadas.

---

**Este arquivo deve ser mantido atualizado conforme decisões estruturais, comerciais ou de domínio forem alteradas.**

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
