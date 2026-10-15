# Stage Flow — perfis públicos e site profissional

Decisão de produto (15/10/2026).

## Músico de apoio — portfólio simples e gratuito

- Endereço: \`stageflow.com/musico/joaooliveira\`
- Instrumentos, estilos, biografia, fotos e links de trabalhos.
- Pode escolher **"Sob consulta"** ou **"A partir de R$ X"**.
- Negociações dos shows são sempre privadas para músico e contratante.
- Publicação opcional pelo músico; não possui subdomínio.
- Pode participar do futuro marketplace.

## Cantor ou artista — perfil gratuito com @

- Endereço comum: \`stageflow.com/cantorsousa\`
- Nome de usuário único \`@cantorsousa\`.
- Biografia, cidade, redes sociais e próximos shows marcados como públicos.
- Disponível com a conta gratuita, sem exigir assinatura.
- O proprietário decide quando publicar.
- O endereço não é removido porque o usuário deixou de pagar o extra.
- Rota antiga \`/artista/cantorsousa\` redireciona para \`/cantorsousa\`.
- No projeto provisório, a URL equivalente é \`stage-flow-lemon.vercel.app/cantorsousa\`. O domínio \`stageflow.com\` é exemplo da futura configuração oficial.

## Cantor — site profissional (ADICIONAL PAGO FUTURO)

- Subdomínio \`cantorsousa.stageflow.com\` (ou outra oferta de domínio a definir).
- Interface completa inspirada no design de referência entregue pelo fundador:
  capa com foto grande, destaques, agenda/calendário, galeria, vídeos,
  portfólio, redes sociais e ações de contratação.
- Tema, cores e layout mais avançados.
- Exige provisionamento do subdomínio, DNS wildcard/SSL e verificação
  server-side de titularidade e habilitação da compra.
- O campo protegido \`profiles.custom_subdomain_enabled\` já está reservado
  para autorização no banco de dados, mas **a cobrança, o provisionamento
  e o acesso ao site premium não estão implementados**.
- **Nunca** liberar apenas porque o usuário escolheu um subdomínio no cliente
  ou alterou metadados do navegador.
- Cancelamento do adicional não apaga o conteúdo do perfil gratuito;
  site comum e @ continuam disponíveis.

## Separação entre os produtos

- Um usuário pode ser cantor e também músico de apoio, mantendo a mesma conta.
- \`/musico/[slug]\` continua reservado ao portfólio simples.
- \`/[username]\` é a rota gratuita dos cantores/artistas.
- Páginas avançadas premium precisam de regras explícitas no servidor
  para não vazarem simplesmente por outra rota.
- As buscas futuras e a presença no marketplace terão regras e monetização próprias.


## Prévia privada do site premium (implementada)

- Rota autenticada: /meu-perfil-artistico/site-profissional
- Somente contas com função de artista e sessão válida podem visualizar o conceito; a RPC stage_my_artist_page retorna dados da própria conta.
- Visual inspirado na referência aprovada: hero com foto, capa, biografia, botões de contato, portfólio, redes, calendário navegável e lista de shows.
- Mostra somente apresentações do próprio artista que estejam simultaneamente published e show_publicly = true. Os números exibidos são contagens reais, não métricas inventadas.
- Imagens já cadastradas no perfil gratuito são reutilizadas apenas para ilustrar a aparência futura.
- Sem SQL novo: lê as estruturas da página gratuita e eventos já existentes.
- Nenhum subdomínio é criado e nenhuma cobrança, assinatura ou site premium público é ativado.
- Galeria detalhada e formulário de contratação aparecem como conceitos/estado em preparação; não são funcionalidade disponível.
- Perfil gratuito /[username] permanece independente de contratação.
- A prévia está aninhada sob a rota estática já reservada meu-perfil-artistico, evitando colisões com @ artísticos.
