# Regra pendente para o AGENTS.md: convite de equipe da loja (M-04)

Texto proposto para a seção "Decisões adicionais do MVP", no lugar de "A gestão inicial da equipe adiciona apenas usuários já cadastrados; convites externos e transferência de ownership ficam fora do MVP.":

- A equipe da loja cresce só por convite (`SellerMemberInvite`). O dono convida qualquer perfil; um administrador convida só perfis operacionais (L-17). O convite guarda apenas o hash SHA-256 de um token aleatório de 32 bytes, vale 7 dias e há no máximo um pendente por loja e e-mail (índice parcial). A resposta ao convidar é a mesma exista ou não uma conta com o e-mail, e o envio tem limite de 10 convites por hora por loja.
- O vínculo `SellerMember` só é criado quando a pessoa aceita em `/convite/<token>` (ou pela lista de convites em `/seller`), logada com a conta do mesmo e-mail e com o e-mail verificado, sem outra loja. O aceite consome o convite e cria o membro na mesma transação, com `AuditLog`. Link vencido, usado, cancelado ou de outro e-mail recebe uma mensagem única.
- O e-mail do convite sai pelo provider do projeto quando o Resend está configurado; falha de envio não muda a resposta. "Copiar link" gera um link novo e invalida o anterior, inclusive o do e-mail.
- Qualquer membro, menos o dono, pode sair da loja por conta própria (`SELLER_MEMBER_LEFT`). Transferência de ownership continua fora do MVP.
