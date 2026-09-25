# Homologação das integrações do MVP

Estado em 24/09/2026. Este documento separa funcionamento local, teste com provedores e autorização para vendas reais. A presença de uma chave no `.env.local` não equivale à homologação.

## 1. Pagamento e notificações

- Cartão de crédito em uma parcela implementado com campos hospedados do MercadoPago.js: número, validade e CVV ficam nos iframes; a aplicação recebe apenas token e identificadores. Token não é persistido no pedido. A interface permanece com Pix se faltar `MERCADO_PAGO_PUBLIC_KEY`.
- Para ativar testes de cartão, preencher `MERCADO_PAGO_PUBLIC_KEY` com a Public Key de teste da mesma aplicação do Access Token. Não colocar Access Token nesse campo. Validar aprovação e recusa com cartões/contas de teste antes de habilitar credenciais produtivas. Os testes locais usam SDK/provider simulados e não comprovam homologação externa.
- Para o webhook, preencher a assinatura original em `MERCADO_PAGO_WEBHOOK_SECRET`. `MERCADO_PAGO_NOTIFICATION_URL` permite apontar somente as cobranças desta aplicação para a URL HTTPS temporária terminada em `/api/webhooks/mercado-pago`, sem sobrescrever a URL global usada por outros projetos. URL não é gerada nem ativada enquanto faltar a assinatura; não inventar assinatura local para representar notificação autêntica.
- Após autenticação do titular, a Public Key de teste foi obtida e configurada localmente. O painel de webhook aponta para outro projeto; sua configuração compartilhada foi preservada, sem envio de teste para essa URL. A assinatura e a URL próprias da Moto Shop continuam pendentes. Split 1:1/1:N fica adiado conforme orientação do responsável.
- Desenvolvimento local: `.env.local` usa `INNGEST_DEV=1`. Iniciar a aplicação (`pnpm dev`) e, em outro terminal, `pnpm inngest:dev`; conferir registro das funções em `http://localhost:8288` e o endpoint local `/api/inngest`. Não publicar o painel/endpoint de desenvolvimento em um túnel público; expor somente o caminho de webhook e manter a verificação de assinatura ativa. Em produção, desativar Dev Mode e configurar as chaves do Inngest Cloud.

- O checkout de uma loja gerou um Pix de teste pelo Mercado Pago. Pedido `MS-20260923-0DC8BD28`, pagamento `1352514061`, valor R$ 1,00; a consulta da API retornou `pending`. Isso **não** confirma pagamento, repasse ou webhook.
- Os testes de integração cobrem aprovação, recusa, concorrência, idempotência, baixa de estoque, repetição e atualização tardia do pagamento. Eles usam provider simulado; nunca fazem cobrança externa.
- O cliente pode reconsultar manualmente um pagamento pendente pelo detalhe do pedido autorizado. A confirmação financeira continua exclusivamente server-side.
- Antes da homologação de webhook: obter `MERCADO_PAGO_WEBHOOK_SECRET`, configurar um endereço HTTPS público temporário para `/api/webhooks/mercado-pago`, iniciar o Inngest local e enviar um evento de teste assinado. Verificar persistência do `WebhookEvent`, processamento, repetição e status final no banco. Não usar a URL temporária como configuração permanente.
- A recuperação de resposta perdida já está implementada: consulta por `external_reference`, exige resultado único, busca o pagamento atualizado e confere referência, ID, valor, moeda e método antes da reconciliação. Busca vazia, erro ou ambiguidade preservam o pedido/reserva; nunca provocam nova cobrança.
- O Inngest agenda consultas a cada dez minutos para pedidos pendentes criados há pelo menos dois minutos, incluindo pagamentos autorizados ainda sem captura. A fila é paginada e cada pagamento tem processamento independente com três retries. **O agendamento exige Inngest ativo e aplicação conectada**; registrar funções não significa que o serviço foi homologado.
- O vencimento local do QR não libera estoque. Somente recusa/cancelamento confirmado pelo provider libera a reserva, dentro da reconciliação transacional idempotente. Casos permanentemente não localizados exigem investigação operacional; não há cancelamento automático por idade.
- Ainda falta homologar no gateway a busca após resposta perdida, cancelamento/expiração confirmado, agendamento ponta a ponta e Pix efetivamente aprovado. Os novos testes usam respostas simuladas, não novas cobranças. Não abrir vendas reais antes dessa validação.

Referências do contrato: [Payment Search](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/payment-management) e [agendamento Inngest v4](https://www.inngest.com/docs/reference/typescript/functions/triggers).

## 2. Repasse aos lojistas

- O adapter atual aceita apenas um seller por cobrança real e bloqueia carrinhos de várias lojas. O `application_fee` enviado no teste **não prova** que houve repasse ao seller.
- O split 1:1 documentado pelo Mercado Pago exige autorização OAuth de cada vendedor. O split 1:N, necessário para cobrar um único carrinho com vários sellers, é restrito a contas de carteira assessorada. A modalidade disponível para a conta da Moto Shop precisa ser confirmada com o Mercado Pago antes de escolher e implementar o contrato financeiro.
- Não ativar `MERCADO_PAGO_MULTI_SELLER_ENABLED` como substituto de integração ou homologação. Não usar a conta central para arrecadar e repassar manualmente sem decisão jurídica, contábil e operacional explícita.
- Após a confirmação da modalidade: implementar conexão OAuth do seller com armazenamento seguro dos tokens, renovação/revogação, isolamento por seller, testes de comissão em centavos e reconciliação de recebíveis. Depois homologar um pedido de uma loja e um pedido de duas lojas com contas de teste separadas.

## 3. Imagens, e-mails e frete

### Cloudflare R2

- O fluxo de produto já cria URL assinada de upload direto, limita tipo/tamanho/quantidade e associa a imagem ao produto do seller. Um teste local verifica a assinatura; **não** verifica upload real.
- Para testar: criar bucket, credenciais S3 restritas, configurar `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` e `R2_PUBLIC_URL`. Para desenvolvimento sem domínio próprio, o `r2.dev` pode servir imagens publicamente, mas não é indicado para produção.
- Configurar CORS do bucket para a origem local e método `PUT` com `Content-Type`. Fazer upload e leitura de uma imagem de teste, associação ao produto, reordenação e remoção. Não colocar credenciais R2 no client.

### Resend

- O adapter e os workflows de e-mail já existem e um teste local verifica o contrato de envio. **Nenhum e-mail real foi enviado.**
- Para testar: preencher `RESEND_API_KEY` e `EMAIL_FROM` com remetente autorizado. Validar uma confirmação de pedido e um erro de pagamento, inclusive retry e deduplicação da `NotificationDelivery`. E-mail nunca deve decidir status financeiro.

### Melhor Envio

- O adapter de cotação/etiqueta existe e um teste local verifica a cotação no contrato do sandbox. O frete próprio já permite checkout sem Melhor Envio. **Nenhuma etiqueta externa foi comprada.**
- Para testar: preencher `MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_USER_AGENT` e CEP de origem da loja. Usar o endpoint sandbox; cotar produtos com medidas reais, selecionar frete, criar uma etiqueta de teste, gerar e consultar rastreio. Validar isolamento por seller e idempotência antes de qualquer compra de etiqueta em produção.

## Critério para encerrar a homologação

Uma integração só passa de **preparada** para **homologada** quando há evidência do fluxo ponta a ponta no serviço externo, estados persistidos no banco, retries seguros, testes de permissões e ausência de segredos em logs/cliente. O painel de integrações do Admin indica apenas presença de configuração.
