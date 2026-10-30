import Link from "next/link";
import "./legal.css";

export const metadata = {
  title: "Termos de Uso | StageFlow",
  description: "Condições de utilização da plataforma StageFlow."
};
export default function TermsPage() {
  return <main className="sf-legal">
    <div className="sf-legal-container">
      <Link href="/cadastro" className="sf-legal-return">← Voltar ao cadastro</Link>
      <p className="sf-legal-eyebrow">STAGEFLOW · DOCUMENTOS</p>
      <h1>Termos de Uso</h1>
      <p className="sf-legal-date">Versão 2026-10-29-v1 · 29 de outubro de 2026</p>
      <p>Ao criar uma conta, você concorda com as condições abaixo para utilizar a plataforma StageFlow.</p>
      <section><h2>1. Para que serve a plataforma</h2>
        <p>O StageFlow reúne recursos de divulgação artística, portfólio, agenda, convites, conversas e organização de apresentações. O cadastro é gratuito; recursos adicionais pagos, quando disponibilizados, serão informados com condições próprias antes de qualquer contratação.</p></section>
      <section><h2>2. Conta e responsabilidade</h2>
        <p>Você deve informar dados corretos, usar sua própria conta e proteger a senha. Não é permitido se passar por outra pessoa, divulgar material sem autorização, enviar mensagens abusivas ou tentar acessar informações de terceiros indevidamente. Os papéis de artista e organizador podem ser ampliados dentro das regras do serviço; gerenciar uma casa de show exige autorização específica.</p></section>
      <section><h2>3. WhatsApp e comunicação</h2>
        <p>O número de WhatsApp é obrigatório no cadastro e será armazenado como contato privado de conta. Informar o número <strong>não autoriza automaticamente</strong> a publicação em seu perfil, seu compartilhamento com contratantes ou o envio de notificações pelo WhatsApp. Essas permissões são escolhas separadas, apresentadas no cadastro.</p>
        <p>Se você permitir que seu número seja mostrado a organizadores de convites, o contato poderá ser compartilhado apenas no contexto das atividades de contratação ou convites disponibilizadas pela plataforma, conforme a Política de Privacidade. Você poderá retirar a autorização nos controles de privacidade. Mensagens automáticas dependerão da disponibilidade e das regras do provedor WhatsApp.</p></section>
      <section><h2>4. Conteúdo, convites e contratação</h2>
        <p>Os conteúdos enviados devem respeitar os direitos de terceiros e a legislação. Propostas, valores e contratações negociados entre usuários são de responsabilidade dos envolvidos; o StageFlow oferece ferramentas de organização e comunicação, sem garantir a conclusão de negócios.</p></section>
      <section><h2>5. Privacidade e atualização das regras</h2>
        <p>O tratamento de dados pessoais está descrito na <Link href="/privacidade">Política de Privacidade</Link>. Quando houver mudanças relevantes nestes termos, a plataforma deverá informar a nova versão para que os usuários possam consultá-la antes de aceitá-la.</p></section>
      <p className="sf-legal-foot">Para dúvidas sobre estas condições ou privacidade, utilize os canais de suporte disponibilizados no StageFlow.</p>
      <Link href="/cadastro" className="sf-legal-cta">Retornar ao cadastro</Link>
    </div>
  </main>;
}