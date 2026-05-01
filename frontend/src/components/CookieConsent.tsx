'use client';

import { useState, useSyncExternalStore } from 'react';
import { Cookie } from 'lucide-react';
import styles from './CookieConsent.module.scss';

type CookieConsentValue = 'all' | 'necessary' | 'denied';

const CONSENT_KEY = 'bentifiles_cookie_consent';
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
const NO_CONSENT = 'none';
const SERVER_SNAPSHOT = 'server';

function getCookieValue(name: string) {
  const match = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`));

  return match?.split('=')[1] ?? null;
}

function saveConsent(value: CookieConsentValue) {
  localStorage.setItem(CONSENT_KEY, value);

  const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_KEY}=${value}; Max-Age=${ONE_YEAR_IN_SECONDS}; Path=/; SameSite=Lax${secureFlag}`;
  window.dispatchEvent(new CustomEvent('cookie-consent-change', { detail: value }));
}

function subscribeToConsentChanges(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener('cookie-consent-change', onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener('cookie-consent-change', onStoreChange);
  };
}

function getConsentSnapshot() {
  return localStorage.getItem(CONSENT_KEY) || getCookieValue(CONSENT_KEY) || NO_CONSENT;
}

export default function CookieConsent() {
  const consent = useSyncExternalStore(
    subscribeToConsentChanges,
    getConsentSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const [isDismissed, setIsDismissed] = useState(false);

  const handleChoice = (value: CookieConsentValue) => {
    saveConsent(value);
    setIsDismissed(true);
  };

  if (consent !== NO_CONSENT || isDismissed) {
    return null;
  }

  return (
    <aside className={styles.banner} aria-label="Preferências de cookies">
      <div className={styles.content}>
        <div className={styles.iconWrap} aria-hidden="true">
          <Cookie size={22} />
        </div>

        <div className={styles.text}>
          <h2>Preferências de cookies</h2>
          <p>
            Usamos cookies para manter a plataforma funcionando, lembrar preferências e,
            com sua permissão, melhorar sua experiência no Bentifiles.
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => handleChoice('all')}
        >
          Aceitar
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => handleChoice('necessary')}
        >
          Aceitar apenas os necessários
        </button>
        <button
          type="button"
          className={styles.ghostButton}
          onClick={() => handleChoice('denied')}
        >
          Negar
        </button>
      </div>
    </aside>
  );
}
