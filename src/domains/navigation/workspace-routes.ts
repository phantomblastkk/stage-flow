/** Explicit opt-in: never wrap public profiles, auth, admin or the existing dashboard. */
export const workspaceRoutes = [
  ["/eventos", "Agenda"],
  ["/meus-shows", "Histórico de shows"],
  ["/shows-recorrentes", "Shows recorrentes"],
  ["/minha-disponibilidade", "Disponibilidade"],
  ["/meus-convites", "Meus convites"],
  ["/conversas", "Conversas"],
  ["/convites", "Convidar músicos"],
  ["/marketplace", "Marketplace"],
  ["/financeiro", "Financeiro"],
  ["/equipes", "Equipes"],
  ["/parceiros", "Casas parceiras"],
  ["/meu-portfolio", "Portfólio"],
  ["/meu-desempenho", "Estatísticas"],
  ["/meu-perfil-artistico", "Perfil de cantor"],
  ["/minha-conta", "Minha conta"],
  ["/notificacoes", "Notificações"],
] as const;

export function workspaceRouteTitle(path: string): string | null {
  return workspaceRoutes.find(([route]) => path === route || path.startsWith(route + "/"))?.[1] ?? null;
}
