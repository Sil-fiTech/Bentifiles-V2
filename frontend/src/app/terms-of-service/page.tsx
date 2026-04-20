import styles from './page.module.scss';

export default function TermsOfService() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1>Termos de Serviço</h1>
        
        <section>
          <h2>1. Introdução</h2>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore 
            et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut 
            aliquip ex ea commodo consequat.
          </p>
        </section>

        <section>
          <h2>2. Aceitação dos Termos</h2>
          <p>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
            Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. 
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.
          </p>
        </section>

        <section>
          <h2>3. Descrição do Serviço</h2>
          <p>
            Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. 
            Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos 
            qui ratione voluptatem sequi nesciunt.
          </p>
          <ul>
            <li>Lorem ipsum dolor sit amet</li>
            <li>Consectetur adipiscing elit</li>
            <li>Sed do eiusmod tempor incididunt</li>
            <li>Ut labore et dolore magna aliqua</li>
          </ul>
        </section>

        <section>
          <h2>4. Contas de Usuário</h2>
          <p>
            Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non 
            numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, 
            quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur.
          </p>
        </section>

        <section>
          <h2>5. Propriedade Intelectual</h2>
          <p>
            Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum 
            qui dolorem eum fugiat quo voluptas nulla pariatur. At vero eos et accusamus et iusto odio dignissimos ducimus qui 
            blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati 
            cupiditate non provident.
          </p>
        </section>

        <section>
          <h2>6. Limitação de Responsabilidade</h2>
          <p>
            Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum 
            facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo 
            minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.
          </p>
        </section>

        <section>
          <h2>7. Indenização</h2>
          <p>
            Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae 
            sint et molestiae non recusandae itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus 
            maiores alias consequatur aut perferendis doloribus asperiores repellat.
          </p>
        </section>

        <section>
          <h2>8. Rescisão</h2>
          <p>
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, 
            eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam 
            voluptatem quia voluptas sit aspernatur aut odit aut fugit.
          </p>
        </section>

        <section>
          <h2>9. Lei Aplicável</h2>
          <p>
            Sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est, qui dolorem 
            ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et 
            dolore magnam aliquam quaerat voluptatem.
          </p>
        </section>

        <section>
          <h2>10. Contato</h2>
          <p>
            Se tiver dúvidas sobre estes Termos de Serviço, entre em contato conosco através do nosso formulário de contato ou envie 
            um e-mail para support@bentifiles.com. Estamos aqui para ajudar e responder a qualquer pergunta que possa ter sobre nossos 
            serviços e políticas.
          </p>
        </section>

        <div className={styles.lastUpdated}>
          <p>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
}
