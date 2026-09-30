'use client';

import { useState } from 'react';
import ui from '../landing.module.scss';
import styles from './ValidationSection.module.scss';

// A partir deste valor de nitidez o documento é considerado legível (demonstração).
const LEGIBLE_FROM = 62;

export default function ValidationSection() {
  const [sharpness, setSharpness] = useState(18);
  const legible = sharpness >= LEGIBLE_FROM;
  const blur = ((100 - sharpness) / 100) * 7;

  return (
    <section className={styles.validation} id="validacao">
      <div className={`${ui.wrap} ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={`${ui.kicker} ${styles.kicker}`}>Validação automática de legibilidade</p>
          <h2>O que não dá pra ler não entra no seu fluxo.</h2>
          <p className={styles.text}>
            Cada arquivo enviado passa por uma validação automática, feita com IA, antes de seguir no
            processo. Você deixa de abrir anexo só para descobrir que a foto está tremida.
          </p>
          <p className={styles.hint}>Arraste a barra e veja a ideia funcionando.</p>

          <div className={styles.control}>
            <label htmlFor="nitidez">Nitidez do arquivo enviado</label>
            <input
              id="nitidez"
              type="range"
              min={0}
              max={100}
              value={sharpness}
              onChange={(event) => setSharpness(Number(event.target.value))}
            />
            <div className={styles.scale} aria-hidden="true">
              <span>Tremido</span>
              <span>Nítido</span>
            </div>
          </div>

          <p className={styles.readout} aria-live="polite">
            {legible
              ? 'Legível: o documento segue no fluxo e fica pronto para a sua aprovação.'
              : 'Ilegível: o arquivo não segue no fluxo até ser enviado de novo.'}
          </p>
        </div>

        <figure className={styles.stage} data-ok={legible}>
          <div className={styles.doc}>
            <div className={styles.docBody} style={{ filter: `blur(${blur.toFixed(2)}px)` }}>
              <p className={styles.docTitle}>Comprovante de residência</p>
              <p className={styles.docModel}>Modelo fictício para demonstração</p>
              <dl>
                <div>
                  <dt>Titular</dt>
                  <dd>Maria Exemplo da Silva</dd>
                </div>
                <div>
                  <dt>Endereço</dt>
                  <dd>Rua das Amostras, 123</dd>
                </div>
                <div>
                  <dt>Referência</dt>
                  <dd>00/0000</dd>
                </div>
                <div>
                  <dt>Valor</dt>
                  <dd>R$ 000,00</dd>
                </div>
              </dl>
            </div>
            <div className={styles.verdict} aria-hidden="true">
              {legible ? 'Legível' : 'Ilegível'}
            </div>
          </div>
          <figcaption>
            Simulação ilustrativa da validação de legibilidade. Não é a interface real do produto.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
