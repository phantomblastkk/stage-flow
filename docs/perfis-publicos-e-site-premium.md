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
