# MotoShop

Fundação técnica do marketplace multi-seller de motocross, construída como monólito modular em Next.js fullstack.

## Requisitos

- Node.js 24+
- pnpm 12+
- PostgreSQL no Neon

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Preencha `DATABASE_URL` com a URL pooled do Neon e `DIRECT_URL` com a URL direta.
3. Gere um `BETTER_AUTH_SECRET` com pelo menos 32 caracteres.
4. Configure `ADMIN_EMAILS` com os e-mails autorizados a revisar sellers e produtos, separados por vírgula.
5. Instale as dependências e aplique as migrations.

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

As integrações com Sentry, Inngest, Upstash, R2 e Resend são opcionais no desenvolvimento local. Seus adapters falham com um erro de configuração explícito se forem usados sem as variáveis correspondentes.

## Notificações transacionais

Pagamentos confirmados ou recusados pelo Mercado Pago geram um evento no Inngest. O workflow consulta o pedido, envia um e-mail transacional pelo Resend e registra a entrega em `notification_deliveries`. A chave do evento é única, evitando o envio duplicado quando o webhook for repetido. Falhas ficam registradas para retry sem alterar o estado financeiro do pedido.

## Fase 2: catálogo operacional

O fluxo inicial implementado é:

1. Criar uma conta em `/login`.
2. Solicitar o cadastro de uma loja em `/seller`.
3. Um administrador, listado em `ADMIN_EMAILS`, aprovar a loja em `/admin`.
4. O seller aprovado criar um produto com variante e estoque inicial.
5. Enviar o produto para aprovação do MotoShop.
6. Aprovar o produto no Admin e publicá-lo no storefront em `/products`.

Preços cadastrados pelo seller são informados em centavos para manter a regra financeira do projeto. A compatibilidade com motos usa o filtro `Minha Moto` quando houver fitments cadastrados.

## Fase 3: governança de catálogo e compatibilidade

O Admin mantém categorias, marcas, fabricantes, modelos e fitments de motos em `/admin`. Registros podem ser desativados sem apagar histórico. Sellers selecionam múltiplos fitments ativos ao criar ou editar um produto; a associação é validada no servidor e respeita a estrutura `Product -> ProductCompatibility -> MotorcycleFitment`.

## Fase 4: imagens de produto

Sellers adicionam até oito imagens JPG, PNG ou WebP de até 5 MB na edição de produtos em rascunho ou rejeitados. O navegador envia o arquivo diretamente ao Cloudflare R2 usando URL assinada; depois o MotoShop persiste o `ProductImage` apenas se o produto pertencer ao seller autenticado. Configure `R2_PUBLIC_URL` para exibir as imagens no storefront.

## Fase 5: equipe e permissões do seller

Owners e admins podem adicionar contas já existentes à equipe em `/seller`, atribuindo os perfis de administrador, catálogo, pedidos ou financeiro. As mudanças validam o seller no servidor, registram auditoria e não permitem remover ou rebaixar o proprietário principal. Convites por e-mail ainda não fazem parte do MVP.

## Fase 6: busca e navegação de catálogo

O storefront em `/products` mantém busca, `Minha Moto`, categoria, marca, ordenação e paginação na URL. Os filtros são carregados e validados no servidor, com ordenação por relevância, data ou preço e paginação de até 12 produtos por página no MVP. Os links de navegação preservam os filtros ativos para permitir compartilhamento e retorno consistente aos resultados.

## Fase 7: favoritos

Clientes autenticados podem favoritar produtos aprovados na página de produto e consultar a lista em `/favorites`. Cada favorito é único por usuário e produto, pode ser removido pelo mesmo controle e não depende de estado persistido apenas no navegador. Visitantes são direcionados ao login antes de salvar favoritos.

## Fase 8: endereços do cliente

Clientes autenticados podem cadastrar, remover e definir o endereço padrão em `/account/addresses`. O checkout carrega esses endereços sem alterar o fluxo de convidados; a compra continua gravando um snapshot próprio em `OrderAddress`, preservando o histórico mesmo que o endereço salvo seja alterado depois.

## Fase 9: histórico de pedidos

Clientes autenticados acompanham seus pedidos em `/orders`, com o status global, total, lojas participantes, quantidade de itens e situação de cada envio. O detalhe continua em `/orders/[orderNumber]`, protegido pelo `userId` para contas autenticadas e pelo token seguro para guests.

## Fase 10: múltiplas variantes

Sellers podem cadastrar e editar várias variantes no mesmo produto, cada uma com título, SKU, preço e estoque próprios. Variantes removidas de rascunhos ou produtos rejeitados são desativadas em vez de apagadas, preservando o histórico de estoque e mantendo a publicação dependente da aprovação do MotoShop.

## Fase 11: páginas públicas de catálogo

O catálogo possui páginas indexáveis para categorias (`/categoria/[slug]`), marcas (`/marca/[slug]`) e compatibilidade por moto/ano (`/moto/[fabricante]/[modelo]/[ano]`). Essas páginas reutilizam o ranking e os filtros server-side do storefront e exibem links de retorno para a busca completa.

## Fase 12: SEO técnico

O App Router gera metadata e URLs canônicas para produtos, categorias, marcas e motos. Produtos publicados recebem JSON-LD `Product` com ofertas agregadas e avaliações quando disponíveis. `sitemap.xml` inclui apenas conteúdo público aprovado/ativo, enquanto `robots.txt` bloqueia superfícies privadas como Admin, seller, checkout, conta e pedidos.

## Fase 13: vitrines públicas de seller

Cada loja aprovada/ativa possui uma vitrine em `/loja/[slug]`, com nome, reputação, status VIP e produtos aprovados daquela loja. O nome da loja agora é navegável a partir das listagens e da página de produto, e as vitrines entram no sitemap público.

## Fase 14: perfil público da loja

Owners e admins do seller podem atualizar em `/seller` o nome público, o slug e a descrição da loja. A alteração valida o tenant no servidor, registra auditoria e revalida a vitrine antiga, a nova URL e o sitemap. Os dados de origem usados no frete continuam separados e privados.

## Fase 15: identidade visual da loja

Owners e admins podem enviar logo e banner da loja diretamente para o R2 em `/seller`. A aplicação valida tipo e tamanho, associa cada asset somente ao seller autenticado e exibe as imagens na vitrine pública quando `R2_PUBLIC_URL` estiver configurado.

## Fase 16: imagens no catálogo público

As listagens públicas reutilizam a primeira imagem aprovada/cadastrada do produto nos cards de categoria, busca e vitrine da loja. Quando o storage público não estiver configurado ou o produto não possuir imagem, a interface mantém um fallback acessível sem quebrar o catálogo.

## Fase 17: avaliações públicas da loja

A vitrine pública mostra a nota média e até seis avaliações recentes do seller, com nome, data, estrelas e comentário quando disponível. A média e a contagem são agregadas no servidor; apenas a amostra necessária é serializada para a página.

## Fase 18: gerenciamento da galeria de produtos

Sellers podem reorganizar as imagens de produtos em rascunho ou rejeitados; a primeira imagem vira a capa dos cards públicos. Também podem remover imagens, com validação de ownership e limpeza best-effort do objeto correspondente no R2.

## Fase 19: estados de fulfillment

Comprar ou gerar a etiqueta move automaticamente o `SellerOrder` pago para processamento. Atualizações de rastreio sincronizam `PROCESSING`, `SHIPPED` e `DELIVERED` por seller e recalculam o status global do `Order`, preservando pedidos parciais e cancelamentos.

## Fase 20: notificações de fulfillment

As transições de preparação, envio e entrega publicam eventos no Inngest. O workflow envia e-mails idempotentes por `sellerOrderId + status`, com rastreio quando disponível, sem reverter o pedido caso o provedor de e-mail ou a fila esteja temporariamente indisponível.

## Fase 21: preferências de notificações

Clientes autenticados podem controlar em `/account/notifications` o recebimento de e-mails de atualização dos próprios pedidos. O workflow respeita essa preferência antes de enviar notificações de fulfillment.

## Fase 22: auditoria de estados de pedido

Transições de `SellerOrder` e `Order` causadas pelo fulfillment registram `AuditLog` com status anterior, próximo status, envio e usuário responsável.

## Fase 23: paginação de pedidos do seller

`/seller/orders` consulta pedidos com paginação server-side de 20 registros, evitando carregar uma lista fixa de até 50 itens no navegador.

## Fase 24: filtros de fulfillment

A Central do Lojista permite filtrar pedidos por status através da URL, preservando o filtro durante a paginação e mantendo a query restrita ao seller autenticado.

## Fase 25: acompanhamento visual de entrega

O cliente acompanha o progresso do envio na página do pedido com uma linha do tempo de status e links diretos de rastreamento, inclusive para pedidos guest com token seguro.

## Fase 26: catálogo do seller paginado

O painel do seller consulta o catálogo com paginação server-side, busca por nome, slug ou SKU e filtro por status, sempre restringindo a consulta ao seller autenticado.

## Fase 27: histórico de pedidos filtrável

Clientes autenticados podem filtrar seus pedidos por status e navegar pelo histórico paginado sem carregar toda a conta em uma única resposta.

## Fase 28: caixa de perguntas paginada

A Central do Lojista permite separar perguntas respondidas e pendentes, com paginação server-side e preservação do filtro na URL.

## Fase 29: fila de sellers do Admin

O Admin pode filtrar sellers por status e navegar pela fila paginada de aprovação, mantendo os dados e ações protegidos pela autorização administrativa.

## Fase 30: fila de aprovação de produtos

A fila administrativa de produtos submetidos ou rejeitados passou a aceitar filtro de status e paginação server-side, reduzindo o volume carregado na tela de gestão.

## Fase 31: auditoria consultável

O Admin pode consultar registros de auditoria por ação ou entidade, com ator, metadados e paginação server-side para investigação operacional.

## Fase 32: resumo financeiro do seller

O painel do seller exibe vendas confirmadas, comissão do MotoShop e valor líquido acumulado a partir dos snapshots financeiros dos pedidos.

## Fase 33: monitoramento de estoque baixo

O seller visualiza as variantes com até cinco unidades disponíveis, incluindo itens esgotados e acesso direto à edição do produto.

## Fase 34: monitoramento de pedidos no Admin

O Admin possui uma visão consolidada de `SellerOrder`, com filtro de status e identificação de seller, cliente, quantidade de itens e rastreio resumido.

## Fase 35: paginação de avaliações e perguntas

A página pública do produto pagina avaliações e perguntas separadamente, mantendo a média real de avaliações calculada no servidor e preservando os parâmetros na URL.

## Fase 36: busca operacional de pedidos

O seller pode buscar pedidos por número, nome ou e-mail do cliente, combinando o texto com o filtro de status e preservando ambos na paginação server-side.

## Fase 37: ciclo de cupons do seller

Sellers podem ativar ou desativar seus cupons com validação de ownership e registro de auditoria, sem alterar cupons de outros tenants.

## Fase 38: ciclo de cupons do marketplace

O Admin pode controlar a disponibilidade de cupons globais, com ação protegida e auditoria do ator responsável.

## Fase 39: filas de pós-venda administrativas

Devoluções, cancelamentos e disputas no Admin agora têm filtros de status e paginação server-side, mantendo os estados operacionais abertos visíveis sem carregar listas ilimitadas.

## Fase 40: estoque por todas as variantes

O painel do seller exibe preço, SKU, quantidade e ajuste manual de cada variante ativa do produto, evitando que a operação dependa apenas da primeira variação.

## Fase 41: cupons do seller paginados

O seller pode buscar seus cupons por código, filtrar ativos ou inativos e navegar pela lista paginada no servidor.

## Fase 42: cupons do marketplace paginados

O Admin possui a mesma visão paginada e filtrável para cupons globais, mantendo a gestão separada dos cupons de seller.

## Fase 43: busca nas filas de pós-venda

Devoluções, cancelamentos e disputas podem ser localizados por pedido, cliente, loja ou motivo, combinando busca textual com status e paginação.

## Fase 44: auditoria de moderação

Aprovação e rejeição de sellers e produtos passaram a ocorrer em transação com `AuditLog`, registrando status anterior, próximo status, motivo quando aplicável e ator.

## Fase 45: filtro de estoque no catálogo

O catálogo do seller pode ser filtrado por estoque baixo ou esgotado, além de busca e status, usando as relações de inventário no servidor.

## Fase 46: ciclo de vida operacional do seller

O Admin pode suspender sellers aprovados/ativos e reativar sellers suspensos. As transições são protegidas, auditadas e refletem imediatamente no acesso à Central do Lojista.

## Fase 47: restauração de produtos arquivados

O seller pode restaurar um produto arquivado para `DRAFT`, com ownership validado e auditoria da operação, antes de reenviá-lo para aprovação.

## Fase 48: visibilidade de uso dos cupons

As listas de cupons do marketplace e do seller exibem o número de resgates e o limite global, usando `_count` do Prisma sem carregar as redações completas.

## Fase 49: histórico de pagamentos no pedido

O detalhe do pedido exibe pagamentos e transações em ordem cronológica, com status traduzido e valores em centavos formatados no servidor.

## Fase 50: reconsulta segura de pagamento pendente

O cliente pode consultar novamente o status de um pagamento pendente a partir do pedido autenticado ou do token seguro de guest. A consulta usa o provider do Mercado Pago e a mesma reconciliação transacional dos webhooks.

## Fase 51: busca de sellers no Admin

A fila administrativa de sellers permite localizar lojas por nome, nome do membro ou e-mail, combinando o texto com o status e a paginação server-side.

## Fase 52: busca na moderação de produtos

A fila de aprovação de produtos pode ser filtrada por nome, slug, SKU ou loja, mantendo os status de revisão e o limite de dados carregados no banco.

## Fase 53: busca no monitor de pedidos

O monitor administrativo de `SellerOrder` aceita busca por número do pedido, cliente ou loja, preservando a separação por seller e o filtro de status.

## Fase 54: busca de perguntas do seller

A Central do Lojista permite localizar perguntas pelo texto ou produto, combinando a busca com o estado respondida/não respondida e a paginação.

## Fase 55: pagamento no histórico do cliente

O histórico de pedidos mostra o status atual do pagamento junto ao total da compra, consultando apenas o último pagamento necessário para a listagem.

## Fase 56: filtro de estoque no painel do seller

O filtro de estoque do catálogo do seller está disponível na interface, com opções para todos, baixo e esgotado, preservando o estado na URL e na paginação.

## Fase 57: busca no histórico do cliente

Clientes autenticados podem localizar pedidos pelo número, combinando a busca com o status e a paginação server-side.

## Fase 58: monitor de webhooks

O Admin possui uma fila paginada de eventos de webhook com busca por tipo, identificador ou erro e filtro de status, sem serializar o payload sensível completo.

## Fase 59: monitor de notificações

O Admin pode acompanhar entregas de e-mail transacional por status, destinatário, assunto ou evento, incluindo falhas registradas pelo provider.

## Fase 60: validade de cupons visível

As operações de cupom exibem a data final configurada junto ao uso e ao limite global, facilitando a conferência comercial sem alterar a regra server-side.

## Fase 61: retry administrativo de webhooks

Eventos de webhook Mercado Pago em estado `FAILED` podem ser reenfileirados pelo Admin. A ação limpa o erro, registra auditoria e devolve o evento ao workflow; se o enqueue falhar, o evento volta a `FAILED`.

## Fase 62: histórico de movimentações de estoque

O seller visualiza as últimas movimentações das próprias variantes, com tipo, ajuste, saldo posterior, data e ator, sempre restrito pelo `sellerId`.

## Fase 63: configuração de comissão padrão

O Admin pode ajustar a comissão global em basis points. A alteração é validada, persistida na configuração do marketplace e auditada sem modificar snapshots de pedidos antigos.

## Fase 64: filtro de validade dos cupons

As listas de cupons permitem separar cupons vigentes e expirados, considerando limites de data abertos e mantendo a validação definitiva no checkout.

## Fase 65: resumo estimado no checkout

O checkout exibe quantidade de itens, subtotal, frete selecionado e total estimado. O valor continua sendo recalculado e validado novamente pelo servidor ao finalizar a compra.

## Fase 66: filtro de status de envio no seller

Os pedidos da Central do Lojista podem ser filtrados pelo status do `Shipment`, além do status do `SellerOrder`, busca textual e paginação.

## Fase 67: filtro por loja no monitor administrativo

O Admin pode restringir o monitor de pedidos a uma loja específica, usando opções de sellers aprovados, ativos ou suspensos sem perder o escopo por `SellerOrder`.

## Fase 68: filtro de status de pagamento no histórico

O histórico autenticado do cliente pode mostrar apenas pedidos cujo pagamento esteja em um status selecionado, mantendo a autorização por `userId`.

## Fase 69: busca de entidade na auditoria

O visualizador de auditoria aceita busca parcial pelo ID da entidade, combinando o filtro com ação, tipo de entidade e paginação.

## Fase 70: filtro de disponibilidade no storefront

O catálogo público permite separar produtos em estoque e esgotados, aplicando a disponibilidade no banco antes do ranking e da serialização dos cards.

## Fase 71: filtro de status de envio no Admin

O monitor administrativo de pedidos pode filtrar o `Shipment` por status, mantendo a visão operacional baseada em `SellerOrder` e exibindo o status do envio junto ao status do pedido.

## Fase 72: busca por loja no histórico do cliente

O cliente pode localizar pedidos pelo nome da loja, combinando o filtro relacional com número do pedido, status de pagamento e paginação dentro do próprio escopo autenticado.

## Fase 73: busca por e-mail nas perguntas

A Central do Lojista permite encontrar perguntas pelo e-mail do cliente, além do texto da pergunta e do produto, sem remover o isolamento por seller.

## Fase 74: faixa de preço no storefront

O catálogo público aceita preço mínimo e máximo em centavos, considerando o preço vigente de qualquer variante ativa antes do ranking e da paginação.

## Fase 75: filtro de cupons futuros

As listas de cupons do Admin e do seller podem separar cupons com início futuro dos vigentes e expirados, mantendo limites de data e validação definitiva no servidor.

## Fase 76: filtro de envio no histórico do cliente

O cliente pode filtrar pedidos pelo status do envio de qualquer `SellerOrder`, preservando o escopo por `userId`, o filtro de loja e a paginação.

## Fase 77: filtro de categoria no catálogo do seller

A Central do Lojista permite restringir seus produtos por categoria ativa, combinando o filtro com busca, status, estoque e isolamento do seller.

## Fase 78: filtro de loja no storefront

O catálogo público oferece lojas aprovadas ou ativas como filtro, aplicando o `sellerId` na consulta de produtos antes do ranking e da paginação.

## Fase 79: filtro de provider em webhooks

O monitor administrativo aceita busca dedicada pelo provider do webhook, além da busca operacional por tipo, ID, erro e status.

## Fase 80: filtro de tipo de notificação

O monitor de entregas administrativas permite filtrar o tipo de notificação, mantendo status, busca textual e paginação sem expor payloads.

## Fase 81: filtro de marca no catálogo do seller

A Central do Lojista pode restringir seus produtos por marca, além de categoria, status, estoque e busca textual, sempre dentro do seller autenticado.

## Fase 82: busca por produto no histórico do cliente

A busca do histórico do cliente localiza pedidos pelo número ou pelo snapshot do nome do produto, combinando os demais filtros sem perder o escopo por usuário.

## Fase 83: filtro de ofertas no storefront

O catálogo público pode exibir apenas produtos com alguma variante ativa em promoção no momento da consulta, usando a mesma regra central de preço vigente.

## Fase 84: filtros estruturados na moderação

O Admin pode filtrar a fila de produtos por categoria e marca, além de status e texto, reduzindo a consulta e o payload antes da paginação.

## Fase 85: janela temporal de webhooks

O monitor administrativo de webhooks aceita datas inicial e final em UTC, com limite final exclusivo e validação de calendário no servidor.

## Fase 86: filtro de seller na moderação

O Admin pode restringir a fila de produtos submetidos ou rejeitados a um seller específico, combinando o escopo com categoria, marca, status e busca.

## Fase 87: janela temporal da auditoria

O visualizador de auditoria aceita período inicial e final, usando `createdAt` no banco e mantendo o limite final exclusivo em UTC.

## Fase 88: janela temporal de notificações

O monitor de e-mails transacionais pode filtrar entregas pelo período de criação, junto de tipo, status e busca operacional.

## Fase 89: período no histórico do cliente

O histórico de pedidos permite filtrar compras por data inicial e final, sem alterar a autorização por `userId` nem os filtros de loja, envio e pagamento.

## Fase 90: tipo de movimentação de estoque

A Central do Lojista pode separar vendas, reservas, devoluções, cancelamentos, ajustes manuais e correções no histórico auditável de estoque.

## Fase 91: filtro de seller em devoluções

O Admin pode restringir a fila de devoluções a uma loja específica, combinando o seller com status, busca e paginação.

## Fase 92: filtro de seller em cancelamentos

O monitor administrativo de cancelamentos permite analisar solicitações por loja sem perder o escopo do `SellerOrder`.

## Fase 93: filtro de seller em disputas

O Admin pode separar disputas por seller, mantendo o histórico de mediação, status e busca textual no banco.

## Fase 94: ordenação do histórico de pedidos

O cliente pode alternar entre pedidos mais recentes e mais antigos, preservando os filtros de status, loja, envio, pagamento e período.

## Fase 95: período no histórico de estoque

A Central do Lojista pode combinar o tipo de movimentação com datas inicial e final em UTC, mantendo `sellerId` e o limite final exclusivo.

## Fase 96: período nas filas de pós-venda

O Admin pode restringir devoluções, cancelamentos e disputas por data de criação, com limites UTC e filtro aplicado antes da paginação.

## Fase 97: período nas perguntas do seller

A Central do Lojista pode combinar estado, busca e período de criação das perguntas, preservando o isolamento por `sellerId`.

## Fase 98: busca ampliada no storefront

A busca pública também encontra produtos por SKU, marca, categoria e loja, além de nome e descrição, diretamente nas relações do banco.

## Fase 99: faixa de preço no catálogo do seller

O seller pode filtrar o próprio catálogo por preço mínimo e máximo em centavos, combinando a faixa com estoque, status, categoria e marca.

## Fase 100: busca por ator na auditoria

O Admin pode localizar registros de auditoria pelo nome ou e-mail do ator, mantendo o período, entidade, ação e paginação.

## Fase 101: período nos pedidos do seller

A Central do Lojista pode filtrar pedidos por data de criação, combinando período, status, envio e busca com o `sellerId` server-side.

## Fase 102: período nos pedidos administrativos

O monitor administrativo de operação aceita período de criação para analisar `SellerOrder` sem perder a unidade operacional por seller.

## Fase 103: período na moderação de produtos

A fila de revisão de produtos pode ser restringida por `submittedAt`, preservando status, categoria, marca, seller, busca e paginação.

## Fase 104: filtro de nota nas avaliações

O detalhe público do produto pode filtrar avaliações por uma a cinco estrelas; lista, média, contagem e paginação usam o mesmo recorte server-side.

## Fase 105: faixa de valor nos pedidos do cliente

O histórico do cliente pode filtrar o total do pedido por mínimo e máximo em centavos, mantendo `userId` no escopo da consulta.

## Fase 106: busca de pedidos do seller por produto e SKU

A Central do Lojista pode localizar pedidos pelo nome do produto ou SKU salvo no snapshot do item, além dos dados do cliente e pedido.

## Fase 107: busca de pedidos administrativos por produto e SKU

O Admin pode localizar `SellerOrder` pelo nome do produto ou SKU persistido no item, combinando a busca com seller, status, envio e período.

## Fase 108: ordenação dos pedidos do seller

A Central do Lojista pode alternar a fila entre pedidos mais recentes e mais antigos, preservando período, status, envio e busca.

## Fase 109: ordenação da operação administrativa

O monitor administrativo de `SellerOrder` suporta ordenação crescente ou decrescente por criação sem perder os filtros operacionais.

## Fase 110: paginação das avaliações da loja

A página pública da loja carrega avaliações em páginas de seis itens, mantendo média e total completos e evitando listas ilimitadas no storefront.

## Fase 111: busca do cliente por SKU

O histórico do cliente também localiza pedidos pelo SKU congelado no item, além do número do pedido e nome do produto.

## Fase 112: ordenação das perguntas do seller

A Central do Lojista pode ordenar perguntas por mais recentes ou mais antigas, mantendo filtros, período e isolamento da loja.

## Fase 113: ordenação da auditoria

O Admin pode alternar a auditoria entre registros mais recentes e mais antigos, preservando ação, entidade, ator e período.

## Fase 114: ordenação da moderação de produtos

A fila de revisão pode ser ordenada por submissão mais antiga ou mais recente, com desempate pela criação do produto.

## Fase 115: paginação do catálogo público da loja

O catálogo de cada loja pública é carregado em páginas menores, mantendo a página de avaliações e reduzindo o volume inicial do storefront.

## Fase 116: paginação de favoritos

A lista de favoritos do cliente é paginada no servidor, mantendo apenas produtos aprovados de sellers ativos ou aprovados.

## Fase 117: busca de favoritos

O cliente pode localizar favoritos por produto, marca, categoria ou loja, com estado persistido na URL.

## Fase 118: busca no histórico de estoque

O seller pode localizar movimentações por nome do produto, variante ou SKU, sempre com `sellerId` e filtros de período/tipo.

## Fase 119: ordenação de webhooks

O Admin pode alternar eventos de webhook entre mais recentes e mais antigos sem expor o payload bruto.

## Fase 120: ordenação de notificações

O monitor de entregas transacionais permite ordenar registros por criação, preservando status, tipo, período e paginação.

## Fase 121: disponibilidade de favoritos

A área de favoritos permite filtrar produtos em estoque ou indisponíveis, sempre recalculando a disponibilidade das variantes no servidor.

## Fase 122: ordenação de favoritos

Favoritos podem ser ordenados por inclusão mais recente ou mais antiga, preservando busca, disponibilidade e paginação.

## Fase 123: ordenação do histórico de estoque

O seller pode alternar o histórico de movimentações entre mais recentes e mais antigas, mantendo produto, SKU, tipo, período e isolamento por seller.

## Fase 124: ordenação da loja pública

O catálogo público de uma loja pode ser ordenado por relevância, novidade ou preço, mantendo a paginação de produtos e avaliações em parâmetros independentes.

## Fase 125: ordenação de sellers no admin

A fila administrativa de sellers pode ser ordenada por cadastro mais recente ou mais antigo, mantendo busca, status e paginação.

## Fase 126: paginação dos catálogos públicos

Páginas públicas de categoria, marca e moto carregam produtos em páginas menores no servidor, evitando listas extensas no primeiro carregamento.

## Fase 127: ordenação dos catálogos públicos

Os catálogos públicos podem ordenar produtos por relevância, novidade ou preço, preservando o contexto da categoria, marca ou moto.

## Fase 128: disponibilidade nos catálogos públicos

Categoria, marca e moto podem filtrar produtos em estoque ou indisponíveis usando variantes ativas e inventário server-side.

## Fase 129: ordenação do catálogo do seller

O seller pode ordenar seus produtos por atualização ou nome, mantendo status, marca, categoria, estoque, preço e isolamento por tenant.

## Fase 130: ordenação de cupons

Cupons do seller e do marketplace podem ser ordenados por criação, validade mais próxima ou código, preservando filtros e paginação.

## Fase 131: ordenação de devoluções no admin

A fila administrativa de devoluções pode alternar entre solicitações mais antigas e mais recentes, preservando status, seller, período e paginação.

## Fase 132: ordenação de cancelamentos no admin

A fila de cancelamentos pode ser ordenada por criação crescente ou decrescente sem perder a unidade operacional do `SellerOrder`.

## Fase 133: ordenação de disputas no admin

A mediação pode ordenar disputas por abertura mais antiga ou recente, mantendo filtros de status, seller, período e busca.

## Fase 134: ordenação de perguntas públicas

Perguntas de produto podem ser exibidas das mais recentes às mais antigas, com a ordenação preservada junto da paginação.

## Fase 135: busca de endereços salvos

O cliente pode localizar endereços por rótulo, destinatário, rua, cidade, estado ou CEP, sempre com escopo exclusivo do usuário autenticado.

## Fase 136: ordenação de avaliações de produto

Avaliações de produto podem ser exibidas das mais recentes às mais antigas, mantendo filtro de nota e paginação.

## Fase 137: ordenação de avaliações da loja

A vitrine pública da loja permite alternar a ordem das avaliações sem perder a paginação de produtos.

## Fase 138: filtro de promoções em catálogos públicos

Páginas de categoria, marca e moto podem mostrar apenas produtos com promoção ativa, sempre validada pelo domínio de preços no servidor.

## Fase 139: ordenação de pedidos por valor

O cliente pode ordenar o histórico por maior ou menor valor total, além da ordem cronológica existente.

## Fase 140: busca de itens nas filas pós-venda

O Admin pode localizar devoluções, cancelamentos e disputas por nome ou SKU do item congelado no pedido.

## Fase 141: filtro de estoque do catálogo do seller

O seller pode filtrar produtos em estoque, com estoque baixo ou esgotados, sempre por variantes ativas e inventário da própria loja.

## Fase 142: filtro de promoções do catálogo do seller

O seller pode listar produtos com promoção ativa usando as datas e o preço promocional persistidos nas variantes.

## Fase 143: disponibilidade na vitrine da loja

A loja pública permite filtrar produtos disponíveis ou indisponíveis, mantendo o seller e a aprovação do catálogo no servidor.

## Fase 144: promoções na vitrine da loja

A vitrine pública pode exibir apenas produtos em promoção ativa, com a mesma regra de pricing usada pelo storefront.

## Fase 145: busca de produtos na vitrine da loja

Visitantes podem buscar produtos da loja por nome, marca, categoria ou SKU, preservando busca, filtros, ordenação e paginação na URL.

## Pós-compra e devoluções

Clientes autenticados ou visitantes com o token seguro do checkout podem consultar o pedido em `/orders/[orderNumber]`, acompanhar os envios por seller e solicitar devolução por item. As solicitações são persistidas com idempotência e ficam aguardando análise; elas não alteram estoque ou pagamento automaticamente.

Sellers operam etiquetas e rastreamento em `/seller/orders`. O perfil de origem da loja precisa estar completo e os produtos precisam ter peso e dimensões para permitir a compra do frete.

Solicitações abertas aparecem no Admin em `/admin`. O fluxo é `REQUESTED -> APPROVED -> RETURNED -> REFUNDED` (ou `REJECTED`); o recebimento registra a movimentação de estoque `RETURN`, e o reembolso só é chamado após essa confirmação.

Cancelamentos são solicitados por `SellerOrder` enquanto o pedido ainda não foi postado. O Admin decide em `/admin`; a aprovação reembolsa o valor do seller, restaura o estoque com movimento `CANCELLATION` e atualiza o `Order` para `CANCELLED` ou `PARTIALLY_CANCELLED`. Após a postagem, o cliente deve usar devolução.

## Disputas e mediação

O cliente pode abrir uma disputa por `SellerOrder` a partir do pedido, inclusive como guest usando o token seguro. O Admin acompanha as disputas em `/admin` com o fluxo `OPEN -> UNDER_REVIEW -> RESOLVED` ou `REJECTED`. A mediação registra a descrição, a resolução e o `AuditLog`; não existe chat privado nem reembolso automático dentro da disputa.

## Cupons e promoções

O Admin pode criar cupons globais e sellers aprovados podem criar cupons próprios. O checkout aceita um cupom por pedido, recalcula o desconto server-side, aplica limites global e por cliente e registra a redenção. Cupons globais são financiados pelo MotoShop; cupons de seller reduzem o saldo daquele seller. Promoções de variante respeitam data inicial e final em todas as telas e no checkout.

## Plano VIP e exposição patrocinada

O Admin pode ativar ou renovar o plano VIP de um seller aprovado diretamente em `/admin`, com validade registrada em `seller_subscriptions`. A ativação ainda é administrativa no MVP; não há cobrança recorrente simulada antes da integração de assinatura com o Mercado Pago.

Produtos de sellers com VIP ativo recebem o selo `Patrocinado · VIP` no storefront. O VIP é apenas um sinal pequeno de ranking, aplicado depois de relevância, disponibilidade e reputação; ele não garante o primeiro resultado.

## Qualidade

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

O servidor local do Inngest pode ser iniciado separadamente com `pnpm inngest:dev`.

## Estrutura

- `src/app`: rotas e layouts do App Router.
- `src/modules`: regras organizadas por domínio.
- `src/components`: componentes visuais e shadcn/ui.
- `src/shared`: contratos compartilhados e erros.
- `src/lib`: infraestrutura e adapters.
- `src/config`: ambiente tipado e validado.
- `prisma`: schema e migrations PostgreSQL.

## Núcleo comercial do banco

O schema inicial cobre o catálogo multi-lojista, estoque auditável por variante, compatibilidade estruturada com motos, carrinho autenticado ou guest, pedidos globais divididos em `SellerOrder`, persistência de pagamentos, fretes, cupons e comissão configurável.

Decisões atuais do MVP:

- valores monetários são inteiros em centavos e percentuais usam basis points;
- SKU é único por seller e as relações comerciais carregam o `sellerId` para reforçar isolamento entre tenants;
- atributos de variante são um objeto JSON validado na aplicação; dimensões que afetam frete possuem colunas próprias;
- compatibilidade é atribuída ao produto nesta etapa, com fabricante, modelo, versão, cilindrada e ano normalizados;
- pedidos guardam snapshots dos dados comerciais e a comissão efetivamente aplicada;
- exclusões de dados históricos usam `Restrict` ou `SetNull`; cascata fica limitada a dados dependentes e descartáveis;
- regras que o Prisma não representa, como saldos não negativos e reconciliação de totais, são protegidas por `CHECK` constraints na migration.

Regras de aplicação como empilhamento de cupons, base exata da comissão e transições de estado serão definidas nos respectivos módulos antes do checkout completo.
