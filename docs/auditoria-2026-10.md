# Auditoria MotoShop — outubro/2026

Escopo: lógica de negócio, segurança, SRP/arquitetura e UI/UX das três áreas (loja, Central do Lojista e Admin). As correções foram aplicadas por cima do estado não commitado do repositório; nada foi commitado.

## Validação

| Verificação                                         | Antes                    | Depois                                                                                           |
| --------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| `tsc --noEmit`                                      | 0 erros                  | 0 erros                                                                                          |
| `eslint .`                                          | limpo                    | limpo                                                                                            |
| Vitest                                              | 93 arquivos / 468 testes | 121 arquivos / 624 testes, todos passando                                                        |
| Integração (`tests/integration`) e E2E (Playwright) | —                        | não executados: precisam de banco e servidor. Compilam, e o spec E2E foi ajustado às novas rotas |
| `next build`                                        | —                        | não executado                                                                                    |

Prettier acusa cerca de 110 arquivos, a maioria intocados nesta revisão. A causa provável é final de linha CRLF do Windows. Rode `pnpm format` antes de commitar.

## 1. Bugs de lógica e segurança corrigidos

### Alta severidade

- **Devolução antes da entrega.** Era possível abrir uma devolução em pedido `PAID`/`PROCESSING`: o cliente recebia o reembolso e também o produto. Agora a devolução exige `DELIVERED`, checado antes e dentro da transação. A regra vive em `returns/domain/return-eligibility.ts` e é usada pela página e pelo serviço.
- **Admin protegido só pelo layout.** Agora todas as páginas admin chamam `requireAdminAccess()`.
- **Melhor Envio sem permissões.** O OAuth pedia apenas `shipping-calculate`, então compra, geração e rastreio de etiqueta falhavam sempre. Agora pede os escopos completos.
- **Reembolso preso em PENDING.** Um timeout ou `in_process` travava o reembolso para sempre e bloqueava cancelamentos. Agora o retry reconsulta o provedor com a mesma chave de idempotência.

### Média severidade

- Webhook que falhava ficava em `PROCESSING` para sempre. Agora há `onFailure` que marca `FAILED`, e o admin pode reprocessar eventos travados há mais de 15 minutos.
- Cartão recusado esvaziava o carrinho e o reenvio caía no pedido cancelado. O carrinho volta a `ACTIVE` e o formulário descarta a chave de idempotência (`paymentDeclined`).
- Limite de cupom por cliente burlável trocando maiúsculas no e-mail. O e-mail agora é normalizado e a comparação ignora maiúsculas.
- Pedido pendente com estoque reservado para sempre quando o pagamento era estornado ou sofria chargeback. `REFUNDED`/`charged_back` agora são terminais.
- Promoção que acabava no meio do checkout gerava preço gravado diferente do cobrado. O instante da compra (`now`) agora é único.
- Pedido de convidado aberto pelo link seguro não permitia devolução, cancelamento ou disputa para usuário logado. Novo helper `orders/application/resolve-customer-order-access.ts`.
- Avaliação permitida antes da entrega, só chamando a action. Agora exige `DELIVERED` e item sem cancelamento ou reembolso.
- Open redirect no login (`/login?next=/%09/evil.com`). Novo `auth/domain/safe-redirect.ts`, com 15 testes.
- Etiqueta podia ser comprada ou gerada em pedido com cancelamento solicitado ou já cancelado. O status agora é rechecado com lock após a chamada ao provedor.
- Status agregado ficava "Parcialmente cancelado" para sempre. Agora é calculado primeiro pelos pedidos de lojista ativos.
- Rejeitar um cancelamento restaurava status desatualizado. Agora há re-sync pelo status atual do envio.
- Resumo financeiro do lojista ignorava reembolsos. Agora expõe `refundedAmountInCents` e `netSalesInCents`.
- Webhook do Mercado Pago aceitava replay. Agora rejeita `ts` fora de ±5 minutos.
- Evento outbox de pagamento não era emitido para cartão aprovado no checkout. Agora vem de `apply-payment-outcome`.
- Favorito de produto arquivado não podia ser removido.
- Adicionar membro à equipe agora exige e-mail verificado.

## 2. Decisões de negócio pendentes (não alteradas)

Estão marcadas no código com `TODO(regra-de-negócio)` e `TODO(convite)`.

1. **Cupom financiado pelo marketplace + split.** O `application_fee` não desconta o cupom do marketplace, então no split o lojista paga o desconto. Exemplo: item de R$100, comissão de 12% e cupom de R$20 do marketplace. O lojista deveria receber R$88 e recebe R$68.
2. **Comissão sobre subtotal bruto**, mesmo quando o próprio lojista financia o desconto. É preciso confirmar a regra e documentá-la no AGENTS.md §15.
3. **Convite de equipe.** O lojista ainda adiciona qualquer usuário verificado sem consentimento. O ideal é um fluxo de convite com aceite.
4. **`WebhookEvent` não tem `updatedAt`.** O retry usa `receivedAt`. Vale adicionar a coluna numa migration.
5. **`PARTIALLY_REFUNDED` em pedido ainda pendente** vai para revisão manual: o webhook fica `FAILED` com mensagem explicativa.
6. **Etiqueta comprada em pedido cancelado no meio da compra.** O sistema não a usa e retorna CONFLICT, mas o cancelamento no Melhor Envio é manual.

## 3. SRP e arquitetura

| Arquivo                                      | Antes | Depois | Destino das responsabilidades                                                                                                               |
| -------------------------------------------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin/components/admin-section-content.tsx` | 1745  | 49     | 14 seções em `admin/components/sections/`, `admin-href.ts`, `admin-ui.tsx`, `queries/dashboard-counters.ts`                                 |
| `app/(seller)/seller/page.tsx`               | 837   | 112    | cards em `sellers/components/dashboard/`, novas rotas `/seller/products`, `/seller/settings`, `/seller/coupons`                             |
| `checkout/application/checkout-service.ts`   | 695   | ~210   | `seller-charges`, `order-number`, `create-pending-order`, `reserve-order-inventory`, `validate-coupon-for-customer`, `assert-payment-ready` |
| `app/products/[slug]/page.tsx`               | 613   | 251    | `products/components/detail/*`, seções de avaliações/perguntas, `product-offer-summary`, `build-product-json-ld`                            |
| `marketing/components/marketing-home.tsx`    | 576   | 60     | header e finder (client) + 6 server components; o JS no cliente caiu                                                                        |
| `checkout/components/checkout-form.tsx`      | 413   | 209    | hooks `use-checkout-shipping-quotes`/`use-checkout-submit` + 5 subcomponentes                                                               |
| `app/orders/[orderNumber]/page.tsx`          | 354   | 75     | `orders/components/order-detail/*`                                                                                                          |
| `products/actions/product-actions.ts`        | 299   | ~150   | `products/application/product-lifecycle.ts`, `inventory/application/adjust-inventory-manually.ts`                                           |

Outras mudanças estruturais:

- **Lógica de pagamento duplicada eliminada.** Checkout e reconciliação agora usam o mesmo `payments/application/apply-payment-outcome.ts`.
- **Regras de elegibilidade** (devolução, cancelamento, disputa, avaliação) agora são funções de domínio compartilhadas entre a UI e o servidor.
- **Rótulos de status** antes espalhados por 4+ arquivos, já divergentes entre si, agora vêm de uma fonte única: `shared/presentation/status-labels.ts`.
- **Datas** agora usam `lib/format.ts`, que fixa o fuso `America/Sao_Paulo`. Antes, pedidos feitos após as 21h apareciam com a data do dia seguinte.
- **Prisma direto em páginas** foi movido para queries: admin, edição de produto, frete do lojista e integrações.
- **Ingestão de webhook** saiu do route handler para `payments/application/ingest-webhook.ts`.

Ficou para depois:

- `tx.auditLog.create` (44 chamadas) num helper tipado.
- Mover regras das actions de catálogo, carrinho e lojistas para `application/`.
- Injetar provedores em vez de importá-los direto.

## 4. Design system e UI/UX

**Tokens:**

- Novos tokens semânticos em `globals.css`: `success`, `warning`, `info`, `brand-strong`, `moto-brand-surface` e `surface-sunken`.
- Cores fixas em `.tsx` caíram de 93 hex + 127 classes de paleta para 0 na interface. Sobraram 4 hex só nos e-mails, que precisam de estilo inline.

**Novos primitivos em `components/ui`:**

- `StatusBadge`: tom de cor + ícone, para não depender só de cor.
- `PageHeader` e `SectionHeader`.
- `EmptyState`, `StatCard` e `FormMessage` (com `role="alert"`/`status`).
- `Skeleton`, `PageSkeleton` e `ProductGridSkeleton`.
- `QuantityStepper`.
- Novas variantes de `Badge`.

**Estados de tela:**

- 8 `loading.tsx` novos.
- `not-found.tsx` com marca, busca e link para o catálogo.
- `error.tsx` no admin e no lojista, mantendo a navegação.

**Produto:**

- Banner "Minha Moto" acima da escolha da variação: verde quando serve, alerta quando não serve, neutro quando não há moto.
- Uma única escolha de variação e um único CTA.
- Adicionar ao carrinho não tira mais o cliente da página.

**Catálogo:**

- Filtros antes da grade no mobile e na lateral no desktop.
- Ordenação ao lado da contagem.
- Filtros ativos como chips removíveis.
- Estado vazio com "Limpar filtros".

**Carrinho:**

- Miniatura, link, total por linha e stepper de 44px com atualização otimista.

**Checkout:**

- `autoComplete`, máscaras de CEP e CPF e teclado numérico.
- Endereço preenchido via ViaCEP e frete cotado automaticamente.
- Resumo fixo no desktop.
- Erros ligados aos campos (`aria-describedby`) e foco no alerta.

**Central do Lojista:**

- Visão geral com KPIs.
- Navegação com Produtos, Cupons e Configurações.
- Permissões preservadas.
- Links antigos `/seller?product…`/`?coupon…` redirecionam.

**Admin:**

- Dashboard com contadores de pendências.
- Tabelas com rolagem no mobile.
- Status em português (antes apareciam enums em inglês).

**Acessibilidade e textos:**

- Um `h1` por página; os layouts deixaram de ter `h1`.
- Skip link.
- Menu da conta acessível.
- Textos: "lojista" em vez de "seller", "Loja VIP", "Finalizar compra", "Compatibilidades de motos" e grafia única "Moto Shop".

## 5. Próximos passos sugeridos

1. Rodar `pnpm test:integration` e `pnpm test:e2e` com banco local. O spec E2E já foi ajustado para `/seller/settings`, `/seller/coupons`, "Aplicar filtros" e o novo add-to-cart.
2. Decidir as regras de negócio da seção 2, em especial a do split antes de habilitar pagamentos com múltiplos lojistas.
3. `cart-thumbnails.ts` faz uma consulta extra. Incluir as imagens em `getActiveCart`.
4. `ProductShippingQuote` ainda tem seletor de variação próprio. Fazê-lo seguir a variação escolhida no buy box.
5. Modo escuro: os tokens `.dark` existem, mas nada aplica a classe. Decidir entre terminar ou remover.
6. Rodar `pnpm format`.

---

# Segunda rodada — 07/10/2026

Validação final: `tsc` 0 erros (os tipos de rota estavam apontando para um build antigo e escondiam 11 erros), `eslint .` limpo (o lint varria `.next-build-check`; o ignore agora cobre `.next*/**`), Vitest **137 arquivos / 759 testes** (antes 121 / 624), `next build` concluído. Conferência visual a 375px: home, catálogo e produto sem rolagem horizontal, um `h1`, sem erros de console. Integração e Playwright não foram executados (precisam de banco/servidor dedicados).

## Lógica corrigida

- **Reembolso recusado travava cancelamento/devolução para sempre** (estoque nunca devolvido): chave de idempotência por tentativa (`returns/domain/refund-attempt.ts`), limite de 5; pagamento já reembolsado no provider encerra a solicitação com auditoria.
- **Pedidos sem cobrança criada ficavam pendentes para sempre** segurando estoque e cupom: ciclo `PREPARED/SENT/REJECTED` em `payments/domain/payment-request-state.ts`; 429 passa a ser recusa definitiva.
- **Chargeback/mediação em pedido pago era espelhado em silêncio**: o webhook fica `FAILED` para revisão.
- **Taxa do marketplace maior que o valor cobrado** com cupom grande: o checkout recusa antes de criar o pedido.
- Reembolso com valor divergente do solicitado permanece `PENDING`; webhooks de outras integrações são ignorados.
- **Etiqueta cancelada nunca podia ser substituída**; cancelamento aprovado com etiqueta comprada agora sinaliza o cancelamento no Admin (com confirmação auditada); reconciliações de etiqueta revalidam status sob lock e sincronizam o fulfillment; 4xx do Melhor Envio é definitivo; refresh de token concorrente relê o token.
- Vínculo de pedido guest exige e-mail verificado e é auditado.
- Rate limit na cotação de frete (visitante, IP e lojista) e na reconsulta de pagamento.
- Auditoria de criação de cupom, alteração da origem de envio e edição de resposta; perguntas só em produtos de lojistas ativos.
- Edição concorrente de produto detecta conflito pela `revision`.
- E-mail não se perde mais após crash do worker; Admin pode reenviar entregas com falha.
- Links sociais da loja limitados aos domínios de cada rede, com `rel="nofollow ugc"`.
- Checkout tinha `paymentAvailable={false}` fixo e a Public Key do cartão nunca chegava ao formulário: agora vem de `getCheckoutPaymentAvailability`, e o aviso aparece já no carrinho.
- Action de reembolso genérica, sem auditoria e sem uso, foi removida.

## SRP

- `admin-return-actions.ts` e `admin-dispute-actions.ts` → `returns/application/review-return.ts`, `refund-return.ts`, `disputes/application/review-dispute.ts`.
- `fulfill-seller-order.ts` → `orders/application/sync-fulfillment-status.ts`, `shipping/domain/shipment-payload.ts`, `shipment-operation-guard.ts`, `shipment-label-cancellation.ts`.
- `mercado-pago-provider.ts` → `mercado-pago/http.ts` + `mercado-pago/mappers.ts`.
- Regra de variante comprável unificada (`products/application/purchasable-variant.ts`); regras de carrinho em `cart/application/cart-items.ts`; upload verificado do ImageKit em `shared/storage/attach-verified-asset.ts`.

## Design system e UX

- Um único sistema de estilos: `marketing-home.module.css` caiu de 1093 para 35 linhas. Header, rodapé (`SiteFooter`) e card de produto (`ProductCard`) compartilhados em todo o storefront.
- Botão "Sair" (não existia); `AppAreaHeader` comum ao lojista e ao admin.
- Controles de 44px no mobile, campos `text-base` (sem zoom no iOS), raio único, token `brand-text` no lugar do hack `.text-primary`, tema escuro incompleto removido.
- `FormField` e `PasswordInput`; formulário de produto em React Hook Form + Zod com erro por campo e slug automático; login com erro por campo, mostrar senha e `?modo=cadastro`.
- Edição de produto com status, motivo da rejeição e envio para aprovação na própria página.
- Barra fixa de compra no produto e de "Finalizar compra" no carrinho (mobile), subtotal por loja, item sem estoque sinalizado.
- Loja: catálogo antes das avaliações, com os mesmos filtros de `/products`.
- Textos padronizados: "lojista" e "O Moto Shop".

## Decisões pendentes do responsável

1. **WhatsApp na vitrine da loja**: decidido em 08/10/2026, o link fica mantido por decisão do cliente (registrado no `AGENTS.md`).
2. **Código de cupom é único globalmente**: um lojista pode ocupar `BLACKFRIDAY` antes do Admin. Unicidade por dono ou prefixo reservado?
3. **Montagem da etiqueta**: resolvido no PR `fix/melhor-envio-purchase`, que reaproveita os volumes da cotação na compra.
4. Os itens da seção 2 da primeira rodada continuam em aberto (split com cupom do marketplace, base da comissão, convite de equipe).
