# Stage Flow — Cadastro e experiências de artista

## Escolhas no cadastro
- Cantor / artista principal: artist_kind = lead, is_artist = true. Pede @ e prioriza agenda, perfil artístico, convites e equipes.
- Músico de apoio: artist_kind = support, is_artist = true. Não exige @ e prioriza convites, portfólio simples e agenda.
- Produtor / contratante: artist_kind = null, is_artist = false, is_producer = true. Prioriza eventos, convites e equipes.
- Cantor ou músico também pode marcar "Também organizo ou contrato shows" na mesma conta.
- Cadastro iniciado por convite começa como músico de apoio, sem exigir @.

## Regras e compatibilidade
- artist_kind é uma preferência de interface; nunca altera plano ou autorizações.
- O artista pode alternar o foco lead/support no painel por RPC stage_choose_artist_experience.
- O SQL supabase/artist_account_experience_migration.sql mantém perfis, convites, papel e recursos premium intactos.
- Contas antigas com @ iniciam como lead; sem @ iniciam como support; podem mudar depois.
- O dashboard funciona antes da migração com fallback, mas salvar a escolha requer executar o SQL.

## Testes depois da migração
1. Cadastre músico de apoio: @ não deve ser obrigatório; verifique WhatsApp e aceite.
2. Cadastre cantor: @ deve ser obrigatório, painel deve priorizar shows e página de cantor.
3. Cadastre produtor somente: não deve exigir WhatsApp de músico.
4. Teste o cadastro por convite: entrada como apoio sem @, retornando ao convite.
5. Alterne o painel entre cantor e apoio e recarregue: a escolha persiste, sem mudar plano e cachês.