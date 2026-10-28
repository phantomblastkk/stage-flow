# Stage Flow — Revisão mobile de foco e teclado (28/10/2026)

Análise de capturas de navegador em 360px das jornadas de painel, contratação e perfis. A navegação inferior está visível e os cartões se encaixam, mas o editor de etapas usa uma barra sticky grande, problemática quando o teclado ocupa parte do visor.

Ajustes: barra de etapas torna-se não fixa enquanto um campo tem foco e em alturas de até 650px; barra inferior é ocultada em formulários com foco para não encobrir inputs; conversa compacta cabeçalho e compositor quando a altura visível é curta. Foco e zoom de campos com fonte >= 16px.

Regressões automatizadas: simulação de viewport reduzido a 375x520, teste do campo de instrumento e de mensagem, verificação de scroll horizontal, barra não sobreposta e botão Enviar dentro do painel. Capturas ficam nos artefatos de QA. Não equivale a teste no Safari/iPhone físico: viewport reduzido é apenas um proxy do teclado.

Sem alterações SQL, permissões ou produção. **Deploy apenas após autorização explícita.**
