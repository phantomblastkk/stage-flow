# StageFlow — Parte 16: editores de equipe, orçamento e flyer

Base sincronizada: `da7548f79e9c532a5f70ad4a84caedfc4a42ab87`, diretamente na main.
As mudanças de dashboard, Marketplace e perfil posteriores à Parte 15 foram preservadas.
Sem deploy, alteração de migrations, banco remoto ou configuração da Vercel nesta etapa.

## Problema → impacto → implementação

| Problema | Impacto | Solução aplicada |
|---|---|---|
| Equipe, orçamento e flyer tinham cores e controles próprios | Aparência e foco divergiam da Agenda/Financeiro | Button, Input, Select, Textarea, InlineNotice e LoadingState compartilhados |
| Regras locais repetiam bordas, campos, botões e avisos | Sobrescritas difíceis de manter | Folhas locais passam a cuidar do layout e usam tokens semânticos |
| Ações de despesa e ranges do flyer eram pequenos | Uso difícil no celular | Alvos mínimos de 44 px; campos monetários com 16 px nas larguras móveis |
| Upload só existia como input hidden dentro de label | Seletor de arquivo não participava da navegação por teclado | Input type=file visível, rotulado e com apresentação reutilizável no Design System |
| Formatos e recortes não expunham seleção semântica | Estado ativo dependia da cor | aria-pressed nos botões de formato/ajuste |
| Proporção do canvas era estilo inline | Apresentação dispersa no JSX | data-format e classes CSS para Feed/Story |

## Alterações e limites

- Três folhas locais: 16.628 → 14.236 bytes de fonte (redução de 2.392 bytes).
  Essa medida não representa redução equivalente de bundle ou latência medida.
- As três folhas não usam hexadecimais ou variáveis de cor legadas.
- Removido o único atributo style desses três editores (proporção do canvas).
- Removida regra financeira para .btn que ficou sem consumidor após a migração.
- Não foram acrescentadas dependências, novas consultas, hooks ou efeitos.
- Valores, validação monetária, estados busy, permissões, handlers de salvar,
  confirmação de convite/exclusão, armazenamento e renderização do flyer foram preservados.
- Input de arquivo mantém os limites JPG/PNG/WebP e 8 MB. Prévia/download não publicam o flyer.
- O resumo de cachês EventFinancialSummary é outro componente e continua com
  estilos legados; sua migração não está incluída nesta etapa.
- CSS global, perfis e demais editores ainda não têm migração completa.

## Validação

- 261 testes Node, TypeScript e build de produção passaram localmente.
- Navegador: cenários existentes em 360/768/1280 px ampliados para equipe,
  despesa inválida/válida, edição da despesa, upload inválido/válido, troca Feed/Story,
  zoom pelo teclado e arquivo exportado com dimensões 1080×1350.
- Confirmação de equipe cancelada não escreve; confirmação aceita escreve uma vez
  na fixture e preserva evento/mensagem. Nenhuma pessoa real é contatada.
- Pagamento de despesa acima do previsto não escreve; salvar valor válido recarrega
  o item e mantém valores na edição. API totalmente sintética.
- Verificação de overflow, contraste do erro e alvos de toque nos estados exercitados.
- CI e inspeção visual: registrar evidências após a execução.

A base possuía falha no workflow operacional de perfis por timeout de navegador
(execução 40723002685); o commit da base da7548f trata esse teste. Verificar seu
resultado separadamente, sem confundir com a regressão dos editores.

## Continuidade

Próxima fatia: migrar resumo de cachês e gestão detalhada de escala/convites,
retirando seletores globais somente depois de migrar todos os consumidores.
