import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <>
      <Head>
        <title>Redirigiendo...</title>
      </Head>
      <div className="redirect">
        Redirigiendo...
      </div>
      <style jsx>{`
        .redirect {
          min-height: 100vh;
          display: grid;
          place-items: center;
          color: var(--text-muted);
          font-weight: 600;
        }
      `}</style>
    </>
  );
}
