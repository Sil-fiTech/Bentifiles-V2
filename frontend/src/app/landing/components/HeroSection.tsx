import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Logo from './Logo';
import ui from '../landing.module.scss';
import styles from './HeroSection.module.scss';

// exemplo ilustrativo: não são dados reais de clientes
const rows = [
  { doc: 'RG, frente e verso', who: 'Enviado por Maria Exemplo', state: 'ok', label: 'Aprovado' },
  { doc: 'Comprovante de residência', who: 'Enviado por João Exemplo', state: 'bad', label: 'Ilegível' },
  { doc: 'Contrato assinado', who: 'Aguardando envio', state: 'wait', label: 'Pendente' },
  { doc: 'Certidão de nascimento', who: 'Enviado por Maria Exemplo', state: 'check', label: 'Validando' },
] as const;

const stampClass = {
  ok: styles.stampOk,
  bad: styles.stampBad,
  wait: styles.stampWait,
  check: styles.stampCheck,
} as const;

export default function HeroSection() {
  return (
    <section className={styles.hero} id="inicio">
      <div className={`${ui.wrap} ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={ui.kicker}>Solicite · Valide · Aprove</p>
          <h1>
            Peça o documento.
            <br />
            Receba <mark>legível</mark>.
          </h1>
          <p className={styles.lead}>
            No Bentifiles você solicita documentos aos seus clientes, acompanha quem já enviou e valida a
            qualidade de cada arquivo antes de abrir. Chega de caçar anexo no WhatsApp e no e-mail.
          </p>
          <div className={styles.cta}>
            <Link className={`${ui.btn} ${ui.btnAmber}`} href="/login?mode=register">
              Criar conta
              <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
            </Link>
            <a className={`${ui.btn} ${ui.btnGhost}`} href="#validacao">
              Ver a validação
            </a>
          </div>
          <ul className={styles.facts}>
            <li>100% web, nada para instalar</li>
            <li>10 dias de teste no plano Individual</li>
            <li>Cancele quando quiser, pelo painel</li>
          </ul>
        </div>

        <figure className={styles.board} aria-label="Exemplo ilustrativo de uma fila de solicitações de documentos">
          <div className={styles.bird} aria-hidden="true">
            <Logo size={132} wordmark={false} />
          </div>
          <div className={styles.sheet}>
            <div className={styles.sheetHead}>
              <span>Projeto · Admissão</span>
              <span>4 solicitações</span>
            </div>
            <ul>
              {rows.map((r) => (
                <li key={r.doc}>
                  <div>
                    <strong>{r.doc}</strong>
                    <span>{r.who}</span>
                  </div>
                  <span className={`${styles.stamp} ${stampClass[r.state]}`}>{r.label}</span>
                </li>
              ))}
            </ul>
            <p className={styles.sheetFoot}>Exemplo ilustrativo, com dados fictícios.</p>
          </div>
        </figure>
      </div>
    </section>
  );
}
