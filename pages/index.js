import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

export default function Home() {
  const [pais, setPais] = useState('');
  const [callerId, setCallerId] = useState('');
  const [email, setEmail] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [DeviceClass, setDeviceClass] = useState(null);
  const [currentLead, setCurrentLead] = useState(null);
  const [twilioDevice, setTwilioDevice] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [callerIdLoading, setCallerIdLoading] = useState(false);
  const [callerIdError, setCallerIdError] = useState('');
  const [callHistory, setCallHistory] = useState([]);

  // Usar ref para mantener la referencia del call activo
  const activeCallRef = useRef(null);

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

  // Ya no necesitamos cargar la lista completa de Caller IDs
  // El Caller ID se asigna automáticamente basado en el email

  // Auto-cargar Caller ID cuando se ingresa el email
  useEffect(() => {
    if (email && email.includes('@')) {
      console.log('📧 Email ingresado, cargando Caller ID asignado...');
      setCallerIdLoading(true);
      setCallerIdError('');
      setCallerId('');

      fetch(`/api/ejecutivo-callerid?email=${encodeURIComponent(email)}`)
        .then(res => res.json())
        .then(data => {
          setCallerIdLoading(false);
          if (data.callerId) {
            console.log('✅ Caller ID asignado:', data.callerId);
            setCallerId(data.callerId);
            setCallerIdError('');
          } else if (data.error) {
            console.log('❌ Error:', data.error);
            setCallerIdError(data.error);
          }
        })
        .catch(err => {
          setCallerIdLoading(false);
          console.log('❌ Error cargando Caller ID:', err.message);
          setCallerIdError('Error al cargar Caller ID. Verifica tu email.');
        });
    } else {
      setCallerId('');
      setCallerIdError('');
    }
  }, [email]);

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

      // IMPORTANTE: Solicitar permisos de micrófono primero
      console.log('🎤 Solicitando permisos de micrófono...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Permisos de micrófono concedidos');
        // Detener el stream temporal, Twilio manejará el audio
        stream.getTracks().forEach(track => track.stop());
      } catch (micError) {
        console.error('❌ Error obteniendo permisos de micrófono:', micError);
        alert('Debes permitir el acceso al micrófono para usar el dialer. Por favor recarga y acepta los permisos.');
        return;
      }

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
        logLevel: 'debug',
        // Configuración de audio para WebRTC
        codecPreferences: ['opus', 'pcmu'],
        enableIceRestart: true
      });

      console.log('Device creado, registrando event listeners...');
      console.log('🔊 Configurando audio del device...');

      // Configurar el audio del device
      device.audio.setOutputDevice('default');
      console.log('✅ Output device configurado');

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
        console.log('📞 Llamada INICIADA (ringing)');
        console.log('Call object:', call);
        console.log('Call status:', call.status());
        console.log('Call parameters:', call.parameters);
        console.log('🔊 Audio enabled:', call.isMuted() ? 'MUTED' : 'UNMUTED');

        setActiveCall(call);
        activeCallRef.current = call;
        setCallStatus('Llamando...');

        // Evento cuando la llamada es aceptada (answered)
        call.on('accept', () => {
          console.log('✅ Llamada ACEPTADA - En conversación');
          console.log('🔊 Verificando audio...');
          console.log('  Muted:', call.isMuted());
          console.log('  Volume:', call.volume || 'default');

          // Asegurar que no esté muteado
          if (call.isMuted()) {
            console.log('⚠️ Llamada estaba muteada, desmuteando...');
            call.mute(false);
          }

          setCallStatus('En llamada activa - Audio conectado');
        });

        // Listeners del objeto Call
        call.on('disconnect', () => {
          console.log('📴 Llamada desconectada');
          setActiveCall(null);
          activeCallRef.current = null;
          setCallStatus('Llamada terminada - Listo para llamar');

          // Agregar a historial
          if (currentLead) {
            addToHistory({
              leadId: currentLead.leadId,
              nombre: currentLead.nombre,
              telefono: currentLead.telefono,
              dealId: currentLead.pipedriveDealId,
              timestamp: new Date(),
              status: 'completed'
            });
          }
        });

        call.on('cancel', () => {
          console.log('🚫 Llamada cancelada');
          setActiveCall(null);
          activeCallRef.current = null;
          setCallStatus('Llamada cancelada - Listo para llamar');
        });

        call.on('reject', () => {
          console.log('❌ Llamada rechazada');
          setActiveCall(null);
          activeCallRef.current = null;
          setCallStatus('Llamada rechazada - Listo para llamar');
        });

        call.on('ringing', () => {
          console.log('📞 Timbrando...');
          setCallStatus('Timbrando...');
        });
      });

      device.on('disconnect', () => {
        console.log('📴 Device desconectado');
        setActiveCall(null);
        setCallStatus('Listo para llamar');
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

    console.log('📞 Iniciando llamada...');
    console.log('  Lead:', currentLead);
    console.log('  Teléfono:', currentLead.telefono);
    console.log('  Caller ID:', callerId);

    setCallStatus('Llamando...');

    // En Voice SDK 2.x, los parámetros personalizados van dentro de 'params'
    const callParams = {
      params: {
        To: currentLead.telefono,
        From: callerId
      }
    };

    console.log('  Parámetros de llamada:', callParams);
    twilioDevice.connect(callParams);
  };

  // Colgar
  const hangup = () => {
    console.log('🔴 Intentando colgar...');
    console.log('  activeCall (state):', activeCall);
    console.log('  activeCall (ref):', activeCallRef.current);
    console.log('  twilioDevice:', twilioDevice);

    // Intentar con el ref primero
    const callToDisconnect = activeCallRef.current || activeCall;

    if (callToDisconnect) {
      console.log('📴 Colgando llamada activa...');
      console.log('  Call status:', callToDisconnect.status ? callToDisconnect.status() : 'unknown');
      try {
        callToDisconnect.disconnect();
        setActiveCall(null);
        activeCallRef.current = null;
        setCallStatus('Llamada terminada - Listo para llamar');
        console.log('✅ Llamada colgada exitosamente');
      } catch (error) {
        console.error('❌ Error al colgar:', error);
        alert('Error al colgar: ' + error.message);
      }
    } else if (twilioDevice) {
      console.log('📴 Desconectando todas las llamadas del device...');
      try {
        twilioDevice.disconnectAll();
        setActiveCall(null);
        activeCallRef.current = null;
        setCallStatus('Listo para llamar');
        console.log('✅ Device desconectado');
      } catch (error) {
        console.error('❌ Error al desconectar device:', error);
      }
    } else {
      console.log('⚠️ No hay llamada activa ni device para desconectar');
      alert('No hay llamada activa para colgar');
    }
  };

  // Agregar al historial
  const addToHistory = (callData) => {
    setCallHistory(prev => [callData, ...prev]);
  };

  // Construir URL de Pipedrive
  const getPipedriveUrl = (dealId) => {
    return `https://arriendoasegurado.pipedrive.com/deal/${dealId}`;
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
          background: linear-gradient(135deg, #f9472f 0%, #d93a1f 100%);
          color: white;
          padding: 24px;
          border-radius: 12px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(249, 71, 47, 0.2);
        }
        .header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .logo {
          width: 56px;
          height: 56px;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .header-text h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 4px 0;
        }
        .header-text p {
          font-size: 15px;
          margin: 0;
          opacity: 0.95;
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
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        .btn-secondary:hover {
          background: #5a6268;
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
          <div className="header-content">
            <img
              src="https://getonbrd-prod.s3.amazonaws.com/uploads/users/logo/8588/Isotipo_Houm_Square_Negativo__1_.jpg"
              alt="Houm Logo"
              className="logo"
            />
            <div className="header-text">
              <h1>Dialer Houm</h1>
              <p>Sistema de marcación automática con Twilio</p>
            </div>
          </div>
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
              <label>Email ejecutivo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejecutivo@houm.com"
              />
              <small style={{color: '#666', marginTop: '5px', display: 'block'}}>
                El Caller ID se asignará automáticamente según tu email
              </small>
            </div>

            {email && email.includes('@') && (
              <div className="form-group">
                <label>Caller ID asignado</label>
                {callerIdLoading ? (
                  <div style={{
                    padding: '12px',
                    background: '#f0f0f0',
                    borderRadius: '6px',
                    color: '#666'
                  }}>
                    🔄 Buscando tu Caller ID...
                  </div>
                ) : callerId ? (
                  <div style={{
                    padding: '12px',
                    background: '#e8f5e9',
                    borderRadius: '6px',
                    color: '#2e7d32',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    ✅ {callerId}
                  </div>
                ) : callerIdError ? (
                  <div style={{
                    padding: '12px',
                    background: '#ffebee',
                    borderRadius: '6px',
                    color: '#c62828'
                  }}>
                    ❌ {callerIdError}
                  </div>
                ) : null}
              </div>
            )}

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
                      <span>
                        <a href={getPipedriveUrl(currentLead.pipedriveDealId)} target="_blank" rel="noopener noreferrer" style={{color: '#667eea', textDecoration: 'none', borderBottom: '1px dashed #667eea'}}>
                          {currentLead.pipedriveDealId}
                        </a>
                      </span>
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
                      Llamar
                    </button>
                  ) : (
                    <button className="btn btn-danger" onClick={hangup}>
                      Colgar
                    </button>
                  )}

                  <button className="btn btn-secondary" onClick={loadNextLead}>
                    Siguiente
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

            {/* Historial de llamadas */}
            <div className="card" style={{marginTop: '24px'}}>
              <h3 style={{fontSize: '20px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px'}}>
                <span>📋</span> Historial de llamadas
              </h3>

              {callHistory.length > 0 ? (
                <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                  {callHistory.map((call, index) => (
                    <div key={index} style={{
                      background: '#f8f9fa',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      borderLeft: '4px solid #f9472f'
                    }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                        <div style={{fontWeight: '600', color: '#1a1a1a'}}>{call.nombre}</div>
                        <div style={{fontSize: '13px', color: '#666'}}>
                          {call.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{fontSize: '14px', color: '#666'}}>
                        {call.telefono} •{' '}
                        <a href={getPipedriveUrl(call.dealId)} target="_blank" rel="noopener noreferrer" style={{color: '#f9472f', textDecoration: 'none'}}>
                          Deal {call.dealId}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{textAlign: 'center', color: '#999', padding: '24px 0'}}>
                  No hay llamadas registradas en esta sesión
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
