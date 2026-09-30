import ui from '../landing.module.scss';
import styles from './ResourcesSection.module.scss';

const items = [
  ['Projetos isolados', 'Documentos, membros e templates independentes em cada projeto. Crie quantos precisar.'],
  ['Templates', 'Crie modelos de documento personalizados e reutilize em qualquer projeto.'],
  ['Categorias e tipos', 'Classifique os arquivos por categorias e tipos personalizados.'],
  ['Qualquer formato', 'Envie arquivos de qualquer formato e associe cada um ao projeto correto.'],
  ['Membros e permissões', 'Adicione e remova membros por projeto, com permissões claras.'],
  ['Painel centralizado', 'Status de documentos, projetos e membros em um dashboard só.'],
  ['100% web', 'Funciona no navegador, em qualquer dispositivo. Nada para instalar.'],
] as const;

export default function ResourcesSection() {
  return (
    <section className={styles.resources} id="recursos">
      <div className={ui.wrap}>
        <div className={styles.head}>
          <p className={ui.kicker}>Recursos</p>
          <h2>Cada projeto no seu espaço. Nada misturado.</h2>
        </div>
        <dl className={styles.list}>
          {items.map(([title, text]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
