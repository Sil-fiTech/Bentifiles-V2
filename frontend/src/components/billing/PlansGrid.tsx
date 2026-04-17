'use client';

import React from 'react';
import PlanCard from './PlanCard';
import { Zap, Shield, Rocket } from 'lucide-react';
import styles from './PlansGrid.module.scss';

const PlansGrid: React.FC = () => {
  const [interval, setInterval] = React.useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      id: 'INDIVIDUAL',
      name: 'Individual',
      monthlyPrice: 64.98,
      yearlyPrice: 599.76,
      discount: '23%',
      priceNote: 'No plano Individual, você pode testar por 10 dias. No anual, o valor mensal cai para 49,98.',
      description: 'Ideal para profissionais autônomos que precisam de organização e produtividade no dia a dia, com 10 dias de teste antes da cobrança.',
      icon: Zap,
      features: [
        'Verificação básica de integridade',
        'Suporte via email',
        '1 usuário',
      ],
    },
    {
      id: 'OFFICE',
      name: 'Office',
      monthlyPrice: 49.98,
      yearlyPrice: 539.76,
      discount: '10%',
      priceNote: 'Valor por acesso com economia no faturamento anual.',
      description: 'Perfeito para escritórios e consultorias em crescimento.',
      icon: Shield,
      recommended: true,
      features: [
        'Documentos ilimitados',
        'Verificação avançada',
        'Suporte prioritário 24/7',
        'Gestão de convites e permissões',
      ],
    },
    {
      id: 'ENTERPRISE',
      name: 'Empresarial',
      monthlyPrice: 'Personalizado',
      yearlyPrice: 'Personalizado',
      description: 'Para grandes empresas que exigem máxima segurança.',
      icon: Rocket,
      features: [
        'Tudo do Pro',
        'Usuários ilimitados',
        'SLA garantido',
        'Gerente de conta dedicado',
        'Customização de marca (White-label)',
        'Integração via API total',
      ],
    },
  ];

  return (
    <>
      <div className={styles.toggleContainer}>
        <div className={styles.toggleWrapper}>
          <div className={`${styles.toggleSlider} ${interval === 'yearly' ? styles.yearly : ''}`} />
          <button
            type="button"
            className={`${styles.toggleOption} ${interval === 'monthly' ? styles.active : ''}`}
            onClick={() => setInterval('monthly')}
          >
            Mensal
          </button>
          <button
            type="button"
            className={`${styles.toggleOption} ${interval === 'yearly' ? styles.active : ''}`}
            onClick={() => setInterval('yearly')}
          >
            Anual
          </button>
        </div>
        {interval === 'yearly' && (
          <span className={styles.savingsIndicator}>
            Economize até 23% no plano anual
          </span>
        )}
      </div>

      <div className={styles.grid}>
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            {...plan}
            price={interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
            interval={interval}
          />
        ))}
      </div>
    </>
  );
};

export default PlansGrid;
