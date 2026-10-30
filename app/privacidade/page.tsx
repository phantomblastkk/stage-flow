import Link from "next/link";
import "../termos/legal.css";

export const metadata = {
  title: "Política de Privacidade | StageFlow",
  description: "Como os dados de cadastro e o WhatsApp são utilizados no StageFlow."
};
export default function PrivacyPage() {
  return <main className="sf-legal">
    <div className="sf-legal-container">
      <Link href="/cadastro" className="sf-legal-return">← Voltar ao cadastro</Link>
      <p className="sf-legal-eyebrow">STAGEFLOW · PRIVACIDADE</p>
      <h1>Política de Privacidade</h1>
      <p className="sf-legal-date">Versão 2026-10-29-v1 · 29 de outubro de 2026</p>
      <p>Esta política explica as finalidades do uso de dados pessoais no StageFlow e as escolhas relacionadas ao seu número de WhatsApp.</p>
      <section><h2>1. Dados utilizados</h2>
        <p>Ao criar uma conta, informamos como dados necessários: nome profissional, e-mail, número de WhatsApp, tipo de atividade e credenciais de acesso. A senha é processada pelo serviço de autenticação e não é disponibilizada a outros usuários. Dados de perfil, fotos, portfólio, agenda, mensagens e propostas só são usados quando você escolhe utilizar essas funções.</p></section>
      <section><h2>2. Por que usamos os dados</h2>
        <p>Os dados servem para autenticar a conta, manter a segurança, permitir convites e conversas, organizar eventos, operar funcionalidades solicitadas e cumprir obrigações legais aplicáveis. O perfil artístico só exibe informações públicas após as ações de publicação correspondentes.</p></section>
      <section><h2>3. WhatsApp privado e consentimentos independentes</h2>
        <p>Seu número é exigido como contato de cadastro, mas não é exposto automaticamente. Existem duas escolhas independentes e opcionais: <strong>(a)</strong> receber notificações operacionais iniciadas pelo StageFlow via WhatsApp, quando essa integração estiver ativa, e <strong>(b)</strong> autorizar contato manual de organizadores em convites ou contratações em que você participa. Nenhuma dessas permissões inclui o envio de publicidade.</p>
        <p>Você pode deixar ambas desmarcadas e continuar criando sua conta. A recusa não impede o uso das ferramentas de convites e mensagens internas. Para interromper comunicações, utilize as preferências de privacidade disponíveis na conta ou solicite a suspensão pelos canais de suporte do StageFlow.</p></section>
      <section><h2>4. Compartilhamento e prestadores</h2>
        <p>Dados técnicos poderão ser processados por fornecedores de infraestrutura e autenticação necessários para operar o serviço. Números de contato só serão disponibilizados a outros usuários conforme suas autorizações e as regras de cada recurso. Se notificações via WhatsApp forem habilitadas, a comunicação poderá envolver o provedor integrado, respeitando suas políticas e o consentimento informado.</p></section>
      <section><h2>5. Retenção, segurança e direitos</h2>
        <p>Adotamos controles de acesso ao banco de dados e permissões para reduzir a exposição indevida. Você poderá solicitar informações, correção ou exclusão de dados nos limites legais, além de revogar consentimentos de comunicação. O StageFlow avaliará a solicitação e os prazos legais aplicáveis.</p></section>
      <section><h2>6. Mudanças</h2>
        <p>Mudanças relevantes de finalidade ou novas versões desta política deverão ser comunicadas aos usuários. Os consentimentos de WhatsApp não são presumidos a partir da aceitação geral dos termos.</p></section>
      <p className="sf-legal-foot">Se desejar esclarecer como seus dados são tratados, use os canais de suporte disponibilizados na plataforma.</p>
      <Link href="/cadastro" className="sf-legal-cta">Retornar ao cadastro</Link>
    </div>
  </main>;
}