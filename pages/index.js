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
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [callerIdLoading, setCallerIdLoading] = useState(false);
  const [callerIdError, setCallerIdError] = useState('');
  const [callHistory, setCallHistory] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [showPostCallForm, setShowPostCallForm] = useState(false);
  const [postCallData, setPostCallData] = useState({
    resultado: '',
    notas: '',
    proximaAccion: ''
  });
  const [isMuted, setIsMuted] = useState(false);

  // Usar ref para mantener la referencia del call activo
  const activeCallRef = useRef(null);
  const callTimerRef = useRef(null);

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
        enableIceRestart: true,
        // Opciones adicionales para mejor experiencia
        fakeLocalDTMF: true,  // Prevenir eco durante tonos DTMF
        enableRingingState: true  // Proveer feedback de estado de llamada
      });

      console.log('Device creado, registrando event listeners...');
      console.log('🔊 Audio configurado con codecPreferences');

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
        console.log('📞 Llamada INICIADA (connect event)');
        console.log('Call object:', call);
        console.log('Call status:', call.status());
        console.log('Call parameters:', call.parameters);
        console.log('🔊 Audio enabled:', call.isMuted() ? 'MUTED' : 'UNMUTED');

        setActiveCall(call);
        activeCallRef.current = call;
        setCallStatus('Conectando...');

        // Evento cuando la llamada es aceptada (answered)
        // IMPORTANTE: Solo iniciar timer cuando se acepta la llamada
        call.on('accept', () => {
          console.log('✅ Llamada ACEPTADA - Cliente contestó');
          console.log('🔊 Verificando audio...');
          console.log('  Muted:', call.isMuted());
          console.log('  Volume:', call.volume || 'default');

          // Asegurar que no esté muteado
          if (call.isMuted()) {
            console.log('⚠️ Llamada estaba muteada, desmuteando...');
            call.mute(false);
          }

          // Iniciar timer SOLO cuando el cliente contesta
          console.log('🔊 Cliente contestó - Iniciando timer...');
          startCallTimer();
          setCallStatus('En llamada');
        });

        // Listeners del objeto Call
        call.on('disconnect', () => {
          console.log('📴 Llamada desconectada');
          setActiveCall(null);
          activeCallRef.current = null;
          setIsCallInProgress(false);
          setCallStatus('Llamada terminada');

          // Mostrar formulario post-llamada solo si hubo conexión (duración > 0)
          if (callDuration > 0) {
            console.log('Mostrando formulario post-llamada (duración:', callDuration, 'segundos)');
            showPostCallFormHandler();
          } else {
            console.log('Llamada no conectó, cargando siguiente lead');
            stopCallTimer();
            loadNextLead();
          }
        });

        call.on('cancel', () => {
          console.log('🚫 Llamada cancelada');
          setActiveCall(null);
          activeCallRef.current = null;
          setIsCallInProgress(false);
          stopCallTimer();
          setCallStatus('Llamada cancelada');
          // No mostrar formulario si se canceló antes de conectar
          loadNextLead();
        });

        call.on('reject', () => {
          console.log('❌ Llamada rechazada');
          setActiveCall(null);
          activeCallRef.current = null;
          setIsCallInProgress(false);
          stopCallTimer();
          setCallStatus('Llamada rechazada');
          // No mostrar formulario si fue rechazada
          loadNextLead();
        });

        call.on('ringing', () => {
          console.log('📞 Timbrando...');
          setCallStatus('Timbrando...');
        });

        // Evento adicional para detectar cuando se contesta
        call.on('audio', () => {
          console.log('🔊 Audio stream iniciado - Llamada conectada');
          // Si el timer no está corriendo, iniciarlo aquí
          if (!callTimerRef.current) {
            console.log('🔊 Iniciando timer en evento audio...');
            startCallTimer();
          }
          setCallStatus('En llamada');
        });

        // Evento de warning
        call.on('warning', (warningName, warningData) => {
          console.log('⚠️ Warning:', warningName, warningData);
        });

        // Evento de error específico del call
        call.on('error', (error) => {
          console.error('❌ Error en call:', error);
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
    setIsCallInProgress(true);

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
    console.log('  isCallInProgress:', isCallInProgress);
    console.log('  callDuration:', callDuration);

    // NO resetear estados aquí - dejar que el evento 'disconnect' lo haga
    // Solo ejecutar disconnect() y el evento se encargará del resto

    try {
      // 1. Intentar con el call activo del ref primero
      const callToDisconnect = activeCallRef.current || activeCall;
      if (callToDisconnect) {
        console.log('📴 Colgando llamada activa via call.disconnect()...');
        callToDisconnect.disconnect();
        console.log('✅ Call.disconnect() ejecutado - esperando evento disconnect');
        return; // El evento disconnect se encargará del resto
      }

      // 2. Si no hay call, intentar desconectar todas las llamadas del device
      if (twilioDevice) {
        console.log('📴 Ejecutando device.disconnectAll()...');
        twilioDevice.disconnectAll();
        console.log('✅ Device.disconnectAll() ejecutado');
      }

      // Si llegamos aquí es porque no había call activo
      // Resetear manualmente
      console.log('⚠️ No había call activo, reseteando manualmente');
      setIsCallInProgress(false);
      setActiveCall(null);
      activeCallRef.current = null;
      stopCallTimer();
      setCallStatus('Listo para llamar');
      loadNextLead();
    } catch (error) {
      console.error('❌ Error al colgar:', error);
      // En caso de error, resetear todo
      setIsCallInProgress(false);
      setActiveCall(null);
      activeCallRef.current = null;
      stopCallTimer();
      setCallStatus('Error al colgar');
      loadNextLead();
    }
  };

  // Agregar al historial
  const addToHistory = (callData) => {
    setCallHistory(prev => [callData, ...prev]);
  };

  // Iniciar timer de llamada
  const startCallTimer = () => {
    setCallDuration(0);
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Detener timer de llamada
  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Formatear duración en MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Mostrar formulario post-llamada
  const showPostCallFormHandler = () => {
    stopCallTimer();
    setShowPostCallForm(true);
    setPostCallData({
      resultado: '',
      notas: '',
      proximaAccion: ''
    });
  };

  // Enviar formulario post-llamada
  const submitPostCallForm = async () => {
    if (!postCallData.resultado) {
      alert('Selecciona un resultado de la llamada');
      return;
    }

    console.log('Enviando resultado a Pipedrive/Kommo:', {
      lead: currentLead,
      duracion: callDuration,
      ...postCallData
    });

    // TODO: Aquí iría la llamada a la API para actualizar Pipedrive/Kommo
    // Por ahora solo lo registramos en el historial
    addToHistory({
      leadId: currentLead?.leadId,
      nombre: currentLead?.nombre,
      telefono: currentLead?.telefono,
      dealId: currentLead?.pipedriveDealId,
      timestamp: new Date(),
      duracion: callDuration,
      resultado: postCallData.resultado,
      notas: postCallData.notas,
      status: 'completed'
    });

    // Cerrar formulario y cargar siguiente lead
    setShowPostCallForm(false);
    setCallDuration(0);
    loadNextLead();
  };

  // Cancelar formulario post-llamada
  const cancelPostCallForm = () => {
    setShowPostCallForm(false);
    setCallDuration(0);
    loadNextLead();
  };

  // Silenciar/Desilenciar micrófono
  const toggleMute = () => {
    const call = activeCallRef.current || activeCall;
    if (call) {
      const newMutedState = !isMuted;
      call.mute(newMutedState);
      setIsMuted(newMutedState);
      console.log(newMutedState ? '🔇 Micrófono silenciado' : '🔊 Micrófono activado');
    }
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <style jsx>{`
        * {
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        body {
          background: #0f0f1e;
          margin: 0;
          padding: 0;
          color: #fff;
        }
        .container {
          max-width: 480px;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
        }
        .header {
          background: linear-gradient(135deg, #f9472f 0%, #d93a1f 100%);
          color: white;
          padding: 20px;
          border-radius: 16px;
          margin-bottom: 20px;
          box-shadow: 0 8px 24px rgba(249, 71, 47, 0.3);
        }
        .header-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .header-text h1 {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 2px 0;
          letter-spacing: -0.5px;
        }
        .header-text p {
          font-size: 13px;
          margin: 0;
          opacity: 0.9;
          font-weight: 400;
        }
        .card {
          background: #1a1a2e;
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          margin-bottom: 16px;
          border: 1px solid #2a2a3e;
        }
        .form-group {
          margin-bottom: 18px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #a8a8b8;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        select, input, textarea {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid #2a2a3e;
          border-radius: 12px;
          font-size: 15px;
          box-sizing: border-box;
          background: #0f0f1e;
          color: #fff;
          font-family: 'Poppins', sans-serif;
          transition: all 0.3s ease;
        }
        select:focus, input:focus, textarea:focus {
          outline: none;
          border-color: #f9472f;
          background: #1a1a2e;
          box-shadow: 0 0 0 3px rgba(249, 71, 47, 0.1);
        }
        textarea {
          resize: vertical;
          min-height: 80px;
        }
        .btn {
          padding: 14px 28px;
          border: none;
          border-radius: 50px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: 'Poppins', sans-serif;
          letter-spacing: 0.3px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .btn-primary {
          background: linear-gradient(135deg, #f9472f 0%, #d93a1f 100%);
          color: white;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(249, 71, 47, 0.4);
        }
        .btn-call {
          background: linear-gradient(135deg, #00c853 0%, #00a843 100%);
          color: white;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          padding: 0;
          font-size: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(0, 200, 83, 0.4);
        }
        .btn-call:hover {
          transform: scale(1.05);
          box-shadow: 0 12px 32px rgba(0, 200, 83, 0.5);
        }
        .btn-hangup {
          background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
          color: white;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          padding: 0;
          font-size: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(244, 67, 54, 0.4);
          animation: pulse 2s infinite;
        }
        .btn-hangup:hover {
          transform: scale(1.05);
          box-shadow: 0 12px 32px rgba(244, 67, 54, 0.5);
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 8px 24px rgba(244, 67, 54, 0.4); }
          50% { box-shadow: 0 8px 32px rgba(244, 67, 54, 0.6); }
        }
        .btn-secondary {
          background: #2a2a3e;
          color: #fff;
          border: 1px solid #3a3a4e;
        }
        .btn-secondary:hover {
          background: #3a3a4e;
          transform: translateY(-1px);
        }
        .btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none !important;
        }
        .lead-card {
          background: linear-gradient(135deg, #2a2a3e 0%, #1f1f2e 100%);
          padding: 24px;
          border-radius: 20px;
          margin-bottom: 20px;
          border: 1px solid #3a3a4e;
        }
        .lead-name {
          font-size: 26px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
          letter-spacing: -0.5px;
        }
        .lead-phone {
          font-size: 16px;
          color: #f9472f;
          font-weight: 500;
          margin-bottom: 16px;
        }
        .lead-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 16px;
        }
        .lead-info-item {
          background: #0f0f1e;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #2a2a3e;
        }
        .lead-info-label {
          font-size: 11px;
          font-weight: 500;
          color: #a8a8b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .lead-info-value {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
        }
        .call-timer {
          text-align: center;
          padding: 24px;
          margin: 24px 0;
        }
        .call-timer-value {
          font-size: 48px;
          font-weight: 700;
          color: #f9472f;
          font-variant-numeric: tabular-nums;
          letter-spacing: 2px;
        }
        .call-status {
          text-align: center;
          padding: 12px 20px;
          background: linear-gradient(135deg, #2a2a3e 0%, #1f1f2e 100%);
          border-radius: 50px;
          margin: 16px 0;
          font-size: 14px;
          font-weight: 600;
          color: #a8a8b8;
          border: 1px solid #3a3a4e;
          letter-spacing: 0.5px;
        }
        .call-status.active {
          background: linear-gradient(135deg, #00c853 0%, #00a843 100%);
          color: #fff;
          box-shadow: 0 4px 16px rgba(0, 200, 83, 0.3);
        }
        .btn-group {
          display: flex;
          gap: 16px;
          justify-content: center;
          align-items: center;
          margin: 24px 0;
        }
        .post-call-form {
          background: linear-gradient(135deg, #2a2a3e 0%, #1f1f2e 100%);
          padding: 24px;
          border-radius: 20px;
          border: 1px solid #3a3a4e;
        }
        .post-call-form h3 {
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 600;
          color: #fff;
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
            <h2 style={{margin: '0 0 24px 0', fontSize: '24px', fontWeight: '600', color: '#fff'}}>Iniciar Sesión</h2>

            <div className="form-group">
              <label>País</label>
              <select value={pais} onChange={(e) => setPais(e.target.value)}>
                <option value="" style={{background: '#0f0f1e'}}>Selecciona país</option>
                <option value="CO" style={{background: '#0f0f1e'}}>🇨🇴 Colombia</option>
                <option value="MX" style={{background: '#0f0f1e'}}>🇲🇽 México</option>
                <option value="CL" style={{background: '#0f0f1e'}}>🇨🇱 Chile</option>
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
              <small style={{color: '#a8a8b8', marginTop: '5px', display: 'block', fontSize: '12px'}}>
                El Caller ID se asignará automáticamente según tu email
              </small>
            </div>

            {email && email.includes('@') && (
              <div className="form-group">
                <label>Caller ID asignado</label>
                {callerIdLoading ? (
                  <div style={{
                    padding: '14px 16px',
                    background: '#0f0f1e',
                    borderRadius: '12px',
                    color: '#a8a8b8',
                    border: '1px solid #2a2a3e'
                  }}>
                    🔄 Buscando tu Caller ID...
                  </div>
                ) : callerId ? (
                  <div style={{
                    padding: '14px 16px',
                    background: 'linear-gradient(135deg, #00c853 0%, #00a843 100%)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(0, 200, 83, 0.3)'
                  }}>
                    ✅ {callerId}
                  </div>
                ) : callerIdError ? (
                  <div style={{
                    padding: '14px 16px',
                    background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                    borderRadius: '12px',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)'
                  }}>
                    ❌ {callerIdError}
                  </div>
                ) : null}
              </div>
            )}

            <button className="btn btn-primary" onClick={handleStartSession} style={{width: '100%', marginTop: '8px'}}>
              Iniciar Sesión
            </button>
          </div>
        ) : (
          <>
            {showPostCallForm ? (
              <div className="card post-call-form">
                <h3>Resultado de la llamada</h3>

                <div className="form-group">
                  <label>Duración de llamada</label>
                  <div style={{
                    padding: '12px',
                    background: '#0f0f1e',
                    borderRadius: '12px',
                    textAlign: 'center',
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#f9472f',
                    border: '1px solid #2a2a3e'
                  }}>
                    {formatDuration(callDuration)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Resultado *</label>
                  <select
                    value={postCallData.resultado}
                    onChange={(e) => setPostCallData({...postCallData, resultado: e.target.value})}
                  >
                    <option value="">Selecciona resultado</option>
                    <option value="contactado">✅ Contactado - Interesado</option>
                    <option value="contactado_no_interesado">📵 Contactado - No interesado</option>
                    <option value="no_contesta">❌ No contesta</option>
                    <option value="buzon">📧 Buzón de voz</option>
                    <option value="numero_equivocado">⚠️ Número equivocado</option>
                    <option value="reagendar">📅 Reagendar</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Notas</label>
                  <textarea
                    value={postCallData.notas}
                    onChange={(e) => setPostCallData({...postCallData, notas: e.target.value})}
                    placeholder="Escribe notas sobre la llamada..."
                  />
                </div>

                <div className="form-group">
                  <label>Próxima acción</label>
                  <select
                    value={postCallData.proximaAccion}
                    onChange={(e) => setPostCallData({...postCallData, proximaAccion: e.target.value})}
                  >
                    <option value="">Selecciona acción</option>
                    <option value="llamar_manana">Llamar mañana</option>
                    <option value="llamar_semana">Llamar próxima semana</option>
                    <option value="enviar_info">Enviar información</option>
                    <option value="agendar_visita">Agendar visita</option>
                    <option value="cerrado">Cerrado</option>
                    <option value="descartado">Descartado</option>
                  </select>
                </div>

                <div style={{display: 'flex', gap: '12px', marginTop: '24px'}}>
                  <button
                    className="btn btn-primary"
                    onClick={submitPostCallForm}
                    style={{flex: 1}}
                  >
                    Guardar y Siguiente
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={cancelPostCallForm}
                  >
                    Saltar
                  </button>
                </div>
              </div>
            ) : currentLead && (
              <div className="card">
                <div className="lead-card">
                  <div className="lead-name">{currentLead.nombre}</div>
                  <div className="lead-phone">{currentLead.telefono}</div>

                  <div className="lead-info">
                    <div className="lead-info-item">
                      <div className="lead-info-label">Deal ID</div>
                      <div className="lead-info-value">
                        <a href={getPipedriveUrl(currentLead.pipedriveDealId)} target="_blank" rel="noopener noreferrer" style={{color: '#f9472f', textDecoration: 'none'}}>
                          {currentLead.pipedriveDealId}
                        </a>
                      </div>
                    </div>
                    <div className="lead-info-item">
                      <div className="lead-info-label">Intentos</div>
                      <div className="lead-info-value">{currentLead.intentos}</div>
                    </div>
                    <div className="lead-info-item">
                      <div className="lead-info-label">País</div>
                      <div className="lead-info-value">{pais}</div>
                    </div>
                    <div className="lead-info-item">
                      <div className="lead-info-label">Email</div>
                      <div className="lead-info-value" style={{fontSize: '12px', wordBreak: 'break-all'}}>{email}</div>
                    </div>
                  </div>
                </div>

                {isCallInProgress && callDuration > 0 && (
                  <div className="call-timer">
                    <div className="call-timer-value">{formatDuration(callDuration)}</div>
                  </div>
                )}

                {callStatus && (
                  <div className={`call-status ${isCallInProgress ? 'active' : ''}`}>
                    {callStatus}
                  </div>
                )}

                <div className="btn-group">
                  {!isCallInProgress ? (
                    <>
                      <button className="btn btn-call" onClick={makeCall} title="Llamar">
                        📞
                      </button>
                      <button className="btn btn-secondary" onClick={loadNextLead} style={{padding: '12px 24px'}}>
                        Siguiente Lead
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-hangup" onClick={hangup} title="Colgar">
                        📵
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={toggleMute}
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '50%',
                          fontSize: '24px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
                      >
                        {isMuted ? '🔇' : '🔊'}
                      </button>
                    </>
                  )}
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
                      background: '#2a2a3e',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      borderLeft: '4px solid #f9472f',
                      border: '1px solid #3a3a4e'
                    }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                        <div style={{fontWeight: '600', color: '#fff'}}>{call.nombre}</div>
                        <div style={{fontSize: '13px', color: '#a8a8b8'}}>
                          {call.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{fontSize: '14px', color: '#a8a8b8'}}>
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
