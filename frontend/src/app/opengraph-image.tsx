import { ImageResponse } from 'next/og';

// Prévia usada ao compartilhar o link (WhatsApp, LinkedIn, Slack...). Mesmas cores da landing.
export const alt = 'Bentifiles: peça o documento, receba legível';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '72px 80px',
                    background: '#fdfaf3',
                    color: '#18181b',
                    fontFamily: 'sans-serif',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 40, fontWeight: 700 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 22, background: '#fbbf24' }} />
                    Bentifiles
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', fontSize: 104, fontWeight: 800, lineHeight: 1.02 }}>
                    <span>Peça o documento.</span>
                    <span style={{ display: 'flex' }}>
                        Receba&nbsp;
                        <span style={{ background: '#fbbf24', padding: '0 18px' }}>legível</span>.
                    </span>
                </div>

                <div style={{ display: 'flex', fontSize: 32, color: '#3f3f46' }}>
                    Solicite · Valide · Aprove &nbsp;—&nbsp; bentifiles.com
                </div>
            </div>
        ),
        size,
    );
}
