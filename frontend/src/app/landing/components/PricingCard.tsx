'use client';

import { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import type { Plan } from '../data/plans';
import styles from '../landing.module.scss';

interface PricingCardProps {
  plan: Plan;
  onSubscribe: (plan: Plan) => Promise<void>;
}

export default function PricingCard({ plan, onSubscribe }: PricingCardProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onSubscribe(plan);
    } finally {
      setLoading(false);
    }
  };

  return (
    <article
      className={`${styles.pricingCard} ${plan.highlighted ? styles.pricingCardHighlighted : ''}`}
      aria-label={`Plano ${plan.name}`}
    >
      {/* Popular badge */}
      {plan.badge && (
        <div className={styles.pricingBadge}>
          <Zap size={12} />
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <div className={styles.pricingCardHeader}>
        <h3 className={styles.pricingPlanName}>{plan.name}</h3>
        <p className={styles.pricingPlanDesc}>{plan.description}</p>
      </div>

      {/* Price */}
      {plan.contactLabel ? (
        <div className={styles.pricingContactBlock}>
          <span className={styles.pricingContactLabel}>{plan.contactLabel}</span>
          {plan.priceNote && <span className={styles.pricingContactNote}>{plan.priceNote}</span>}
        </div>
      ) : (
        <div className={styles.pricingStack}>
          <div className={styles.pricingPriceRow}>
            <span className={styles.pricingPriceLabel}>Mensal</span>
            <div className={styles.pricingPriceBlock}>
              <span className={styles.pricingPrice}>{plan.monthlyPrice}</span>
              <span className={styles.pricingPeriod}>/mês</span>
            </div>
          </div>

          <div className={styles.pricingPriceRow}>
            <span className={styles.pricingPriceLabel}>Anual</span>
            <div className={styles.pricingAnnualBlock}>
              <div className={styles.pricingAnnualLine}>
                <span className={styles.pricingAnnualPrice}>{plan.annualPrice}</span>
                <span className={styles.pricingAnnualPeriod}>/mês</span>
              </div>
              <span className={styles.pricingAnnualTotal}>{plan.annualTotal}</span>
            </div>
          </div>

          <div className={styles.pricingMetaRow}>
            <span className={styles.pricingDiscount}>Desconto de {plan.discount}</span>
            {plan.priceNote && <span className={styles.pricingMetaNote}>{plan.priceNote}</span>}
          </div>
        </div>
      )}

      {/* CTA Button */}
      <button
        className={plan.highlighted ? styles.pricingBtnPrimary : styles.pricingBtnSecondary}
        onClick={handleClick}
        disabled={loading}
        id={`subscribe-btn-${plan.id}`}
        aria-label={`Assinar plano ${plan.name}`}
      >
        {loading ? (
          <>
            <Loader2 size={16} className={styles.pricingBtnSpinner} />
            Processando...
          </>
        ) : (
          plan.ctaLabel
        )}
      </button>

      {plan.features.length > 0 && (
        <>
          <div className={styles.pricingDivider} />

          <ul className={styles.pricingFeatureList} role="list">
            {plan.features.map((feature, i) => (
              <li
                key={i}
                className={`${styles.pricingFeatureItem} ${!feature.included ? styles.pricingFeatureExcluded : ''}`}
              >
                <span className={`${styles.pricingFeatureIcon} ${!feature.included ? styles.pricingFeatureIconNo : ''}`}>
                  {feature.included ? '✓' : '✕'}
                </span>
                <span>{feature.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
