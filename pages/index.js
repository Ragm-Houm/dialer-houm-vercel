import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [pais, setPais] = useState('');
  const [callerId, setCallerId] = useState('');
  const [callerIds, setCallerIds] = useState([]);
  const [email, setEmail] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [DeviceClass, setDeviceClass] = useState(null);
  const [currentLead, setCurrentLead] = useState(null);
  const [twilioDevice, setTwilioDevice] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);

  // Cargar Twilio Voice SDK 2.x desde archivo local
  useEffect(() => {
    console.log('📥 Cargando Twilio Voice SDK 2.x...');
    const script = document.createElement('script');
    script.src = '/twilio.min.js';  // Archivo local en /public
    script.async = false;
    script.onload = () => {
      console.log('✅ Twilio Voice SDK cargado');
      if (typeof window.Twilio !== 'undefined' && typeof window.Twilio.Device !== 'undefined') {
        setDeviceClass(() => window.Twilio.Device);
        setSdkLoaded(true);
        console.log('✅ Twilio.Device disponible');
      } else {
        console.error('❌ Twilio.Device no está disponible después de cargar el script');
        setSdkLoaded(false);
      }
    };
    script.onerror = (e) => {
      console.error('❌ Error cargando Twilio SDK:', e);
      setSdkLoaded(false);
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Cargar Caller IDs
  useEffect(() => {
    console.log('📞 Cargando Caller IDs...');
    fetch('/api/callerids')
      .then(res => res.json())
      .then(data => {
        console.log('✅ Caller IDs cargados:', data);
        setCallerIds(data);
      })
      .catch(err => console.error('❌ Error cargando Caller IDs:', err));
  }, []);

  // Iniciar sesión
  const handleStartSession = async () => {
    if (!pais || !callerId || !email) {
      alert('Selecciona país, Caller ID y email');
      return;
    }

    try {
      if (!sdkLoaded || !DeviceClass) {
        alert('Twilio SDK no está cargado. Recarga la página.');
        return;
      }

      console.log('🔄 Iniciando sesión...');

      // Obtener token de Twilio
      console.log('📡 Solicitando token...');
      const tokenRes = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      console.log('Token response status:', tokenRes.status);
      const tokenData = await tokenRes.json();
      console.log('Token data:', tokenData);

      if (!tokenRes.ok) {
        throw new Error(tokenData.error || 'Error al obtener token');
      }

      const { token } = tokenData;

      // Inicializar Twilio Voice SDK 2.x
      // Esperar un momento para asegurar que SDK esté listo
      await new Promise(resolve => setTimeout(resolve, 200));

      // En SDK 2.x, crear Device CON el token directamente
      console.log('📱 Creando Twilio Device con token...');
      console.log('Token length:', token.length);

      const device = new DeviceClass(token, {
        edge: 'ashburn',
        logLevel: 'debug'
      });

      console.log('Device creado, registrando event listeners...');

      device.on('registered', () => {
        console.log('✅ Device registrado y listo');
        setCallStatus('Listo para llamar');
        setTwilioDevice(device);
        setSessionStarted(true);
        loadNextLead();
      });

      device.on('error', (error) => {
        console.error('❌ Error Twilio:', error);
        setCallStatus('Error: ' + (error.message || 'Unknown error'));
        alert('Error Twilio: ' + (error.message || 'Unknown error'));
      });

      device.on('connect', (call) => {
        console.log('📞 Llamada conectada');
        setActiveCall(call);
        setCallStatus('En llamada');
      });

      device.on('disconnect', () => {
        console.log('📴 Llamada terminada');
        setActiveCall(null);
        setCallStatus('Llamada terminada');
      });

      device.on('unregistered', () => {
        console.log('📡 Device no registrado');
      });

      // Registrar el device
      console.log('🔧 Registrando device...');
      await device.register();
      console.log('⏳ Device registration initiated...');
    } catch (error) {
      console.error('❌ Error iniciando sesión:', error);
      alert('Error iniciando sesión: ' + error.message);
    }
  };

  // Cargar siguiente lead
  const loadNextLead = async () => {
    try {
      const res = await fetch(`/api/leads?pais=${pais}&email=${encodeURIComponent(email)}`);
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
      console.log('📴 Colgando llamada...');
      activeCall.disconnect();
    } else if (twilioDevice) {
      // En SDK 2.x, disconnectAll() desconecta todas las llamadas activas
      twilioDevice.disconnectAll();
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

            <div className="form-group">
              <label>Email ejecutivo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejecutivo@houm.com"
              />
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
