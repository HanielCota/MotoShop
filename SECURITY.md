# Política de segurança — O Moto Shop

## Como reportar uma vulnerabilidade

**Não abra issue pública, PR ou comentário descrevendo a falha.**

1. Use o reporte privado do GitHub: aba **Security → Report a vulnerability** neste repositório
   (_private vulnerability reporting_).
2. Se o reporte privado não estiver disponível, fale diretamente com o responsável pelo projeto
   ([@HanielCota](https://github.com/HanielCota)) por um canal privado.

Inclua, se possível: rota ou módulo afetado, passos para reproduzir, impacto estimado e sugestão de correção.

## Escopo

- Aplicação Next.js (storefront, Central do Lojista e Admin).
- Pagamentos e checkout (Mercado Pago, webhooks, reembolsos, comissão).
- Autenticação e sessões (Better Auth, recuperação de senha, acesso de pedido guest por token).
- Isolamento de dados entre sellers (multi-tenant) e dados pessoais de clientes.
- Integrações (Melhor Envio, ImageKit, Resend, Inngest) e exposição de segredos.

## O que não fazer

- Não testar contra pagamentos de produção nem usar cartões ou contas reais.
- Não acessar, copiar ou alterar dados reais de clientes ou sellers. Use contas `@example.test` e um banco de
  desenvolvimento ou branch Neon isolado.
- Não executar testes de carga, negação de serviço ou engenharia social.
- Não divulgar a falha antes da correção ser publicada.

## Expectativas de resposta

- Confirmação de recebimento em até **3 dias úteis**.
- Avaliação inicial e classificação de severidade em até **7 dias úteis**.
- Falhas críticas (pagamento, autenticação, vazamento entre sellers) têm prioridade sobre qualquer outra tarefa.

## Regras de segurança do projeto

As regras obrigatórias estão no [AGENTS.md](AGENTS.md):

- §32 — Segurança multi-tenant (ownership validado no servidor, nunca confiar em IDs do cliente).
- §33 — Segurança (segredos só no servidor, nunca `NEXT_PUBLIC_*` para segredo).
- §34 — Dados sensíveis (sem dados completos de cartão, sem tokens ou senhas em logs).
