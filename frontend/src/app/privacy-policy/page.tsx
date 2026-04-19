import styles from './page.module.scss';

export default function PrivacyPolicy() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1>Política de Privacidade</h1>
        
        <section>
          <h2>1. Introdução</h2>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sua privacidade é importante para nós. Esta Política de 
            Privacidade explica como coletamos, usamos, divulgamos e protegemos suas informações quando você utiliza nossa plataforma. 
            Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        </section>

        <section>
          <h2>2. Informações que Coletamos</h2>
          <p>Coletamos informações de várias maneiras:</p>
          <ul>
            <li><strong>Informações de Conta:</strong> Nome, email, senha, foto de perfil</li>
            <li><strong>Dados de Pagamento:</strong> Informações de cartão de crédito (processadas por Stripe)</li>
            <li><strong>Documentos Enviados:</strong> Arquivos de documentos e metadados</li>
            <li><strong>Dados de Uso:</strong> Logs de acesso, IP, navegador, timestamp</li>
            <li><strong>Cookies:</strong> Para autenticação e preferências de sessão</li>
          </ul>
        </section>

        <section>
          <h2>3. Como Usamos Suas Informações</h2>
          <p>
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. 
            Usamos suas informações para:
          </p>
          <ul>
            <li>Fornecer e manter nossos serviços</li>
            <li>Processar transações e enviar notificações relacionadas</li>
            <li>Personalizar e melhorar sua experiência</li>
            <li>Enviar comunicações de marketing (com consentimento)</li>
            <li>Detectar e prevenir fraudes e atividades ilegais</li>
            <li>Conformidade com obrigações legais</li>
          </ul>
        </section>

        <section>
          <h2>4. Compartilhamento de Informações</h2>
          <p>
            Não vendemos ou alugamos suas informações pessoais. Podemos compartilhar seus dados com:
          </p>
          <ul>
            <li><strong>Stripe:</strong> Para processamento de pagamentos</li>
            <li><strong>Cloudflare:</strong> Para armazenamento seguro de documentos</li>
            <li><strong>Parceiros de Serviço:</strong> Que nos ajudam a operar o serviço</li>
            <li><strong>Autoridades Legais:</strong> Quando obrigados por lei</li>
          </ul>
        </section>

        <section>
          <h2>5. Segurança de Dados</h2>
          <p>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
            Implementamos medidas técnicas e organizacionais para proteger suas informações, incluindo:
          </p>
          <ul>
            <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
            <li>Senhas com hash bcrypt</li>
            <li>Autenticação de dois fatores (quando disponível)</li>
            <li>Acesso restrito aos dados pessoais</li>
            <li>Auditorias de segurança regulares</li>
          </ul>
        </section>

        <section>
          <h2>6. Retenção de Dados</h2>
          <p>
            Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. 
            Retemos suas informações enquanto sua conta estiver ativa ou conforme necessário para fornecer nossos serviços. 
            Você pode solicitar a exclusão de seus dados a qualquer momento.
          </p>
        </section>

        <section>
          <h2>7. Seus Direitos</h2>
          <p>Você tem direito a:</p>
          <ul>
            <li>Acessar suas informações pessoais</li>
            <li>Corrigir dados imprecisos</li>
            <li>Solicitar exclusão de seus dados (direito ao esquecimento)</li>
            <li>Restringir o processamento de seus dados</li>
            <li>Exportar seus dados em formato legível</li>
            <li>Revogar consentimento para processamento</li>
          </ul>
        </section>

        <section>
          <h2>8. Cookies e Rastreamento</h2>
          <p>
            Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos 
            qui ratione voluptatem sequi nesciunt. Usamos cookies para:
          </p>
          <ul>
            <li>Manter você conectado à sua sessão</li>
            <li>Lembrar preferências</li>
            <li>Analisar padrões de uso</li>
            <li>Melhorar a experiência do usuário</li>
          </ul>
        </section>

        <section>
          <h2>9. Conformidade com LGPD/GDPR</h2>
          <p>
            Nossa plataforma está em conformidade com a Lei Geral de Proteção de Dados (LGPD) no Brasil e com o Regulamento Geral 
            sobre Proteção de Dados (GDPR) na União Europeia. Somos transparentes sobre como processamos seus dados pessoais e 
            oferecemos controles robustos.
          </p>
        </section>

        <section>
          <h2>10. Alterações nesta Política</h2>
          <p>
            Podemos atualizar esta Política de Privacidade de tempos em tempos. Notificaremos você sobre mudanças significativas via 
            email ou através de um aviso em destaque em nossa plataforma. Seu uso continuado do serviço após tais modificações constitui 
            sua aceitação das alterações.
          </p>
        </section>

        <section>
          <h2>11. Contato - Oficial de Privacidade</h2>
          <p>
            Se tiver perguntas sobre esta Política de Privacidade ou desejar exercer seus direitos de privacidade, entre em contato:
          </p>
          <ul>
            <li><strong>Email:</strong> privacy@bentifiles.com</li>
            <li><strong>Formulário de Contato:</strong> Disponível em nossa plataforma</li>
            <li><strong>Endereço:</strong> Detalhes completos fornecidos mediante solicitação</li>
          </ul>
        </section>

        <div className={styles.lastUpdated}>
          <p>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
}
