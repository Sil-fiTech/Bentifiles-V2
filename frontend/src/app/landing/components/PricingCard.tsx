'use client';

import { useState } from 'react';
import { Check, X, Loader2, Zap } from 'lucide-react';
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
      <div className={styles.pricingPriceBlock}>
        <span className={styles.pricingPrice}>{plan.price}</span>
        <span className={styles.pricingPeriod}>{plan.period}</span>
      </div>

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

      {/* Divider */}
      <div className={styles.pricingDivider} />

      {/* Features */}
      <ul className={styles.pricingFeatureList} role="list">
        {plan.features.map((feature, i) => (
          <li
            key={i}
            className={`${styles.pricingFeatureItem} ${!feature.included ? styles.pricingFeatureExcluded : ''}`}
          >
            <span className={`${styles.pricingFeatureIcon} ${!feature.included ? styles.pricingFeatureIconNo : ''}`}>
              {feature.included ? <Check size={13} strokeWidth={2.5} /> : <X size={13} strokeWidth={2.5} />}
            </span>
            <span>{feature.text}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
