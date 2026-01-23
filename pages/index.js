import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [pais, setPais] = useState('');
  const [callerId, setCallerId] = useState('');
  const [callerIds, setCallerIds] = useState([]);
  const [currentLead, setCurrentLead] = useState(null);
  const [twilioDevice, setTwilioDevice] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);

  // Cargar Twilio Client SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://sdk.twilio.com/js/client/releases/1.14.0/twilio.min.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Cargar Caller IDs
  useEffect(() => {
    fetch('/api/callerids')
      .then(res => res.json())
      .then(data => setCallerIds(data))
      .catch(err => console.error('Error cargando Caller IDs:', err));
  }, []);

  // Iniciar sesión
  const handleStartSession = async () => {
    if (!pais || !callerId) {
      alert('Selecciona país y Caller ID');
      return;
    }

    try {
      // Obtener token de Twilio
      const tokenRes = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ejecutivo@houm.com' })
      });
      const { token } = await tokenRes.json();

      // Inicializar Twilio Device
      if (typeof Twilio !== 'undefined') {
        const device = new Twilio.Device(token);

        device.ready(() => {
          console.log('✅ Twilio Device listo');
          setCallStatus('Listo para llamar');
        });

        device.error((error) => {
          console.error('Error Twilio:', error);
          setCallStatus('Error: ' + error.message);
        });

        device.connect((conn) => {
          console.log('Llamada conectada');
          setActiveCall(conn);
          setCallStatus('En llamada');
        });

        device.disconnect(() => {
          console.log('Llamada terminada');
          setActiveCall(null);
          setCallStatus('Llamada terminada');
        });

        setTwilioDevice(device);
        setSessionStarted(true);
        loadNextLead();
      } else {
        alert('Twilio SDK no está cargado');
      }
    } catch (error) {
      console.error('Error iniciando sesión:', error);
      alert('Error: ' + error.message);
    }
  };

  // Cargar siguiente lead
  const loadNextLead = async () => {
    try {
      const res = await fetch(`/api/leads?pais=${pais}`);
      if (res.ok) {
        const lead = await res.json();
        setCurrentLead(lead);
      } else {
        setCurrentLead(null);
        alert('No hay más leads disponibles');
      }
    } catch (error) {
      console.error('Error cargando lead:', error);
    }
  };

  // Hacer llamada
  const makeCall = () => {
    if (!twilioDevice || !currentLead) {
      alert('No hay Twilio Device o lead');
      return;
    }

    setCallStatus('Llamando...');

    const params = {
      To: currentLead.telefono,
      From: callerId
    };

    twilioDevice.connect(params);
  };

  // Colgar
  const hangup = () => {
    if (activeCall) {
      activeCall.disconnect();
    }
  };

  return (
    <>
      <Head>
        <title>Dialer Houm</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style jsx>{`
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: #f9472f;
          color: white;
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 20px;
          text-align: center;
        }
        .card {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
        }
        select, input {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 6px;
          font-size: 16px;
          box-sizing: border-box;
        }
        select:focus, input:focus {
          outline: none;
          border-color: #f9472f;
        }
        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        .btn-primary {
          background: #f9472f;
          color: white;
        }
        .btn-primary:hover {
          background: #d93a1f;
        }
        .btn-success {
          background: #4caf50;
          color: white;
        }
        .btn-success:hover {
          background: #45a049;
        }
        .btn-danger {
          background: #f44336;
          color: white;
        }
        .btn-danger:hover {
          background: #da190b;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .lead-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .lead-name {
          font-size: 24px;
          font-weight: 700;
          color: #333;
          margin-bottom: 15px;
        }
        .lead-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .lead-info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #ddd;
        }
        .lead-info-label {
          font-weight: 600;
          color: #666;
        }
        .call-status {
          text-align: center;
          padding: 15px;
          background: #e3f2fd;
          border-radius: 6px;
          margin: 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1976d2;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
      `}</style>

      <div className="container">
        <div className="header">
          <h1>🎯 Dialer Houm</h1>
          <p>Sistema de marcación con Twilio Client</p>
        </div>

        {!sessionStarted ? (
          <div className="card">
            <h2>Iniciar Sesión</h2>

            <div className="form-group">
              <label>País</label>
              <select value={pais} onChange={(e) => setPais(e.target.value)}>
                <option value="">Selecciona país</option>
                <option value="CO">🇨🇴 Colombia</option>
                <option value="MX">🇲🇽 México</option>
                <option value="CL">🇨🇱 Chile</option>
              </select>
            </div>

            <div className="form-group">
              <label>Caller ID</label>
              <select value={callerId} onChange={(e) => setCallerId(e.target.value)}>
                <option value="">Selecciona Caller ID</option>
                {callerIds.map((caller) => (
                  <option key={caller.phoneNumber} value={caller.phoneNumber}>
                    {caller.friendlyName} - {caller.phoneNumber}
                  </option>
                ))}
              </select>
            </div>

            <button className="btn btn-primary" onClick={handleStartSession}>
              Iniciar Sesión
            </button>
          </div>
        ) : (
          <>
            {currentLead && (
              <div className="card">
                <div className="lead-card">
                  <div className="lead-name">{currentLead.nombre}</div>
                  <div className="lead-info">
                    <div className="lead-info-row">
                      <span className="lead-info-label">Teléfono:</span>
                      <span>{currentLead.telefono}</span>
                    </div>
                    <div className="lead-info-row">
                      <span className="lead-info-label">Deal ID:</span>
                      <span>{currentLead.pipedriveDealId}</span>
                    </div>
                    <div className="lead-info-row">
                      <span className="lead-info-label">Intentos:</span>
                      <span>{currentLead.intentos}</span>
                    </div>
                    <div className="lead-info-row">
                      <span className="lead-info-label">País:</span>
                      <span>{pais}</span>
                    </div>
                  </div>
                </div>

                {callStatus && (
                  <div className="call-status">
                    {callStatus}
                  </div>
                )}

                <div className="btn-group">
                  {!activeCall ? (
                    <button className="btn btn-success" onClick={makeCall}>
                      📞 Llamar
                    </button>
                  ) : (
                    <button className="btn btn-danger" onClick={hangup}>
                      ❌ Colgar
                    </button>
                  )}

                  <button className="btn btn-primary" onClick={loadNextLead}>
                    ⏭️ Siguiente Lead
                  </button>
                </div>
              </div>
            )}

            {!currentLead && (
              <div className="card">
                <h2>No hay leads disponibles</h2>
                <p>No se encontraron leads pendientes para {pais}</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
