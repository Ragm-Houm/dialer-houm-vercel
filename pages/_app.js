import Head from 'next/head';
import { SessionProvider } from '../lib/session';
import { ToastProvider } from '../components/Toast';

export default function App({ Component, pageProps }) {
  return (
    <SessionProvider>
      <ToastProvider>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Component {...pageProps} />
      </ToastProvider>
      <style jsx global>{`
        :global(body) {
          margin: 0;
          padding: 0;
          background: var(--page-bg, var(--bg));
          color: var(--text-primary);
          font-family: 'Poppins', 'Nunito', sans-serif;
        }
        :global(body[data-theme='dark']) {
          --bg: #0f0f1e;
          --page-bg: var(--bg);
          --surface: rgba(12, 18, 38, 0.9);
          --surface-strong: rgba(9, 14, 32, 0.9);
          --surface-soft: rgba(255, 255, 255, 0.04);
          --surface-soft-2: rgba(255, 255, 255, 0.05);
          --surface-soft-3: rgba(255, 255, 255, 0.02);
          --border: rgba(255, 255, 255, 0.1);
          --border-subtle: rgba(255, 255, 255, 0.06);
          --border-strong: rgba(255, 255, 255, 0.09);
          --text-primary: #f5f7ff;
          --text-muted: rgba(230, 235, 255, 0.7);
          --text-subtle: rgba(230, 235, 255, 0.6);
          --text-soft: rgba(230, 235, 255, 0.75);
          --text-strong: rgba(230, 235, 255, 0.85);
          --accent: #f9472f;
          --accent-strong: #ff7a59;
          --accent-soft: rgba(249, 71, 47, 0.14);
          --success: #00c853;
          --warning: #ffb020;
          --danger: #ff9b93;
          --danger-strong: #f9472f;
          --accent-glow: rgba(249, 71, 47, 0.12);
          --success-glow: rgba(0, 200, 83, 0.1);
          --shadow-strong: 0 18px 40px rgba(4, 8, 20, 0.45);
          --shadow-soft: 0 10px 24px rgba(4, 8, 20, 0.3);
          --text-on-accent: #ffffff;
          --overlay-bg: rgba(6, 7, 15, 0.72);
          --alert-bg: rgba(255, 120, 120, 0.08);
          --alert-border: rgba(255, 120, 120, 0.4);
          --alert-dot: rgba(255, 120, 120, 0.9);
          --alert-dot-glow: rgba(255, 120, 120, 0.2);
          --success-text: #7bf1a8;
          --warning-text: #ffd29a;
          --danger-text: #ff9b93;
          --success-bg: rgba(0, 200, 83, 0.12);
          --success-border: rgba(0, 200, 83, 0.45);
          --warning-bg: rgba(255, 176, 32, 0.18);
          --warning-border: rgba(255, 176, 32, 0.45);
          --danger-bg: rgba(244, 67, 54, 0.15);
          --danger-border: rgba(244, 67, 54, 0.5);
        }
        :global(body[data-theme='light']) {
          --bg: #f6f2ee;
          --page-bg: var(--bg);
          --surface: #ffffff;
          --surface-strong: #f2ebe5;
          --surface-soft: rgba(0, 0, 0, 0.04);
          --surface-soft-2: rgba(0, 0, 0, 0.06);
          --surface-soft-3: rgba(0, 0, 0, 0.02);
          --border: rgba(0, 0, 0, 0.12);
          --border-subtle: rgba(0, 0, 0, 0.08);
          --border-strong: rgba(0, 0, 0, 0.14);
          --text-primary: #231f20;
          --text-muted: #6f6660;
          --text-subtle: #7c736c;
          --text-soft: #5f5852;
          --text-strong: #3f3934;
          --accent: #f9472f;
          --accent-strong: #ff7a59;
          --accent-soft: rgba(249, 71, 47, 0.12);
          --success: #00a34a;
          --warning: #b36b00;
          --danger: #c85a52;
          --danger-strong: #e0564e;
          --accent-glow: rgba(249, 71, 47, 0.16);
          --success-glow: rgba(0, 163, 74, 0.12);
          --shadow-strong: 0 18px 35px rgba(40, 28, 16, 0.14);
          --shadow-soft: 0 10px 24px rgba(40, 28, 16, 0.12);
          --text-on-accent: #ffffff;
          --overlay-bg: rgba(17, 24, 39, 0.35);
          --alert-bg: rgba(224, 86, 78, 0.1);
          --alert-border: rgba(224, 86, 78, 0.28);
          --alert-dot: rgba(224, 86, 78, 0.9);
          --alert-dot-glow: rgba(224, 86, 78, 0.2);
          --success-text: #1b7a45;
          --warning-text: #a66200;
          --danger-text: #b73b34;
          --success-bg: rgba(0, 163, 74, 0.12);
          --success-border: rgba(0, 163, 74, 0.35);
          --warning-bg: rgba(255, 171, 0, 0.16);
          --warning-border: rgba(255, 171, 0, 0.35);
          --danger-bg: rgba(224, 86, 78, 0.12);
          --danger-border: rgba(224, 86, 78, 0.35);
        }
      `}</style>
    </SessionProvider>
  );
}
