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
  - Rodapé (atualizado em 13/10/2026 pelo modelo do cliente): descrição em dois parágrafos, horário de atendimento, formas de pagamento só com o que o checkout aceita pelo Mercado Pago (Pix e cartões Visa, Mastercard, Elo, American Express, Hipercard, Diners e Cabal; sem boleto) e atalhos Comprar, Vender, Pedidos e Entrar. Institucional lista só páginas que existem (hoje "Seja um Lojista"); "Sobre", trocas, políticas e termos entram quando o cliente mandar o texto. O copyright fica em duas linhas: "© 2026 MOTO SHOP BRASIL E-COMMERCE E MARKETPLACE. Todos os direitos reservados." e, logo abaixo, "CNPJ: 69.663.409/0001-94" (decisões de 22/10/2026). Abaixo do horário de atendimento ficam os ícones do Instagram e do YouTube da loja (decisão de 22/10/2026); o WhatsApp entra quando houver número corporativo.
  - Link de WhatsApp na vitrine da loja: mantido, por decisão do cliente; o lojista não pode linkar uma loja própria fora da plataforma.
  - "Minha moto" é seleção de peças compatíveis (não venda de motos): a escolha acontece na página do produto e no catálogo, sem aba própria no menu da conta.

---

## 2. Carrinho, checkout e pagamento

### Carrinho e checkout

- Ao entrar (ou criar conta) com carrinho de visitante ativo, o carrinho guest é mesclado no carrinho ativo do usuário na primeira leitura do carrinho (`getCartIdentity`): soma quantidades por variante limitadas ao estoque disponível e a 99 por item, ignora variantes não compráveis (demo/inativas/arquivadas/sem estoque), nunca reduz quantidades já existentes, trava os dois carrinhos na mesma transação, marca o guest como `ABANDONED` (idempotente) e remove o cookie do visitante.
- Totais exibidos no checkout são informativos até a submissão; o serviço de checkout recalcula preços, estoque, cupom e frete no servidor.
- Repetições da mesma chave de idempotência recuperam o pedido existente antes do limite de pendências. O teto por CPF é conferido sob lock na transação que cria o pedido, impedindo que checkouts simultâneos ultrapassem o limite.
- The storefront no longer displays payment-availability notices (16 October 2026). Real checkout still uses `getCheckoutPaymentAvailability` and the server payment checks. Test-only carts use the Pix-only simulation; mixed carts cannot create a real order containing test products.
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
- Cupom da loja com validade (BUG-025, decisão do responsável em 16/10/2026): o formulário da Central do Lojista ganha "Início" e "Fim" opcionais, gravados em `startsAt`/`endsAt`, que já existem e já são validados no checkout.
- Vigência: datas de validade podem ser exibidas na operação, mas aplicação e checkout continuam validando vigência no servidor. Filtros de vigência aceitam datas nulas como limites abertos; cupons futuros são identificados por `startsAt > now`; nenhum filtro substitui a validação do checkout.

### Pagamento (Mercado Pago)

- Proteção do checkout contra abuso (M-06, antes de habilitar o checkout real): além do limite por carrinho, o checkout limita por IP confiável (10/min) e por CPF (5 a cada 10 min), e recusa um CPF com 3 pedidos aguardando pagamento nas últimas 24 h; o "adicionar ao carrinho" limita por IP (60/min). Pix nasce com validade de 30 minutos (`date_of_expiration`), e o cancelamento pelo provider libera estoque e cupom pelo fluxo de recuperação. A reconsulta automática (a cada 10 minutos) só pergunta ao provider sobre pagamentos criados entre 2 minutos e 7 dias atrás (17/10/2026, A8): passado isso, o webhook continua podendo atualizá-lo, e o pagamento sem id do provider já gerou o alerta de 6 horas e aparece na lista do Admin. Ainda em aberto, para decisão do responsável: se o resgate de um pedido pendente deve contar no limite global do cupom.
- Confirmação de venda exige pagamento `APPROVED`; `AUTHORIZED` ainda aguarda captura. Timeout incerto preserva pedido/reserva pendente para reconciliação, sem liberar estoque ou emitir outra cobrança automaticamente.
- O adapter atual do Mercado Pago não implementa repasse 1:N. A flag de ambiente não habilita essa capacidade; checkout real multi-seller permanece bloqueado até integração homologada. Simulação de pagamentos ocorre exclusivamente por injeção de provider em testes, sem rota pública ou modo fake em produção.
- Cartão de crédito usa Secure Fields do MercadoPago.js (iframes) e token descartável; PAN, validade e CVV nunca passam pelo servidor do Moto Shop. A primeira versão aceita crédito em uma parcela, definida no servidor. A Public Key pertence à mesma aplicação/ambiente do Access Token; somente a Public Key chega ao navegador. A URL opcional `MERCADO_PAGO_NOTIFICATION_URL` é enviada por cobrança e exige assinatura secreta configurada, sem sobrescrever configurações globais de outras integrações. Cartões e webhook real permanecem sujeitos à homologação.
- A transação AUTHORIZATION registra em `providerMetadata.paymentRequestState` o ciclo da cobrança: `PREPARED` (pedido criado, nada enviado), `SENT` (`requestSentAt` gravado sob lock do pedido imediatamente antes de chamar o provider) e `REJECTED` (recusa definitiva: 400/401/403/422/429). A recuperação pode cancelar o pedido e liberar estoque/cupom sem resposta do provider somente para `REJECTED` ou para `PREPARED` após 2 minutos; `SENT`, registros sem marcador ou pagamentos com ID externo continuam dependendo de confirmação do provider.
- Recuperação de pagamento sem ID externo consulta por referência do pedido e exige resultado único, com validação de ID, referência, valor, moeda e método. Nunca cria nova cobrança. Busca vazia, timeout ou ambiguidade preservam reservas. O Inngest agenda recuperação paginada a cada dez minutos para pendências com mais de dois minutos; depende do serviço ativo. Expiração local de QR/idade do pedido não autoriza liberar estoque: é necessária recusa/cancelamento confirmado pelo provider.
- Reconsulta manual de pagamento aceita somente pedidos autorizados por sessão ou token guest seguro, limita-se a pagamentos pendentes e reutiliza o reconciliador idempotente.
- O detalhe do pedido pode expor ao próprio cliente o histórico dos pagamentos e transações vinculados ao `Order`, sem revelar metadados sensíveis do provider. Listagens de pedidos do cliente carregam somente o último pagamento para resumo; o histórico completo fica no detalhe.
- Chargeback, mediação ou reembolso não explicado por transações REFUND internas em pedido pago não são espelhados: o webhook fica `FAILED` para revisão financeira. Webhooks de cobranças sem `external_reference` do Moto Shop (`MS-`) são marcados como processados e ignorados.

### Reembolsos

- Reembolso cujo valor confirmado pelo provider difere do solicitado, ou cuja resposta não traz o valor, permanece `PENDING` para revisão financeira (L-08).
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
- Equipe por convite com aceite (M-04, 15/10/2026): o lojista convida por e-mail; a pessoa só entra ao aceitar com a conta daquele e-mail verificado (`SellerMemberInvite`, só o hash do token no banco, no máximo um convite pendente por loja e e-mail). Transferência de ownership fica fora do MVP. (Substitui a regra anterior, que adicionava qualquer conta já cadastrada sem consentimento.)

### Financeiro

- Resumos financeiros do seller usam valores persistidos no `SellerOrder`, sempre em centavos, e excluem pedidos não confirmados ou cancelados.

### Pós-venda

- Lojista vê devolução, cancelamento e disputa (UX-13, decisão do responsável em 16/10/2026): o card do pedido na Central mostra motivo, itens e status das três solicitações, sem ações para o lojista. A mediação e as decisões continuam no Admin. Toda consulta filtra `sellerId`.
- Fotos na devolução (decisão do responsável em 16/10/2026): o cliente anexa até 3 fotos opcionais ao solicitar devolução, com upload direto ao ImageKit e conferência do asset no servidor, como nas fotos de produto. As fotos aparecem para o Admin e para o lojista.

---

## 5. Admin

### Governança

- Categorias, marcas, fabricantes, modelos e fitments são governados pelo Admin; sellers apenas selecionam referências ativas.
- Aprovação ou rejeição de seller/produto é uma mudança administrativa crítica e persiste o estado e o `AuditLog` na mesma transação.
- Suspensão e reativação de seller são transições administrativas explícitas, com `AuditLog` transacional e bloqueio de acesso enquanto o seller estiver suspenso.
- Perguntas e avaliações públicas podem ser ocultadas/restauradas pelo Admin sem exclusão física. Consultas públicas ignoram itens ocultos, e cada alteração gera AuditLog. O histórico pessoal do pedido permanece acessível ao próprio cliente.
- A nota de resolução de disputa do Admin é interna (15/10/2026): fica no Admin e na auditoria; o cliente e o lojista veem o resultado (resolvida ou recusada), não o texto da nota.

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
- A busca do storefront consulta SKU, marca, categoria e loja além de nome e descrição, mantendo apenas produtos aprovados e sellers ativos/aprovados. Nome, descrição e SKU têm índice de trigramas (`pg_trgm`, GIN) para o `ILIKE '%termo%'` não ler a tabela inteira (17/10/2026, A10); marca, categoria e loja são tabelas pequenas e ficam sem índice. Cada coluna é buscada num ramo próprio de um `UNION` (`p.id IN (...)`), porque um `OR` entre tabelas do join ou o SKU buscado pela CTE `offers` impedem o PostgreSQL de usar os índices. Os índices estão declarados no `schema.prisma`, para o `migrate dev` não tratá-los como diferença. O filtro público de loja lista apenas sellers aprovados ou ativos.
- A faixa de preço do storefront considera o preço vigente de variantes ativas em centavos, sem confiar em cálculo do cliente. Filtros públicos de promoção usam a regra de promoção ativa do domínio de pricing.
- Disponibilidade pública considera variantes ativas e inventário no servidor, preservando produtos multi-variante e sem confiar em estado do cliente.
- Categorias, marcas e compatibilidade por moto/ano têm URLs públicas legíveis e reutilizam a camada de consulta/ranking do storefront, sem duplicar regras de produto nem criar buscador externo no MVP. Esses catálogos paginam no servidor, mantêm filtros na URL e ordenam por relevância, novidade ou preço sem remover o escopo de categoria, marca ou fitment.

### VIP

- Produtos de sellers com VIP ativo recebem identificação de conteúdo patrocinado.
- O VIP é um sinal pequeno de ranking, depois de relevância, disponibilidade e reputação; não garante o primeiro resultado.

### Minha Moto

- A garagem pessoal `SavedMotorcycle` pertence ao `User` e referencia exclusivamente `MotorcycleFitment` da base administrada. Cada usuário pode salvar a mesma configuração uma vez; um índice parcial permite no máximo uma moto principal. A primeira vira principal, e remover a principal promove a próxima configuração ativa disponível. Consultas e mutações sempre filtram `userId` no servidor.
- A moto principal aparece como seleção inicial na landing e como atalho explícito no catálogo (UX-01, 15/10/2026): nunca é aplicada sozinha; busca, categoria e o link "Catálogo" mostram tudo, e a faixa oferece "Ver peças para minha moto". O filtro efetivo continua representado por `?moto=<fitmentId>` na URL. No detalhe do produto, ausência de relacionamento de compatibilidade significa "não confirmada", nunca incompatibilidade comprovada.
- Categoria universal (decisão do responsável em 16/10/2026): marcação na categoria, ligada só pelo Admin, para itens que servem em qualquer moto (capacetes, vestuário, ferramentas). Com `?moto=` ativo, o catálogo retorna os produtos compatíveis mais os de categorias universais; a página de produto universal mostra "Serve em qualquer moto" em vez do aviso de compatibilidade não informada. Motivo: hoje "Capacetes" com uma moto escolhida devolve zero produtos.
- Na página do produto, o bloco "Sua moto" fica logo abaixo do preço (15/10/2026). No seletor da home, escolher um fabricante preenche o modelo quando ele é o único cadastrado; o ano fica em branco (mantido em 15/10/2026). O bloco de busca da home abre em "Buscar produto" (à esquerda), com "Peças por moto" à direita (pedido do cliente em 22/10/2026); só abre em "Peças por moto" quando a URL já traz uma moto válida em `?moto=`, para a moto escolhida continuar à vista. A moto principal salva preenche os campos, mas não muda a aba inicial.

### Página de produto, avaliações e perguntas

- Selo "Novidade" (13/10/2026): produtos aprovados nos últimos 30 dias, pela data de aprovação (`reviewedAt`) ou, sem ela, pela de criação; calculado no servidor (`products/domain/product-novelty.ts`). O card mostra no máximo dois selos, nesta prioridade: Patrocinado, Oferta, Novidade (`product-card-badges.ts`). Não existe selo de demonstração (16/10/2026). Na página do produto todos aparecem.
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
- Acompanhamento do pedido pelo visitante (decisão do responsável em 15/10/2026, a implementar): o link seguro vai por e-mail; ao abrir, o token entra num cookie com validade e a página do pedido passa a funcionar sem o token na URL. O token nunca fica em log nem em URL compartilhável por mais tempo que o necessário.
- Páginas públicas que podem não existir (ex.: `/products/[slug]`) checam a existência antes de qualquer `Suspense`/`loading.tsx` e chamam `notFound()` cedo: depois que o streaming começa, o status fica 200. O esqueleto de carregamento fica num `<Suspense>` dentro da página; o `loading.tsx` do catálogo vive no grupo `products/(catalog)` para não envolver o detalhe do produto.

---

## 8. Autenticação e segurança

- Recuperação de senha e verificação de e-mail usam os tokens nativos do Better Auth e envio pelo provider de e-mail do projeto. Sem Resend configurado, não oferecer recuperação funcional; exigir verificação de e-mail apenas com `AUTH_REQUIRE_EMAIL_VERIFICATION=true` e envio configurado, para evitar bloquear contas existentes acidentalmente.
- Quando um e-mail de `ADMIN_EMAILS` é verificado, a senha da conta é descartada e as sessões encerradas: o admin define a senha por "Esqueci minha senha", o que prova o controle da caixa de entrada. Impede que quem cadastrou o e-mail antes vire admin com a própria senha (L-19).
- Vínculo posterior de pedido guest exige token de acesso não previsível, sessão autenticada, mesmo e-mail do pedido e e-mail verificado na conta; a atualização é condicional, revoga o token no mesmo passo para impedir dupla vinculação e gera `AuditLog` `ORDER_GUEST_CLAIMED`.
- Rate limiting de autenticação e mutations sensíveis usa contador atômico no PostgreSQL como solução de MVP enquanto Upstash não está configurado; chaves persistidas são hashes e nunca contêm token ou e-mail em claro. Monitorar crescimento da tabela e migrar o armazenamento para Upstash se o volume justificar.
- O IP usado em rate limit vem só de `x-vercel-forwarded-for` (preenchido pela Vercel), no Better Auth (`advanced.ipAddress`) e nas actions (`shared/request/client-ip.ts`). O `x-forwarded-for` é controlado pelo cliente e não é confiável; sem o header confiável, todos caem no mesmo balde (L-05).
- O login por e-mail tem, além do limite por IP, um limite por conta (10 falhas/15 min; só senha ou e-mail errados contam e um login certo zera o contador, para que quem conhece um e-mail não bloqueie o dono, M-01) com chave derivada do e-mail normalizado e persistida apenas como hash; a resposta é 429 com mensagem genérica em português, sem revelar se a conta existe.
- Com `AUTH_REQUIRE_EMAIL_VERIFICATION=true`, o cadastro responde igual para e-mail novo e já cadastrado (sem revelar contas). O dono do e-mail existente recebe no máximo uma mensagem por dia avisando da tentativa (`sendExistingAccountEmail`), e falha nesse envio não altera a resposta. Contas antigas não verificadas recebem o link de confirmação ao tentar entrar.
- Áreas privadas não revelam que existem (decisão do responsável em 17/10/2026). Quem não é administrador, logado ou não, recebe o 404 comum em qualquer endereço de `/admin`. Na Central do Lojista, `/seller` continua sendo a página pública de cadastro de loja; nas páginas internas, o visitante vai para o login, quem não é membro de nenhuma loja recebe 404, o membro de loja em análise volta para `/seller` e o membro sem a permissão do papel vai para `/seller/sem-permissao`. A checagem fica em `requireAdminAccess`/`requireSellerAccess` (e no `generateMetadata` dos layouts, para o título da aba não vazar), nunca só na navegação.
- Login de volta à página pedida na Central do Lojista (decisão de 23/10/2026): `src/proxy.ts` (o antigo middleware do Next 16) roda só em `/seller/:path+` e, sem o cookie de sessão do Better Auth, manda os carregamentos de página (GET/HEAD) para `/login?next=<página pedida, com a query>`; POSTs de Server Functions passam direto, para a checagem da própria action responder. É só uma checagem otimista do cookie: não substitui a checagem do servidor, que continua no layout `(private)` e em cada página. Descartado: passar o endereço de cada página para `requireSellerAccess`, que espalhava a regra por cerca de 12 páginas e deixava o redirecionamento sair depois do `loading.tsx`, com status 200. `/seller` sozinho fica fora do proxy, por ser a página pública de cadastro.
- Headers de segurança globais ficam em `src/config/security-headers.ts`. A CSP está em `Content-Security-Policy-Report-Only` até a homologação do checkout com Secure Fields; ao passar sem violações, trocar para `Content-Security-Policy`.

---

## 9. Dados de demonstração

- Simulated checkout removes only cart items whose IDs and quantities still match the priced snapshot. Items added or changed while shipping is calculated remain in the cart.

- Exceção explícita aprovada para apresentação antes do catálogo oficial: produtos marcados `isDemo` podem existir no banco com fotos locais geradas e valores/estoque ilustrativos. Desde 16/10/2026 (decisão do responsável) o storefront se comporta como produção: nenhuma tela pública mostra aviso de demonstração (selo, "Valor ilustrativo", aviso de produto de apresentação, "Compras em breve" ou aviso de pagamento não liberado). Os nomes "(demonstração)" gravados no banco e o selo desenhado nas imagens ficam até uma mudança de dados aprovada à parte. Produtos de teste entram no carrinho, na cotação de frete e no checkout, mas terminam numa compra simulada (16/10/2026): com o carrinho só de produtos de teste, o servidor valida e calcula tudo como numa compra real (dados, frete, cupom e estoque) e responde com a tela "Compra concluída". Nada da compra é gravado: nenhum pedido, reserva de estoque, uso de cupom, pagamento, e-mail, job ou chamada ao Mercado Pago; a única escrita é esvaziar o carrinho do próprio cliente, e o limite de tentativas do checkout continua valendo. Só Pix, sem campos de cartão (que já chamariam o Mercado Pago). O pedido real continua recusando produto de teste no servidor, e um teste automatizado garante que a compra simulada não grava nada. Produtos de teste não emitem Product JSON-LD, não entram no sitemap e levam `noindex`. O seed é isolado por slugs `demo-*` e deve permanecer idempotente; nenhuma loja ou produto real pode ser sobrescrito. As lojas demo ficam `PENDING` até o código de bloqueio estar publicado.
- As imagens geradas pelo seed de revisão (`public/images/demo/review-*.webp`) são versionadas no git apenas enquanto o site público for demonstração, para não darem 404 no deploy. Saem antes do lançamento junto com os dados demo, via `pnpm db:remove:review`; como o script só apaga os arquivos localmente, a remoção precisa ser commitada.
- IDs determinísticos do seed de revisão usam o prefixo `czrvw` para passar na validação `z.cuid()` das Server Actions.

---

## 10. Infraestrutura, CI e interface

- Runtime e ferramentas (revisado em 08/10/2026): Node **24** (Active LTS, manutenção até 30/04/2028), fixado em `engines` e `.nvmrc`; pnpm via Corepack na versão de `packageManager`. Node 26 vira LTS em 28/10/2026: reavaliar quando a Vercel suportar e o CI passar nele. Major adiada de propósito: **Prisma 8** (o `latest` do npm ainda é release candidate). O ESLint 10 deixou de importar e o TypeScript 7 entrou em 19/10/2026 (item abaixo). O Dependabot ignora majors de TypeScript, Prisma e `@types/node`; atualizá-las exige PR dedicado com o guia de migração. A política de idade mínima de release do pnpm não deve ser contornada para atualizações de rotina.
- Lint e TypeScript (decidido em 19/10/2026, pedido do Guilherme por sugestão do Haniel): o **Oxlint** substitui o ESLint e o **TypeScript** sobe para o **7**. Motivo: o typescript-eslint, base das regras de TypeScript do `eslint-config-next`, só aceita TypeScript abaixo de 6.1, porque o TypeScript 7 não tem API em JavaScript (issue typescript-eslint #10940). Isso prendia o projeto no TypeScript 5. O Oxlint checa os tipos com o typescript-go (`oxlint-tsgolint`), que é o próprio TypeScript 7. Ficou assim:
  - **Regras:** `.oxlintrc.json` tem o mesmo conjunto de antes, convertido com `@oxlint/migrate`: Next.js, React e React Compiler, jsx-a11y, import, as regras de TypeScript, `max-depth: 3` e `no-non-null-assertion`, com os mesmos níveis. Somam-se 12 regras que usam os tipos, do grupo `correctness` do Oxlint, que já passavam sem nenhuma ocorrência.
  - **Regras próprias:** ficam em `tools/oxlint-plugin.ts` (carregado por `jsPlugins`), porque o Oxlint não tem `no-restricted-syntax`: `moto-shop/no-else` e `moto-shop/no-then` (seção 46 do AGENTS.md) e `moto-shop/no-location-assign-relative-destination` (regra do Next que o Oxlint ainda não implementou).
  - **Sem equivalente, e por quê:** `react/jsx-uses-react` e `react/jsx-uses-vars` são cobertas por `no-unused-vars` com o JSX novo. `react/no-deprecated` cobria APIs que o React 19 removeu, então o `tsc` já recusa o uso. `react/require-render-return` só vale para componentes de classe, que o projeto não tem. `react-hooks/config` e `react-hooks/gating` só validam opções do React Compiler, que o Oxlint fixa.
  - **Server Components:** o `react/purity` do Oxlint acusa `new Date()` em três deles; nessas linhas há um comentário de exceção com o motivo, porque um Server Component renderiza uma vez por requisição.
  - **TypeScript 7:** o `next build` usa o `tsc` do projeto por padrão (`experimental.useTypeScriptCli`), e Vitest, tsx, Prisma e Playwright não usam a API do TypeScript. Por isso o TypeScript 7 entra direto, sem a convivência oficial com o TypeScript 6 (`@typescript/typescript6`). O `pnpm typecheck` caiu de cerca de 2 minutos para cerca de 20 segundos.
  - **Descartado:** esperar o typescript-eslint suportar o TypeScript 7 (sem data) e a convivência com o TypeScript 6 (desnecessária).
  - **Fica para depois:** `no-floating-promises`, `no-misused-promises`, `unbound-method` e `no-base-to-string` acusariam 66 pontos hoje e exigiriam mudar código; vão como tarefa separada, se o responsável quiser.
- CI (`.github/workflows`): todo PR roda typecheck (com `next typegen`), lint, `format:check`, testes unitários e `next build` sem banco; dependency review e título em Conventional Commits; CodeQL semanal. Integração e Playwright só rodam com os secrets `TEST_DATABASE_URL`/`TEST_DATABASE_DIRECT_URL` apontando para um branch Neon descartável, nunca para o banco de produção. Actions são fixadas por SHA.
- E-mail nunca é enviado para domínios reservados de teste (`.test`, `.example`, `.invalid`, `.localhost`, `example.com/org/net`): o `ResendEmailProvider` descarta esses destinatários, registra só a contagem no log e, se nenhum sobrar, não chama o Resend (a entrega fica com `providerId` `skipped:reserved-domain`). Os runners de E2E, integração e unitários também apagam `RESEND_API_KEY`. Motivo: bounces de contas de QA derrubavam a reputação de `mail.motoshopbrasil.com.br` (14/10/2026).
- Testes de integração e navegador usam contas `@example.test`, identificadores únicos e limpeza restrita aos registros da execução. Nunca resetar o banco compartilhado nem usar credenciais reais de pagamento nos testes.
- Em produção, `/api/inngest` responde 503 (sem detalhes) se `INNGEST_DEV` estiver ativo ou `INNGEST_SIGNING_KEY` ausente.
- Erros inesperados exibidos ao usuário usam mensagem genérica em português; `ZodError` vira `VALIDATION_ERROR` com a mensagem do schema, ou "Confira os dados informados." quando a mensagem é a padrão (inglês) do Zod.
- UI: um único sistema de estilos (Tailwind + tokens de `globals.css`). Header (`StorefrontNavigation`), rodapé (`SiteFooter`) e card de produto (`ProductCard`) são compartilhados por todo o storefront; Central do Lojista e Admin usam `AppAreaHeader` com "Sair". Controles têm 44px (`h-11`) por padrão no mobile, `sm` (36px) apenas em tabelas operacionais densas; campos usam `text-base` no mobile para evitar zoom no iOS; formulários usam React Hook Form + Zod com `FormField` (erro por campo com `aria-describedby`). Não criar CSS modules paralelos para componentes que já existem em `components/ui`.
- Dependências da stack (auditoria de design system, DS-23; decisão do responsável em 16/10/2026): a regra do `AGENTS.md` foi ajustada, não o código. `@tanstack/react-table` entra quando uma tabela precisar de ordenação, seleção ou filtro no navegador; até lá, tabelas HTML server-rendered com paginação no banco. `react-hook-form` é obrigatório em formulário novo ou reescrito; login e checkout continuam validando à mão até serem reescritos. `tw-animate-css` foi removido por não ter nenhuma classe em uso.
- Card com borda (DS-10, decisão do responsável em 16/10/2026): o `Card` de `components/ui` usa `border` (token `border`), não `ring`; as caixas feitas à mão com `bg-card rounded-* border` (checkout, carrinho, prévia visual) passam a usar o `Card`, e `CardTitle` vira heading por `render`/`as`. Painéis de navegação e o hero não são cards.
- DS-15 (caixa de sugestões da busca) adiado para depois do lançamento.
- Ícones (auditoria de ícones, 15/10/2026): o ícone representa o significado, não a cor. Status usam `meaning` em `status-labels.ts` (aguardando = `Clock`, concluído = `Check`, em trânsito = `Truck`, atenção = `TriangleAlert`, recusado/falhou = `CircleX`); `X` fica para fechar, limpar e remover filtro. Conceitos recorrentes vêm de `shared/presentation/domain-icons.ts` (pedido = `Package`, carrinho = `ShoppingBag`, nada encontrado = `SearchX`, estoque = `Boxes`). Moto é `Motorbike`. Lixeira só em exclusão definitiva. Setas: `ChevronRight` em linha de lista ou atalho de configuração; `ArrowRight` em link ou CTA com texto ("Ver pedido", "Ver produtos"); `ArrowUpRight`/`ExternalLink` só quando abre fora do site. KPIs mostram o objeto contado, não o estado. Onde a Lucide não tem símbolo honesto (filtros, pneus, capacetes), usar só o texto.
