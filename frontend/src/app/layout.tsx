import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.scss';
import Providers from '../components/Providers';
import ThemeToggleGate from '../components/ThemeToggleGate';
import ThemedToaster from '../components/ThemedToaster';

export const metadata: Metadata = {
  title: 'Bentifiles — Centralize, Organize e Padronize seus Documentos',
  description:
    'O Bentifiles é uma plataforma de gestão de documentos, projetos e templates. Reduza o retrabalho e mantenha sua equipe alinhada com organização inteligente.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <Script id="google-tag-manager" strategy="beforeInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-KR75HXPL');
        `}
      </Script>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '1527942838596631');
          fbq('track', 'PageView');
        `}
      </Script>
      <body suppressHydrationWarning>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KR75HXPL"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1527942838596631&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        <Providers>
          {children}
          <ThemeToggleGate />
          <ThemedToaster />
        </Providers>
      </body>
    </html>
  );
}
