'use client';

import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { withRefParam } from '@/lib/affiliate/refLink';

const REGISTER_PATH = '/login?mode=register';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

// Link de cadastro que repassa o codigo de afiliado (?ref=) da URL atual.
// Reescreve o href no clique/foco para nao depender de JS no primeiro render.
export default function RegisterLink({ onClick, onFocus, ...props }: Props) {
  const applyRef = (el: HTMLAnchorElement) => {
    el.setAttribute('href', withRefParam(REGISTER_PATH));
  };

  return (
    <a
      {...props}
      href={REGISTER_PATH}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        applyRef(e.currentTarget);
        onClick?.(e);
      }}
      onFocus={(e) => {
        applyRef(e.currentTarget);
        onFocus?.(e);
      }}
      onMouseEnter={(e) => applyRef(e.currentTarget)}
    />
  );
}
