# AGENTS.md — O Moto Shop

> Este arquivo é a fonte principal de contexto técnico e de produto do Moto Shop.
> Antes de criar, alterar, refatorar ou remover qualquer funcionalidade, leia este documento por completo.
> Em caso de conflito entre uma sugestão técnica genérica e este documento, este documento tem prioridade, salvo instrução explícita do responsável pelo projeto.

---

# 1. Visão do produto

**O Moto Shop** é um marketplace vertical focado exclusivamente no ecossistema de motocross.

O produto nasce como **marketplace multi-lojista**, não como e-commerce de loja única.

O Moto Shop terá três experiências principais:

1. **Marketplace / Storefront**
   - Navegação pública.
   - Busca.
   - Categorias.
   - Produtos.
   - Minha Moto.
   - Carrinho.
   - Checkout.
   - Pedidos.
   - Favoritos.
   - Avaliações.
   - Perguntas sobre produtos.

2. **Central do Lojista**
   - Cadastro e gestão de produtos.
   - Preços.
   - Promoções.
   - Estoque.
   - Variações.
   - Pedidos.
   - Fretes.
   - Cupons.
   - Integrações.
   - Relatórios.
   - Perfil da loja.
   - Gestão de usuários e permissões.

3. **Admin do Moto Shop**
   - Aprovação de lojistas.
   - Aprovação de produtos.
   - Gestão de categorias.
   - Gestão de marcas.
   - Gestão da base de motos.
   - Gestão de pedidos e disputas.
   - Configuração de comissão.
   - Gestão de plano VIP.
   - Cupons globais.
   - Campanhas.
   - Reembolsos.
   - Moderação.

---

# 2. Objetivo do MVP

O MVP deve validar o modelo de negócio com **custo de infraestrutura próximo de zero**, sem criar uma arquitetura descartável.

Prioridades:

- entregar rápido;
- código simples de manter;
- arquitetura modular;
- custos baixos;
- segurança financeira;
- rastreabilidade;
- boa experiência mobile;
- evitar dependências desnecessárias;
- evitar microserviços prematuros.

Não otimizar antecipadamente para milhões de usuários.

---

# 3. Stack oficial

A stack principal do Moto Shop é:

## Aplicação

- **Next.js**
- **React**
- **TypeScript**
- **pnpm**

Arquitetura:

- **Next.js fullstack**
- **Monólito modular**
- Server Components quando fizer sentido.
- Server Actions para mutations internas.
- Route Handlers para APIs públicas, integrações e webhooks.

Não criar um backend NestJS separado sem uma necessidade real aprovada.

---

## Banco de dados

- **PostgreSQL**
- **Neon**
- **Prisma**

O PostgreSQL é a fonte principal da verdade.

Nunca usar Redis como fonte da verdade para:

- pedidos;
- pagamentos;
- produtos;
- estoque;
- comissão;
- saldo;
- devoluções;
- usuários.

---

## Autenticação

- **Better Auth**

Usar autenticação centralizada e sessões seguras.

A autorização de negócio deve continuar pertencendo ao Moto Shop.

Não espalhar verificações como:

```ts
if (user.role === "admin")
```

por toda a aplicação.

Centralizar permissões.

---

## UI

- **Tailwind CSS**
- **shadcn/ui**
- **Lucide**
- componentes próprios do Moto Shop

Não adicionar outra biblioteca visual pesada sem necessidade.

---

## Formulários e validação

- **React Hook Form**
- **Zod**
- **@hookform/resolvers**

Toda entrada externa relevante deve ser validada.

Isso inclui:

- formulários;
- Server Actions;
- webhooks;
- query params;
- APIs externas;
- payloads de integrações.

---

## Estado

Usar a ferramenta correta para cada tipo de estado.

### Server state

Preferir Server Components.

### Client state

- **Zustand**

Usar apenas quando realmente houver estado de UI compartilhado.

Não mover dados do banco para Zustand sem motivo.

### Estado na URL

- **nuqs**

Usar para:

- filtros;
- busca;
- ordenação;
- paginação;
- categorias;
- parâmetros compartilháveis.

---

## Tabelas

- **TanStack Table**

Principalmente para:

- produtos;
- pedidos;
- sellers;
- pagamentos;
- devoluções;
- disputas;
- cupons;
- admin.

---

## Cache e rate limit

- **Upstash Redis**

Usar com parcimônia.

Casos adequados:

- rate limiting;
- locks;
- cache pontual;
- tokens temporários;
- proteção contra abuso;
- controle de concorrência.

---

## Processamento assíncrono

- **Inngest**

Usar para:

- e-mails;
- workflows;
- eventos de pagamento;
- eventos de frete;
- retries;
- tarefas agendadas;
- expiração de reservas;
- processamento de webhooks;
- notificações.

Não executar processos longos dentro de uma request HTTP.

---

## Storage

- **ImageKit Forever Free** para imagens de produto e identidade da loja. Decisão do responsável: não ativar R2 nem plano com cobrança de excedentes.

Uploads devem, quando possível, ser feitos diretamente do cliente com autenticação temporária gerada no servidor. Após o upload, o servidor deve confirmar caminho, tipo e tamanho do asset antes de associá-lo ao produto ou à loja.

Evitar:

```text
Browser -> Next.js -> arquivo grande -> ImageKit
```

Preferir:

```text
Browser -> autenticação temporária -> ImageKit
```

---

## Imagens

- **Sharp**

Gerar versões adequadas quando necessário:

- original;
- large;
- medium;
- thumbnail.

---

## E-mail

- **Resend**
- **React Email**

E-mails transacionais não devem bloquear fluxos de pagamento ou pedido.

Enviar através de jobs/workflows.

---

## Pagamento

Gateway inicial:

- **Mercado Pago**

O checkout deve permanecer dentro do Moto Shop.

Nunca redirecionar o cliente para uma experiência externa do Mercado Pago se houver alternativa compatível com o requisito de Checkout Transparente.

Criar abstração própria.

Exemplo:

```ts
interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPayment(id: string): Promise<PaymentResult>;
  refund(input: RefundPaymentInput): Promise<RefundResult>;
}
```

Implementação inicial:

```text
MercadoPagoProvider
```

Não espalhar SDK do Mercado Pago pelo projeto inteiro.

---

## Frete

Integração inicial:

- **Melhor Envio**

O sistema deve suportar:

- Melhor Envio conectado pelo seller;
- frete próprio do seller.

Criar abstração.

```ts
interface ShippingProvider {
  quote(input: ShippingQuoteInput): Promise<ShippingQuote[]>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  track(input: TrackShipmentInput): Promise<TrackingResult>;
}
```

Implementação inicial:

```text
MelhorEnvioProvider
```

---

## Observabilidade

- **Sentry**
- **Pino**

Logs devem ser estruturados.

Preferir:

```ts
logger.info({
  event: "payment.approved",
  orderId,
  sellerId,
  paymentId,
});
```

Evitar depender de:

```ts
console.log("chegou aqui");
```

---

## Testes

- **Vitest**
- **Playwright**

Prioridade alta para testes de:

- comissão;
- cálculo financeiro;
- checkout;
- carrinho multi-seller;
- estoque;
- cupons;
- descontos;
- pagamento;
- webhooks;
- idempotência;
- devoluções;
- permissões.

---

# 4. Arquitetura obrigatória

O Moto Shop é um **monólito modular**.

Organizar código por domínio, não apenas por tipo técnico.

Estrutura recomendada:

```text
src/
├── app/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── customers/
│   ├── sellers/
│   ├── stores/
│   ├── catalog/
│   ├── products/
│   ├── categories/
│   ├── brands/
│   ├── inventory/
│   ├── motorcycles/
│   ├── compatibility/
│   ├── cart/
│   ├── checkout/
│   ├── orders/
│   ├── payments/
│   ├── shipping/
│   ├── coupons/
│   ├── promotions/
│   ├── reviews/
│   ├── questions/
│   ├── returns/
│   ├── disputes/
│   ├── subscriptions/
│   └── notifications/
│
├── shared/
├── lib/
└── config/
```

Cada módulo pode conter:

```text
modules/products/
├── domain/
├── application/
├── infrastructure/
├── schemas/
├── components/
├── queries/
└── actions/
```

Não é obrigatório criar todas as pastas se o módulo ainda for simples.

Evitar abstrações vazias.

---

# 5. Regra fundamental de arquitetura

**Route Handlers e Server Actions não devem conter regras de negócio complexas.**

Errado:

```ts
export async function createProductAction(input: unknown) {
  // valida usuário
  // valida seller
  // valida categoria
  // valida marca
  // cria produto
  // cria variantes
  // cria estoque
  // envia notificação
  // registra auditoria
}
```

Preferir:

```ts
export async function createProductAction(input: unknown) {
  const data = createProductSchema.parse(input);

  return createProduct.execute({
    userId: await requireUserId(),
    data,
  });
}
```

Regra de negócio fica na camada de aplicação/domínio.

---

# 6. Domínio multi-lojista

O Moto Shop nasce com múltiplos sellers.

Um carrinho pode conter produtos de vários lojistas.

Exemplo:

```text
Cart
├── Seller A
│   ├── Product 1
│   └── Product 2
│
└── Seller B
    └── Product 3
```

O cliente deve ter **um checkout unificado**.

Internamente, o pedido deve ser dividido.

Estrutura conceitual:

```text
Order
├── SellerOrder A
│   ├── OrderItem
│   └── Shipment
│
└── SellerOrder B
    ├── OrderItem
    └── Shipment
```

Nunca modelar o pedido assumindo que existe apenas um seller.

---

# 7. Pedidos

Existem dois níveis importantes:

## Order

Representa a compra global do cliente.

## SellerOrder

Representa a parte do pedido pertencente a um seller.

Exemplo:

```text
Order MS-202609-0001

├── SellerOrder MX Parts
└── SellerOrder Racing Store
```

Cancelamentos, fretes, devoluções e fulfillment podem ser parciais.

Não assumir que todo o Order muda de estado junto.

---

# 8. Estoque

O seller controla o estoque através do Moto Shop.

O sistema deve atualizar automaticamente o estoque após vendas e ajustes.

Estoque deve existir por variante.

Exemplo:

```text
Capacete Fox V1
├── Preto / P: 3
├── Preto / M: 8
├── Preto / G: 2
└── Branco / M: 4
```

Manter histórico de movimentação.

Exemplo:

```text
InventoryMovement
- SALE
- MANUAL_IN
- MANUAL_OUT
- RETURN
- CANCEL
- CORRECTION
```

Nunca atualizar estoque sem rastreabilidade.

---

# 9. Produtos

Produtos podem ter:

- nome;
- slug;
- descrição;
- SKU;
- preço;
- preço promocional;
- marca;
- categoria;
- imagens;
- peso;
- dimensões;
- seller;
- status;
- variantes;
- estoque;
- compatibilidade com motos.

Produtos novos precisam de **aprovação do Moto Shop inicialmente**.

Fluxo sugerido:

```text
DRAFT
-> SUBMITTED
-> APPROVED

ou

-> REJECTED
```

No futuro sellers confiáveis poderão ter autoaprovação.

Não implementar isso agora sem necessidade.

---

# 10. Categorias e marcas

Categorias e marcas são controladas pelo Moto Shop.

Sellers não criam categorias livremente.

Sellers não criam marcas livremente.

Isso evita duplicidade e dados ruins.

---

# 11. Minha Moto

**Minha Moto é funcionalidade central do MVP.**

Usuário pode selecionar:

- fabricante;
- modelo;
- versão;
- cilindrada;
- ano.

Exemplo:

```text
Honda
CRF 250R
2025
```

Produtos podem ser compatíveis com múltiplas motos.

Nunca armazenar compatibilidade como texto livre.

Usar relacionamento estruturado.

Exemplo conceitual:

```text
Product
  |
ProductCompatibility
  |
MotorcycleFitment
```

A base de motos é controlada pelo Moto Shop.

Sellers podem sugerir novos modelos, mas não criar livremente.

---

# 12. Cliente convidado

O cliente pode comprar sem criar conta.

O checkout deve pedir **o mínimo de dados necessário** para concluir:

- nome;
- e-mail;
- telefone;
- CPF quando necessário;
- endereço de entrega.

Não obrigar criação de senha.

Depois do pedido, fornecer link seguro para acompanhamento.

Pedidos guest devem poder ser vinculados posteriormente a uma conta autenticada após validação segura do e-mail/identidade.

Nunca usar IDs previsíveis como único mecanismo de acesso a pedido guest.

---

# 13. Carrinho

Carrinho deve suportar vários sellers.

Carrinho deve ser persistente.

Pode existir para:

- usuário autenticado;
- visitante.

Não armazenar preço final como verdade apenas no cliente.

Na hora do checkout:

- recalcular preços;
- revalidar estoque;
- revalidar promoções;
- revalidar cupons;
- recalcular frete;
- revalidar seller.

---

# 14. Dinheiro

**Nunca usar `float` para dinheiro.**

Valores monetários devem ser armazenados em centavos.

Exemplo:

```ts
const price = 149990;
```

Representa:

```text
R$ 1.499,90
```

Aplicar isso para:

- preços;
- desconto;
- subtotal;
- frete;
- comissão;
- taxa;
- reembolso;
- valor do seller.

Comissões percentuais devem preferencialmente usar basis points.

Exemplo:

```text
12% = 1200 bps
10,5% = 1050 bps
```

Cálculos financeiros devem ter testes.

---

# 15. Comissão

O Moto Shop monetiza através de comissão sobre vendas.

Existe uma comissão global padrão.

Exemplo:

```text
marketplaceDefaultCommissionBps = 1200
```

Cada seller pode ter override individual.

Exemplo:

```text
Seller A = 1200 bps
Seller B = 1000 bps
Seller C = 800 bps
```

Não hardcodar comissão em código.

A configuração deve vir do banco.

Registrar no pedido a comissão efetivamente utilizada naquele momento.

Mudanças futuras de comissão não podem alterar pedidos antigos.

---

# 16. Plano VIP

Existe um plano VIP para sellers.

No MVP, o VIP funciona principalmente como **assinatura mensal e ganho de exposição**.

Benefícios possíveis:

- destaque na busca;
- vitrines;
- produtos recomendados;
- selo;
- campanhas;
- relatórios melhores.

VIP não deve significar automaticamente "primeiro resultado".

Ranking deve considerar:

- relevância;
- compatibilidade;
- preço;
- reputação;
- disponibilidade;
- conversão;
- boost comercial.

Conteúdo patrocinado deve ser identificável como patrocinado quando aplicável.

---

# 17. Pagamentos

Gateway inicial: Mercado Pago.

O cliente permanece dentro do Moto Shop.

O sistema precisa estar preparado para split de marketplace.

Como o carrinho pode ter vários sellers, qualquer implementação financeira deve considerar **multi-seller desde o princípio**.

Não assumir disponibilidade automática de split 1:N.

A solução final depende da modalidade liberada pelo Mercado Pago para a conta do marketplace.

Toda integração de pagamento deve ser:

- idempotente;
- auditável;
- rastreável;
- resiliente a retries;
- desacoplada do SDK.

Nunca confiar apenas no retorno do navegador para confirmar pagamento.

Pagamento é confirmado server-side.

---

# 18. Webhooks

Webhooks devem ser persistidos antes do processamento relevante.

Tabela conceitual:

```text
WebhookEvent
- id
- provider
- externalId
- type
- payload
- status
- receivedAt
- processedAt
- error
```

Criar constraint:

```text
UNIQUE(provider, externalId)
```

Objetivo:

- impedir processamento duplicado;
- permitir retry;
- auditoria;
- debug.

Responder webhook rapidamente.

Processamento pesado deve ser encaminhado ao Inngest.

---

# 19. Idempotência

Idempotência é obrigatória para:

- pagamento;
- refund;
- webhooks;
- criação de pedido;
- compra de etiqueta;
- callbacks externos;
- jobs críticos.

Nunca assumir que uma API externa chamará uma única vez.

---

# 20. Frete

O frete é calculado por seller.

Exemplo:

```text
Seller A
- Jadlog R$ 20
- SEDEX R$ 32

Seller B
- Jadlog R$ 28
- SEDEX R$ 43
```

O cliente escolhe um método por seller.

Frete total é a soma dos fretes.

Suportar:

- Melhor Envio;
- frete próprio do seller.

---

# 21. Cupons

Existem dois tipos principais:

## Marketplace coupon

Criado pelo Moto Shop.

## Seller coupon

Criado pelo seller.

Registrar claramente:

- owner;
- desconto;
- limite;
- período;
- escopo;
- responsável financeiro pelo desconto.

Nunca perder a informação de quem subsidiou o desconto.

---

# 22. Frete grátis

Pode ser financiado por:

- seller;
- O Moto Shop;
- ambos.

Registrar valores separados.

Exemplo:

```text
shippingAmount = 3000
sellerSubsidy = 2000
marketplaceSubsidy = 1000
customerShippingAmount = 0
```

---

# 23. Promoções

Seller pode definir:

- preço normal;
- preço promocional;
- data inicial;
- data final.

Guardar histórico quando necessário para auditoria e regras comerciais.

Promoção deve ser validada server-side.

---

# 24. Devoluções

Cliente pode solicitar devolução dentro do Moto Shop.

Devolução pode ser por item.

Status conceituais:

```text
REQUESTED
UNDER_REVIEW
APPROVED
WAITING_RETURN
RETURNED
REFUNDED
REJECTED
```

Permitir anexos/fotos quando necessário.

---

# 25. Cancelamento

Cliente não cancela automaticamente.

Ele faz uma **solicitação de cancelamento**.

A operação deve considerar:

- status do pagamento;
- envio;
- etiqueta;
- seller;
- estoque;
- reembolso.

Se já enviado, normalmente tratar como devolução.

---

# 26. Disputas

O Moto Shop faz mediação entre cliente e seller.

Admin deve ter dados suficientes para analisar:

- pedido;
- item;
- produto;
- SKU;
- fotos;
- rastreamento;
- seller;
- cliente;
- histórico;
- pagamento;
- mensagens.

---

# 27. Avaliações

Avaliação de produto e seller são entidades diferentes.

Somente compradores válidos devem avaliar.

Exemplo:

```text
ProductReview
SellerReview
```

Não misturar as duas reputações.

---

# 28. Perguntas sobre produto

Perguntas públicas sobre produtos entram no MVP.

Exemplo:

```text
"Serve na CRF 250F 2025?"
```

Seller responde.

Isso substitui chat privado no MVP.

Não implementar chat privado cliente-seller inicialmente.

Motivos:

- moderação;
- spam;
- venda por fora;
- anexos;
- denúncias;
- notificações;
- complexidade.

---

# 29. Motos completas

No MVP, motos completas não entram no checkout tradicional.

O marketplace inicialmente prioriza:

- peças;
- equipamentos;
- acessórios;
- vestuário;
- ferramentas;
- manutenção;
- componentes;
- consumíveis.

Motos completas poderão futuramente existir como módulo de anúncios/leads.

Não misturar fluxo de compra de uma moto completa com checkout normal de peças sem decisão explícita.

---

# 30. Seller

Seller pode ser:

- CPF;
- CNPJ.

Cadastro precisa de aprovação do Moto Shop.

Status sugeridos:

```text
PENDING
APPROVED
ACTIVE
SUSPENDED
BLOCKED
REJECTED
```

Seller pode ter múltiplos usuários.

---

# 31. Permissões de seller

Preparar o sistema para múltiplos membros por seller.

Exemplos de roles:

```text
OWNER
ADMIN
CATALOG
ORDERS
FINANCE
```

Preferir permissions granulares internamente.

Exemplo:

```text
PRODUCT_CREATE
PRODUCT_UPDATE
PRODUCT_DELETE
ORDER_READ
ORDER_UPDATE
FINANCE_READ
SELLER_MANAGE
```

---

# 32. Segurança multi-tenant

Este é um requisito crítico.

Toda query de seller deve validar tenant/seller.

Nunca confiar somente em IDs recebidos do cliente.

Errado:

```ts
db.product.update({
  where: { id: productId },
  data,
});
```

quando o seller está editando.

Preferir validar ownership.

Exemplo conceitual:

```ts
const product = await db.product.findFirst({
  where: {
    id: productId,
    sellerId: session.sellerId,
  },
});
```

Nunca permitir que Seller A leia ou altere dados privados do Seller B.

Criar testes específicos para isolamento multi-tenant.

---

# 33. Segurança

Nunca expor:

- secrets;
- tokens OAuth;
- access tokens;
- refresh tokens;
- credenciais;
- dados sensíveis desnecessários.

Secrets ficam apenas no servidor.

Nunca usar variável `NEXT_PUBLIC_*` para segredo.

Validar permissões server-side.

Nunca confiar em UI escondida como mecanismo de segurança.

---

# 34. Dados sensíveis

Guardar somente dados necessários.

Não armazenar dados completos de cartão.

Não logar:

- senha;
- token;
- cartão;
- CVV;
- segredo OAuth;
- cookies de sessão.

Aplicar mascaramento em logs quando necessário.

---

# 35. Prisma

Prisma é o ORM principal.

Não criar vários padrões concorrentes de acesso ao banco.

Raw SQL pode ser usado quando:

- consulta complexa;
- performance;
- busca;
- relatório;
- recurso específico do PostgreSQL.

Mas deve ser encapsulado e documentado.

---

# 36. Transações

Usar transações em operações que precisam ser atômicas.

Exemplos:

- criação de pedido;
- reserva/baixa de estoque;
- movimentação financeira interna;
- refund + atualização de estado;
- operações relacionadas que não podem ficar pela metade.

Evitar transações longas envolvendo chamadas de rede externas.

Errado:

```text
BEGIN
-> banco
-> chama Mercado Pago
-> espera
-> chama Melhor Envio
-> espera
-> COMMIT
```

Separar efeitos externos usando estados e workflows.

---

# 37. Estados e máquinas de estado

Pedidos, pagamentos, envios e devoluções possuem estados.

Não permitir transições arbitrárias.

Exemplo:

```text
PENDING_PAYMENT
-> PAID
-> PROCESSING
-> SHIPPED
-> DELIVERED
```

Cancelar apenas quando transição fizer sentido.

Centralizar regras de transição.

---

# 38. Server Components

Preferir Server Components para:

- leitura de produto;
- categorias;
- páginas de SEO;
- detalhes;
- dashboards server-rendered;
- listagens quando não precisam ser altamente interativas.

Não transformar tudo em `"use client"`.

Usar Client Components apenas onde houver necessidade real.

---

# 39. Server Actions

Usar Server Actions para mutations internas do app.

Toda Action deve:

1. autenticar quando necessário;
2. validar input;
3. verificar autorização;
4. chamar application service/use case;
5. retornar resultado previsível.

Action não é local para regra complexa.

---

# 40. Route Handlers

Usar Route Handlers para:

- webhooks;
- callbacks OAuth;
- endpoints públicos;
- integrações;
- APIs que precisem ser consumidas externamente.

Não criar `/api/*` para toda leitura interna se um Server Component pode consultar a camada de aplicação diretamente.

---

# 41. Busca

No MVP, preferir PostgreSQL.

Possíveis recursos:

- full-text search;
- `pg_trgm`;
- índices apropriados.

Não adicionar:

- Elasticsearch;
- Algolia;
- Meilisearch;
- Typesense

sem necessidade comprovada.

Criar abstração se a busca começar a ficar complexa.

---

# 42. SEO

Storefront deve ser desenvolvido pensando em SEO.

Importante para:

- produtos;
- categorias;
- marcas;
- motos;
- páginas de compatibilidade.

Usar URLs legíveis.

Exemplo:

```text
/produto/capacete-fox-v1
/categoria/capacetes
/moto/honda/crf-250r/2025
```

Gerar metadata adequada.

Evitar conteúdo importante disponível apenas depois de JavaScript client-side.

---

# 43. Performance

Prioridades:

- Server Components;
- cache consciente;
- imagens otimizadas;
- queries indexadas;
- evitar N+1;
- paginação;
- lazy loading quando apropriado;
- bundles pequenos.

Não criar cache prematuro de tudo.

Primeiro medir.

---

# 44. Mobile first

A experiência do cliente deve ser prioritariamente mobile.

Checkout, busca, filtros e página de produto devem funcionar muito bem em telas pequenas.

Não construir desktop primeiro e "adaptar depois".

---

# 45. Acessibilidade

Componentes interativos precisam considerar:

- teclado;
- foco;
- labels;
- aria quando necessário;
- contraste;
- estados disabled/loading/error.

Preferir primitives acessíveis do shadcn/Radix.

---

# 46. Padrões TypeScript

TypeScript strict.

Evitar:

```ts
any;
```

Se for inevitável, justificar localmente.

Preferir:

```ts
unknown;
```

em entradas externas e validar.

Não duplicar tipos que podem ser derivados de schemas quando isso reduzir inconsistência.

---

# 47. Naming

Usar inglês no código.

Exemplos:

```text
Product
Seller
Order
Payment
Shipment
Return
Coupon
Promotion
```

Textos exibidos ao usuário podem ser em português.

Banco, código, interfaces e domínio técnico preferencialmente em inglês.

---

# 48. Datas

Usar datas em UTC internamente quando aplicável.

Converter para timezone adequado na apresentação.

Biblioteca:

- **date-fns**

Não usar Moment.js.

---

# 49. IDs

IDs internos não devem depender de sequência pública previsível.

Preferir:

- UUID;
- CUID2;
- estratégia equivalente.

Número visível do pedido pode ser separado do ID interno.

Exemplo:

```text
id = cmabc123...
orderNumber = MS-202609-01842
```

Nunca usar `orderNumber` como mecanismo de autorização.

---

# 50. Auditoria

Operações administrativas importantes devem ser auditáveis.

Exemplos:

- seller aprovado;
- seller suspenso;
- produto aprovado;
- produto rejeitado;
- comissão alterada;
- refund;
- disputa resolvida;
- pedido alterado manualmente.

Preparar entidade de audit log quando necessário.

---

# 51. Erros

Não expor stack trace ao usuário.

Erros de domínio devem ser claros e tipados.

Exemplos:

```text
OUT_OF_STOCK
INVALID_COUPON
SELLER_SUSPENDED
PAYMENT_FAILED
PRODUCT_NOT_AVAILABLE
```

Logs podem ter detalhes técnicos; UI não.

---

# 52. External providers

Toda integração externa deve ficar atrás de um adapter/provider.

Exemplos:

```text
PaymentProvider
ShippingProvider
EmailProvider
StorageProvider
```

Nunca deixar o domínio depender diretamente de detalhes do SDK.

---

# 53. Retries

Toda chamada externa crítica deve considerar:

- timeout;
- retry;
- idempotência;
- rate limit;
- erro temporário;
- erro permanente.

Não criar loop de retry infinito.

---

# 54. Feature flags

Não adicionar uma plataforma de feature flags no MVP.

Se necessário, usar configuração simples no banco ou ambiente.

Evitar infraestrutura antes da necessidade.

---

# 55. Infra de MVP

Objetivo inicial: custo mínimo.

Preferências atuais:

```text
App:
Vercel

Database:
Neon

Redis:
Upstash

Jobs:
Inngest

Storage:
ImageKit Forever Free

Email:
Resend

Monitoring:
Sentry
```

Ao atingir limites reais, migrar ou aumentar planos por componente.

Não reestruturar a aplicação apenas por medo de escala futura.

---

# 56. Bibliotecas que NÃO devem ser adicionadas sem motivo forte

Evitar inicialmente:

- NestJS;
- GraphQL;
- Kafka;
- RabbitMQ;
- Kubernetes;
- Elasticsearch;
- Temporal;
- microservices;
- Redux;
- Formik;
- Moment.js;
- múltiplas libs de UI;
- múltiplos ORMs.

Uma nova dependência deve resolver um problema concreto.

---

# 57. Antes de instalar uma biblioteca

A IA ou desenvolvedor deve perguntar internamente:

1. O problema já é resolvido pela stack atual?
2. A biblioteca é realmente necessária?
3. Ela é mantida?
4. Ela funciona bem com Next.js atual?
5. Possui bom suporte TypeScript?
6. Aumenta muito o bundle?
7. Adiciona lock-in?
8. Existe uma solução simples sem dependência?

Não reinventar funcionalidades complexas de segurança ou infraestrutura só para evitar uma lib madura.

---

# 58. Antes de criar uma nova abstração

Não criar abstração apenas porque "pode ser útil no futuro".

Criar quando:

- existem múltiplas implementações;
- existe alta chance real de troca;
- domínio precisa ficar isolado;
- reduz acoplamento importante.

Exemplos onde abstração faz sentido desde cedo:

- pagamento;
- frete;
- storage;
- e-mail.

---

# 59. Antes de implementar uma feature

Verificar:

- afeta multi-seller?
- afeta comissão?
- afeta estoque?
- afeta pedido?
- afeta pagamento?
- afeta frete?
- precisa de idempotência?
- precisa de audit log?
- precisa ser parcial por seller/item?
- exige permission check?
- exige tenant isolation?
- precisa funcionar para guest?

Essas perguntas evitam grande parte dos bugs arquiteturais do Moto Shop.

---

# 60. Regra de ouro para IA

Antes de gerar código, a IA deve:

1. localizar o módulo correto;
2. entender as entidades envolvidas;
3. preservar arquitetura modular;
4. evitar duplicar lógica;
5. verificar impacto multi-seller;
6. verificar segurança;
7. verificar idempotência;
8. verificar concorrência;
9. manter tipos fortes;
10. escrever testes quando a alteração envolver regra de negócio.

---

# 61. Não assumir requisitos

Se uma decisão de produto não estiver definida neste arquivo ou no código existente:

- não inventar silenciosamente uma regra complexa;
- escolher a opção mais simples e reversível quando seguro;
- documentar a suposição;
- pedir decisão do responsável apenas quando ela bloquear uma implementação importante.

Não criar features extras por iniciativa própria.

---

# 62. Preservar simplicidade

O Moto Shop deve ser sofisticado no domínio, não na infraestrutura.

Preferir:

```text
1 app Next.js bem organizada
```

a:

```text
8 serviços distribuídos sem necessidade
```

Preferir:

```text
PostgreSQL
```

a adicionar bancos especializados prematuramente.

Preferir:

```text
funções simples e testáveis
```

a padrões arquiteturais cerimoniosos sem ganho real.

---

# 63. Fonte da verdade

Ordem de prioridade para decisões:

1. instrução explícita atual do responsável pelo projeto;
2. este `AGENTS.md`;
3. regras já consolidadas no código/testes;
4. documentação oficial das tecnologias;
5. padrões genéricos.

Quando alterar uma decisão estrutural importante, atualizar este arquivo.

---

# 64. Checklist antes de PR

Antes de considerar uma tarefa concluída:

- [ ] TypeScript passa sem erros.
- [ ] Lint passa.
- [ ] Testes relevantes passam.
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

# 65. Resumo executivo

Se houver pouco tempo para ler este arquivo, nunca esquecer:

```text
O Moto Shop = marketplace multi-seller de motocross.

Stack:
Next.js + TypeScript
Neon PostgreSQL + Prisma
Better Auth
Tailwind + shadcn/ui
Zod + React Hook Form
Zustand + nuqs
Upstash Redis
Inngest
ImageKit Forever Free
Resend
Mercado Pago
Melhor Envio
Sentry
Vitest + Playwright

Arquitetura:
Monólito modular.

Regras:
- Multi-seller desde o primeiro dia.
- Um checkout, vários SellerOrders.
- Estoque por variante.
- Minha Moto faz parte do MVP.
- Cliente pode comprar como guest.
- Dinheiro sempre em centavos.
- Comissão configurável.
- Produto novo exige aprovação inicialmente.
- Categories/brands/motorcycles são controlados pelo Moto Shop.
- Pagamentos e webhooks precisam ser idempotentes.
- Next.js pode ser fullstack.
- Jobs complexos ficam no Inngest.
- Não criar microserviços prematuramente.
- Não colocar regra complexa em Server Actions/Route Handlers.
- Toda query de seller deve respeitar tenant isolation.
```

Decisões adicionais do MVP:

- A garagem pessoal `SavedMotorcycle` pertence ao `User` e referencia exclusivamente `MotorcycleFitment` da base administrada. Cada usuário pode salvar a mesma configuração uma vez; um índice parcial permite no máximo uma moto principal. A primeira vira principal, e remover a principal promove a próxima configuração ativa disponível. Consultas e mutações sempre filtram `userId` no servidor.
- A moto principal aparece como seleção inicial na landing e como atalho explícito no catálogo; o filtro efetivo continua representado por `?moto=<fitmentId>` na URL. No detalhe do produto, ausência de relacionamento de compatibilidade significa "não confirmada", nunca incompatibilidade comprovada.

- Formulários de produto permitem peso embalado em gramas e dimensões da embalagem em milímetros, como inteiros positivos opcionais no rascunho. Valores nulos na variante herdam o campo correspondente do produto. Não inventar medidas ao preencher o formulário.
- Promoções são configuradas por variante em rascunhos/rejeitados, com preço positivo inferior ao normal e limites temporais opcionais. As datas do formulário usam UTC−03:00 explícito e são persistidas em UTC; início/fim vazios representam limites abertos. Para remover a promoção, limpar preço e datas. Alterações comerciais registram snapshot de antes/depois na auditoria transacional.
- A comissão individual é editada exclusivamente no Admin, em percentual com até duas casas decimais, persistida como basis points. Campo vazio remove o override; zero é uma comissão explícita de 0%. Atualizações concorrentes com valor anterior divergente são rejeitadas, a alteração é auditada e nunca modifica snapshots de pedidos antigos.

- Frete próprio usa `SellerShippingMethod`: faixa de CEP inclusiva, preço fixo em centavos por `SellerOrder` e prazo em dias úteis após confirmação do pagamento. Novas modalidades ficam desativadas; somente `SELLER_MANAGE` pode criar/ativar/desativar. Pedidos preservam o snapshot da cotação. Alterações de valores são feitas criando outra modalidade e desativando a anterior.
- Entregas próprias (`Shipment.provider = OWN`) são atualizadas manualmente com `ORDER_UPDATE`, ownership e auditoria transacional: pedido pago → enviado → entregue. Não compram etiquetas nem chamam Melhor Envio. Rastreio é opcional.
- Financiamento de desconto de cupom usa `marketplaceDiscountInCents`/`sellerDiscountInCents` no `SellerOrder`; os campos `marketplaceSubsidyInCents`/`sellerSubsidyInCents` continuam exclusivos de frete grátis.
- Confirmação de venda exige pagamento `APPROVED`; `AUTHORIZED` ainda aguarda captura. Timeout incerto preserva pedido/reserva pendente para reconciliação, sem liberar estoque ou emitir outra cobrança automaticamente.
- O adapter atual do Mercado Pago não implementa repasse 1:N. A flag de ambiente não habilita essa capacidade; checkout real multi-seller permanece bloqueado até integração homologada. Simulação de pagamentos ocorre exclusivamente por injeção de provider em testes, sem rota pública ou modo fake em produção.
- Busca, ranking e paginação públicos são calculados no PostgreSQL em `public-product-page.ts`; só os produtos da página são carregados pelo Prisma. SQL parametrizado preserva sinais de relevância, estoque, avaliações e VIP, com desempate estável.
- Testes de integração e navegador usam contas `@example.test`, identificadores únicos e limpeza restrita aos registros da execução. Nunca resetar o banco compartilhado nem usar credenciais reais de pagamento nos testes.

- O plano VIP é representado por `SellerSubscription`, com validade e status persistidos.
- No MVP, a ativação/renovação do VIP é administrativa; não simular cobrança recorrente antes da integração de assinatura do Mercado Pago.
- Produtos de sellers com VIP ativo recebem identificação de conteúdo patrocinado.
- O VIP é um sinal pequeno de ranking, depois de relevância, disponibilidade e reputação; não garante o primeiro resultado.
- Categorias, marcas, fabricantes, modelos e fitments são governados pelo Admin; sellers apenas selecionam referências ativas.
- A compatibilidade do produto é persistida por relacionamento estruturado e pode conter múltiplos fitments.
- Imagens de produto usam upload direto para ImageKit com autenticação temporária; a persistência de `ProductImage` exige ownership e conferência do asset no servidor. A URL pública depende de `IMAGEKIT_URL_ENDPOINT`.
- A gestão inicial da equipe adiciona apenas usuários já cadastrados; convites externos e transferência de ownership ficam fora do MVP.
- Busca, filtros, ordenação e paginação do storefront são estado da URL e devem ser carregados, filtrados e paginados no servidor; o ranking de relevância continua considerando disponibilidade, reputação e o sinal comercial limitado do VIP.
- Favoritos são persistidos em `Favorite`, com unicidade por usuário e produto; somente produtos aprovados podem ser salvos e a lista exige autenticação.
- Endereços salvos pertencem exclusivamente ao usuário autenticado em `CustomerAddress`; o checkout pode usá-los como preenchimento, mas sempre grava um snapshot independente em `OrderAddress`.
- O histórico autenticado em `/orders` deve consultar pedidos exclusivamente pelo `userId`; o detalhe mantém suporte separado para `orderNumber` com token seguro de guest.
- Produtos podem ter múltiplas variantes ativas, cada uma com SKU, preço e estoque próprios; em edições de rascunhos/rejeitados, remoções desativam a variante para preservar histórico em vez de apagá-la.
- Categorias, marcas e compatibilidade por moto/ano possuem URLs públicas legíveis e devem reutilizar a camada de consulta/ranking do storefront, sem duplicar regras de produto ou criar um buscador externo no MVP.
- SEO público usa `generateMetadata`, canonical URLs, `sitemap.ts`, `robots.ts` e JSON-LD sanitizado; somente produtos aprovados e referências ativas entram no sitemap.
- Vitrines públicas só podem expor sellers com status `APPROVED` ou `ACTIVE` e devem listar exclusivamente produtos `APPROVED` pertencentes ao `sellerId` da loja.
- O perfil público da loja (`name`, `slug` e `description`) pode ser alterado apenas com `SELLER_MANAGE`, sempre validando `sellerId` no servidor e registrando `AuditLog`; dados de origem e frete continuam privados.
- Logo e banner da loja usam chaves explícitas no `Store`, upload direto para ImageKit e associação server-side com prefixo do seller e conferência do asset; a vitrine só deriva URLs públicas dos assets associados.
- Cards públicos de produto podem exibir apenas a primeira `ProductImage` associada; a URL é derivada no servidor e o card sempre mantém fallback textual quando não houver imagem pública.
- A vitrine pública agrega a nota do seller no servidor e serializa no máximo seis avaliações recentes, sempre filtradas pelo `sellerId` da loja e originadas de compras verificadas.
- A galeria de `ProductImage` só pode ser reordenada ou removida pelo seller dono de produto `DRAFT`/`REJECTED`; a primeira posição é a capa pública e a limpeza do ImageKit não fica dentro de transação de banco.
- O fulfillment sincroniza o status do `SellerOrder` a partir do envio dentro de transação; depois recalcula o `Order` global, permitindo estados parciais e sem regredir cancelamentos.
- Notificações de fulfillment são eventos do Inngest e usam `NotificationDelivery` com chave `sellerOrderId + status`; falha de enfileiramento não desfaz a mudança operacional do pedido.
- Preferências de e-mail de atualização pertencem ao `User` e são verificadas no workflow antes do envio; não expor preferências de outro usuário.
- Mudanças de status de fulfillment devem registrar auditoria com actor autenticado sempre que originadas pela Central do Lojista.
- A listagem do seller usa paginação e filtros na URL, com `sellerId` sempre presente no `where`; não trazer todos os pedidos para o client.
- O acompanhamento público pode exibir linha do tempo e rastreio do `Shipment`, mas nunca expõe dados privados de origem do seller.
- Listagens operacionais de seller e cliente devem paginar no servidor e validar o tenant ou `userId` no `where`.
- Filtros de fila devem ser representados por parâmetros tipados na URL, permitindo links compartilháveis e paginação estável.
- Filas administrativas de sellers e produtos devem limitar status e quantidade no banco antes de serializar dados para a página.
- Auditoria administrativa pode exibir ação, entidade, ator e metadados, mas deve continuar protegida pelo `requireAdminAccess`.
- Resumos financeiros do seller devem usar valores persistidos no `SellerOrder`, sempre em centavos, e excluir pedidos não confirmados ou cancelados.
- Alertas de estoque devem consultar `Inventory` com `sellerId` no filtro e respeitar a variante ativa do produto.
- Monitoramento administrativo de pedidos deve preservar a separação por `SellerOrder` e não expor dados de endereço ou tokens guest.
- Avaliações e perguntas públicas devem ter paginação independente; médias e contagens devem ser agregadas no servidor, sem depender apenas da página carregada.
- Busca operacional de pedidos deve combinar texto e status no `where` do seller, mantendo `sellerId` obrigatório para isolamento.
- Ativação ou desativação de cupons deve validar owner e tenant no servidor e registrar auditoria com o usuário autenticado.
- Filas de devoluções, cancelamentos e disputas devem limitar status e paginação antes de serializar dados no Admin.
- Operações de estoque do seller devem apresentar todas as variantes e preservar ajustes auditáveis por `InventoryMovement`.
- Listagens de cupons devem paginar e filtrar por owner, código e disponibilidade sem misturar marketplace e seller.
- Busca em filas administrativas deve usar relações do banco para localizar pedido, cliente ou loja, preservando os filtros de status.
- Aprovação ou rejeição de seller/produto é uma mudança administrativa crítica e deve persistir o estado e o `AuditLog` na mesma transação.
- Filtros de estoque devem consultar `Inventory` relacionado à variante ativa e manter o `sellerId` no escopo da consulta.
- Suspensão e reativação de seller são transições administrativas explícitas, com `AuditLog` transacional e bloqueio de acesso enquanto o seller estiver suspenso.
- Produto arquivado pode voltar a `DRAFT` somente por ação do seller dono, sempre com ownership server-side e auditoria.
- Uso de cupom deve ser consultado por agregação/count do banco, sem serializar resgates completos para as páginas operacionais.
- O detalhe do pedido pode expor ao próprio cliente o histórico dos pagamentos e transações vinculados ao `Order`, sem revelar metadados sensíveis do provider.
- Reconsulta manual de pagamento aceita somente pedidos autorizados por sessão ou token guest seguro, limita-se a pagamentos pendentes e reutiliza o reconciliador idempotente.
- Cartão de crédito usa Secure Fields do MercadoPago.js (iframes) e token descartável; PAN, validade e CVV nunca passam pelo servidor do Moto Shop. A primeira versão aceita crédito em uma parcela, definida no servidor. A Public Key pertence à mesma aplicação/ambiente do Access Token; somente a Public Key chega ao navegador. A URL opcional `MERCADO_PAGO_NOTIFICATION_URL` é enviada por cobrança e exige assinatura secreta configurada, sem sobrescrever configurações globais de outras integrações. Cartões e webhook real permanecem sujeitos à homologação.
- Recuperação de pagamento sem ID externo consulta por referência do pedido e exige resultado único, com validação de ID, referência, valor, moeda e método. Nunca cria nova cobrança. Busca vazia, timeout ou ambiguidade preservam reservas. O Inngest agenda recuperação paginada a cada dez minutos para pendências com mais de dois minutos; depende do serviço ativo. Expiração local de QR/idade do pedido não autoriza liberar estoque: é necessária recusa/cancelamento confirmado pelo provider.
- Filas administrativas devem combinar busca textual, status e paginação no `where` do banco, limitando o payload serializado.
- A busca de seller deve considerar loja e membros, mas nunca remover o filtro de status ou a proteção administrativa.
- A moderação de produtos pode localizar nome, slug, SKU ou loja sem expor dados privados do seller além do necessário à revisão.
- O monitor de pedidos administrativos continua baseado em `SellerOrder`, mesmo quando a busca usa dados do `Order` global.
- Perguntas do seller devem manter `sellerId` no `where` ao aplicar busca por texto ou produto.
- Listagens de pedidos do cliente podem carregar somente o último pagamento para resumo; o histórico completo fica no detalhe do pedido.
- O filtro de estoque do catálogo do seller deve ser refletido na URL e enviado ao `listSellerProducts`, mantendo o tenant no `where`.
- O histórico autenticado de pedidos pode buscar pelo `orderNumber`, sempre combinado com `userId` antes da paginação.
- O monitor administrativo de webhooks deve exibir apenas metadados operacionais e nunca serializar o payload bruto para a interface.
- Entregas de notificações devem ser consultadas por status e dados operacionais, mantendo erros limitados ao necessário para diagnóstico.
- Datas de validade de cupons podem ser exibidas na operação, mas a aplicação e o checkout continuam validando vigência no servidor.
- Retry manual de webhook deve ser exclusivo do Admin, registrar auditoria e reverter para `FAILED` se o reenfileiramento não for confirmado.
- Histórico de `InventoryMovement` do seller deve filtrar por `sellerId` e expor apenas os metadados operacionais necessários.
- Comissão padrão deve ser atualizada em basis points, persistida no `MarketplaceConfiguration` e nunca retroagir sobre pedidos já criados.
- Filtros de vigência de cupom devem aceitar datas nulas como limites abertos e não substituir a validação server-side do checkout.
- Totais exibidos no checkout são informativos até a submissão; o serviço de checkout deve recalcular preços, estoque, cupom e frete no servidor.
- Filtros de pedidos do seller podem combinar status do `SellerOrder` e status do `Shipment`, sempre com `sellerId` no `where`.
- O monitor administrativo pode filtrar `SellerOrder` por seller selecionado, sem trocar a unidade operacional por `Order` global.
- Filtros de pagamento no histórico do cliente devem combinar a relação `payments` com `userId` antes da paginação.
- O visualizador de auditoria pode buscar `entityId`, mas continua protegido por `requireAdminAccess` e sem expor segredos.
- Disponibilidade no storefront deve consultar variantes ativas e inventário no servidor, preservando produtos multi-variante.
- O monitor administrativo pode filtrar o `Shipment` por status sem perder a unidade operacional de `SellerOrder`.
- A busca por loja no histórico do cliente deve combinar `sellerOrders.some` com `userId` antes da paginação.
- Perguntas do seller podem ser localizadas pelo e-mail do cliente, sempre preservando o `sellerId` no `where`.
- A faixa de preço do storefront deve considerar o preço vigente de variantes ativas e usar centavos, sem confiar em cálculo do cliente.
- Cupons futuros são identificados por `startsAt > now`; a vigência final continua sendo validada no checkout.
- O histórico do cliente pode filtrar por status de `Shipment`, sempre combinado com `userId` e sem expor pedidos de terceiros.
- O catálogo do seller pode filtrar por categoria, mantendo `sellerId` no `where` e opções de categorias controladas pelo Moto Shop.
- O storefront deve listar apenas sellers aprovados ou ativos ao oferecer filtro público de loja.
- Monitoramento de webhook pode filtrar `provider` no banco sem serializar o payload bruto.
- Entregas de notificação podem filtrar `kind` no banco, preservando status, paginação e dados operacionais mínimos.
- O catálogo do seller pode filtrar por marca usando `brandId` junto do `sellerId`, sem abrir acesso entre tenants.
- A busca do histórico do cliente pode consultar snapshots de produto em `SellerOrder.items`, sempre combinada com `userId`.
- A regra de promoção ativa deve ser centralizada no domínio de pricing e reutilizada por filtros e checkout.
- A fila de moderação pode combinar categoria e marca com o status de revisão antes da paginação.
- Janelas temporais de monitoramento devem validar datas no servidor e usar limites UTC explícitos.
- A fila de moderação pode filtrar por `sellerId`, mantendo o escopo administrativo e a unidade de produto submetido.
- O visualizador de auditoria deve aplicar o período em `createdAt` antes da paginação e sem serializar dados desnecessários.
- Entregas de notificação podem filtrar `createdAt` por período, preservando o status e o tipo operacional.
- Períodos no histórico do cliente devem ser combinados com `userId` antes de qualquer paginação.
- O histórico de estoque deve filtrar `InventoryMovement.type` mantendo `sellerId` e a rastreabilidade da operação.
- Filas administrativas de devoluções, cancelamentos e disputas podem filtrar `sellerId` sem misturar unidades de seller.
- Consultas administrativas de pós-venda devem aplicar status, seller e busca antes da paginação.
- A ordenação do histórico do cliente deve ser aplicada no `orderBy` do banco depois do escopo `userId`.
- O histórico de `InventoryMovement` pode filtrar por período UTC além do tipo, sem remover o isolamento do seller.
- Filas administrativas de pós-venda podem filtrar `createdAt` por período UTC, combinando status, seller e busca antes da paginação.
- Perguntas do seller podem filtrar período de criação sem remover o `sellerId` do escopo da consulta.
- A busca do storefront pode consultar SKU, marca, categoria e loja além de nome e descrição, mantendo apenas produtos aprovados e sellers ativos/aprovados.
- O catálogo do seller pode filtrar faixa de preço em centavos por variantes ativas, sempre combinado com `sellerId`.
- Auditoria administrativa pode filtrar ator por nome ou e-mail sem expor payloads ou dados sensíveis na interface.
- Pedidos do seller podem filtrar `createdAt` por período UTC, mantendo status, envio, busca e `sellerId` antes da paginação.
- O monitor administrativo de `SellerOrder` pode filtrar `createdAt` por período sem trocar a unidade operacional por `Order` global.
- A fila de moderação de produtos pode filtrar `submittedAt` por período antes da paginação, mantendo os filtros de status, seller e catálogo.
- O detalhe público deve aplicar filtro de nota nas avaliações no banco e recalcular média, contagem e paginação para o mesmo recorte.
- O histórico do cliente pode filtrar `totalAmountInCents` por faixa, sempre depois de aplicar o escopo `userId` na consulta.
- A busca do seller pode consultar `OrderItem.productNameSnapshot` e `skuSnapshot`, preservando o histórico congelado da compra.
- O monitor administrativo pode consultar nome e SKU de `OrderItem` sem depender do catálogo atual.
- A fila de pedidos do seller pode ordenar `createdAt` de forma crescente ou decrescente sem remover o `sellerId`.
- O monitor administrativo de `SellerOrder` pode alternar ordenação por `createdAt`, mantendo filtros de seller, status e envio.
- Avaliações públicas de loja devem ser paginadas no banco; o resumo completo não deve depender apenas da página carregada.
- Snapshots de itens são a fonte correta para busca histórica de pedidos, não dados mutáveis do catálogo atual.
- A busca do histórico do cliente pode consultar `skuSnapshot` junto do nome do produto, sempre protegida por `userId`.
- Perguntas do seller podem ordenar `createdAt` sem alterar o filtro de respostas, período ou isolamento por seller.
- Auditoria administrativa pode ordenar `createdAt` nos dois sentidos sem expor payloads.
- A fila de moderação deve ordenar `submittedAt` e usar `createdAt` como desempate, antes da paginação.
- Catálogos públicos de loja devem paginar produtos no banco e preservar parâmetros independentes das avaliações.
- Favoritos devem ser consultados com `userId`, paginados no servidor e limitados a produtos aprovados de sellers ativos/aprovados.
- A busca de favoritos deve usar relações do produto sem remover o escopo do usuário autenticado.
- O histórico de estoque pode buscar produto, variante ou SKU, mantendo `sellerId`, tipo e período no `where`.
- Webhooks administrativos podem ordenar por `receivedAt` sem serializar o payload bruto.
- Notificações administrativas podem ordenar por `createdAt`, mantendo apenas metadados operacionais no payload.
- Favoritos podem filtrar disponibilidade por variantes ativas e inventário, sempre com `userId` no escopo da consulta.
- Favoritos podem ordenar `createdAt` sem remover busca, disponibilidade, paginação ou o escopo do usuário autenticado.
- O histórico de `InventoryMovement` do seller pode ordenar `createdAt` nos dois sentidos mantendo `sellerId`, tipo, período e busca.
- Catálogos públicos de loja podem ordenar produtos por relevância, novidade ou preço, preservando paginação independente das avaliações.
- A fila administrativa de sellers pode ordenar `createdAt` nos dois sentidos sem remover status, busca ou paginação.
- Catálogos públicos de categoria, marca e moto devem paginar produtos no servidor, mantendo filtros na URL.
- Catálogos públicos podem ordenar por relevância, novidade ou preço sem remover o escopo de categoria, marca ou fitment.
- Disponibilidade pública deve considerar variantes ativas e inventário no servidor, sem confiar em estado do cliente.
- O catálogo do seller pode ordenar produtos por atualização ou nome mantendo `sellerId` no `where`.
- Cupons podem ordenar por criação, validade ou código sem perder owner, vigência, status e paginação.
- Filas administrativas de devoluções podem ordenar `createdAt` nos dois sentidos mantendo status, seller, período e paginação.
- Filas administrativas de cancelamentos podem ordenar `createdAt` nos dois sentidos mantendo a unidade de `SellerOrder`.
- Disputas administrativas podem ordenar `createdAt` nos dois sentidos sem remover status, seller, busca ou período.
- Perguntas públicas de produto podem ordenar `createdAt` sem remover paginação, estado de avaliações ou escopo do produto aprovado.
- Endereços salvos podem buscar campos de apresentação, mas sempre devem consultar com `userId` do usuário autenticado.
- Avaliações de produto podem ordenar `createdAt` sem remover filtro de nota, paginação ou escopo do produto aprovado.
- Avaliações públicas de loja podem ordenar `createdAt` preservando paginação de avaliações e produtos.
- Filtros públicos de promoção devem usar a regra de promoção ativa do domínio de pricing, nunca cálculo do cliente.
- Histórico de pedidos do cliente pode ordenar `totalAmountInCents`, sempre combinado com `userId`.
- Filas pós-venda administrativas podem buscar `productNameSnapshot` e `skuSnapshot` dos itens, preservando a fonte histórica do pedido.
- O catálogo do seller pode filtrar estoque `IN`, `LOW` e `OUT` por variantes ativas, mantendo `sellerId` no `where`.
- O catálogo do seller pode filtrar promoções ativas por datas e preço persistidos da variante, sem confiar no cliente.
- A vitrine pública da loja pode filtrar disponibilidade server-side mantendo seller aprovado e paginação.
- A vitrine pública da loja pode filtrar promoções usando a mesma semântica de promoção ativa do storefront.
- A busca da vitrine pública deve consultar nome, marca, categoria e SKU dentro do seller selecionado, preservando filtros na URL.
- A homepage pública (`/`) é uma landing comercial server-rendered. Antes do lançamento, pode exibir uma vitrine de demonstração solicitada pelo responsável, desde que produtos, preços e condições estejam claramente marcados como ilustrativos, não criem registros no catálogo e não ofereçam compra direta. Na versão de lançamento, os destaques devem vir apenas de produtos aprovados e categorias/marcas ativas; remover a vitrine mock ao ativar a vitrine real.
- A vitrine mock foi removida: a homepage mostra até quatro produtos aprovados, de sellers ativos/aprovados e com estoque disponível; sem elegíveis, usa estado vazio. Não apresentar preço ou disponibilidade inventados.
- Exceção explícita aprovada para apresentação antes do catálogo oficial: produtos marcados `isDemo` podem existir no banco com fotos locais geradas e valores/estoque ilustrativos. Devem ser identificados como demonstração no storefront, nunca entrar no carrinho/checkout (checagem server-side), não emitir Product JSON-LD nem entrar no sitemap. O seed é isolado por slugs `demo-*` e deve permanecer idempotente; nenhuma loja ou produto real pode ser sobrescrito. As lojas demo ficam `PENDING` até o código de bloqueio estar publicado.
- Recuperação de senha e verificação de e-mail usam os tokens nativos do Better Auth e envio pelo provider de e-mail do projeto. Sem Resend configurado, não oferecer recuperação funcional; exigir verificação de e-mail apenas com `AUTH_REQUIRE_EMAIL_VERIFICATION=true` e envio configurado, para evitar bloquear contas existentes acidentalmente.
- Vínculo posterior de pedido guest exige token de acesso não previsível, sessão autenticada e mesmo e-mail do pedido; a atualização é condicional e revoga o token no mesmo passo para impedir dupla vinculação.
- Rate limiting de autenticação e mutations sensíveis usa contador atômico no PostgreSQL como solução de MVP enquanto Upstash não está configurado; chaves persistidas são hashes e nunca contêm token ou e-mail em claro. Monitorar crescimento da tabela e migrar o armazenamento para Upstash se o volume justificar.
- Perguntas e avaliações públicas podem ser ocultadas/restauradas pelo Admin sem exclusão física. Consultas públicas ignoram itens ocultos, e cada alteração gera AuditLog. O histórico pessoal do pedido permanece acessível ao próprio cliente.
- A marca pública é **O Moto Shop**. Em textos de interface, SEO, e-mails e mensagens para pessoas, usar o artigo masculino e manter as duas palavras separadas. Identificadores técnicos internos, nomes de arquivos e chaves de integração não precisam ser renomeados.

---

**Este arquivo deve ser mantido atualizado conforme decisões estruturais, comerciais ou de domínio forem alteradas.**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
