'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import axios, { AxiosError } from 'axios';
import styles from './PlanCard.module.scss';
import { useAccessGate } from '@/lib/hooks/useAccessGate';

interface PlanCardProps {
  id: string;
  name: string;
  price: number | string;
  description: string;
  recommended?: boolean;
  icon: React.ElementType;
  discount?: string | number;
  priceNote?: string;
  interval: 'monthly' | 'yearly';
}

const PlanCard: React.FC<PlanCardProps> = ({
  id,
  name,
  price,
  description,
  recommended,
  icon: Icon,
  discount,
  priceNote,
  interval,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [quantity, setQuantity] = React.useState(1);

  const { access, loading: accessLoading } = useAccessGate();

  const formatPrice = (val: number | string) => {
    if (typeof val === 'string') return val;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val * quantity);
  };

  const handleSubscribe = async () => {
    if (id === 'ENTERPRISE') {
      window.location.href = 'mailto:contato@bentifiles.com';
      return;
    }

    try {
      setLoading(true);

      if (accessLoading || !access?.authenticated) return;

      const token = access.token;
      if (!token) {
        toast.error('Você precisa estar logado para escolher um plano.');
        window.location.href = '/login';
        return;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/billing/create-checkout-session`,
        { plan: id, interval, quantity },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('URL de checkout não retornada');
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.error('Checkout error:', error);
      toast.error(axiosError.response?.data?.message || 'Erro ao iniciar checkout. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const isEnterprise = id === 'ENTERPRISE';

  return (
    <div className={`${styles.card} ${recommended ? styles.recommended : ''} ${isEnterprise ? styles.enterprise : ''}`}>
      {recommended && (
        <div className={styles.badge}>
          Recomendado
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.iconBox}>
          <Icon size={24} />
        </div>
        {!isEnterprise && (
          <div className={styles.trial}>
            <p className={styles.trialText}>10 dias grátis</p>
          </div>
        )}
      </div>

      <h3 className={styles.name}>{name}</h3>
      <p className={styles.description}>{description}</p>

      <div className={styles.priceWrapper}>
        <span className={styles.priceValue}>{formatPrice(price)}</span>
        {!isEnterprise && (
          <span className={styles.pricePeriod}>
            / {id === 'OFFICE' ? 'usuário / ' : ''}{interval === 'monthly' ? 'mês' : 'ano'}
          </span>
        )}
      </div>

      {!isEnterprise && interval === 'yearly' && (discount || priceNote) && (
        <div className={styles.pricingMetaRow}>
          {discount && <span className={styles.pricingDiscount}>Desconto de {discount}</span>}
          {priceNote && <span className={styles.pricingMetaNote}>{priceNote}</span>}
        </div>
      )}

      {id === 'OFFICE' && (
        <div className={styles.quantitySelector}>
          <span className={styles.quantityLabel}>Número de usuários</span>
          <div className={styles.quantityControls}>
            <button
              type="button"
              className={styles.quantityBtn}
              onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
              disabled={quantity <= 1 || loading}
            >
              <Minus size={16} />
            </button>
            <span className={styles.quantityValue}>{quantity}</span>
            <button
              type="button"
              className={styles.quantityBtn}
              onClick={() => setQuantity(prev => prev + 1)}
              disabled={loading}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className={styles.subscribeBtn}
      >
        {loading ? 'Processando...' : (isEnterprise ? 'Entre em contato' : 'Começar teste grátis')}
      </button>

      {!isEnterprise && (
        <p className={styles.footer}>
          Cancele a qualquer momento. Nenhuma cobrança será feita nos primeiros 10 dias.
        </p>
      )}
    </div>
  );
};

export default PlanCard;
