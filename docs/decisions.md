# Decisões do MVP — O Moto Shop

Decisões pontuais tomadas ao longo do MVP, agrupadas por domínio. Complementam o [`AGENTS.md`](../AGENTS.md) e têm a mesma autoridade dele. Ao tomar uma decisão nova, registrá-la aqui, na seção do domínio.

---

## 1. Produto e marca

- A marca pública é **O Moto Shop**. Em textos de interface, SEO, e-mails e mensagens para pessoas, usar o artigo masculino e manter as duas palavras separadas. Identificadores técnicos internos, nomes de arquivos e chaves de integração não precisam ser renomeados.
- Títulos de aba e metadados usam **Moto Shop Brasil** (`BRAND_SITE_NAME` em `src/config/brand.ts`), por decisão do responsável (13/10/2026): páginas internas mostram `<Página> - Moto Shop Brasil`; a home mostra `Moto Shop Brasil - O Marketplace de quem vive o OFF-ROAD!`; `siteName`, `applicationName` e o OpenGraph padrão usam Moto Shop Brasil. O link de uma loja (`/loja/<slug>`) usa só o nome da loja, na aba e no OpenGraph. Nos textos do site continua "O Moto Shop".
- Decisões do responsável sobre o feedback do cliente (08/10/2026):
  - Login social (Google, Apple, Facebook): fora do escopo por enquanto.
  - Avaliações: cada avaliação tem nota inteira de 1 a 5; a casa decimal aparece apenas na média. Vídeo em avaliações está fora do escopo.
  - "Quantidade vendida" é exibida no produto e calculada a partir de pedidos reais confirmados (na demonstração, reflete os pedidos fictícios).
  - Estimativa de frete por localização automática e entregas por aplicativo (ex.: Uber): não serão implementadas.
  - Rodapé (atualizado em 13/10/2026 pelo modelo do cliente): descrição em dois parágrafos, horário de atendimento, formas de pagamento só com o que o checkout aceita pelo Mercado Pago (Pix e cartões Visa, Mastercard, Elo, American Express, Hipercard, Diners e Cabal; sem boleto) e atalhos Comprar, Vender, Pedidos e Entrar. Institucional lista só páginas que existem (hoje "Seja um Lojista"); "Sobre", trocas, políticas e termos entram quando o cliente mandar o texto. CNPJ e ícones de redes sociais ficam fora até chegarem os dados reais.
  - Link de WhatsApp na vitrine da loja: mantido, por decisão do cliente; o lojista não pode linkar uma loja própria fora da plataforma.
  - "Minha moto" é seleção de peças compatíveis (não venda de motos): a escolha acontece na página do produto e no catálogo, sem aba própria no menu da conta.

---

## 2. Carrinho, checkout e pagamento

### Carrinho e checkout

- Ao entrar (ou criar conta) com carrinho de visitante ativo, o carrinho guest é mesclado no carrinho ativo do usuário na primeira leitura do carrinho (`getCartIdentity`): soma quantidades por variante limitadas ao estoque disponível e a 99 por item, ignora variantes não compráveis (demo/inativas/arquivadas/sem estoque), nunca reduz quantidades já existentes, trava os dois carrinhos na mesma transação, marca o guest como `ABANDONED` (idempotente) e remove o cookie do visitante.
- Totais exibidos no checkout são informativos até a submissão; o serviço de checkout recalcula preços, estoque, cupom e frete no servidor.
- A disponibilidade do pagamento exibida no carrinho e no checkout vem de `getCheckoutPaymentAvailability`, que reaproveita as mesmas verificações do serviço de checkout; nunca fixar o valor na página.
- Endereços salvos pertencem exclusivamente ao usuário autenticado em `CustomerAddress`; o checkout pode usá-los como preenchimento, mas sempre grava um snapshot independente em `OrderAddress`.

### Cupons e descontos

- Tipos de cupom (decisão do responsável com o cliente, 13/10/2026; `coupons/domain/coupon-kind.ts`):
  - **Cupom Moto Shop** (`ownerType` MARKETPLACE, `fundedBy` MARKETPLACE): pago pelo Moto Shop e válido em todas as lojas; o desconto vai para `marketplaceDiscountInCents`.
  - **Campanha com adesão** (`ownerType` MARKETPLACE, `fundedBy` SELLER): paga por cada loja que aderir. Vale só nos itens das lojas com adesão ativa em `CouponSellerParticipation` (`leftAt` nulo); o desconto é calculado sobre o subtotal dessas lojas, rateado entre elas e vai para `sellerDiscountInCents`. Sem nenhuma loja aderente no carrinho, o checkout recusa o cupom. É o tipo padrão do formulário do Admin (campo `couponKind`).
  - **Cupom da loja** (`ownerType` SELLER, `fundedBy` SELLER): pago e válido só na loja dona.
- A loja adere ou sai de uma campanha com `COUPON_MANAGE`, a qualquer momento, mesmo com a campanha em vigor (`setCouponParticipation`). A mudança trava o cupom, atualiza seu `updatedAt` (o checkout em andamento falha na rechecagem em vez de usar dados antigos), registra `AuditLog` e vale só para checkouts seguintes; sair preserva o registro (`leftAt`). Só é possível aderir a campanha ativa e não expirada.
- Financiamento de desconto de cupom usa `marketplaceDiscountInCents`/`sellerDiscountInCents` no `SellerOrder`; os campos `marketplaceSubsidyInCents`/`sellerSubsidyInCents` continuam exclusivos de frete grátis.
- A comissão incide sobre o valor líquido da loja: `itemsSubtotalInCents − sellerDiscountInCents` do `SellerOrder` (ex.: R$ 100 com cupom de 5% pago pela loja → base R$ 95). Frete fica fora da base, e desconto pago pelo Moto Shop não reduz a base. Pedidos já criados mantêm o snapshot da comissão (`commissionBaseInCents` em `checkout/domain/seller-charges.ts`).
- A taxa do marketplace nunca pode exceder o total cobrado de um seller; o checkout recusa o cupom antes de criar o pedido.
- Formulários de cupom (lojista e Admin) recebem desconto em % e valores em R$; a conversão para basis points e centavos acontece no servidor (`coupons/domain/coupon-form-input.ts`, sem `float`). Unidades internas nunca aparecem na interface.
- Ativação ou desativação de cupons valida owner e tenant no servidor e registra auditoria com o usuário autenticado.
- Uso de cupom é consultado por agregação/count do banco, sem serializar resgates completos para as páginas operacionais.
- Vigência: datas de validade podem ser exibidas na operação, mas aplicação e checkout continuam validando vigência no servidor. Filtros de vigência aceitam datas nulas como limites abertos; cupons futuros são identificados por `startsAt > now`; nenhum filtro substitui a validação do checkout.

### Pagamento (Mercado Pago)

- Confirmação de venda exige pagamento `APPROVED`; `AUTHORIZED` ainda aguarda captura. Timeout incerto preserva pedido/reserva pendente para reconciliação, sem liberar estoque ou emitir outra cobrança automaticamente.
- O adapter atual do Mercado Pago não implementa repasse 1:N. A flag de ambiente não habilita essa capacidade; checkout real multi-seller permanece bloqueado até integração homologada. Simulação de pagamentos ocorre exclusivamente por injeção de provider em testes, sem rota pública ou modo fake em produção.
- Cartão de crédito usa Secure Fields do MercadoPago.js (iframes) e token descartável; PAN, validade e CVV nunca passam pelo servidor do Moto Shop. A primeira versão aceita crédito em uma parcela, definida no servidor. A Public Key pertence à mesma aplicação/ambiente do Access Token; somente a Public Key chega ao navegador. A URL opcional `MERCADO_PAGO_NOTIFICATION_URL` é enviada por cobrança e exige assinatura secreta configurada, sem sobrescrever configurações globais de outras integrações. Cartões e webhook real permanecem sujeitos à homologação.
- A transação AUTHORIZATION registra em `providerMetadata.paymentRequestState` o ciclo da cobrança: `PREPARED` (pedido criado, nada enviado), `SENT` (`requestSentAt` gravado sob lock do pedido imediatamente antes de chamar o provider) e `REJECTED` (recusa definitiva: 400/401/403/422/429). A recuperação pode cancelar o pedido e liberar estoque/cupom sem resposta do provider somente para `REJECTED` ou para `PREPARED` após 2 minutos; `SENT`, registros sem marcador ou pagamentos com ID externo continuam dependendo de confirmação do provider.
- Recuperação de pagamento sem ID externo consulta por referência do pedido e exige resultado único, com validação de ID, referência, valor, moeda e método. Nunca cria nova cobrança. Busca vazia, timeout ou ambiguidade preservam reservas. O Inngest agenda recuperação paginada a cada dez minutos para pendências com mais de dois minutos; depende do serviço ativo. Expiração local de QR/idade do pedido não autoriza liberar estoque: é necessária recusa/cancelamento confirmado pelo provider.
- Reconsulta manual de pagamento aceita somente pedidos autorizados por sessão ou token guest seguro, limita-se a pagamentos pendentes e reutiliza o reconciliador idempotente.
- O detalhe do pedido pode expor ao próprio cliente o histórico dos pagamentos e transações vinculados ao `Order`, sem revelar metadados sensíveis do provider. Listagens de pedidos do cliente carregam somente o último pagamento para resumo; o histórico completo fica no detalhe.
- Chargeback, mediação ou reembolso não explicado por transações REFUND internas em pedido pago não são espelhados: o webhook fica `FAILED` para revisão financeira. Webhooks de cobranças sem `external_reference` do Moto Shop (`MS-`) são marcados como processados e ignorados.

### Reembolsos

- Reembolso cujo valor confirmado pelo provider difere do solicitado permanece `PENDING` para revisão financeira.
- Reembolsos de cancelamento/devolução usam uma chave de idempotência por tentativa (`<base>` e depois `<base>:retry-<n>`, no máximo 5). Nova tentativa só é criada quando todas as anteriores estão `FAILED`; `PENDING`/`SUCCEEDED` são sempre reaproveitadas. Se o pagamento já foi integralmente reembolsado no provider, a solicitação é encerrada com auditoria `upstreamRefund`.

---

## 3. Frete e fulfillment

- Frete próprio usa `SellerShippingMethod`: faixa de CEP inclusiva, preço fixo em centavos por `SellerOrder` e prazo em dias úteis após confirmação do pagamento. Novas modalidades ficam desativadas; somente `SELLER_MANAGE` pode criar/ativar/desativar. Pedidos preservam o snapshot da cotação. Alterações de valores são feitas criando outra modalidade e desativando a anterior.
- Entregas próprias (`Shipment.provider = OWN`) são atualizadas manualmente com `ORDER_UPDATE`, ownership e auditoria transacional: pedido pago → enviado → entregue. Não compram etiquetas nem chamam Melhor Envio. Rastreio é opcional.
- O fulfillment sincroniza o status do `SellerOrder` a partir do envio dentro de transação; depois recalcula o `Order` global, permitindo estados parciais e sem regredir cancelamentos.
- Mudanças de status de fulfillment registram auditoria com actor autenticado sempre que originadas pela Central do Lojista.
- Notificações de fulfillment são eventos do Inngest e usam `NotificationDelivery` com chave `sellerOrderId + status`; falha de enfileiramento não desfaz a mudança operacional do pedido.
- Preferências de e-mail de atualização pertencem ao `User` e são verificadas no workflow antes do envio; não expor preferências de outro usuário.
- O acompanhamento público pode exibir linha do tempo e rastreio do `Shipment`, mas nunca expõe dados privados de origem do seller.
- Cancelamento aprovado com etiqueta Melhor Envio já comprada marca o `Shipment` como `CANCELLED` com `providerMetadata.labelCancellationRequired`; o cancelamento da etiqueta no provider é manual e confirmado no Admin (`/admin/shipping-recovery`). Uma etiqueta cancelada pode ser substituída: o ID anterior vai para `providerMetadata.previousLabels`, com auditoria. Erros 4xx do Melhor Envio (exceto 408/409/429) são definitivos e liberam nova tentativa.

---

## 4. Seller (Central do Lojista)

### Catálogo

- Produtos podem ter múltiplas variantes ativas, cada uma com SKU, preço e estoque próprios; em edições de rascunhos/rejeitados, remoções desativam a variante para preservar histórico em vez de apagá-la.
- Formulários de produto permitem peso embalado em gramas e dimensões da embalagem em milímetros, como inteiros positivos opcionais no rascunho. Valores nulos na variante herdam o campo correspondente do produto. Não inventar medidas ao preencher o formulário.
- Promoções são configuradas por variante em rascunhos/rejeitados, com preço positivo inferior ao normal e limites temporais opcionais. As datas do formulário usam UTC−03:00 explícito e são persistidas em UTC; início/fim vazios representam limites abertos. Para remover a promoção, limpar preço e datas. Alterações comerciais registram snapshot de antes/depois na auditoria transacional.
- A compatibilidade do produto é persistida por relacionamento estruturado e pode conter múltiplos fitments.
- Imagens de produto usam upload direto para ImageKit com autenticação temporária; a persistência de `ProductImage` exige ownership e conferência do asset no servidor. A URL pública depende de `IMAGEKIT_URL_ENDPOINT`.
- A galeria de `ProductImage` só pode ser reordenada ou removida pelo seller dono de produto `DRAFT`/`REJECTED`; a primeira posição é a capa pública e a limpeza do ImageKit não fica dentro de transação de banco.
- Produto arquivado pode voltar a `DRAFT` somente por ação do seller dono, sempre com ownership server-side e auditoria.

### Estoque

- Operações de estoque do seller apresentam todas as variantes e preservam ajustes auditáveis por `InventoryMovement`.
- Alertas e filtros de estoque consultam `Inventory` com `sellerId` no filtro e respeitam a variante ativa do produto.
- O histórico de `InventoryMovement` filtra por `sellerId` e expõe apenas os metadados operacionais necessários.

### Loja e equipe

- O perfil público da loja (`name`, `slug` e `description`) pode ser alterado apenas com `SELLER_MANAGE`, sempre validando `sellerId` no servidor e registrando `AuditLog`; dados de origem e frete continuam privados.
- Logo e banner da loja usam chaves explícitas no `Store`, upload direto para ImageKit e associação server-side com prefixo do seller e conferência do asset; a vitrine só deriva URLs públicas dos assets associados.
- A gestão inicial da equipe adiciona apenas usuários já cadastrados; convites externos e transferência de ownership ficam fora do MVP.

### Financeiro

- Resumos financeiros do seller usam valores persistidos no `SellerOrder`, sempre em centavos, e excluem pedidos não confirmados ou cancelados.

---

## 5. Admin

### Governança

- Categorias, marcas, fabricantes, modelos e fitments são governados pelo Admin; sellers apenas selecionam referências ativas.
- Aprovação ou rejeição de seller/produto é uma mudança administrativa crítica e persiste o estado e o `AuditLog` na mesma transação.
- Suspensão e reativação de seller são transições administrativas explícitas, com `AuditLog` transacional e bloqueio de acesso enquanto o seller estiver suspenso.
- Perguntas e avaliações públicas podem ser ocultadas/restauradas pelo Admin sem exclusão física. Consultas públicas ignoram itens ocultos, e cada alteração gera AuditLog. O histórico pessoal do pedido permanece acessível ao próprio cliente.

### Comissão e VIP

- A comissão individual é editada exclusivamente no Admin, em percentual com até duas casas decimais, persistida como basis points. Campo vazio remove o override; zero é uma comissão explícita de 0%. Atualizações concorrentes com valor anterior divergente são rejeitadas, a alteração é auditada e nunca modifica snapshots de pedidos antigos.
- A comissão padrão é atualizada em basis points, persistida no `MarketplaceConfiguration` e nunca retroage sobre pedidos já criados.
- O plano VIP é representado por `SellerSubscription`, com validade e status persistidos.
- No MVP, a ativação/renovação do VIP é administrativa; não simular cobrança recorrente antes da integração de assinatura do Mercado Pago.

### Monitoramento

- Auditoria administrativa pode exibir ação, entidade, ator e metadados, mas continua protegida por `requireAdminAccess` e sem expor segredos ou payloads.
- O monitor de pedidos administrativos preserva a separação por `SellerOrder` (mesmo quando a busca usa dados do `Order` global) e não expõe dados de endereço ou tokens guest.
- O monitor administrativo de webhooks exibe apenas metadados operacionais e nunca serializa o payload bruto para a interface.
- Entregas de notificações são consultadas por status e dados operacionais, mantendo erros limitados ao necessário para diagnóstico.
- Retry manual de webhook é exclusivo do Admin, registra auditoria e reverte para `FAILED` se o reenfileiramento não for confirmado.
- A moderação de produtos pode localizar nome, slug, SKU ou loja sem expor dados privados do seller além do necessário à revisão.
- A busca de seller considera loja e membros, mas nunca remove o filtro de status ou a proteção administrativa.

---

## 6. Listagens, filtros, buscas e ordenação (regra geral)

Vale para toda listagem operacional (Central do Lojista, Admin e conta do cliente) e pública:

1. **Escopo primeiro.** O `where` sempre contém o escopo de acesso antes de qualquer filtro: `sellerId` na Central do Lojista, `userId` na conta do cliente, `requireAdminAccess` no Admin, e produto aprovado de seller `APPROVED`/`ACTIVE` no storefront. Nenhum filtro, busca ou ordenação remove esse escopo.
2. **Tudo no banco, antes da paginação.** Busca textual, filtros de status, períodos e ordenação são aplicados no `where`/`orderBy` do banco e só então a página é carregada. Nunca trazer tudo para o client nem filtrar a página já carregada.
3. **Estado na URL.** Filtros, busca, ordenação e paginação são parâmetros tipados na URL (nuqs), permitindo links compartilháveis e paginação estável; listas independentes na mesma página usam parâmetros independentes.
4. **Períodos** são validados no servidor e aplicados como limites UTC explícitos.
5. **Unidade operacional preservada.** Pedidos do seller e o monitor do Admin trabalham com `SellerOrder`; cancelamentos também. Filas administrativas não misturam unidades de seller.
6. **Snapshots para histórico.** Buscas em pedidos usam `OrderItem.productNameSnapshot`/`skuSnapshot`, não o catálogo atual.
7. **Payload mínimo.** Filas limitam status e quantidade no banco antes de serializar; webhooks e auditoria nunca serializam payload bruto; uso de cupom é agregado por count.
8. **Disponibilidade e promoção** consideram variantes ativas e inventário no servidor; promoção ativa usa a regra centralizada do domínio de pricing (a mesma do checkout); faixas de preço usam o preço vigente em centavos.

Filtros e ordenações já existentes, todos sob a regra acima:

| Tela                                       | Busca                                                                           | Filtros                                                                                                                       | Ordenação                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Pedidos do seller                          | número, cliente, e-mail, `productNameSnapshot`, `skuSnapshot`                   | status do `SellerOrder`, status do `Shipment`, período `createdAt`                                                            | `createdAt` asc/desc                               |
| Catálogo do seller                         | —                                                                               | estoque `IN`/`LOW`/`OUT` (via `listSellerProducts`), categoria, marca (`brandId`), faixa de preço em centavos, promoção ativa | atualização ou nome                                |
| Perguntas do seller                        | texto, produto, e-mail do cliente                                               | respondidas, período `createdAt`                                                                                              | `createdAt`                                        |
| Histórico de estoque (`InventoryMovement`) | produto, variante, SKU                                                          | `type`, período UTC                                                                                                           | `createdAt` asc/desc                               |
| Cupons (seller e Admin)                    | código                                                                          | owner (sem misturar marketplace e seller), disponibilidade, vigência, status                                                  | criação, validade ou código                        |
| Histórico de pedidos do cliente            | `orderNumber`, loja (`sellerOrders.some`), `productNameSnapshot`, `skuSnapshot` | status, pagamento (relação `payments`), status do `Shipment`, período, faixa de `totalAmountInCents`                          | `orderBy` no banco, incluindo `totalAmountInCents` |
| Favoritos                                  | relações do produto                                                             | disponibilidade (variantes ativas e inventário)                                                                               | `createdAt`                                        |
| Endereços salvos                           | campos de apresentação                                                          | —                                                                                                                             | —                                                  |
| Admin: fila de sellers                     | loja e membros                                                                  | status                                                                                                                        | `createdAt` asc/desc                               |
| Admin: moderação de produtos               | nome, slug, SKU, loja                                                           | status de revisão, categoria, marca, `sellerId`, período `submittedAt`                                                        | `submittedAt`, desempate `createdAt`               |
| Admin: monitor de pedidos (`SellerOrder`)  | dados do `Order`, nome e SKU de `OrderItem`                                     | seller, status, status do `Shipment`, período `createdAt`                                                                     | `createdAt` asc/desc                               |
| Admin: devoluções, cancelamentos, disputas | relações (pedido, cliente, loja), `productNameSnapshot`, `skuSnapshot`          | status, `sellerId`, período `createdAt`                                                                                       | `createdAt` asc/desc                               |
| Admin: auditoria                           | `entityId`, ator (nome ou e-mail)                                               | período `createdAt`                                                                                                           | `createdAt` asc/desc                               |
| Admin: webhooks                            | —                                                                               | `provider`, status                                                                                                            | `receivedAt`                                       |
| Admin: entregas de notificação             | —                                                                               | status, `kind`, período `createdAt`                                                                                           | `createdAt`                                        |

---

## 7. Storefront, busca e conta do cliente

### Busca, catálogo e ranking

- Busca, ranking e paginação públicos são calculados no PostgreSQL em `public-product-page.ts`; só os produtos da página são carregados pelo Prisma. SQL parametrizado preserva sinais de relevância, estoque, avaliações e VIP, com desempate estável.
- Busca, filtros, ordenação e paginação do storefront são estado da URL e são carregados, filtrados e paginados no servidor; o ranking de relevância considera disponibilidade, reputação e o sinal comercial limitado do VIP.
- A busca do storefront consulta SKU, marca, categoria e loja além de nome e descrição, mantendo apenas produtos aprovados e sellers ativos/aprovados. O filtro público de loja lista apenas sellers aprovados ou ativos.
- A faixa de preço do storefront considera o preço vigente de variantes ativas em centavos, sem confiar em cálculo do cliente. Filtros públicos de promoção usam a regra de promoção ativa do domínio de pricing.
- Disponibilidade pública considera variantes ativas e inventário no servidor, preservando produtos multi-variante e sem confiar em estado do cliente.
- Categorias, marcas e compatibilidade por moto/ano têm URLs públicas legíveis e reutilizam a camada de consulta/ranking do storefront, sem duplicar regras de produto nem criar buscador externo no MVP. Esses catálogos paginam no servidor, mantêm filtros na URL e ordenam por relevância, novidade ou preço sem remover o escopo de categoria, marca ou fitment.

### VIP

- Produtos de sellers com VIP ativo recebem identificação de conteúdo patrocinado.
- O VIP é um sinal pequeno de ranking, depois de relevância, disponibilidade e reputação; não garante o primeiro resultado.

### Minha Moto

- A garagem pessoal `SavedMotorcycle` pertence ao `User` e referencia exclusivamente `MotorcycleFitment` da base administrada. Cada usuário pode salvar a mesma configuração uma vez; um índice parcial permite no máximo uma moto principal. A primeira vira principal, e remover a principal promove a próxima configuração ativa disponível. Consultas e mutações sempre filtram `userId` no servidor.
- A moto principal aparece como seleção inicial na landing e como atalho explícito no catálogo; o filtro efetivo continua representado por `?moto=<fitmentId>` na URL. No detalhe do produto, ausência de relacionamento de compatibilidade significa "não confirmada", nunca incompatibilidade comprovada.

### Página de produto, avaliações e perguntas

- Cards públicos de produto podem exibir apenas a primeira `ProductImage` associada; a URL é derivada no servidor e o card sempre mantém fallback textual quando não houver imagem pública.
- Avaliações e perguntas públicas têm paginação independente; médias e contagens são agregadas no servidor, sem depender apenas da página carregada.
- O filtro de nota nas avaliações do detalhe público é aplicado no banco, recalculando média, contagem e paginação para o mesmo recorte.
- Avaliações e perguntas públicas do produto podem ordenar `createdAt` sem remover filtro de nota, paginação, estado da outra lista ou o escopo do produto aprovado.

### Vitrine da loja

- Vitrines públicas só expõem sellers com status `APPROVED` ou `ACTIVE` e listam exclusivamente produtos `APPROVED` do `sellerId` da loja.
- A vitrine agrega a nota do seller no servidor e serializa no máximo seis avaliações recentes, sempre filtradas pelo `sellerId` da loja e originadas de compras verificadas. Avaliações da loja são paginadas no banco e podem ordenar `createdAt`; o resumo completo não depende apenas da página carregada.
- O catálogo da vitrine pagina produtos no banco com parâmetros independentes das avaliações; ordena por relevância, novidade ou preço; filtra disponibilidade e promoções com a mesma semântica do storefront; e busca nome, marca, categoria e SKU dentro do seller, preservando filtros na URL.

### Homepage

- A homepage pública (`/`) é uma landing comercial server-rendered. A vitrine mock foi removida: a homepage mostra até doze produtos aprovados, de sellers ativos/aprovados e com estoque disponível; sem elegíveis, usa estado vazio. Não apresentar preço ou disponibilidade inventados. (A regra anterior, que permitia uma vitrine de demonstração ilustrativa sem registros no catálogo e sem compra direta até o lançamento, foi substituída por esta.)

### SEO

- SEO público usa `generateMetadata`, canonical URLs, `sitemap.ts`, `robots.ts` e JSON-LD sanitizado; somente produtos aprovados e referências ativas entram no sitemap.
- O sitemap é renderizado por requisição (`dynamic = "force-dynamic"`): produtos aprovados aparecem sem novo deploy, e `next build` não depende de banco.

### Conta do cliente

- Favoritos são persistidos em `Favorite`, com unicidade por usuário e produto; somente produtos aprovados podem ser salvos e a lista exige autenticação. A lista consulta com `userId`, pagina no servidor e se limita a produtos aprovados de sellers ativos/aprovados.
- O histórico autenticado em `/orders` consulta pedidos exclusivamente pelo `userId`; o detalhe mantém suporte separado para `orderNumber` com token seguro de guest.
- Páginas públicas que podem não existir (ex.: `/products/[slug]`) checam a existência antes de qualquer `Suspense`/`loading.tsx` e chamam `notFound()` cedo: depois que o streaming começa, o status fica 200. O esqueleto de carregamento fica num `<Suspense>` dentro da página; o `loading.tsx` do catálogo vive no grupo `products/(catalog)` para não envolver o detalhe do produto.

---

## 8. Autenticação e segurança

- Recuperação de senha e verificação de e-mail usam os tokens nativos do Better Auth e envio pelo provider de e-mail do projeto. Sem Resend configurado, não oferecer recuperação funcional; exigir verificação de e-mail apenas com `AUTH_REQUIRE_EMAIL_VERIFICATION=true` e envio configurado, para evitar bloquear contas existentes acidentalmente.
- Vínculo posterior de pedido guest exige token de acesso não previsível, sessão autenticada, mesmo e-mail do pedido e e-mail verificado na conta; a atualização é condicional, revoga o token no mesmo passo para impedir dupla vinculação e gera `AuditLog` `ORDER_GUEST_CLAIMED`.
- Rate limiting de autenticação e mutations sensíveis usa contador atômico no PostgreSQL como solução de MVP enquanto Upstash não está configurado; chaves persistidas são hashes e nunca contêm token ou e-mail em claro. Monitorar crescimento da tabela e migrar o armazenamento para Upstash se o volume justificar.
- O login por e-mail tem, além do limite por IP, um limite por conta (10 tentativas/15 min) com chave derivada do e-mail normalizado e persistida apenas como hash; a resposta é 429 com mensagem genérica em português, sem revelar se a conta existe.
- Com `AUTH_REQUIRE_EMAIL_VERIFICATION=true`, o cadastro responde igual para e-mail novo e já cadastrado (sem revelar contas). O dono do e-mail existente recebe no máximo uma mensagem por dia avisando da tentativa (`sendExistingAccountEmail`), e falha nesse envio não altera a resposta. Contas antigas não verificadas recebem o link de confirmação ao tentar entrar.
- Headers de segurança globais ficam em `src/config/security-headers.ts`. A CSP está em `Content-Security-Policy-Report-Only` até a homologação do checkout com Secure Fields; ao passar sem violações, trocar para `Content-Security-Policy`.

---

## 9. Dados de demonstração

- Exceção explícita aprovada para apresentação antes do catálogo oficial: produtos marcados `isDemo` podem existir no banco com fotos locais geradas e valores/estoque ilustrativos. Devem ser identificados como demonstração no storefront, nunca entrar no carrinho/checkout (checagem server-side), não emitir Product JSON-LD nem entrar no sitemap. O seed é isolado por slugs `demo-*` e deve permanecer idempotente; nenhuma loja ou produto real pode ser sobrescrito. As lojas demo ficam `PENDING` até o código de bloqueio estar publicado.
- As imagens geradas pelo seed de revisão (`public/images/demo/review-*.webp`) são versionadas no git apenas enquanto o site público for demonstração, para não darem 404 no deploy. Saem antes do lançamento junto com os dados demo, via `pnpm db:remove:review`; como o script só apaga os arquivos localmente, a remoção precisa ser commitada.
- IDs determinísticos do seed de revisão usam o prefixo `czrvw` para passar na validação `z.cuid()` das Server Actions.

---

## 10. Infraestrutura, CI e interface

- Runtime e ferramentas (revisado em 08/10/2026): Node **24** (Active LTS, manutenção até 30/04/2028), fixado em `engines` e `.nvmrc`; pnpm via Corepack na versão de `packageManager`. Node 26 vira LTS em 28/10/2026: reavaliar quando a Vercel suportar e o CI passar nele. Majors adiadas de propósito: **ESLint 10** (plugins `react`, `import` e `jsx-a11y` ainda não declaram suporte), **TypeScript 7** (compilador nativo; aguardar suporte do Next e do typescript-eslint) e **Prisma 8** (o `latest` do npm ainda é release candidate). O Dependabot ignora majors de TypeScript, Prisma e `@types/node`; atualizá-las exige PR dedicado com o guia de migração. A política de idade mínima de release do pnpm não deve ser contornada para atualizações de rotina.
- CI (`.github/workflows`): todo PR roda typecheck (com `next typegen`), lint, `format:check`, testes unitários e `next build` sem banco; dependency review e título em Conventional Commits; CodeQL semanal. Integração e Playwright só rodam com os secrets `TEST_DATABASE_URL`/`TEST_DATABASE_DIRECT_URL` apontando para um branch Neon descartável, nunca para o banco de produção. Actions são fixadas por SHA.
- Testes de integração e navegador usam contas `@example.test`, identificadores únicos e limpeza restrita aos registros da execução. Nunca resetar o banco compartilhado nem usar credenciais reais de pagamento nos testes.
- Em produção, `/api/inngest` responde 503 (sem detalhes) se `INNGEST_DEV` estiver ativo ou `INNGEST_SIGNING_KEY` ausente.
- Erros inesperados exibidos ao usuário usam mensagem genérica em português; `ZodError` vira `VALIDATION_ERROR` com a mensagem do schema, ou "Confira os dados informados." quando a mensagem é a padrão (inglês) do Zod.
- UI: um único sistema de estilos (Tailwind + tokens de `globals.css`). Header (`StorefrontNavigation`), rodapé (`SiteFooter`) e card de produto (`ProductCard`) são compartilhados por todo o storefront; Central do Lojista e Admin usam `AppAreaHeader` com "Sair". Controles têm 44px (`h-11`) por padrão no mobile, `sm` (36px) apenas em tabelas operacionais densas; campos usam `text-base` no mobile para evitar zoom no iOS; formulários usam React Hook Form + Zod com `FormField` (erro por campo com `aria-describedby`). Não criar CSS modules paralelos para componentes que já existem em `components/ui`.
