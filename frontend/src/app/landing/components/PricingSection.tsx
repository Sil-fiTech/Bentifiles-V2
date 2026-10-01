import RegisterLink from './RegisterLink';
import { plans } from '../data/plans';
import ui from '../landing.module.scss';
import styles from './PricingSection.module.scss';

const SALES_URL = 'https://www.silfi-tech.net/';

export default function PricingSection() {
  return (
    <section className={styles.pricing} id="planos">
      <div className={ui.wrap}>
        <div className={styles.head}>
          <p className={ui.kicker}>Planos e preços</p>
          <h2>Escolha como começar. Sem taxas ocultas.</h2>
          <p>Valores em reais. Você pode trocar de plano a qualquer momento, com cobrança proporcional.</p>
        </div>

        <div className={styles.plans}>
          {plans.map((plan) => (
            <article key={plan.id} className={plan.highlighted ? styles.featured : undefined}>
              {plan.badge && <p className={styles.flag}>{plan.badge}</p>}
              <h3>{plan.name}</h3>
              <p className={styles.for}>{plan.description}</p>

              {plan.contactLabel ? (
                <p className={styles.price}>
                  <strong className={styles.consult}>Sob consulta</strong>
                </p>
              ) : (
                <p className={styles.price}>
                  <strong>{plan.monthlyPrice}</strong>
                  <span>/mês</span>
                </p>
              )}

              {!plan.contactLabel && (
                <p className={styles.alt}>
                  No anual: <b>{plan.annualPrice}/mês</b> ({plan.annualTotal}), {plan.discount} de desconto.
                </p>
              )}
              <p className={styles.note}>{plan.priceNote}</p>

              {plan.contactLabel ? (
                <a className={`${ui.btn} ${ui.btnGhost}`} href={SALES_URL}>
                  {plan.ctaLabel}
                </a>
              ) : (
                <RegisterLink
                  className={`${ui.btn} ${plan.highlighted ? ui.btnAmber : ui.btnInk}`}
                  id={`subscribe-btn-${plan.id}`}
                >
                  {plan.ctaLabel}
                </RegisterLink>
              )}
            </article>
          ))}
        </div>

        <p className={styles.footnote}>
          Pagamento processado com segurança via Stripe. Cobranças recorrentes; cancele quando quiser pelo
          painel e mantenha o acesso até o fim do período pago.
        </p>
      </div>
    </section>
  );
}
