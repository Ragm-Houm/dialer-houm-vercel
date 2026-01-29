import { useMemo, useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AppHeader from '../components/AppHeader';
import { useSession } from '../lib/session';
import {
  BarChart3,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardCopy,
  FileCheck,
  FileText,
  Globe,
  Headphones,
  Inbox,
  List,
  Loader2,
  LogOut,
  Mail,
  MessageCircle,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  Shield,
  SkipForward,
  Timer,
  User,
  Voicemail,
  XCircle
} from 'lucide-react';

export default function Home() {
  const [pais, setPais] = useState('');
  const [callerId, setCallerId] = useState('');
  const [email, setEmail] = useState('');
  const [idToken, setIdToken] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [DeviceClass, setDeviceClass] = useState(null);
  const [currentLead, setCurrentLead] = useState(null);
  const [twilioDevice, setTwilioDevice] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const [callState, setCallState] = useState('idle');
  const [statusHistory, setStatusHistory] = useState([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [userRole, setUserRole] = useState('ejecutivo');
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [isLeadLoading, setIsLeadLoading] = useState(false);
  const [prevLeads, setPrevLeads] = useState([]);
  const [nextLead, setNextLead] = useState(null);
  const [noLeadsInfo, setNoLeadsInfo] = useState(null);
  const [campaignAvailability, setCampaignAvailability] = useState(null);
  const [campaignAvailabilityReason, setCampaignAvailabilityReason] = useState(null);
  const [lastCallSnapshot, setLastCallSnapshot] = useState(null);
  const [showSkipForm, setShowSkipForm] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [callerIdLoading, setCallerIdLoading] = useState(false);
  const [callerIdError, setCallerIdError] = useState('');
  const [authError, setAuthError] = useState('');
  const [callHistory, setCallHistory] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [activityUpdatingId, setActivityUpdatingId] = useState(null);
  const [rightTab, setRightTab] = useState('today');
  const [dealUsers, setDealUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [ownerEditOpen, setOwnerEditOpen] = useState(false);
  const [isOwnerUpdating, setIsOwnerUpdating] = useState(false);
  const [actionLog, setActionLog] = useState([]);
  const [showPostCallForm, setShowPostCallForm] = useState(false);
  const [callOutcomeMode, setCallOutcomeMode] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [retryDelay, setRetryDelay] = useState('');
  const [futureDelay, setFutureDelay] = useState('');
  const [availabilityDecision, setAvailabilityDecision] = useState('keep');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [lostReasons, setLostReasons] = useState([]);
  const [selectedLostReason, setSelectedLostReason] = useState('');
  const [autoCallCountdown, setAutoCallCountdown] = useState(null);
  const [autoCallMessage, setAutoCallMessage] = useState('');
  const autoCallTimerRef = useRef(null);
  const autoCallCancelCountRef = useRef(0);
  const [isMuted, setIsMuted] = useState(false);
  const [actionToast, setActionToast] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaignKey, setSelectedCampaignKey] = useState('');
  const [campaignJoined, setCampaignJoined] = useState(false);
  const [campaignStartAt, setCampaignStartAt] = useState(null);
  const [campaignElapsed, setCampaignElapsed] = useState(0);
  const [campaignSessionId, setCampaignSessionId] = useState(null);
  const [campaignCallSeconds, setCampaignCallSeconds] = useState(0);
  const [showCampaignSummary, setShowCampaignSummary] = useState(false);
  const [campaignSummary, setCampaignSummary] = useState(null);
  const [campaignClosing, setCampaignClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [campaignError, setCampaignError] = useState('');
  const [callOutcomes, setCallOutcomes] = useState([]);
  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedInputId, setSelectedInputId] = useState('');
  const [selectedOutputId, setSelectedOutputId] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const autoStartRef = useRef(false);
  const menuOpenRef = useRef(null);
  const campaignTimerRef = useRef(null);
  const campaignJoinedRef = useRef(false);
  const completedDealsRef = useRef(new Set());
  const router = useRouter();
  const paisRef = useRef('');
  const isManagerRole = userRole === 'admin' || userRole === 'supervisor';
  const { session, isSessionReady, sessionError, updateSession, clearSession, csrfFetch } = useSession();
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioMeterRafRef = useRef(null);

  useEffect(() => {
    if (!isSessionReady) return;
    setAuthError(sessionError || '');
    if (!session?.email || !session?.idToken) {
      setEmail('');
      setIdToken('');
      setUserRole('ejecutivo');
      setPais('');
      paisRef.current = '';
      return;
    }
    setEmail(session.email);
    setIdToken(session.idToken);
    setUserRole(session.role || 'ejecutivo');
    if (session.country) {
      setPais(session.country);
      paisRef.current = session.country;
    } else {
      setPais('');
      paisRef.current = '';
      setAuthError('Tu usuario no tiene pais asignado. Pide a tu supervisor que lo configure.');
    }
  }, [isSessionReady, session, sessionError]);

  useEffect(() => {
    if (!isSessionReady) return;
    if (!session?.email || !session?.idToken) {
      router.replace('/login');
    }
  }, [isSessionReady, session, router]);

  const [readiness, setReadiness] = useState({
    email: 'idle',
    audio: 'idle',
    pipedrive: 'idle'
  });
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const nextTaskDateRef = useRef(null);

  // Usar ref para mantener la referencia del call activo
  const activeCallRef = useRef(null);
  const callTimerRef = useRef(null);
  const callDurationRef = useRef(0);
  const callConnectedRef = useRef(false);
  const userHangupRef = useRef(false);
  const statusRef = useRef('idle');
  const readinessTimerRef = useRef([]);

  useEffect(() => {
    paisRef.current = pais;
  }, [pais]);

  const loadAudioDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((device) => device.kind === 'audioinput');
      const outputs = devices.filter((device) => device.kind === 'audiooutput');
      setAudioInputs(inputs);
      setAudioOutputs(outputs);
      if (!selectedInputId && inputs.length > 0) {
        setSelectedInputId(inputs[0].deviceId);
      }
      if (!selectedOutputId && outputs.length > 0) {
        setSelectedOutputId(outputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error cargando dispositivos de audio:', error);
    }
  };

  useEffect(() => {
    if (!sessionStarted) return;
    loadAudioDevices();
  }, [sessionStarted]);

  const loadCampaigns = async (nextCountry = pais) => {
    if (!email || !idToken || !nextCountry) return;
    try {
      setCampaignsLoading(true);
      setCampaignError('');
      const res = await fetch(
        `/api/campaigns?country=${nextCountry}&status=active&email=${encodeURIComponent(email)}&idToken=${encodeURIComponent(idToken)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCampaignError(data.error || 'No se pudieron cargar campañas');
        setCampaigns([]);
        return;
      }
      const active = data.campaigns || [];
      const filtered = active.filter((campaign) => {
        if (campaign.allow_all_execs || !campaign.allowed_execs) return true;
        return campaign.allowed_execs.includes(email);
      });
      setCampaigns(filtered);
      if (!selectedCampaignKey) {
        const stored = window.localStorage.getItem(`dialer_campaign_${email}`) || '';
        const candidate = filtered.find((c) => c.campaign_key === stored) ? stored : (filtered[0]?.campaign_key || '');
        setSelectedCampaignKey(candidate);
      }
    } catch (error) {
      console.error('Error cargando campañas:', error);
      setCampaigns([]);
      setCampaignError('Error cargando campañas');
    } finally {
      setCampaignsLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionStarted) return;
    loadCampaigns();
  }, [sessionStarted, pais, email, idToken]);

  const loadCallOutcomes = async () => {
    if (!email || !idToken) return;
    try {
      const res = await fetch(
        `/api/outcomes?email=${encodeURIComponent(email)}&idToken=${encodeURIComponent(idToken)}`
      );
      const data = await res.json();
      if (!res.ok) {
        return;
      }
      setCallOutcomes((data.outcomes || []).filter((o) => o.activo !== false));
    } catch (error) {
      console.error('Error cargando outcomes:', error);
    }
  };

  useEffect(() => {
    if (!sessionStarted) return;
    loadCallOutcomes();
  }, [sessionStarted, email, idToken]);

  useEffect(() => {
    if (!sessionStarted) return;
    loadDealUsers();
  }, [sessionStarted]);

  useEffect(() => {
    if (!sessionStarted || !email || !idToken) return;
    const fetchLostReasons = async () => {
      try {
        const res = await csrfFetch('/api/pipedrive-lost-reasons');
        if (!res.ok) return;
        const data = await res.json();
        const reasons = (data.reasons || []).filter((item) => item.active_flag !== false);
        setLostReasons(reasons);
      } catch (error) {
        console.error('Error cargando motivos de pérdida:', error);
      }
    };
    fetchLostReasons();
  }, [sessionStarted, email, idToken]);

  useEffect(() => {
    if (!email) return;
    if (!selectedCampaignKey) return;
    window.localStorage.setItem(`dialer_campaign_${email}`, selectedCampaignKey);
  }, [selectedCampaignKey, email]);

  useEffect(() => {
    campaignJoinedRef.current = campaignJoined;
  }, [campaignJoined]);

  useEffect(() => {
    setCurrentLead(null);
    setNextLead(null);
    setPrevLeads([]);
    setStatusHistory([]);
    setShowPostCallForm(false);
    setShowSkipForm(false);
    setCampaignJoined(false);
    campaignJoinedRef.current = false;
    setCampaignStartAt(null);
    setCampaignElapsed(0);
    setCampaignSessionId(null);
    setCampaignCallSeconds(0);
    if (campaignTimerRef.current) {
      clearInterval(campaignTimerRef.current);
      campaignTimerRef.current = null;
    }
  }, [selectedCampaignKey]);

  useEffect(() => {
    if (!twilioDevice || !selectedInputId) return;
    const audioHelper = twilioDevice.audio;
    if (audioHelper?.setInputDevice) {
      audioHelper.setInputDevice(selectedInputId).catch((error) => {
        console.error('Error asignando microfono:', error);
      });
    }
  }, [twilioDevice, selectedInputId]);

  useEffect(() => {
    if (!campaignJoined || !campaignStartAt) return;
    if (campaignTimerRef.current) {
      clearInterval(campaignTimerRef.current);
    }
    campaignTimerRef.current = setInterval(() => {
      setCampaignElapsed(Math.floor((Date.now() - campaignStartAt.getTime()) / 1000));
    }, 1000);
    return () => {
      if (campaignTimerRef.current) {
        clearInterval(campaignTimerRef.current);
        campaignTimerRef.current = null;
      }
    };
  }, [campaignJoined, campaignStartAt]);

  useEffect(() => {
    const shouldLock = showCloseConfirm || showCampaignSummary;
    if (!shouldLock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showCloseConfirm, showCampaignSummary]);

  useEffect(() => {
    if (!twilioDevice || !selectedOutputId) return;
    const audioHelper = twilioDevice.audio;
    if (audioHelper?.speakerDevices?.set) {
      audioHelper.speakerDevices.set(selectedOutputId).catch((error) => {
        console.error('Error asignando altavoz:', error);
      });
    }
    if (audioHelper?.ringtoneDevices?.set) {
      audioHelper.ringtoneDevices.set(selectedOutputId).catch((error) => {
        console.error('Error asignando ringtone:', error);
      });
    }
  }, [twilioDevice, selectedOutputId]);

  useEffect(() => {
    if (!sessionStarted || !selectedInputId) return;
    let cancelled = false;

    const startMeter = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedInputId ? { deviceId: { exact: selectedInputId } } : true
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        audioStreamRef.current = stream;
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        audioContextRef.current = context;
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i += 1) {
            const val = data[i] - 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / data.length) / 128;
          setAudioLevel(Math.min(100, Math.round(rms * 220)));
          audioMeterRafRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (error) {
        console.error('Error iniciando medidor de audio:', error);
      }
    };

    startMeter();

    return () => {
      cancelled = true;
      if (audioMeterRafRef.current) {
        cancelAnimationFrame(audioMeterRafRef.current);
        audioMeterRafRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      setAudioLevel(0);
    };
  }, [sessionStarted, selectedInputId]);

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

  useEffect(() => {
    const applyTheme = (nextTheme) => {
      document.body.setAttribute('data-theme', nextTheme);
    };
    try {
      const storedTheme = window.localStorage.getItem('houm_theme');
      if (storedTheme === 'light' || storedTheme === 'dark') {
        applyTheme(storedTheme);
        return;
      }
    } catch (error) {
      console.error('Error leyendo tema guardado:', error);
    }
    if (!window.matchMedia) {
      applyTheme('dark');
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => applyTheme(media.matches ? 'light' : 'dark');
    sync();
    const handleChange = (event) => applyTheme(event.matches ? 'light' : 'dark');
    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    setOwnerEditOpen(false);
    setUserSearch('');
  }, [currentLead?.pipedriveDealId]);

  useEffect(() => {
    setShowLeadDetails(false);
  }, [currentLead?.pipedriveDealId]);

  useEffect(() => {
    const handler = (event) => {
      if (isTextInput(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === 'l') {
        if (!isCallInProgress && !showPostCallForm && !showSkipForm) {
          makeCall();
        }
      }
      if (key === 'n') {
        if (!isCallInProgress && !showPostCallForm && !showSkipForm && !isLeadLoading) {
          openSkipForm();
        }
      }
      if (key === 'c') {
        if (currentLead && !activityUpdatingId) {
          const { overdue, upcoming } = getTaskBuckets(currentLead);
          const nextTask = overdue[0] || upcoming[0];
          if (nextTask) {
            markNextTaskDone(nextTask.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCallInProgress, showPostCallForm, showSkipForm, isLeadLoading, currentLead, activityUpdatingId]);

  // Ya no necesitamos cargar la lista completa de Caller IDs
  // El Caller ID se asigna automáticamente basado en el email

  // Auto-cargar Caller ID cuando se ingresa el email
  useEffect(() => {
    if (email && idToken && email.includes('@')) {
      console.log('📧 Email ingresado, cargando Caller ID asignado...');
      setCallerIdLoading(true);
      setCallerIdError('');
      setCallerId('');

      fetch(
        `/api/ejecutivo-callerid?email=${encodeURIComponent(email)}&idToken=${encodeURIComponent(idToken)}`
      )
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
  }, [email, idToken]);

  // Iniciar sesión
  const handleStartSession = async () => {
    if (isSessionLoading) return;
    const country = paisRef.current;
    if (!email || !idToken || !country) {
      alert('Inicia sesion con Google. Si falta el pais, pide que lo configuren.');
      return;
    }

    setIsSessionLoading(true);
    try {
      const meRes = await csrfFetch('/api/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email })
      });
      const meData = await meRes.json();
      if (!meRes.ok) {
        alert(meData.error || 'Usuario no autorizado');
        return;
      }
      const verifiedEmail = meData.user.email;
      const userCountry = meData.user.country || '';
      if (!userCountry) {
        setAuthError('Tu usuario no tiene pais asignado. Pide a tu supervisor que lo configure.');
        return;
      }
      setEmail(verifiedEmail);
      setUserRole(meData.user?.role || 'ejecutivo');
      setPais(userCountry);
      paisRef.current = userCountry;
      updateSession({
        email: verifiedEmail,
        idToken: '__cookie__',
        role: meData.user?.role || 'ejecutivo',
        country: userCountry,
        picture: meData.google?.picture || ''
      });

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
      const tokenRes = await csrfFetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
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
        updateStatus('ready', 'Listo');
        setTwilioDevice(device);
        setSessionStarted(true);
      });

      device.on('error', (error) => {
        console.error('❌ Error Twilio:', error);
        updateStatus('error', 'Error');
        alert('Error Twilio: ' + (error.message || 'Unknown error'));
      });

      device.on('connect', (call) => {
        if (!activeCallRef.current) {
          attachCallHandlers(call);
        }
      });

      device.on('disconnect', () => {
        console.log('📴 Device desconectado');
        setActiveCall(null);
        if (!showPostCallForm) {
          updateStatus('ready', 'Listo');
        }
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
    } finally {
      setIsSessionLoading(false);
    }
  };

  useEffect(() => {
    if (!isSessionReady) return;
    if (autoStartRef.current) return;
    if (sessionStarted || isSessionLoading) return;
    if (!email || !idToken || !pais) return;
    if (!sdkLoaded || !DeviceClass) return;
    autoStartRef.current = true;
    handleStartSession();
  }, [
    isSessionReady,
    sessionStarted,
    isSessionLoading,
    email,
    idToken,
    pais,
    sdkLoaded,
    DeviceClass,
    handleStartSession
  ]);

  useEffect(() => {
    let isActive = true;
    if (!selectedCampaignKey) {
      setCampaignAvailability(null);
      setCampaignAvailabilityReason(null);
      return () => {};
    }
    fetchCampaignAvailability(selectedCampaignKey)
      .then((data) => {
        if (!isActive) return;
        if (data && data.availability) {
          setCampaignAvailability(data.availability);
          setCampaignAvailabilityReason(data.reason || null);
        } else {
          setCampaignAvailability(null);
          setCampaignAvailabilityReason(null);
        }
      })
      .catch((error) => {
        console.error('Error cargando disponibilidad de campaña:', error);
        if (!isActive) return;
        setCampaignAvailability(null);
        setCampaignAvailabilityReason(null);
      });
    return () => {
      isActive = false;
    };
  }, [selectedCampaignKey, email, idToken]);

  const fetchLead = async () => {
    if (!selectedCampaignKey || !email || !idToken) return null;
    const res = await csrfFetch('/api/campaign-next-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignKey: selectedCampaignKey,
        email,
        idToken
      })
    });
    if (!res.ok) {
      return null;
    }
    return res.json();
  };

  const fetchCampaignAvailability = async (campaignKey) => {
    if (!campaignKey || !email || !idToken) return null;
    const res = await csrfFetch('/api/campaign-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignKey,
        email,
        idToken
      })
    });
    if (!res.ok) return null;
    return res.json();
  };

  const refreshLeadContext = async (lead) => {
    if (!lead?.pipedriveDealId) return;
    try {
      const dealId = lead.pipedriveDealId;
      const res = await fetch(`/api/lead-context?dealId=${dealId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.pipedrive) return;
      setCurrentLead((prev) => {
        if (!prev || String(prev.pipedriveDealId) !== String(dealId)) {
          return prev;
        }
        return {
          ...prev,
          pipedrive: data.pipedrive
        };
      });
      setNextLead((prev) => {
        if (!prev || String(prev.pipedriveDealId) !== String(dealId)) {
          return prev;
        }
        return {
          ...prev,
          pipedrive: data.pipedrive
        };
      });
    } catch (error) {
      console.error('Error refrescando contexto del lead:', error);
    }
  };

  const loadDealUsers = async () => {
    if (dealUsers.length > 0 || isUsersLoading) return;
    try {
      setIsUsersLoading(true);
      const res = await csrfFetch('/api/pipedrive-users');
      if (!res.ok) return;
      const data = await res.json();
      const users = (data.users || []).filter((user) => !user.is_deleted && user.active_flag !== false);
      setDealUsers(users);
    } catch (error) {
      console.error('Error cargando usuarios de Pipedrive:', error);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const prefetchNextLead = async () => {
    if (nextLead || isLeadLoading) return;
    if (!selectedCampaignKey || !email || !idToken) return;
    if (!campaignJoined) return;
    try {
      const lead = await fetchLead();
      if (lead?.completed || lead?.available === false) {
        return;
      }
      if (lead) {
        if (currentLead && String(currentLead.pipedriveDealId) === String(lead.pipedriveDealId)) {
          return;
        }
        setNextLead(lead);
        refreshLeadContext(lead);
      }
    } catch (error) {
      console.error('Error pre-cargando siguiente lead:', error);
    }
  };

  // Cargar siguiente lead
  const buildNoLeadsMessage = (payload) => {
    const reason = payload?.reason || 'none';
    const stats = payload?.stats || {};
    if (reason === 'no_phone') {
      return { title: 'Sin teléfonos válidos', detail: 'Los leads pendientes no tienen números válidos.', stats };
    }
    if (reason === 'max_attempts') {
      return { title: 'Límite de intentos alcanzado', detail: 'Todos los leads pendientes ya alcanzaron el máximo de intentos.', stats };
    }
    if (reason === 'max_gestions') {
      return { title: 'Límite de gestiones alcanzado', detail: 'Los leads pendientes alcanzaron el máximo de gestiones.', stats };
    }
    if (reason === 'cooldown') {
      let extra = '';
      if (stats.nextRetryAt) {
        const nextText = formatRetryHhmm(stats.nextRetryAt);
        if (nextText) {
          extra = ` Próximo reintento en ${nextText}.`;
        }
      }
      return { title: 'En espera de reintento', detail: `Los leads pendientes están en cooldown.${extra}`, stats };
    }
    if (reason === 'locked') {
      return { title: 'Leads en uso', detail: 'Los leads están bloqueados por otros ejecutivos. Intenta más tarde.', stats };
    }
    if (stats.totalPending === 0) {
      return { title: 'Sin leads pendientes', detail: 'No se encontraron leads pendientes para esta campaña.', stats };
    }
    return { title: 'No hay leads disponibles', detail: 'No se pudo asignar un lead en este momento.', stats };
  };

  const formatRetryHhmm = (nextRetryAt) => {
    if (!nextRetryAt) return '';
    const diffMs = new Date(nextRetryAt).getTime() - Date.now();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return '';
    const totalMinutes = Math.max(0, Math.round(diffMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
  };

  const TZ_BY_COUNTRY = {
    CO: 'America/Bogota',
    MX: 'America/Mexico_City',
    CL: 'America/Santiago'
  };

  const getLeadTimezone = () => {
    const country = currentLead?.pipedrive?.country || currentLead?.pais || paisRef.current || pais || 'CO';
    return TZ_BY_COUNTRY[String(country || '').toUpperCase()] || 'America/Bogota';
  };

  const toLocalParts = (date, timeZone) => {
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = fmt.formatToParts(date);
      const map = parts.reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {});
      return {
        date: `${map.year}-${map.month}-${map.day}`,
        time: `${map.hour}:${map.minute}`
      };
    } catch (error) {
      const iso = date.toISOString();
      return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
    }
  };

  const addHoursInZone = (hours, timeZone) => {
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    return toLocalParts(target, timeZone);
  };

  const addDaysInZone = (days, timeZone) => {
    const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return toLocalParts(target, timeZone);
  };

  const getTimeBucket = (timeZone) => {
    const parts = toLocalParts(new Date(), timeZone);
    const hour = Number(parts.time.split(':')[0]);
    const period = hour < 12 ? 'AM' : 'PM';
    if (Number.isNaN(hour)) {
      return { period, block: 'fuera' };
    }
    if (hour < 7 || hour >= 19) {
      return { period, block: 'fuera' };
    }
    const blockStart = 7 + Math.floor((hour - 7) / 3) * 3;
    const blockEnd = blockStart + 3;
    return { period, block: `${blockStart}:00-${blockEnd}:00` };
  };

  const clearAutoCallCountdown = () => {
    if (autoCallTimerRef.current) {
      clearInterval(autoCallTimerRef.current);
      autoCallTimerRef.current = null;
    }
    setAutoCallCountdown(null);
    setAutoCallMessage('');
  };

  const startAutoCallCountdown = (seconds, message = 'Llamando en') => {
    clearAutoCallCountdown();
    setAutoCallMessage(message);
    setAutoCallCountdown(seconds);
    let remaining = seconds;
    autoCallTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearAutoCallCountdown();
        makeCall({ auto: true });
        return;
      }
      setAutoCallCountdown(remaining);
    }, 1000);
  };

  const handleAutoCallCancel = () => {
    clearAutoCallCountdown();
    autoCallCancelCountRef.current += 1;
    if (autoCallCancelCountRef.current === 1) {
      showActionToast('Reintento en 30 segundos');
      startAutoCallCountdown(30, 'Reintentando en');
      return;
    }
    if (autoCallCancelCountRef.current === 2) {
      showActionToast('Reintento en 60 segundos');
      startAutoCallCountdown(60, 'Reintentando en');
      return;
    }
    showActionToast('Cerrando campaña por múltiples cancelaciones');
    finalizeCampaignSession('manual');
  };

  const loadNextLead = async (forceJoin = false, options = {}) => {
    try {
      setIsLeadLoading(true);
      if (!email || !idToken || !selectedCampaignKey) {
        setIsLeadLoading(false);
        if (!selectedCampaignKey) {
          showActionToast('Selecciona una campaña activa');
        }
        return;
      }
      if (!campaignJoined && !forceJoin) {
        setIsLeadLoading(false);
        showActionToast('Debes unirte a una campaña para iniciar.');
        return;
      }

      if (currentLead) {
        setPrevLeads((prev) => [...prev, currentLead]);
      }

      if (nextLead) {
        setShowPostCallForm(false);
        resetOutcomeForm();
        autoCallCancelCountRef.current = 0;
        setCurrentLead(nextLead);
        setNextLead(null);
        setNoLeadsInfo(null);
        setShowSkipForm(false);
        setStatusHistory([]);
        updateStatus('ready', 'Listo');
        trackEvent('lead_loaded', {
          dealId: nextLead.pipedriveDealId,
          stageName: nextLead.stageName || '',
          phone: nextLead.telefono || ''
        });
        refreshLeadContext(nextLead);
        prefetchNextLead();
        if (options.autoCall) {
          startAutoCallCountdown(3);
        }
        return;
      }

      const lead = await fetchLead();
      if (lead?.completed) {
        setCurrentLead(null);
        setNoLeadsInfo(null);
        setNextLead(null);
        clearAutoCallCountdown();
        showActionToast('Campaña completada');
        if (campaignJoined && !showCampaignSummary) {
          finalizeCampaignSession('auto');
        }
        return;
      }
      if (lead && lead.available === false) {
        const message = buildNoLeadsMessage(lead);
        setCurrentLead(null);
        setNextLead(null);
        setNoLeadsInfo(message);
        clearAutoCallCountdown();
        if (lead.stats) {
          setCampaignAvailability(lead.stats);
          setCampaignAvailabilityReason(lead.reason || null);
        }
        showActionToast(message.title);
        return;
      }
      if (lead) {
        setShowPostCallForm(false);
        resetOutcomeForm();
        autoCallCancelCountRef.current = 0;
        setCurrentLead(lead);
        setNoLeadsInfo(null);
        setShowSkipForm(false);
        setStatusHistory([]);
        updateStatus('ready', 'Listo');
        trackEvent('lead_loaded', {
          dealId: lead.pipedriveDealId,
          stageName: lead.stageName || '',
          phone: lead.telefono || ''
        });
        refreshLeadContext(lead);
        prefetchNextLead();
        if (options.autoCall) {
          startAutoCallCountdown(3);
        }
      } else {
        setCurrentLead(null);
        clearAutoCallCountdown();
        const message = buildNoLeadsMessage(null);
        setNoLeadsInfo(message);
        showActionToast(message.title);
      }
      } catch (error) {
        console.error('Error cargando lead:', error);
      } finally {
        setIsLeadLoading(false);
      }
    };

  const loadPrevLead = () => {
    if (prevLeads.length === 0) return;
    const updated = [...prevLeads];
    const previous = updated.pop();
    setPrevLeads(updated);
    if (currentLead) {
      setNextLead(currentLead);
    }
    if (previous) {
      setCurrentLead(previous);
      setStatusHistory([]);
      updateStatus('ready', 'Listo');
      refreshLeadContext(previous);
    }
  };

  // Hacer llamada
  const makeCall = (options = {}) => {
    if (!campaignJoinedRef.current) {
      showActionToast('Debes unirte a una campaña antes de llamar.');
      return;
    }
    if (!twilioDevice || !currentLead) {
      alert('No hay Twilio Device o lead');
      return;
    }
    if (!callerId) {
      alert('No tienes Caller ID asignado. Pide que lo configuren en Twilio.');
      return;
    }

    setShowPostCallForm(false);
    resetOutcomeForm();
    clearAutoCallCountdown();
    autoCallCancelCountRef.current = 0;

    console.log('📞 Iniciando llamada...');
    console.log('  Lead:', currentLead);
    console.log('  Teléfono:', currentLead.telefono);
    console.log('  Caller ID:', callerId);

    setCallStatus('Llamando...');
    setIsCallInProgress(true);
    userHangupRef.current = false;
    callConnectedRef.current = false;
    updateStatus('dialing', 'Llamando');
    const timeBucket = getTimeBucket(getLeadTimezone());
    trackEvent('call_started', {
      dealId: currentLead.pipedriveDealId,
      phone: currentLead.telefono || '',
      callerId,
      period: timeBucket.period,
      block: timeBucket.block
    });
    setCurrentLead((prev) => (prev ? { ...prev, intentos: (prev.intentos || 0) + 1 } : prev));

    // En Voice SDK 2.x, los parámetros personalizados van dentro de 'params'
    const callParams = {
      params: {
        To: currentLead.telefono,
        From: callerId
      }
    };

    console.log('  Parámetros de llamada:', callParams);
    const callOrPromise = twilioDevice.connect(callParams);
    if (callOrPromise && typeof callOrPromise.then === 'function') {
      callOrPromise.then((call) => attachCallHandlers(call));
    } else if (callOrPromise) {
      attachCallHandlers(callOrPromise);
    }
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
        userHangupRef.current = true;
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
      updateStatus('ready', 'Listo');
      loadNextLead(false, { autoCall: true });
    } catch (error) {
      console.error('❌ Error al colgar:', error);
      // En caso de error, resetear todo
      setIsCallInProgress(false);
      setActiveCall(null);
      activeCallRef.current = null;
      stopCallTimer();
      updateStatus('error', 'Error');
      loadNextLead(false, { autoCall: true });
    }
  };

  // Agregar al historial
  const addToHistory = (callData) => {
    setCallHistory(prev => [callData, ...prev]);
  };

  // Iniciar timer de llamada
  const startCallTimer = () => {
    if (callTimerRef.current) {
      return;
    }
    setCallDuration(0);
    callDurationRef.current = 0;
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => {
        const next = prev + 1;
        callDurationRef.current = next;
        return next;
      });
    }, 1000);
  };

  // Detener timer de llamada
  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);

  // Formatear duración en MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const buildCampaignSummary = (mode) => {
    const completedCount = callHistory.filter((call) => call.status === 'completed').length;
    const skippedCount = callHistory.filter((call) => call.status === 'skipped').length;
    const totalLeads = campaignTotal || completedCount + skippedCount;
    const handledCount = completedCount + skippedCount;
    const callCount = callHistory.filter((call) => (call.duracion || 0) > 0).length;
    const progress = totalLeads ? Math.round((handledCount / totalLeads) * 100) : 0;
    return {
      mode,
      totalLeads,
      handledCount,
      completedCount,
      skippedCount,
      callCount,
      progress,
      elapsedSeconds: campaignElapsed,
      callSeconds: campaignCallSeconds
    };
  };

  const resetCampaignSessionState = () => {
    setCampaignJoined(false);
    campaignJoinedRef.current = false;
    setCampaignStartAt(null);
    setCampaignElapsed(0);
    setCampaignSessionId(null);
    setCampaignCallSeconds(0);
    setCurrentLead(null);
    setNextLead(null);
    setPrevLeads([]);
    setShowPostCallForm(false);
    setShowSkipForm(false);
    setStatusHistory([]);
    setCallHistory([]);
    setCallStatus('');
    setIsCallInProgress(false);
    setCallDuration(0);
    callDurationRef.current = 0;
    userHangupRef.current = false;
    callConnectedRef.current = false;
    clearAutoCallCountdown();
    resetOutcomeForm();
  };

  const finalizeCampaignSession = async (mode) => {
    if (campaignClosing) return;
    setCampaignClosing(true);
    const summary = buildCampaignSummary(mode);
    setCampaignSummary(summary);
    try {
      if (campaignSessionId) {
        await csrfFetch('/api/campaign-session-end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: campaignSessionId,
            activeSeconds: campaignElapsed,
            callSeconds: campaignCallSeconds,
            idleSeconds: Math.max(0, campaignElapsed - campaignCallSeconds),
            status: mode === 'auto' ? 'closed_auto' : 'closed_manual',
            email,
            idToken
          })
        });
      }
    } catch (error) {
      console.error('Error cerrando sesión de campaña:', error);
    }
    trackEvent(mode === 'auto' ? 'campaign_closed_auto' : 'campaign_closed_manual', {
      campaignKey: selectedCampaignKey,
      summary
    });
    setCampaignClosing(false);
    setShowCampaignSummary(true);
  };

  const handleCloseCampaign = () => {
    if (!campaignJoined) return;
    setShowCloseConfirm(true);
  };

  const confirmCloseCampaign = () => {
    setShowCloseConfirm(false);
    finalizeCampaignSession('manual');
  };

  const cancelCloseCampaign = () => {
    setShowCloseConfirm(false);
  };

  const closeCampaignSummary = () => {
    setShowCampaignSummary(false);
    setCampaignSummary(null);
    resetCampaignSessionState();
    loadCampaigns();
  };

  const resetOutcomeForm = () => {
    setCallOutcomeMode('');
    setSelectedOutcome('');
    setCallNotes('');
    setRetryDelay('');
    setFutureDelay('');
    setAvailabilityDecision('keep');
    setSelectedStageId('');
    setSelectedLostReason('');
    setFormError('');
  };

  const openOutcomeForm = (options = {}) => {
    stopCallTimer();
    resetOutcomeForm();
    if (options.mode) {
      setCallOutcomeMode(options.mode);
    }
    if (options.outcome) {
      setSelectedOutcome(options.outcome);
      if (!options.mode) {
        const outcomeDef = getOutcomeByKey(options.outcome);
        setCallOutcomeMode(POSITIVE_BUCKETS.has(outcomeDef.metric_bucket) ? 'positive' : 'negative');
      }
    }
    setShowSkipForm(false);
    setShowPostCallForm(true);
  };

  const isNoContestaStage = () => {
    const stageName = String(currentLead?.pipedrive?.stageName || currentLead?.stageName || '').toLowerCase();
    return stageName.includes('no contesta');
  };

  const getOutcomeByKey = (key) =>
    allOutcomes.find((item) => item.key === key) ||
    DEFAULT_OUTCOMES.find((item) => item.key === key) || {
      key,
      label: key,
      outcome_type: 'final',
      metric_bucket: 'otro'
    };

  const handleSaveOutcome = async () => {
    if (!selectedOutcome) {
      setFormError('Selecciona un resultado antes de continuar.');
      return;
    }

    const outcomeDef = getOutcomeByKey(selectedOutcome);
    const isPositive = POSITIVE_BUCKETS.has(outcomeDef.metric_bucket);
    const isNoContesta = selectedOutcome === NO_CONTESTA_KEY;
    const isFuture = selectedOutcome === FUTURE_KEY;
    const isLost = LOST_KEYS.has(selectedOutcome) || (isFuture && availabilityDecision === 'lose');
    const requiresStage =
      (isPositive && isNoContestaStage()) ||
      (availabilityDecision === 'move' && isFuture);

    const projectedGestiones = (currentLead?.gestiones || 0) + 1;
    if (projectedGestiones >= MAX_GESTIONS && (isNoContesta || isFuture) && selectedOutcome !== 'intentos_max') {
      setFormError('Se alcanzó el máximo de gestiones. Marca "Intentos máximos".');
      return;
    }

    if (isNoContesta && !retryDelay) {
      setFormError('Selecciona un tiempo de reintento.');
      return;
    }
    if (isFuture && !futureDelay) {
      setFormError('Selecciona un plazo de disponibilidad.');
      return;
    }
    if (requiresStage && !selectedStageId) {
      setFormError('Selecciona la etapa de destino.');
      return;
    }
    if (isLost && !selectedLostReason) {
      setFormError('Selecciona el motivo de pérdida.');
      return;
    }

    setFormError('');
    const timeZone = getLeadTimezone();
    const timeBucket = getTimeBucket(timeZone);
    const duration = callDurationRef.current || 0;

    const retryHours = retryDelay ? Number(retryDelay) : 0;
    const futureDays = futureDelay ? Number(futureDelay) : 0;
    const nextAttemptAt = isNoContesta && retryHours
      ? new Date(Date.now() + retryHours * 60 * 60 * 1000).toISOString()
      : null;

    const followUpInfo = (() => {
      if (isNoContesta && retryHours) {
        const { date, time } = addHoursInZone(retryHours, timeZone);
        return {
          nextTaskDate: date,
          nextTaskTime: time,
          nextTaskType: 'llamada',
          nextTaskLabel: `Reintento en ${retryHours}h`
        };
      }
      if (isFuture && futureDays) {
        const { date, time } = addDaysInZone(futureDays, timeZone);
        return {
          nextTaskDate: date,
          nextTaskTime: time,
          nextTaskType: 'llamada',
          nextTaskLabel: `Disponibilidad en ${futureDays} dias`
        };
      }
      return {};
    })();

    const shouldAssignOwner = isPositive || isLost;
    const execUser = dealUsers.find((user) => (user.email || '').toLowerCase() === email.toLowerCase());
    const execUserId = execUser?.id || null;

    if (shouldAssignOwner && !execUserId) {
      showActionToast('No se encontró el usuario en Pipedrive para asignar responsable.');
    }

    try {
      if (shouldAssignOwner && execUserId) {
        await csrfFetch('/api/pipedrive-deal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId: currentLead?.pipedriveDealId, ownerId: execUserId })
        });
        addActionLog('Responsable actualizado en Pipedrive');
      }

      if (selectedStageId) {
        await csrfFetch('/api/pipedrive-deal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId: currentLead?.pipedriveDealId, stageId: selectedStageId })
        });
        addActionLog('Etapa actualizada en Pipedrive');
      }

      await logCallToPipedrive({
        resultado: selectedOutcome,
        notas: callNotes,
        proximaAccion: outcomeDef.label,
        status: 'completed',
        duracion: duration,
        nextTaskDate: followUpInfo.nextTaskDate || '',
        nextTaskTime: followUpInfo.nextTaskTime || '',
        nextTaskType: followUpInfo.nextTaskType || ''
      });

      if (isLost && selectedLostReason) {
        await csrfFetch('/api/pipedrive-deal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dealId: currentLead?.pipedriveDealId,
            status: 'lost',
            lostReasonId: selectedLostReason
          })
        });
        addActionLog('Negocio marcado como perdido en Pipedrive');
      }

      const forceDone = isPositive || isLost || isFuture;
      const completionRes = await csrfFetch('/api/campaign-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignKey: currentLead?.campaignKey,
          dealId: currentLead?.pipedriveDealId,
          outcome: selectedOutcome,
          email,
          idToken,
          forceDone,
          nextAttemptAt
        })
      });
      const completionData = await completionRes.json();
      const statusResult = completionData?.status || (forceDone ? 'done' : 'pending');
      const isFinalOutcome = statusResult === 'done';
      if (isFinalOutcome) {
        completedDealsRef.current.add(String(currentLead?.pipedriveDealId));
        setCampaigns((prev) =>
          prev.map((campaign) => {
            if (campaign.campaign_key !== currentLead?.campaignKey) return campaign;
            const handled = (campaign.handled || 0) + 1;
            const pending = Math.max((campaign.pending || 0) - 1, 0);
            return { ...campaign, handled, pending };
          })
        );
      }

      trackEvent('call_outcome_selected', {
        dealId: currentLead?.pipedriveDealId,
        outcome: selectedOutcome,
        duration,
        period: timeBucket.period,
        block: timeBucket.block
      });

      if (isFinalOutcome) {
        trackEvent('lead_completed', {
          dealId: currentLead?.pipedriveDealId,
          outcome: selectedOutcome
        });
      } else {
        trackEvent('lead_deferred', {
          dealId: currentLead?.pipedriveDealId,
          outcome: selectedOutcome,
          nextAttemptAt
        });
      }

      addToHistory({
        leadId: currentLead?.leadId,
        nombre: currentLead?.nombre,
        telefono: currentLead?.telefono,
        dealId: currentLead?.pipedriveDealId,
        timestamp: new Date(),
        duracion: duration,
        resultado: selectedOutcome,
        notas: callNotes,
        status: isFinalOutcome ? 'completed' : 'pending'
      });

      setShowPostCallForm(false);
      resetOutcomeForm();
      setCallDuration(0);
      callDurationRef.current = 0;
      setNextLead(null);
      updateStatus('ready', 'Listo');
      autoCallCancelCountRef.current = 0;
      loadNextLead(false, { autoCall: true });
    } catch (error) {
      console.error('Error guardando resultado:', error);
      showActionToast('No se pudo guardar el resultado. Intenta de nuevo.');
    }
  };

  const handleRetryNow = () => {
    setShowPostCallForm(false);
    resetOutcomeForm();
    setCallDuration(0);
    callDurationRef.current = 0;
    updateStatus('ready', 'Listo');
    autoCallCancelCountRef.current = 0;
    startAutoCallCountdown(3, 'Reintentando en');
  };

  const cancelOutcomeForm = () => {
    setShowPostCallForm(false);
    resetOutcomeForm();
    setCallDuration(0);
    callDurationRef.current = 0;
    updateStatus('ready', 'Listo');
  };

  const openSkipForm = () => {
    if (!currentLead || isLeadLoading || !campaignJoined) return;
    clearAutoCallCountdown();
    setShowSkipForm(true);
    setShowPostCallForm(false);
    setSkipReason('');
  };

  const submitSkipForm = async () => {
    if (!skipReason) {
      alert('Selecciona un motivo para saltar el lead');
      return;
    }
    if (!currentLead?.campaignKey || !currentLead?.pipedriveDealId) {
      return;
    }
    try {
      await logCallToPipedrive({
        resultado: skipReason,
        notas: 'Lead saltado sin llamada',
        proximaAccion: 'Salto manual',
        status: 'skipped',
        duracion: 0
      });
      const res = await csrfFetch('/api/campaign-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignKey: currentLead.campaignKey,
          dealId: currentLead.pipedriveDealId,
          outcome: skipReason,
          skip: true,
          forceDone: true,
          email,
          idToken
        })
      });
      if (res.ok) {
        const data = await res.json();
        const statusResult = data?.status || 'done';
        if (statusResult === 'done') {
          completedDealsRef.current.add(String(currentLead.pipedriveDealId));
          setCampaigns((prev) =>
            prev.map((campaign) => {
              if (campaign.campaign_key !== currentLead.campaignKey) return campaign;
              const handled = (campaign.handled || 0) + 1;
              const pending = Math.max((campaign.pending || 0) - 1, 0);
              return { ...campaign, handled, pending };
            })
          );
        }
        addToHistory({
          leadId: currentLead?.leadId,
          nombre: currentLead?.nombre,
          telefono: currentLead?.telefono,
          dealId: currentLead?.pipedriveDealId,
          timestamp: new Date(),
          duracion: 0,
          resultado: skipReason,
          notas: '',
          status: statusResult === 'done' ? 'skipped' : 'pending'
        });
        trackEvent('lead_skipped', {
          dealId: currentLead?.pipedriveDealId,
          reason: skipReason
        });
      } else {
        showActionToast('No se pudo saltar el lead. Intenta de nuevo.');
        return;
      }
    } catch (error) {
      console.error('Error saltando lead:', error);
      showActionToast('No se pudo saltar el lead. Intenta de nuevo.');
      return;
    }
    setShowSkipForm(false);
    setSkipReason('');
    setNextLead(null);
    updateStatus('ready', 'Listo');
    autoCallCancelCountRef.current = 0;
    loadNextLead(false, { autoCall: true });
  };

  const cancelSkipForm = () => {
    setShowSkipForm(false);
    setSkipReason('');
  };

  const handleJoinCampaign = async () => {
    if (!selectedCampaignKey) {
      showActionToast('Selecciona una campaña para unirte.');
      return;
    }
    clearAutoCallCountdown();
    resetOutcomeForm();
    setShowPostCallForm(false);
    setCampaignJoined(true);
    campaignJoinedRef.current = true;
    setCampaignStartAt(new Date());
    setCampaignElapsed(0);
    setCampaignCallSeconds(0);
    try {
      const res = await csrfFetch('/api/campaign-session-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignKey: selectedCampaignKey,
          email,
          idToken
        })
      });
      const data = await res.json();
      if (res.ok && data.sessionId) {
        setCampaignSessionId(data.sessionId);
      }
    } catch (error) {
      console.error('Error iniciando sesion de campaña:', error);
    }
    trackEvent('campaign_joined', { campaignKey: selectedCampaignKey }, { allowWhenNotJoined: true });
    autoCallCancelCountRef.current = 0;
    loadNextLead(true, { autoCall: true });
  };

  const logCallToPipedrive = async ({ resultado, notas, proximaAccion, status, duracion, nextTaskDate, nextTaskTime, nextTaskType }) => {
    if (!currentLead?.pipedriveDealId) {
      return;
    }

    try {
      const res = await csrfFetch('/api/pipedrive-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: currentLead.pipedriveDealId,
          lead: {
            nombre: currentLead.nombre,
            telefono: currentLead.telefono
          },
          resultado,
          notas,
          proximaAccion,
          nextTaskDate,
          nextTaskTime,
          nextTaskType,
          duracion,
          status
        })
      });
      if (res.ok) {
        const data = await res.json();
        addActionLog('Registro de llamada guardado en Pipedrive');
        addActionLog('Nota guardada en Pipedrive');
        if (data && currentLead) {
          setCurrentLead((prev) => {
            if (!prev) return prev;
            let openActivities = (prev.pipedrive && prev.pipedrive.openActivities) ? [...prev.pipedrive.openActivities] : [];
            if (data.closedActivity && data.closedActivity.id) {
              openActivities = openActivities.filter((activity) => activity.id !== data.closedActivity.id);
            }
            if (data.followUp && data.followUp.activityId) {
              openActivities.unshift({
                id: data.followUp.activityId,
                subject: `Seguimiento: ${nextTaskType || 'tarea'}`,
                due_date: nextTaskDate || null,
                due_time: nextTaskTime || '',
                done: 0,
                type: nextTaskType || 'task'
              });
              addActionLog('Tarea futura creada en Pipedrive');
            }
            return {
              ...prev,
              pipedrive: {
                ...(prev.pipedrive || {}),
                openActivities
              }
            };
          });
        }
      }
      return { ok: true };
    } catch (error) {
      console.error('Error registrando en Pipedrive:', error);
    }
    return null;
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

  const getWhatsappLink = (phone) => {
    const digits = (phone || '').replace(/\D/g, '');
    return `https://wa.me/${digits}`;
  };

  const stripHtml = (value) => {
    if (!value) return '';
    return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  };

  const getTaskBuckets = (lead) => {
    const activities = lead?.pipedrive?.openActivities || [];
    if (activities.length === 0) {
      return { overdue: [], upcoming: [] };
    }
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...activities].sort((a, b) => {
      const dateA = a.due_date || '9999-12-31';
      const dateB = b.due_date || '9999-12-31';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      const timeA = a.due_time || '99:99';
      const timeB = b.due_time || '99:99';
      return timeA.localeCompare(timeB);
    });
    const overdue = sorted.filter((activity) => activity.due_date && activity.due_date < today);
    const upcoming = sorted.filter((activity) => !activity.due_date || activity.due_date >= today);
    return { overdue, upcoming };
  };

  const getTaskTiming = (activity) => {
    if (!activity?.due_date) {
      return { label: 'Hoy', tone: 'today' };
    }
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dueTime = activity.due_time && String(activity.due_time).length ? activity.due_time : '23:59';
    const dueDt = new Date(`${activity.due_date}T${dueTime}:00`);
    if (activity.due_date > todayStr) {
      return { label: 'Futura', tone: 'future' };
    }
    if (activity.due_date < todayStr || dueDt < now) {
      return { label: 'Vencida', tone: 'overdue' };
    }
    return { label: 'Hoy', tone: 'today' };
  };

  const getNextOpenActivity = (lead) => {
    const activities = lead?.pipedrive?.openActivities || [];
    if (activities.length === 0) return null;
    const sorted = [...activities].sort((a, b) => {
      const dateA = a.due_date || '9999-12-31';
      const dateB = b.due_date || '9999-12-31';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      const timeA = a.due_time || '99:99';
      const timeB = b.due_time || '99:99';
      return timeA.localeCompare(timeB);
    });
    return sorted[0];
  };

  const isTextInput = (target) => {
    if (!target) return false;
    const tag = target.tagName ? target.tagName.toLowerCase() : '';
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  };

  const filteredDealUsers = dealUsers.filter((user) => {
    if (!userSearch.trim()) return true;
    const name = (user.name || '').toLowerCase();
    return name.includes(userSearch.trim().toLowerCase());
  });

  const showActionToast = (message) => {
    setActionToast(message);
    setTimeout(() => setActionToast(''), 2000);
  };

  const addActionLog = (message) => {
    const entry = { id: `${Date.now()}-${Math.random()}`, message, at: new Date() };
    setActionLog((prev) => [entry, ...prev].slice(0, 8));
  };

  const handleCopy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      showActionToast(`${label} copiado`);
    } catch (error) {
      console.error('Error copiando al portapapeles:', error);
      showActionToast('No se pudo copiar');
    }
  };

  const handleOwnerChange = async (ownerId) => {
    if (!currentLead?.pipedriveDealId || !ownerId) return;
    try {
      setIsOwnerUpdating(true);
      const res = await csrfFetch('/api/pipedrive-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: currentLead.pipedriveDealId, ownerId })
      });
      if (res.ok) {
        showActionToast('Responsable actualizado');
        addActionLog('Responsable cambiado en Pipedrive');
        setOwnerEditOpen(false);
        setUserSearch('');
        refreshLeadContext(currentLead);
      } else {
        showActionToast('No se pudo actualizar responsable');
      }
    } catch (error) {
      console.error('Error actualizando responsable:', error);
      showActionToast('Error actualizando responsable');
    } finally {
      setIsOwnerUpdating(false);
    }
  };

  const markNextTaskDone = async (activityId) => {
    if (!activityId || !currentLead?.pipedrive) {
      return;
    }
    const activity = currentLead.pipedrive.openActivities?.find((item) => item.id === activityId);
    if (!activity) {
      return;
    }

    const doneStamp = new Date();
    const optimisticDone = {
      ...activity,
      done: true,
      marked_as_done_time: doneStamp.toISOString(),
      update_time: doneStamp.toISOString()
    };

    setCurrentLead((prev) => {
      if (!prev?.pipedrive) return prev;
      const openActivities = (prev.pipedrive.openActivities || []).filter((item) => item.id !== activityId);
      const recentDone = [optimisticDone, ...(prev.pipedrive.activities || [])]
        .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index)
        .slice(0, 2);
      return {
        ...prev,
        pipedrive: {
          ...prev.pipedrive,
          openActivities,
          activities: recentDone
        }
      };
    });

    try {
      setActivityUpdatingId(activityId);
      const res = await csrfFetch('/api/pipedrive-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, done: true })
      });
      if (res.ok) {
        showActionToast('Tarea marcada como realizada');
      }
    } catch (error) {
      console.error('Error marcando actividad realizada:', error);
      setCurrentLead((prev) => {
        if (!prev?.pipedrive) return prev;
        const openActivities = [activity, ...(prev.pipedrive.openActivities || [])]
          .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
        const activities = (prev.pipedrive.activities || []).filter((item) => item.id !== activityId);
        return {
          ...prev,
          pipedrive: {
            ...prev.pipedrive,
            openActivities,
            activities
          }
        };
      });
      showActionToast('No se pudo completar la tarea');
    } finally {
      setActivityUpdatingId(null);
    }
  };

  const handleLogout = () => {
    if (campaignSessionId) {
      csrfFetch('/api/campaign-session-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: campaignSessionId,
          activeSeconds: campaignElapsed,
          callSeconds: campaignCallSeconds,
          idleSeconds: 0,
          status: 'closed',
          email,
          idToken
        })
      }).catch((error) => console.error('Error cerrando sesion de campaña:', error));
    }
    clearSession();
    autoStartRef.current = false;
    setSessionStarted(false);
    setUserRole('ejecutivo');
    setIdToken('');
    setAuthError('');
    setTwilioDevice(null);
    setActiveCall(null);
    activeCallRef.current = null;
    setIsCallInProgress(false);
    setCallStatus('');
    setCallState('idle');
    setStatusHistory([]);
    statusRef.current = 'idle';
    setCurrentLead(null);
    setCallHistory([]);
    setCallDuration(0);
    setShowPostCallForm(false);
    resetOutcomeForm();
    clearAutoCallCountdown();
    setIsMuted(false);
    setReadiness({ email: 'idle', audio: 'idle', pipedrive: 'idle' });
    setPrevLeads([]);
    setNextLead(null);
    setLastCallSnapshot(null);
    setActivityUpdatingId(null);
    setOwnerEditOpen(false);
    setUserSearch('');
    setIsOwnerUpdating(false);
    setDealUsers([]);
    setActionLog([]);
    setCampaignJoined(false);
    setCampaignStartAt(null);
    setCampaignElapsed(0);
    setCampaignSessionId(null);
    setCampaignCallSeconds(0);
  };

  const trackEvent = async (eventType, payload = {}, options = {}) => {
    const campaignKey = payload.campaignKey || selectedCampaignKey;
    if (!campaignKey || !email || !idToken) return;
    if (!campaignJoined && !options.allowWhenNotJoined) return;
    try {
      await csrfFetch('/api/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          campaignKey,
          dealId: payload.dealId,
          metadata: payload,
          email,
          idToken
        })
      });
    } catch (error) {
      console.error('Error enviando evento:', eventType, error);
    }
  };

  const countries = [
    { code: 'CO', name: 'Colombia', flag: 'CO' },
    { code: 'MX', name: 'Mexico', flag: 'MX' },
    { code: 'CL', name: 'Chile', flag: 'CL' }
  ];
  const getCountryName = (code) => countries.find((c) => c.code === code)?.name || code;

  const updateStatus = (key, label) => {
    if (statusRef.current === key) {
      setCallStatus(label);
      return;
    }
    statusRef.current = key;
    setCallState(key);
    setCallStatus(label);
    setStatusHistory((prev) => [...prev, { key, label, at: new Date() }].slice(-6));
  };

  const attachCallHandlers = (call) => {
    if (!call) return;
    console.log('📞 Llamada INICIADA (call object)');
    console.log('Call status:', call.status());
    console.log('Call parameters:', call.parameters);
    console.log('🔊 Audio enabled:', call.isMuted() ? 'MUTED' : 'UNMUTED');

    setActiveCall(call);
    activeCallRef.current = call;
    callConnectedRef.current = false;
    userHangupRef.current = false;
    updateStatus('connecting', 'Conectando');

    call.on('accept', () => {
      console.log('✅ Llamada ACEPTADA - Cliente contestó');
      console.log('🔊 Verificando audio...');
      console.log('  Muted:', call.isMuted());
      console.log('  Volume:', call.volume || 'default');

      if (call.isMuted()) {
        console.log('⚠️ Llamada estaba muteada, desmuteando...');
        call.mute(false);
      }

      console.log('🔊 Cliente contestó - Iniciando timer...');
      autoCallCancelCountRef.current = 0;
      callConnectedRef.current = true;
      startCallTimer();
      updateStatus('in_call', 'En llamada');
    });

    call.on('disconnect', async () => {
      console.log('📴 Llamada desconectada');
      setActiveCall(null);
      activeCallRef.current = null;
      setIsCallInProgress(false);
      const duration = callDurationRef.current || 0;
      if (userHangupRef.current) {
        updateStatus('ended_user', 'Colgaste tu');
      } else if (callConnectedRef.current) {
        updateStatus('ended_remote', 'Colgo cliente');
      } else {
        updateStatus('no_answer', 'No contesta');
      }
      if (duration > 0) {
        setCampaignCallSeconds((prev) => prev + duration);
      }
      const timeBucket = getTimeBucket(getLeadTimezone());
      trackEvent('call_ended', {
        dealId: currentLead?.pipedriveDealId,
        duration,
        connected: callConnectedRef.current,
        outcome: callConnectedRef.current ? 'connected' : 'no_answer',
        period: timeBucket.period,
        block: timeBucket.block
      });
      if (callConnectedRef.current && callDurationRef.current > 0) {
        console.log('Mostrando formulario post-llamada (duración:', callDurationRef.current, 'segundos)');
        openOutcomeForm();
      } else {
        console.log('Llamada no conectó, mostrando resultado No contesta');
        openOutcomeForm({ mode: 'negative', outcome: NO_CONTESTA_KEY });
      }
    });

    call.on('cancel', async () => {
      console.log('🚫 Llamada cancelada');
      setActiveCall(null);
      activeCallRef.current = null;
      setIsCallInProgress(false);
      stopCallTimer();
      updateStatus('cancelled', 'Cancelada');
      const duration = callDurationRef.current || 0;
      if (duration > 0) {
        setCampaignCallSeconds((prev) => prev + duration);
      }
      const timeBucket = getTimeBucket(getLeadTimezone());
      trackEvent('call_ended', {
        dealId: currentLead?.pipedriveDealId,
        duration,
        connected: false,
        outcome: 'cancelled',
        period: timeBucket.period,
        block: timeBucket.block
      });
      openOutcomeForm({ mode: 'negative', outcome: NO_CONTESTA_KEY });
    });

    call.on('reject', async () => {
      console.log('❌ Llamada rechazada');
      setActiveCall(null);
      activeCallRef.current = null;
      setIsCallInProgress(false);
      stopCallTimer();
      updateStatus('rejected', 'Rechazada');
      const duration = callDurationRef.current || 0;
      if (duration > 0) {
        setCampaignCallSeconds((prev) => prev + duration);
      }
      const timeBucket = getTimeBucket(getLeadTimezone());
      trackEvent('call_ended', {
        dealId: currentLead?.pipedriveDealId,
        duration,
        connected: false,
        outcome: 'rejected',
        period: timeBucket.period,
        block: timeBucket.block
      });
      openOutcomeForm({ mode: 'negative', outcome: NO_CONTESTA_KEY });
    });

    call.on('ringing', () => {
      console.log('📞 Timbrando...');
      updateStatus('ringing', 'Timbrando');
    });

    call.on('audio', () => {
      console.log('🔊 Audio stream iniciado - Llamada conectada');
      if (!callTimerRef.current) {
        console.log('🔊 Iniciando timer en evento audio...');
        callConnectedRef.current = true;
        startCallTimer();
      }
      updateStatus('in_call', 'En llamada');
    });

    call.on('warning', (warningName, warningData) => {
      console.log('⚠️ Warning:', warningName, warningData);
    });

    call.on('error', async (error) => {
      console.error('❌ Error en call:', error);
      setIsCallInProgress(false);
      updateStatus('error', 'Error');
      openOutcomeForm({ mode: 'negative', outcome: NO_CONTESTA_KEY });
    });
  };

  useEffect(() => {
    readinessTimerRef.current.forEach((timer) => clearTimeout(timer));
    readinessTimerRef.current = [];

    if (sessionStarted) {
      return;
    }

    setReadiness({ email: 'validating', audio: 'idle', pipedrive: 'idle' });

    const emailTimer = setTimeout(() => {
      setReadiness({ email: 'done', audio: 'validating', pipedrive: 'idle' });
    }, 700);

    const audioTimer = setTimeout(() => {
      setReadiness({ email: 'done', audio: 'done', pipedrive: 'validating' });
    }, 1400);

    const pipedriveTimer = setTimeout(() => {
      setReadiness({ email: 'done', audio: 'done', pipedrive: 'done' });
    }, 2100);

    readinessTimerRef.current.push(emailTimer, audioTimer, pipedriveTimer);

    return () => {
      readinessTimerRef.current.forEach((timer) => clearTimeout(timer));
      readinessTimerRef.current = [];
    };
  }, [sessionStarted]);

  const readinessItems = [
    { key: 'email', title: 'Acceso seguro', icon: Shield },
    { key: 'audio', title: 'Audio estable', icon: Headphones },
    { key: 'pipedrive', title: 'Seguimiento rapido', icon: BarChart3 }
  ];

  const readinessList = (
    <div className="readiness-panel">
      <div className="readiness-list">
        {readinessItems.map((item, index) => {
          const status = readiness[item.key];
          const isValidating = status !== 'done';
          const isDone = status === 'done';
          const isVisible = status !== 'idle';
          return (
            <div
              className={`readiness-item ${isVisible ? 'show' : ''}`}
              key={item.key}
              style={{ transitionDelay: `${index * 120}ms` }}
            >
              <span className="readiness-icon"><item.icon className="icon" /></span>
              <span className="readiness-title">{item.title}</span>
              <span className={`status-pill ${isDone ? 'active' : ''}`}>
                {isValidating ? <Loader2 className="icon-sm spin" /> : <CheckCircle2 className="icon-sm" />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const POSITIVE_BUCKETS = new Set(['interesado', 'agendado', 'publicada', 'reservada', 'arrendada']);
  const NO_CONTESTA_KEY = 'no_contesta';
  const FUTURE_KEY = 'disponibilidad_futura';
  const LOST_KEYS = new Set(['informacion_falsa', 'le_parece_caro', 'intentos_max']);
  const DEFAULT_OUTCOMES = [
    { key: 'interesado', label: 'Interesado', outcome_type: 'final', metric_bucket: 'interesado' },
    { key: 'fotos_agendadas', label: 'Fotos agendadas', outcome_type: 'final', metric_bucket: 'agendado' },
    { key: 'propiedad_publicada', label: 'Propiedad publicada', outcome_type: 'final', metric_bucket: 'publicada' },
    { key: 'propiedad_reservada', label: 'Propiedad reservada', outcome_type: 'final', metric_bucket: 'reservada' },
    { key: 'propiedad_arrendada', label: 'Propiedad arrendada', outcome_type: 'final', metric_bucket: 'arrendada' },
    { key: 'no_contesta', label: 'No contesta', outcome_type: 'intermediate', metric_bucket: 'no_contesta' },
    { key: 'disponibilidad_futura', label: 'Disponibilidad futura', outcome_type: 'intermediate', metric_bucket: 'futuro' },
    { key: 'informacion_falsa', label: 'Información falsa', outcome_type: 'final', metric_bucket: 'falso' },
    { key: 'le_parece_caro', label: 'Le parece caro', outcome_type: 'final', metric_bucket: 'caro' },
    { key: 'intentos_max', label: 'Intentos máximos', outcome_type: 'final', metric_bucket: 'perdido' }
  ];
  const allOutcomes = useMemo(() => {
    const map = new Map();
    DEFAULT_OUTCOMES.forEach((item) => map.set(item.key, item));
    (callOutcomes || []).forEach((item) => map.set(item.key, item));
    return Array.from(map.values());
  }, [callOutcomes]);
  const positiveOutcomes = allOutcomes.filter((item) => POSITIVE_BUCKETS.has(item.metric_bucket));
  const negativeOutcomes = allOutcomes.filter((item) => !POSITIVE_BUCKETS.has(item.metric_bucket));
  const MAX_GESTIONS = Number(process.env.NEXT_PUBLIC_DIALER_MAX_GESTIONS || 5);

  const totalCalls = callHistory.length;
  const isContactado = (resultado) => POSITIVE_BUCKETS.has(
    (allOutcomes.find((item) => item.key === resultado)?.metric_bucket) || ''
  );
  const contactadosCount = callHistory.filter(call => isContactado(call.resultado)).length;
  const noContestaCount = callHistory.filter(call => call.resultado === 'no_contesta').length;
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.campaign_key === selectedCampaignKey) || null,
    [campaigns, selectedCampaignKey]
  );
  const campaignHandled = selectedCampaign?.handled || 0;
  const campaignPending = selectedCampaign?.pending || 0;
  const campaignTotal = selectedCampaign ? campaignHandled + campaignPending : 0;
  const campaignProgress = campaignTotal ? Math.round((campaignHandled / campaignTotal) * 100) : 0;
  const sleepingLeads = campaignAvailability?.cooldown || 0;
  const selectedOutcomeDef = selectedOutcome ? getOutcomeByKey(selectedOutcome) : null;
  const outcomeIsPositive = selectedOutcomeDef ? POSITIVE_BUCKETS.has(selectedOutcomeDef.metric_bucket) : false;
  const outcomeIsNoContesta = selectedOutcome === NO_CONTESTA_KEY;
  const outcomeIsFuture = selectedOutcome === FUTURE_KEY;
  const outcomeIsLost = selectedOutcome
    ? LOST_KEYS.has(selectedOutcome) || (outcomeIsFuture && availabilityDecision === 'lose')
    : false;
  const outcomeRequiresStage = selectedOutcome
    ? (outcomeIsPositive && isNoContestaStage()) || (outcomeIsFuture && availabilityDecision === 'move')
    : false;
  const showStageSelector = selectedOutcome
    ? outcomeIsPositive || (outcomeIsFuture && availabilityDecision === 'move')
    : false;
  const isSaveDisabled =
    !selectedOutcome ||
    (outcomeIsNoContesta && !retryDelay) ||
    (outcomeIsFuture && !futureDelay) ||
    (outcomeRequiresStage && !selectedStageId) ||
    (outcomeIsLost && !selectedLostReason);

  if (!isSessionReady) {
    return (
      <>
        <Head>
          <title>Dialer Houm</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="session-boot">
          <Loader2 className="icon-sm spin" />
          <span>Preparando sesion...</span>
        </div>
        <style jsx>{`
          .session-boot {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            color: var(--text-muted);
            font-weight: 600;
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Dialer Houm</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="https://getonbrd-prod.s3.amazonaws.com/uploads/users/logo/8588/Isotipo_Houm_Square_Negativo__1_.jpg" />
        <link rel="apple-touch-icon" href="https://getonbrd-prod.s3.amazonaws.com/uploads/users/logo/8588/Isotipo_Houm_Square_Negativo__1_.jpg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        :global(body) {
          background: var(--bg);
          margin: 0;
          padding: 0;
          color: var(--text-primary);
          overflow-x: hidden;
          --bg: #0f0f1e;
          --surface: #1a1a2e;
          --surface-alt: #0f0f1e;
          --border: #2a2a3e;
          --border-strong: #3a3a4e;
          --text-primary: #ffffff;
          --text-muted: #a8a8b8;
          --accent: #f9472f;
          --accent-strong: #d93a1f;
          --success: #00c853;
          --success-strong: #00a843;
          --danger: #f44336;
          --danger-strong: #d32f2f;
        }
        :global(body[data-theme='dark']) {
          --bg: #0f0f1e;
          --surface: #1a1a2e;
          --surface-alt: #0f0f1e;
          --border: #2a2a3e;
          --border-strong: #3a3a4e;
          --text-primary: #ffffff;
          --text-muted: #a8a8b8;
          --accent: #f9472f;
          --accent-strong: #d93a1f;
          --success: #00c853;
          --success-strong: #00a843;
          --danger: #f44336;
          --danger-strong: #d32f2f;
          --call-icon-bg: rgba(255, 255, 255, 0.2);
        }
        :global(body[data-theme='light']) {
          --bg: #f6f2ee;
          --surface: #ffffff;
          --surface-alt: #f1ece7;
          --border: #e5dcd4;
          --border-strong: #d7cbc1;
          --text-primary: #231f20;
          --text-muted: #6f6660;
          --accent: #f9472f;
          --accent-strong: #d93a1f;
          --success: #00c853;
          --success-strong: #00a843;
          --danger: #f44336;
          --danger-strong: #d32f2f;
          --call-icon-bg: rgba(0, 0, 0, 0.08);
        }
        .container {
          max-width: 1040px;
          margin: 0 auto;
          padding: 28px 20px 80px;
          min-height: 100vh;
          position: relative;
        }
        .icon {
          width: 18px;
          height: 18px;
          stroke-width: 1.8;
        }
        .icon-sm {
          width: 14px;
          height: 14px;
        }
        .icon-lg {
          width: 22px;
          height: 22px;
        }
        .spin {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .background-orb {
          position: absolute;
          width: 280px;
          height: 280px;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0.35;
          z-index: 0;
        }
        .orb-1 {
          top: -80px;
          left: -80px;
          background: radial-gradient(circle, rgba(249, 71, 47, 0.6), transparent 70%);
        }
        .orb-2 {
          bottom: 60px;
          right: -60px;
          background: radial-gradient(circle, rgba(0, 200, 83, 0.5), transparent 70%);
        }
        .content {
          position: relative;
          z-index: 1;
        }
        .header {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
          color: white;
          padding: 18px 20px;
          border-radius: 16px;
          margin-bottom: 18px;
          box-shadow: 0 8px 24px rgba(249, 71, 47, 0.3);
        }
        .header-content {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: space-between;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .header-nav {
          flex: 1;
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .nav-link {
          display: inline-flex;
          align-items: center;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
          transition: transform 0.15s ease, background-color 0.15s ease;
        }
        .nav-link:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.2);
        }
        .nav-link.active {
          background: rgba(7, 11, 26, 0.28);
          border-color: rgba(7, 11, 26, 0.45);
        }
        .header-actions {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.25);
          padding: 6px 8px;
          border-radius: 999px;
          backdrop-filter: blur(8px);
        }
        .logout-btn {
          border: none;
          background: rgba(0, 0, 0, 0.18);
          color: #fff;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .logout-btn:hover {
          background: rgba(0, 0, 0, 0.28);
        }
        .theme-toggle {
          border: none;
          background: transparent;
          padding: 0;
          cursor: pointer;
        }
        .theme-track {
          width: 56px;
          height: 30px;
          background: rgba(255, 255, 255, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 999px;
          display: flex;
          align-items: center;
          padding: 4px;
          position: relative;
          transition: background 0.3s ease, border 0.3s ease;
        }
        .theme-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          transform: translateX(0);
          transition: transform 0.3s ease;
        }
        .theme-thumb svg {
          width: 12px;
          height: 12px;
          color: #1f1f2e;
        }
        .theme-track.light {
          background: rgba(0, 0, 0, 0.2);
          border-color: rgba(0, 0, 0, 0.2);
        }
        .theme-track.light .theme-thumb {
          transform: translateX(26px);
        }
        .logo {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .header-text h1 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 2px 0;
          letter-spacing: -0.5px;
        }
        .header-text p {
          font-size: 12px;
          margin: 0;
          opacity: 0.9;
          font-weight: 400;
        }
        .card {
          background: var(--surface);
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          margin-bottom: 16px;
          border: 1px solid var(--border);
        }
        .card.compact {
          padding: 20px;
        }
        .login-grid {
          display: grid;
          gap: 18px;
          grid-template-columns: minmax(0, 1fr);
        }
        .login-brand {
          display: grid;
          justify-items: center;
        }
        .login-brand-logo {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          box-shadow:
            0 18px 30px rgba(255, 122, 41, 0.35),
            0 0 0 1px rgba(255, 160, 92, 0.45);
        }
        .login-card {
          max-width: 720px;
          margin: 0 auto;
          padding: 28px 28px 22px;
          position: relative;
          overflow: hidden;
          border-color: rgba(255, 122, 41, 0.55);
          background:
            radial-gradient(120% 120% at 0% 0%, rgba(255, 122, 41, 0.18) 0%, rgba(255, 122, 41, 0.02) 55%, transparent 100%),
            var(--surface);
          box-shadow:
            0 24px 60px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(255, 122, 41, 0.35),
            0 0 32px rgba(255, 122, 41, 0.28);
        }
        .login-card::after {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 18px;
          pointer-events: none;
          border: 1px solid rgba(255, 161, 85, 0.55);
          box-shadow: inset 0 0 24px rgba(255, 122, 41, 0.18);
          opacity: var(--login-glow, 1);
        }
        .login-header {
          display: flex;
          justify-content: center;
          text-align: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .login-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .login-subtitle {
          margin: 0 0 18px 0;
          color: var(--text-muted);
          font-size: 13.5px;
          text-align: center;
          position: relative;
          z-index: 1;
        }
        .login-google {
          position: relative;
          z-index: 1;
          margin-bottom: 14px;
        }
        .google-btn {
          display: grid;
          justify-content: center;
        }
        .login-google-hint {
          text-align: center;
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 6px;
          font-weight: 600;
        }
        .auth-panel {
          border: 1px solid var(--border);
          background: var(--surface-alt);
          border-radius: 14px;
          padding: 12px;
          display: grid;
          gap: 8px;
        }
        .auth-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .auth-meta {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .auth-meta strong {
          color: var(--text-primary);
        }
        .mini-btn {
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-primary);
          padding: 6px 10px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .mini-btn:hover {
          border-color: var(--accent);
        }
        .login-info-list {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 8px;
          margin: 12px 0 10px;
        }
        .login-info-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 2px;
          border: 0;
          background: transparent;
        }
        .login-info-icon {
          width: auto;
          height: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 0;
          color: var(--text-primary);
          flex-shrink: 0;
        }
        .login-info-text {
          display: flex;
          align-items: baseline;
          gap: 6px;
          min-width: 0;
          flex-wrap: wrap;
        }
        .login-info-label {
          font-size: 13.5px;
          color: var(--text-muted);
          text-transform: none;
          letter-spacing: 0;
          font-weight: 700;
        }
        .login-info-value {
          font-size: 13.8px;
          color: var(--text-primary);
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }
        .login-info-value .muted {
          color: var(--text-muted);
          font-weight: 600;
          font-size: 12.5px;
        }
        .login-inline-action {
          margin-left: 2px;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--accent-strong);
          text-decoration: none;
        }
        .login-inline-action:hover {
          text-decoration: underline;
        }
        .login-version {
          margin-top: 8px;
          text-align: center;
          font-size: 11.5px;
          color: var(--text-muted);
          position: relative;
          z-index: 1;
        }
        .login-loading {
          display: grid;
          justify-items: center;
          gap: 8px;
          padding: 18px 0 8px;
        }
        .login-loading .spin {
          width: 20px;
          height: 20px;
        }
        .login-loading-text {
          font-size: 12.5px;
          color: var(--text-muted);
          text-align: center;
          font-weight: 600;
        }
        .readiness-panel {
          margin-top: 16px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: var(--text-muted);
        }
        .status-pill.active {
          color: var(--success);
          border-color: rgba(0, 200, 83, 0.5);
          background: rgba(0, 200, 83, 0.12);
        }
        .readiness-list {
          display: grid;
          gap: 6px;
        }
        .readiness-item {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 8px 6px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid transparent;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .readiness-item.show {
          opacity: 1;
          transform: translateY(0);
        }
        .readiness-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.08);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--text-primary);
        }
        .readiness-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0 0 24px 0;
          font-size: 24px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .section-title .icon-badge {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
          box-shadow: 0 6px 16px rgba(249, 71, 47, 0.35);
          font-size: 16px;
          color: #fff;
        }
        .form-group {
          margin-bottom: 14px;
        }
        .form-error {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(244, 67, 54, 0.12);
          border: 1px solid rgba(244, 67, 54, 0.35);
          color: var(--danger);
          font-weight: 600;
          font-size: 12px;
        }
        .outcome-lead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }
        .outcome-lead .lead-name {
          font-size: 20px;
          font-weight: 700;
        }
        .outcome-lead .lead-phone {
          font-size: 15px;
          color: var(--accent);
          font-weight: 600;
        }
        .outcome-lead .lead-email {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .lead-email {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .call-duration {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          text-align: center;
          font-size: 12px;
          color: var(--text-muted);
          min-width: 120px;
        }
        .call-duration strong {
          display: block;
          font-size: 20px;
          color: var(--accent);
        }
        .outcome-toggle {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
        }
        .toggle-btn {
          flex: 1;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .toggle-btn.active {
          border-color: var(--accent);
          background: rgba(249, 71, 47, 0.15);
          color: var(--text-primary);
        }
        .outcome-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
        }
        .outcome-grid.compact {
          gap: 8px;
        }
        .outcome-pill {
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .outcome-pill.active {
          border-color: var(--accent);
          background: rgba(249, 71, 47, 0.18);
        }
        .retry-panel {
          margin-bottom: 16px;
        }
        .decision-row {
          display: flex;
          gap: 10px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .decision-btn {
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          font-weight: 600;
          cursor: pointer;
        }
        .decision-btn.active {
          border-color: var(--accent);
          background: rgba(249, 71, 47, 0.18);
        }
        .decision-btn.danger {
          color: var(--danger);
          border-color: rgba(244, 67, 54, 0.35);
        }
        .btn-retry {
          margin-top: 10px;
        }
        .auto-call-row {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }
        .auto-call-status {
          padding: 10px 12px;
          border-radius: 12px;
          background: var(--surface-alt);
          border: 1px solid var(--border);
          font-weight: 600;
          color: var(--text-primary);
        }
        .auto-call-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .google-btn {
          display: flex;
          justify-content: center;
          padding: 6px 0;
        }
        .auth-error {
          font-size: 12px;
          color: #ffb4aa;
          font-weight: 600;
          margin-top: 6px;
        }
        .email-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(0, 200, 83, 0.12);
          border: 1px solid rgba(0, 200, 83, 0.35);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 700;
        }
        .caller-box {
          padding: 13px 14px;
          border-radius: 12px;
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
        }
        .caller-box.loading {
          background: var(--surface-alt);
          color: var(--text-muted);
        }
        .caller-box.success {
          background: linear-gradient(135deg, var(--success) 0%, var(--success-strong) 100%);
          border-color: transparent;
          color: #fff;
          box-shadow: 0 6px 14px rgba(0, 200, 83, 0.28);
        }
        .caller-box.error {
          background: linear-gradient(135deg, var(--danger) 0%, var(--danger-strong) 100%);
          border-color: transparent;
          color: #fff;
          box-shadow: 0 6px 14px rgba(244, 67, 54, 0.28);
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: var(--text-muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .field-label {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .label-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 8px;
          background: var(--surface);
          color: var(--text-primary);
          font-size: 12px;
        }
        .country-picker {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          align-items: stretch;
        }
        .country-card {
          border: 1px solid var(--border);
          background: var(--surface-alt);
          border-radius: 16px;
          padding: 8px 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
        }
        .country-card:hover {
          border-color: var(--accent);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(249, 71, 47, 0.15);
        }
        .country-card.active {
          border-color: var(--accent);
          background: linear-gradient(135deg, rgba(249, 71, 47, 0.12), transparent);
        }
        .country-flag {
          width: 28px;
          height: 18px;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .country-flag img {
          display: block;
          pointer-events: none;
        }
        .country-name {
          font-weight: 600;
          font-size: 12px;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .country-code {
          display: none;
        }
        .country-check {
          margin-left: auto;
          color: var(--accent);
        }
        .label-icon svg {
          width: 14px;
          height: 14px;
        }
        .label-icon.small {
          width: 20px;
          height: 20px;
          font-size: 11px;
        }
        .label-icon.small svg {
          width: 12px;
          height: 12px;
        }
        select, input, textarea {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          font-size: 14px;
          box-sizing: border-box;
          background: var(--surface-alt);
          color: var(--text-primary);
          font-family: 'Poppins', sans-serif;
          transition: all 0.3s ease;
        }
        select:focus, input:focus, textarea:focus {
          outline: none;
          border-color: var(--accent);
          background: var(--surface);
          box-shadow: 0 0 0 3px rgba(249, 71, 47, 0.1);
        }
        textarea {
          resize: vertical;
          min-height: 80px;
        }
        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 50px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: 'Poppins', sans-serif;
          letter-spacing: 0.3px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .btn-small {
          padding: 8px 16px;
          font-size: 12px;
          border-radius: 999px;
          box-shadow: none;
        }
        .lead-card .btn-small {
          margin-top: 12px;
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
          color: white;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(249, 71, 47, 0.4);
        }
        .btn-full {
          width: 100%;
          justify-content: center;
        }
        .btn-call {
          background: linear-gradient(135deg, var(--success) 0%, var(--success-strong) 100%);
          color: white;
          min-width: 170px;
          height: 58px;
          border-radius: 999px;
          padding: 0 18px;
          font-size: 15px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 8px 24px rgba(0, 200, 83, 0.4);
        }
        .btn-call:hover {
          transform: scale(1.05);
          box-shadow: 0 12px 32px rgba(0, 200, 83, 0.5);
        }
        .btn-hangup {
          background: linear-gradient(135deg, var(--danger) 0%, var(--danger-strong) 100%);
          color: white;
          min-width: 170px;
          height: 58px;
          border-radius: 999px;
          padding: 0 18px;
          font-size: 15px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
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
          background: var(--surface-alt);
          color: var(--text-primary);
          border: 1px solid var(--border-strong);
        }
        .btn-secondary:hover {
          background: var(--border-strong);
          transform: translateY(-1px);
        }
        .btn-icon {
          margin-right: 8px;
          font-size: 16px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
        }
        .btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none !important;
        }
        .call-controls .btn {
          min-height: 52px;
        }
        .lead-card {
          background: linear-gradient(135deg, var(--border-strong) 0%, var(--surface) 100%);
          padding: 24px;
          border-radius: 20px;
          margin-bottom: 20px;
          border: 1px solid var(--border-strong);
        }
        .lead-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .lead-title {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .lead-subtitle {
          font-size: 12px;
          color: var(--text-muted);
        }
        .lead-badge {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          background: rgba(0, 200, 83, 0.12);
          border: 1px solid rgba(0, 200, 83, 0.4);
          color: #7bf1a8;
        }
        .lead-badge.in-call {
          background: rgba(45, 156, 255, 0.15);
          border-color: rgba(45, 156, 255, 0.45);
          color: #86c5ff;
        }
        .lead-badge.pending {
          background: rgba(255, 176, 32, 0.18);
          border-color: rgba(255, 176, 32, 0.45);
          color: #ffd29a;
        }
        .lead-badge.idle {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
          color: var(--text-muted);
        }
        .lead-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 10px 0 12px;
        }
        .lead-meta-chip {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-primary);
          background: var(--surface-alt);
          border: 1px solid var(--border);
        }
        .next-lead-card {
          background: linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%);
          border: 1px solid var(--border-strong);
          display: grid;
          gap: 16px;
        }
        .campaign-card {
          border: 1px solid var(--border);
          background: var(--surface);
          display: grid;
          gap: 12px;
        }
        .campaign-note {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
          padding: 6px 10px;
          border-radius: 10px;
          background: var(--surface-alt);
          border: 1px dashed var(--border);
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .tooltip-trigger {
          position: relative;
          cursor: default;
        }
        .tooltip-icon {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-primary);
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .tooltip-content {
          position: absolute;
          right: 0;
          bottom: calc(100% + 10px);
          min-width: 280px;
          max-width: 360px;
          padding: 10px 12px;
          border-radius: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
          color: var(--text-primary);
          font-size: 12px;
          line-height: 1.4;
          opacity: 0;
          pointer-events: none;
          transform: translateY(6px);
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 10;
        }
        .tooltip-trigger:hover .tooltip-content,
        .tooltip-trigger:focus-within .tooltip-content {
          opacity: 1;
          transform: translateY(0);
        }
        .join-card {
          display: grid;
          gap: 12px;
        }
        .join-card p {
          margin: 0;
          color: var(--text-muted);
        }
        .audio-status-card {
          border: 1px solid var(--border);
          background: var(--surface);
          display: grid;
          gap: 12px;
        }
        .audio-status-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .audio-status-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .audio-status-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          color: var(--text-muted);
        }
        .audio-status-pill.ok {
          border-color: rgba(0, 200, 83, 0.45);
          background: rgba(0, 200, 83, 0.12);
          color: #7bf1a8;
        }
        .audio-status-pill.error {
          border-color: rgba(255, 122, 41, 0.45);
          background: rgba(255, 122, 41, 0.12);
          color: #ffb27a;
        }
        .audio-status-body {
          font-size: 12px;
          color: var(--text-muted);
        }
        .campaign-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .campaign-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .campaign-subtitle {
          font-size: 12px;
          color: var(--text-muted);
        }
        .campaign-select {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .campaign-error {
          font-size: 12px;
          color: var(--danger);
          font-weight: 600;
        }
        .next-lead-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .next-lead-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .next-lead-subtitle {
          font-size: 12px;
          color: var(--text-muted);
        }
        .next-lead-badge {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text-muted);
        }
        .next-lead-body {
          background: var(--surface);
          border-radius: 16px;
          padding: 16px;
          border: 1px solid var(--border);
          display: grid;
          gap: 6px;
        }
        .next-lead-name {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .next-lead-phone {
          font-size: 14px;
          color: var(--accent);
          font-weight: 600;
        }
        .next-lead-meta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .next-lead-empty {
          padding: 16px;
          border-radius: 14px;
          border: 1px dashed var(--border);
          background: var(--surface);
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
        }
        .audio-card {
          border: 1px solid var(--border);
          background: var(--surface);
          display: grid;
          gap: 14px;
        }
        .audio-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .audio-card-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .audio-card-hint {
          font-size: 11px;
          color: var(--text-muted);
        }
        .audio-controls {
          display: grid;
          gap: 12px;
        }
        .audio-control {
          display: grid;
          gap: 6px;
        }
        .audio-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .audio-select {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .audio-meter {
          display: grid;
          gap: 8px;
        }
        .audio-meter-track {
          height: 8px;
          background: var(--surface-alt);
          border-radius: 999px;
          border: 1px solid var(--border);
          overflow: hidden;
        }
        .audio-meter-fill {
          height: 100%;
          background: linear-gradient(90deg, rgba(0, 200, 83, 0.7), rgba(249, 71, 47, 0.85));
          border-radius: 999px;
          transition: width 0.12s ease;
        }
        .audio-meter-label {
          font-size: 11px;
          color: var(--text-muted);
        }
        .lead-name {
          font-size: 26px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
          letter-spacing: -0.5px;
        }
        .lead-phone {
          font-size: 16px;
          color: var(--accent);
          font-weight: 500;
          margin-bottom: 16px;
        }
        .lead-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 16px;
        }
        .lead-insights {
          margin-top: 16px;
          display: grid;
          gap: 12px;
        }
        .lead-insight-card {
          background: var(--surface-alt);
          padding: 14px;
          border-radius: 14px;
          border: 1px solid var(--border);
          display: grid;
          gap: 8px;
        }
        .lead-insight-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--text-muted);
        }
        .lead-insight-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .owner-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .owner-btn {
          padding: 6px 10px;
          font-size: 11px;
          min-height: 34px;
        }
        .owner-edit {
          display: grid;
          gap: 8px;
        }
        .owner-list {
          display: grid;
          gap: 6px;
          max-height: 180px;
          overflow-y: auto;
        }
        .owner-item {
          text-align: left;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .owner-item:hover {
          border-color: var(--accent);
          transform: translateY(-1px);
        }
        .lead-insight-list {
          display: grid;
          gap: 8px;
        }
        .task-list {
          display: grid;
          gap: 10px;
        }
        .task-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface);
        }
        .task-item.overdue {
          border-color: rgba(244, 67, 54, 0.4);
          background: rgba(244, 67, 54, 0.08);
        }
        .task-main {
          display: grid;
          gap: 4px;
        }
        .task-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .task-meta {
          font-size: 11px;
          color: var(--text-muted);
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .task-badge {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border: 1px solid transparent;
        }
        .task-badge.overdue {
          background: rgba(244, 67, 54, 0.2);
          color: #ff9b93;
          border-color: rgba(244, 67, 54, 0.4);
        }
        .task-badge.today {
          background: rgba(255, 171, 0, 0.18);
          color: #ffd784;
          border-color: rgba(255, 171, 0, 0.35);
        }
        .task-badge.future {
          background: rgba(0, 200, 83, 0.16);
          color: #7bf1a8;
          border-color: rgba(0, 200, 83, 0.35);
        }
        .lead-insight-item {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 10px;
          align-items: start;
          font-size: 12px;
          color: var(--text-primary);
        }
        .lead-insight-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--border-strong);
          margin-top: 6px;
        }
        .lead-insight-dot.done {
          background: var(--success);
        }
        .lead-insight-text {
          line-height: 1.4;
        }
        .lead-insight-empty {
          font-size: 12px;
          color: var(--text-muted);
        }
        .lead-info-item {
          background: var(--surface-alt);
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        .quick-actions {
          display: flex;
          gap: 10px;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          background: var(--surface-alt);
          border: 1px solid var(--border);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          border-color: var(--accent);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(249, 71, 47, 0.2);
        }
        .action-icon {
          width: 24px;
          height: 24px;
          border-radius: 8px;
          background: var(--surface);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: var(--text-primary);
        }
        .action-icon svg {
          width: 14px;
          height: 14px;
        }
        .action-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--surface);
          color: var(--text-primary);
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid var(--border);
          font-size: 13px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          z-index: 50;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: var(--overlay-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 60;
          padding: 20px;
        }
        .modal-card {
          width: min(560px, 96vw);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.45);
          display: grid;
          gap: 16px;
        }
        .modal-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .modal-subtitle {
          font-size: 12px;
          color: var(--text-muted);
        }
        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .summary-list {
          display: grid;
          gap: 10px;
        }
        .summary-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          font-size: 13px;
          color: var(--text-primary);
        }
        .summary-line span {
          color: var(--text-muted);
          font-weight: 500;
        }
        .lead-info-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .lead-info-value {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .call-timer {
          text-align: center;
          padding: 24px;
          margin: 24px 0;
        }
        .call-panel {
          margin-top: 20px;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid var(--border-strong);
          background: var(--surface-alt);
          display: grid;
          gap: 14px;
        }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .section-subtitle {
          font-size: 11px;
          color: var(--text-muted);
        }
        .call-mini-timer {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface);
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
        }
        .call-timer-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .call-timer-value {
          font-size: 48px;
          font-weight: 700;
          color: var(--accent);
          font-variant-numeric: tabular-nums;
          letter-spacing: 2px;
        }
        .call-status {
          text-align: center;
          padding: 12px 20px;
          background: linear-gradient(135deg, var(--border-strong) 0%, var(--surface) 100%);
          border-radius: 50px;
          margin: 16px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-muted);
          border: 1px solid var(--border-strong);
          letter-spacing: 0.5px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .call-status.active {
          background: linear-gradient(135deg, var(--success) 0%, var(--success-strong) 100%);
          color: #fff;
          box-shadow: 0 4px 16px rgba(0, 200, 83, 0.3);
        }
        .status-icon {
          font-size: 16px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
        }
        .call-timeline {
          margin-top: 10px;
          display: flex;
          gap: 16px;
          align-items: center;
          overflow-x: auto;
          padding-bottom: 6px;
        }
        .timeline-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .timeline-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--border-strong);
          box-shadow: inset 0 0 0 3px var(--surface-alt);
        }
        .timeline-item.active .timeline-dot {
          background: var(--accent);
          box-shadow: 0 0 0 4px rgba(249, 71, 47, 0.15);
        }
        .timeline-label {
          font-weight: 600;
        }
        .timeline-time {
          font-variant-numeric: tabular-nums;
          opacity: 0.7;
        }
        .summary-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          margin-bottom: 20px;
        }
        .summary-card {
          background: var(--surface);
          border-radius: 16px;
          border: 1px solid var(--border);
          padding: 16px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        }
        .summary-card--progress {
          flex-direction: column;
          align-items: flex-start;
        }
        .summary-meta {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .summary-card--progress .summary-meta {
          width: 100%;
        }
        .summary-icon {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          background: var(--surface-alt);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: var(--text-primary);
        }
        .summary-icon svg {
          width: 18px;
          height: 18px;
        }
        .summary-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .summary-value {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .summary-sub {
          font-size: 12px;
          color: var(--text-muted);
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .summary-subline {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          border: 1px solid var(--border);
          background: var(--surface-alt);
        }
        .summary-progress {
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: var(--border);
          overflow: hidden;
          margin-top: 12px;
        }
        .summary-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, rgba(255, 122, 41, 0.6), rgba(255, 122, 41, 1));
        }
        .summary-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .summary-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-muted);
        }
        .summary-chip.success {
          border-color: rgba(0, 200, 83, 0.5);
          color: #7bf1a8;
        }
        .summary-chip.error {
          border-color: rgba(244, 67, 54, 0.5);
          color: #ff9b93;
        }
        .dashboard-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: minmax(0, 1fr);
        }
        @media (min-width: 960px) {
          .dashboard-grid {
            grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
          }
        }
        .right-panel {
          display: grid;
          gap: 20px;
        }
        .call-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 420px;
          overflow-y: auto;
        }
        .history-item {
          background: var(--surface-alt);
          padding: 14px;
          border-radius: 12px;
          border: 1px solid var(--border-strong);
          display: grid;
          gap: 8px;
        }
        .history-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .history-name {
          font-weight: 600;
          color: var(--text-primary);
        }
        .history-meta {
          font-size: 12px;
          color: var(--text-muted);
        }
        .history-details {
          font-size: 13px;
          color: var(--text-muted);
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .history-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          background: var(--surface);
          border: 1px solid var(--border-strong);
          color: var(--text-muted);
        }
        .history-badge svg {
          width: 12px;
          height: 12px;
        }
        .call-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 12px;
          background: var(--call-icon-bg);
          font-size: 22px;
        }
        .call-icon svg {
          width: 18px;
          height: 18px;
        }
        .tabs-card {
          display: grid;
          gap: 12px;
        }
        .tabs-header {
          display: flex;
          gap: 6px;
          background: var(--surface-soft-2);
          padding: 4px;
          border-radius: 14px;
          border: 1px solid var(--border);
          align-items: center;
        }
        .tab-btn {
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          flex: 1;
        }
        .tab-btn.active {
          background: var(--surface);
          color: var(--text-primary);
          box-shadow: var(--shadow-soft);
        }
        .tabs-content {
          display: grid;
          gap: 12px;
        }
        .tab-panel {
          display: grid;
          gap: 12px;
        }
        .tab-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .tab-empty {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          padding: 18px 0;
        }
        .action-log {
          display: grid;
          gap: 6px;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
        }
        .action-log-item {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--text-muted);
        }
        .action-log-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
        }
        .action-log-text {
          color: var(--text-primary);
          font-weight: 600;
        }
        .action-log-time {
          font-variant-numeric: tabular-nums;
          opacity: 0.7;
        }
        .shortcut-hint {
          font-size: 11px;
          color: var(--text-muted);
          text-align: center;
          margin-top: 6px;
        }
        @media (max-width: 720px) {
          .header-content {
            flex-direction: column;
            align-items: flex-start;
          }
          .header-nav {
            width: 100%;
            justify-content: flex-start;
          }
          .theme-toggle {
            align-self: stretch;
            justify-content: center;
          }
          .header {
            padding: 14px 16px;
          }
          .logo {
            width: 40px;
            height: 40px;
          }
          .header-text h1 {
            font-size: 18px;
          }
          .header-text p {
            font-size: 11px;
          }
          .container {
            padding: 20px 16px 72px;
          }
          .card {
            padding: 20px;
          }
          .login-card {
            padding: 22px;
          }
          .login-card::after {
            opacity: 0.9;
          }
          .login-brand-logo {
            width: 60px;
            height: 60px;
          }
          .auth-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .header {
            padding: 16px;
          }
          .country-picker {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .summary-grid {
            grid-template-columns: 1fr;
          }
          .btn-group {
            flex-direction: column;
          }
          .call-controls {
            flex-direction: column;
          }
        }
        @media (max-width: 540px) {
          .country-picker {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .readiness-item {
            grid-template-columns: auto 1fr;
          }
          .status-pill {
            justify-self: start;
          }
        }
        @media (max-width: 420px) {
          .container {
            padding: 18px 12px 64px;
          }
          .card {
            padding: 18px;
          }
          .login-card {
            padding: 20px 18px;
          }
          .header {
            padding: 14px;
          }
          .login-info-item {
            padding: 3px 0;
          }
          .login-info-value {
            font-size: 13.5px;
          }
          .login-brand-logo {
            width: 56px;
            height: 56px;
          }
        }
        .history-badge.success {
          background: rgba(0, 200, 83, 0.15);
          border-color: rgba(0, 200, 83, 0.5);
          color: #7bf1a8;
        }
        .history-badge.warning {
          background: rgba(255, 171, 0, 0.15);
          border-color: rgba(255, 171, 0, 0.4);
          color: #ffd784;
        }
        .history-badge.error {
          background: rgba(244, 67, 54, 0.15);
          border-color: rgba(244, 67, 54, 0.5);
          color: #ff9b93;
        }
        .btn-group {
          display: flex;
          gap: 16px;
          justify-content: center;
          align-items: center;
          margin: 24px 0;
        }
        .post-call-form {
          background: linear-gradient(135deg, var(--border-strong) 0%, var(--surface) 100%);
          padding: 24px;
          border-radius: 20px;
          border: 1px solid var(--border-strong);
        }
        .post-call-form h3 {
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .form-row {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .field-hint {
          display: block;
          margin-top: 6px;
          font-size: 11px;
          color: var(--text-muted);
        }
        .switch-row {
          margin-top: 12px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .switch-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .switch-subtitle {
          font-size: 11px;
          color: var(--text-muted);
        }
        .switch {
          width: 46px;
          height: 26px;
          border-radius: 999px;
          background: var(--border-strong);
          border: 1px solid var(--border);
          position: relative;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .switch.active {
          background: var(--accent);
          border-color: transparent;
        }
        .switch-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          transition: all 0.2s ease;
        }
        .switch.active .switch-thumb {
          transform: translateX(20px);
        }
        .date-input {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
        }
        .date-picker-btn {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid var(--border-strong);
          background: var(--surface-alt);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .date-picker-btn:hover {
          border-color: var(--accent);
          transform: translateY(-1px);
        }
        .date-picker-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>

      <div className="container">
        <div className="background-orb orb-1" />
        <div className="background-orb orb-2" />

        <div className="content">
          {email && (
            <AppHeader
              email={email}
              role={userRole}
              picture={session?.picture}
              onLogout={handleLogout}
              onMenuReady={(openFn) => {
                menuOpenRef.current = openFn;
              }}
              audioConfig={{
                inputs: audioInputs,
                outputs: audioOutputs,
                selectedInputId,
                selectedOutputId,
                onInputChange: setSelectedInputId,
                onOutputChange: setSelectedOutputId,
                level: audioLevel
              }}
            />
          )}

          {!sessionStarted ? (
            <div className="card login-card">
              <div className="login-header">
                <h2>Conectando dialer</h2>
              </div>
              <div className="login-loading">
                <Loader2 className="icon-sm spin" />
                <div className="login-loading-text">
                  Preparando tu sesion de llamadas...
                </div>
              </div>
              {authError && <div className="auth-error">{authError}</div>}
            </div>
          ) : (
            <>
              <div className="summary-grid">
                <div className="summary-card summary-card--progress">
                  <div className="summary-meta">
                    <span className="summary-icon"><PhoneCall className="icon" /></span>
                    <div>
                      <div className="summary-label">Llamadas</div>
                      <div className="summary-value">{totalCalls}</div>
                      <div className="summary-sub">Sesion actual</div>
                    </div>
                  </div>
                  <div className="summary-chips">
                    <span className="summary-chip success"><CheckCircle2 className="icon-sm" />Contactados {contactadosCount}</span>
                    <span className="summary-chip error"><PhoneMissed className="icon-sm" />No contesta {noContestaCount}</span>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="summary-meta">
                    <span className="summary-icon"><CheckCircle2 className="icon" /></span>
                    <div>
                      <div className="summary-label">Progreso campaña</div>
                      <div className="summary-value">
                        {campaignTotal ? `${campaignHandled} / ${campaignTotal}` : '--'}
                      </div>
                      {campaignTotal ? (
                        <div className="summary-sub">
                          {campaignProgress}% completado
                          {selectedCampaignKey ? (
                            <span className="summary-subline">Leads dormidos {sleepingLeads}</span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="summary-sub">Selecciona una campaña</div>
                      )}
                    </div>
                  </div>
                  <div className="summary-progress">
                    <span style={{ width: `${campaignProgress}%` }} />
                  </div>
                </div>
                <div className="summary-card">
                  <div className="summary-meta">
                    <span className="summary-icon"><Timer className="icon" /></span>
                    <div>
                      <div className="summary-label">Tiempo en campaña</div>
                      <div className="summary-value">
                        {campaignJoined ? formatDuration(campaignElapsed) : '--:--'}
                      </div>
                      <div className="summary-sub">Tiempo activo en campaña</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dashboard-grid">
              <div>
                {!campaignJoined ? (
                  <div className="card join-card">
                    <h2 style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <Inbox className="icon-lg" /> Selecciona una campaña
                    </h2>
                    <p>Para iniciar, elige una campaña activa y pulsa “Unirse a campaña”.</p>
                    <button
                      className="btn btn-primary"
                      onClick={handleJoinCampaign}
                      disabled={!selectedCampaignKey}
                    >
                      Unirse a campaña
                    </button>
                  </div>
                ) : showPostCallForm ? (
                  <div className="card post-call-form">
                    <h3 style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <FileCheck className="icon-lg" />
                      Resultado de la llamada
                    </h3>

                    <div className="outcome-lead">
                      <div>
                        <div className="lead-name">{currentLead?.nombre}</div>
                        <div className="lead-phone">{currentLead?.telefono}</div>
                        {currentLead?.pipedrive?.email && (
                          <div className="lead-email">{currentLead.pipedrive.email}</div>
                        )}
                      </div>
                      <div className="call-duration">
                        <span>Duración</span>
                        <strong>{formatDuration(callDuration)}</strong>
                      </div>
                    </div>

                    <div className="outcome-toggle">
                      <button
                        className={`toggle-btn ${callOutcomeMode === 'positive' ? 'active' : ''}`}
                        onClick={() => {
                          setCallOutcomeMode('positive');
                          setSelectedOutcome('');
                          setRetryDelay('');
                          setFutureDelay('');
                          setAvailabilityDecision('keep');
                          setSelectedStageId('');
                          setSelectedLostReason('');
                          setFormError('');
                        }}
                      >
                        <ThumbsUp className="icon-sm" /> Positivo
                      </button>
                      <button
                        className={`toggle-btn ${callOutcomeMode === 'negative' ? 'active' : ''}`}
                        onClick={() => {
                          setCallOutcomeMode('negative');
                          setSelectedOutcome('');
                          setRetryDelay('');
                          setFutureDelay('');
                          setAvailabilityDecision('keep');
                          setSelectedStageId('');
                          setSelectedLostReason('');
                          setFormError('');
                        }}
                      >
                        <ThumbsDown className="icon-sm" /> Negativo
                      </button>
                    </div>

                    {callOutcomeMode && (
                      <div className="outcome-grid">
                        {(callOutcomeMode === 'positive' ? positiveOutcomes : negativeOutcomes).map((outcome) => (
                          <button
                            key={outcome.key}
                            className={`outcome-pill ${selectedOutcome === outcome.key ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedOutcome(outcome.key);
                              setRetryDelay('');
                              setFutureDelay('');
                              setAvailabilityDecision('keep');
                              setSelectedStageId('');
                              setSelectedLostReason('');
                              setFormError('');
                            }}
                            type="button"
                          >
                            {outcome.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedOutcome === NO_CONTESTA_KEY && (
                      <div className="retry-panel">
                        <div className="field-label">Reintentar luego</div>
                        <div className="outcome-grid compact">
                          {['1', '2', '3', '4', '6', '24'].map((hours) => (
                            <button
                              key={hours}
                              className={`outcome-pill ${retryDelay === hours ? 'active' : ''}`}
                              onClick={() => setRetryDelay(hours)}
                              type="button"
                            >
                              {hours}h
                            </button>
                          ))}
                        </div>
                        <button className="btn btn-secondary btn-retry" type="button" onClick={handleRetryNow}>
                          Reintentar ahora
                        </button>
                      </div>
                    )}

                    {selectedOutcome === FUTURE_KEY && (
                      <div className="retry-panel">
                        <div className="field-label">Disponibilidad futura</div>
                        <div className="outcome-grid compact">
                          <button
                            className={`outcome-pill ${futureDelay === '15' ? 'active' : ''}`}
                            onClick={() => setFutureDelay('15')}
                            type="button"
                          >
                            15 días
                          </button>
                          <button
                            className={`outcome-pill ${futureDelay === '30' ? 'active' : ''}`}
                            onClick={() => setFutureDelay('30')}
                            type="button"
                          >
                            30 días
                          </button>
                          <button
                            className={`outcome-pill ${futureDelay === '45' ? 'active' : ''}`}
                            onClick={() => setFutureDelay('45')}
                            type="button"
                          >
                            Más de 30
                          </button>
                        </div>
                        <div className="decision-row">
                          <button
                            className={`decision-btn ${availabilityDecision === 'keep' ? 'active' : ''}`}
                            onClick={() => setAvailabilityDecision('keep')}
                            type="button"
                          >
                            Mantener etapa
                          </button>
                          <button
                            className={`decision-btn ${availabilityDecision === 'move' ? 'active' : ''}`}
                            onClick={() => setAvailabilityDecision('move')}
                            type="button"
                          >
                            Mover etapa
                          </button>
                          <button
                            className={`decision-btn danger ${availabilityDecision === 'lose' ? 'active' : ''}`}
                            onClick={() => setAvailabilityDecision('lose')}
                            type="button"
                          >
                            Perder
                          </button>
                        </div>
                      </div>
                    )}

                    {showStageSelector && currentLead?.pipedrive?.stages?.length > 0 && (
                      <div className="form-group">
                        <label className="field-label">
                          <span className="label-icon"><BarChart3 className="icon-sm" /></span>
                          {outcomeRequiresStage ? 'Selecciona etapa de destino *' : 'Cambiar etapa (opcional)'}
                        </label>
                        <select
                          value={selectedStageId}
                          onChange={(e) => setSelectedStageId(e.target.value)}
                        >
                          {!outcomeRequiresStage && <option value="">Mantener etapa actual</option>}
                          {currentLead.pipedrive.stages.map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {outcomeIsLost && (
                      <div className="form-group">
                        <label className="field-label">
                          <span className="label-icon"><XCircle className="icon-sm" /></span>
                          Motivo de pérdida *
                        </label>
                        <select
                          value={selectedLostReason}
                          onChange={(e) => setSelectedLostReason(e.target.value)}
                        >
                          <option value="">Selecciona motivo</option>
                          {lostReasons.map((reason) => (
                            <option key={reason.id} value={reason.id}>
                              {reason.label || reason.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="form-group">
                      <label className="field-label">
                        <span className="label-icon"><FileText className="icon-sm" /></span>
                        Notas
                      </label>
                      <textarea
                        value={callNotes}
                        onChange={(e) => setCallNotes(e.target.value)}
                        placeholder="Notas sobre la llamada..."
                      />
                    </div>

                    {formError && <div className="form-error">{formError}</div>}

                    <div style={{display: 'flex', gap: '12px', marginTop: '24px'}}>
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveOutcome}
                        style={{flex: 1}}
                        disabled={isSaveDisabled}
                      >
                        Guardar y Siguiente Lead
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={cancelOutcomeForm}
                      >
                        Volver
                      </button>
                    </div>
                  </div>
                ) : showSkipForm ? (
                  <div className="card post-call-form">
                    <h3 style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <FileCheck className="icon-lg" />
                      Motivo de salto
                    </h3>
                    <div className="form-group">
                      <label className="field-label">
                        <span className="label-icon"><CheckCircle2 className="icon-sm" /></span>
                        Resultado *
                      </label>
                      <select value={skipReason} onChange={(e) => setSkipReason(e.target.value)}>
                        <option value="">Selecciona motivo</option>
                        {allOutcomes.map((outcome) => (
                          <option key={outcome.key} value={outcome.key}>
                            {outcome.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{display: 'flex', gap: '12px', marginTop: '24px'}}>
                      <button
                        className="btn btn-primary"
                        onClick={submitSkipForm}
                        style={{flex: 1}}
                      >
                        Confirmar salto
                      </button>
                      <button className="btn btn-secondary" onClick={cancelSkipForm}>
                        Volver
                      </button>
                    </div>
                  </div>
                ) : currentLead && (
                  <div className="card">
                    <div className="call-panel">
                      <div className="section-header">
                        <div>
                          <div className="section-title">Gestion de llamada</div>
                          <div className="section-subtitle">Control rapido y estado en tiempo real</div>
                        </div>
                        {isCallInProgress && callDuration > 0 && (
                          <div className="call-mini-timer">
                            <Timer className="icon-sm" />
                            {formatDuration(callDuration)}
                          </div>
                        )}
                      </div>

                    {callStatus && (
                      <div className={`call-status ${isCallInProgress ? 'active' : ''}`}>
                        <span className="status-icon">
                          {isCallInProgress ? <CheckCircle2 className="icon-sm" /> : <Circle className="icon-sm" />}
                        </span>
                        {callStatus}
                      </div>
                    )}
                    {statusHistory.length > 0 && (
                      <div className="call-timeline">
                        {statusHistory.map((item, index) => (
                          <div
                            key={`${item.key}-${index}`}
                            className={`timeline-item ${item.key === callState ? 'active' : ''}`}
                          >
                            <span className="timeline-dot" />
                            <span className="timeline-label">{item.label}</span>
                            <span className="timeline-time">
                              {item.at.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                      <div className="btn-group call-controls">
                        {!isCallInProgress ? (
                          <>
                            {autoCallCountdown !== null ? (
                              <div className="auto-call-row">
                                <div className="auto-call-status">
                                  {autoCallMessage || 'Llamando en'} {autoCallCountdown}s
                                </div>
                                <div className="auto-call-actions">
                                  <button className="btn btn-call" onClick={() => makeCall()} title="Llamar ahora">
                                    <span className="call-icon"><PhoneCall className="icon-lg" /></span>
                                    Llamar ahora
                                  </button>
                                  <button className="btn btn-secondary" onClick={handleAutoCallCancel}>
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button className="btn btn-call" onClick={makeCall} title="Llamar" disabled={!campaignJoined}>
                                <span className="call-icon"><PhoneCall className="icon-lg" /></span>
                                Llamar
                              </button>
                            )}
                            <button
                              className="btn btn-secondary"
                              onClick={openSkipForm}
                              disabled={isLeadLoading || !campaignJoined}
                            >
                              <span className="btn-icon"><SkipForward className="icon-sm" /></span>
                              {isLeadLoading ? 'Cargando...' : 'Saltar'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-hangup" onClick={hangup} title="Colgar">
                              <span className="call-icon"><PhoneOff className="icon-lg" /></span>
                              Colgar
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
                              title={isMuted ? 'Activar microfono' : 'Silenciar microfono'}
                            >
                              {isMuted ? <MicOff className="icon-lg" /> : <Mic className="icon-lg" />}
                            </button>
                          </>
                        )}
                      </div>
                      <div className="shortcut-hint">
                        Atajos: L = llamar · N = saltar · C = completar tarea
                      </div>
                    </div>
                    <div className="lead-card">
                      <div className="lead-header">
                        <div>
                          <div className="lead-title">Lead actual</div>
                          <div className="lead-subtitle">Listado prioritario para contacto</div>
                        </div>
                        <span className={`lead-badge ${isCallInProgress ? 'in-call' : (showPostCallForm ? 'pending' : 'idle')}`}>
                          {isCallInProgress ? 'En llamada' : showPostCallForm ? 'Pendiente' : 'Pendiente'}
                        </span>
                      </div>
                      <div className="lead-name">{currentLead.nombre}</div>
                      <div className="lead-phone">{currentLead.telefono}</div>
                      {currentLead.pipedrive?.email && (
                        <div className="lead-email">{currentLead.pipedrive.email}</div>
                      )}
                      <div className="lead-meta">
                        <span className="lead-meta-chip">
                          Etapa: {currentLead.pipedrive?.stageName || currentLead.stageName || 'Sin etapa'}
                        </span>
                        <span className="lead-meta-chip">
                          Intentos: {currentLead.intentos || 0}
                        </span>
                        <span className="lead-meta-chip">
                          Gestiones: {currentLead.gestiones || 0}
                        </span>
                      </div>
                      <div className="quick-actions">
                        <a
                          className="action-btn"
                          href={getPipedriveUrl(currentLead.pipedriveDealId)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="action-icon"><FileText className="icon-sm" /></span>
                          Ver Pipedrive
                        </a>
                        <a
                          className="action-btn"
                          href={getWhatsappLink(currentLead.telefono)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="action-icon"><MessageCircle className="icon-sm" /></span>
                          WhatsApp
                        </a>
                        <button
                          className="action-btn"
                          onClick={() => handleCopy(currentLead.telefono, 'Telefono')}
                          type="button"
                        >
                          <span className="action-icon"><ClipboardCopy className="icon-sm" /></span>
                          Copiar telefono
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => handleCopy(currentLead.nombre, 'Nombre')}
                          type="button"
                        >
                          <span className="action-icon"><User className="icon-sm" /></span>
                          Copiar nombre
                        </button>
                      </div>

                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => setShowLeadDetails((prev) => !prev)}
                        type="button"
                      >
                        {showLeadDetails ? 'Ocultar detalles' : 'Ver detalles'}
                      </button>

                      {showLeadDetails && (
                        <>
                        <div className="lead-info">
                        <div className="lead-info-item">
                          <div className="lead-info-label">
                            <span className="label-icon small"><FileText className="icon-sm" /></span>
                            Deal ID
                          </div>
                          <div className="lead-info-value">
                            <a href={getPipedriveUrl(currentLead.pipedriveDealId)} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)', textDecoration: 'none'}}>
                              {currentLead.pipedriveDealId}
                            </a>
                          </div>
                        </div>
                        <div className="lead-info-item">
                          <div className="lead-info-label">
                            <span className="label-icon small"><User className="icon-sm" /></span>
                            Cliente
                          </div>
                          <div className="lead-info-value">
                            {currentLead.pipedrive?.personName || currentLead.nombre}
                          </div>
                        </div>
                        <div className="lead-info-item">
                          <div className="lead-info-label">
                            <span className="label-icon small"><BarChart3 className="icon-sm" /></span>
                            Etapa
                          </div>
                          <div className="lead-info-value">
                            {currentLead.pipedrive?.stageName || 'Sin etapa'}
                          </div>
                        </div>
                        <div className="lead-info-item">
                          <div className="lead-info-label">
                            <span className="label-icon small"><PhoneCall className="icon-sm" /></span>
                            Intentos
                          </div>
                          <div className="lead-info-value">{currentLead.intentos || 0}</div>
                        </div>
                        <div className="lead-info-item">
                          <div className="lead-info-label">
                            <span className="label-icon small"><Globe className="icon-sm" /></span>
                            Pais
                          </div>
                          <div className="lead-info-value">{pais}</div>
                        </div>
                        <div className="lead-info-item">
                          <div className="lead-info-label">
                            <span className="label-icon small"><Mail className="icon-sm" /></span>
                            Email
                          </div>
                          <div className="lead-info-value" style={{fontSize: '12px', wordBreak: 'break-all'}}>{email}</div>
                        </div>
                      </div>

                      {currentLead.pipedrive && (
                        <div className="lead-insights">
                          <div className="lead-insight-card">
                            <div className="owner-row">
                              <div className="lead-insight-title" style={{margin: 0}}>Responsable</div>
                              <button
                                type="button"
                                className="btn btn-secondary owner-btn"
                                onClick={() => {
                                  const nextOpen = !ownerEditOpen;
                                  setOwnerEditOpen(nextOpen);
                                  if (nextOpen) loadDealUsers();
                                }}
                                disabled={isOwnerUpdating}
                              >
                                {ownerEditOpen ? 'Cerrar' : 'Cambiar'}
                              </button>
                            </div>
                            <div className="lead-insight-value">
                              {currentLead.pipedrive.ownerName || 'Sin asignar'}
                            </div>
                            {ownerEditOpen && (
                              <div className="owner-edit">
                                <input
                                  type="text"
                                  value={userSearch}
                                  onChange={(e) => setUserSearch(e.target.value)}
                                  placeholder="Escribe para buscar responsable..."
                                />
                                <div className="owner-list">
                                  {isUsersLoading && <div className="lead-insight-empty">Cargando usuarios...</div>}
                                  {!isUsersLoading && filteredDealUsers.slice(0, 8).map((user) => (
                                    <button
                                      key={user.id}
                                      type="button"
                                      className="owner-item"
                                      onClick={() => handleOwnerChange(user.id)}
                                      disabled={isOwnerUpdating}
                                    >
                                      {user.name}
                                    </button>
                                  ))}
                                  {!isUsersLoading && filteredDealUsers.length === 0 && (
                                    <div className="lead-insight-empty">Sin resultados</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="lead-insight-card">
                            <div className="lead-insight-title">Pendientes del lead</div>
                            {(() => {
                              const { overdue, upcoming } = getTaskBuckets(currentLead);
                              const tasksToShow = [...overdue.slice(0, 2), ...upcoming.slice(0, 3)];
                              if (tasksToShow.length === 0) {
                                return <div className="lead-insight-empty">Sin tareas pendientes</div>;
                              }
                              return (
                                <div className="task-list">
                                  {tasksToShow.map((task) => {
                                    const timing = getTaskTiming(task);
                                    return (
                                      <div key={task.id} className={`task-item ${timing.tone === 'overdue' ? 'overdue' : ''}`}>
                                        <div className="task-main">
                                          <div className="task-title">{task.subject || 'Tarea pendiente'}</div>
                                          <div className="task-meta">
                                            {task.due_date || 'Sin fecha'} {task.due_time || ''}
                                            <span className={`task-badge ${timing.tone}`}>{timing.label}</span>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          onClick={() => markNextTaskDone(task.id)}
                                          disabled={activityUpdatingId === task.id}
                                        >
                                          {activityUpdatingId === task.id ? 'Guardando...' : 'Completar'}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="lead-insight-card">
                            <div className="lead-insight-title">Tareas recientes</div>
                            <div className="lead-insight-list">
                              {currentLead.pipedrive.activities && currentLead.pipedrive.activities.length > 0 ? (
                                currentLead.pipedrive.activities.slice(0, 3).map((activity) => (
                                  <div key={activity.id} className="lead-insight-item">
                                    <span className={`lead-insight-dot ${activity.done ? 'done' : ''}`} />
                                    <span className="lead-insight-text">
                                      {activity.subject || activity.type || 'Actividad'}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="lead-insight-empty">Sin tareas registradas</div>
                              )}
                            </div>
                          </div>
                          <div className="lead-insight-card">
                            <div className="lead-insight-title">Notas recientes</div>
                            <div className="lead-insight-list">
                              {currentLead.pipedrive.notes && currentLead.pipedrive.notes.length > 0 ? (
                                currentLead.pipedrive.notes.slice(0, 3).map((note) => (
                                  <div key={note.id} className="lead-insight-item">
                                    <span className="lead-insight-dot" />
                                    <span className="lead-insight-text">
                                      {stripHtml(note.content) || 'Nota'}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="lead-insight-empty">Sin notas registradas</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {campaignJoined && !currentLead && (
                  <div className="card">
                    <h2 style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <Inbox className="icon-lg" /> {noLeadsInfo?.title || 'No hay leads disponibles'}
                    </h2>
                    <p>{noLeadsInfo?.detail || `No se encontraron leads pendientes para ${pais}`}</p>
                    {noLeadsInfo?.stats && (
                      <div className="status-note" style={{ marginTop: '10px' }}>
                        Pendientes: {noLeadsInfo.stats.totalPending || 0} · Disponibles: {noLeadsInfo.stats.eligible || 0} · Sin teléfono: {noLeadsInfo.stats.noPhone || 0} · En cooldown: {noLeadsInfo.stats.cooldown || 0} · Máx intentos: {noLeadsInfo.stats.maxAttempts || 0} · Máx gestiones: {noLeadsInfo.stats.maxGestions || 0} · Bloqueados: {noLeadsInfo.stats.locked || 0}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="right-panel">
                <div className="card campaign-card">
                  <div className="campaign-header">
                    <div>
                      <div className="campaign-title">Campaña activa</div>
                      <div className="campaign-subtitle">Selecciona para comenzar</div>
                    </div>
                    {campaignsLoading && <Loader2 className="icon-sm spin" />}
                  </div>
                  <select
                    className="campaign-select"
                    value={selectedCampaignKey}
                    onChange={(event) => setSelectedCampaignKey(event.target.value)}
                  >
                    <option value="">Selecciona campaña</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.campaign_key} value={campaign.campaign_key}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                  {campaignError && <div className="campaign-error">{campaignError}</div>}
                  <button
                    className="btn btn-primary btn-full"
                    onClick={handleJoinCampaign}
                    disabled={!selectedCampaignKey || campaignJoined}
                  >
                    {campaignJoined ? 'En campaña' : 'Unirse a campaña'}
                  </button>
                  {campaignJoined && (
                    <button
                      className="btn btn-secondary btn-full"
                      onClick={handleCloseCampaign}
                      disabled={campaignClosing}
                    >
                      <LogOut className="icon-sm" /> {campaignClosing ? 'Cerrando...' : 'Cerrar campaña'}
                    </button>
                  )}
                  <button className="btn btn-secondary btn-full" onClick={loadCampaigns}>
                    <Plus className="icon-sm" /> Recargar campañas
                  </button>
                  {(() => {
                    const stats = (noLeadsInfo?.stats || campaignAvailability);
                    if (!stats) return null;
                    const hasValues = ['totalPending', 'eligible', 'noPhone', 'cooldown', 'maxAttempts', 'maxGestions', 'locked']
                      .some((key) => Number(stats[key] || 0) > 0);
                    if (!hasValues) return null;
                    if (Number(stats.eligible || 0) > 0) return null;

                    const retryHhmm = formatRetryHhmm(stats.nextRetryAt);
                    const cooldownText = retryHhmm
                      ? `En cooldown: ${stats.cooldown || 0} (reintento ~${retryHhmm})`
                      : `En cooldown: ${stats.cooldown || 0}`;
                    const summary = `Pendientes: ${stats.totalPending || 0} · Disponibles: ${stats.eligible || 0} · Sin teléfono: ${stats.noPhone || 0} · ${cooldownText} · Máx intentos: ${stats.maxAttempts || 0} · Máx gestiones: ${stats.maxGestions || 0} · Bloqueados: ${stats.locked || 0}`;

                    return (
                      <div className="campaign-note tooltip-trigger">
                        Sin leads disponibles
                        <span className="tooltip-icon">?</span>
                        <span className="tooltip-content">{summary}</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="card audio-status-card">
                  <div className="audio-status-header">
                    <div className="audio-status-title">Audio</div>
                    <span className={`audio-status-pill ${selectedInputId ? 'ok' : 'error'}`}>
                      {selectedInputId ? 'Listo' : 'Sin configurar'}
                    </span>
                  </div>
                  <div className="audio-status-body">
                    {selectedInputId ? 'Audio configurado correctamente.' : 'Configura microfono y altavoz desde el menu.'}
                  </div>
                  <button
                    className="btn btn-secondary btn-full"
                    onClick={() => menuOpenRef.current?.()}
                  >
                    Configurar audio
                  </button>
                </div>

                <div className="card tabs-card">
                  <div className="tabs-header">
                    <button
                      className={`tab-btn ${rightTab === 'today' ? 'active' : ''}`}
                      onClick={() => setRightTab('today')}
                    >
                      Hoy
                    </button>
                    <button
                      className={`tab-btn ${rightTab === 'next' ? 'active' : ''}`}
                      onClick={() => setRightTab('next')}
                    >
                      Proximas
                    </button>
                    <button
                      className={`tab-btn ${rightTab === 'history' ? 'active' : ''}`}
                      onClick={() => setRightTab('history')}
                    >
                      Historial
                    </button>
                  </div>

                  {actionLog.length > 0 && (
                    <div className="action-log">
                      {actionLog.slice(0, 4).map((entry) => (
                        <div key={entry.id} className="action-log-item">
                          <span className="action-log-dot" />
                          <span className="action-log-text">{entry.message}</span>
                          <span className="action-log-time">
                            {entry.at.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="tabs-content">
                    {rightTab === 'today' && (
                      <div className="tab-panel">
                        <div className="tab-title">Pendientes hoy</div>
                        {(() => {
                          if (!currentLead || !currentLead.pipedrive) {
                            return <div className="tab-empty">Sin lead activo.</div>;
                          }
                          const { overdue, upcoming } = getTaskBuckets(currentLead);
                          const today = new Date().toISOString().slice(0, 10);
                          const todayTasks = upcoming.filter((task) => !task.due_date || task.due_date === today);
                          const tasksToShow = [...overdue, ...todayTasks].slice(0, 6);

                          if (tasksToShow.length === 0) {
                            return <div className="tab-empty">Sin tareas para hoy.</div>;
                          }

                          return (
                            <div className="task-list">
                              {tasksToShow.map((task) => {
                                const timing = getTaskTiming(task);
                                return (
                                  <div key={task.id} className={`task-item ${timing.tone === 'overdue' ? 'overdue' : ''}`}>
                                    <div className="task-main">
                                      <div className="task-title">{task.subject || 'Tarea pendiente'}</div>
                                      <div className="task-meta">
                                        {task.due_date || 'Sin fecha'} {task.due_time || ''}
                                        <span className={`task-badge ${timing.tone}`}>{timing.label}</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      onClick={() => markNextTaskDone(task.id)}
                                      disabled={activityUpdatingId === task.id}
                                    >
                                      {activityUpdatingId === task.id ? 'Guardando...' : 'Completar'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {rightTab === 'next' && (
                      <div className="tab-panel">
                        <div className="tab-title">Proximas tareas</div>
                        {(() => {
                          if (!currentLead || !currentLead.pipedrive) {
                            return <div className="tab-empty">Sin lead activo.</div>;
                          }
                          const { upcoming } = getTaskBuckets(currentLead);
                          const today = new Date().toISOString().slice(0, 10);
                          const futureTasks = upcoming.filter((task) => task.due_date && task.due_date > today);
                          if (futureTasks.length === 0) {
                            return <div className="tab-empty">No hay tareas futuras.</div>;
                          }
                          return (
                            <div className="task-list">
                              {futureTasks.slice(0, 6).map((task) => (
                                <div key={task.id} className="task-item">
                                  <div className="task-main">
                                    <div className="task-title">{task.subject || 'Tarea pendiente'}</div>
                                    <div className="task-meta">
                                      {task.due_date || 'Sin fecha'} {task.due_time || ''}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {rightTab === 'history' && (
                      <div className="tab-panel">
                        <div className="tab-title">Historial de llamadas</div>
                        {callHistory.length > 0 ? (
                          <div className="history-list">
                            {callHistory.map((call, index) => {
                              const isSuccess = ['interesado', 'fotos_agendadas'].includes(call.resultado);
                              const isWarning = ['no_contesta', 'disponibilidad_futura'].includes(call.resultado);
                              const badgeClass = isSuccess ? 'success' : isWarning ? 'warning' : 'error';
                              const badgeLabel = call.resultado
                                ? call.resultado.replace(/_/g, ' ')
                                : 'sin resultado';
                              const badgeIcon = isSuccess ? <CheckCircle2 className="icon-sm" /> : isWarning ? <Voicemail className="icon-sm" /> : <XCircle className="icon-sm" />;

                              return (
                                <div key={index} className="history-item">
                                  <div className="history-row">
                                    <div className="history-name">{call.nombre}</div>
                                    <div className="history-meta">
                                      {call.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                  <div className="history-details">
                                    <span>{call.telefono}</span>
                                    <span>•</span>
                                    <a href={getPipedriveUrl(call.dealId)} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)', textDecoration: 'none'}}>
                                      Deal {call.dealId}
                                    </a>
                                    <span>•</span>
                                    <span>{formatDuration(call.duracion || 0)}</span>
                                  </div>
                                  <div className={`history-badge ${badgeClass}`}>
                                    {badgeIcon}
                                    {badgeLabel}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0'}}>
                            No hay llamadas registradas en esta sesion
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </>
          )}
        </div>
      </div>
      {actionToast && <div className="action-toast">{actionToast}</div>}
      {showCloseConfirm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div>
              <div className="modal-title">Cerrar campaña</div>
              <div className="modal-subtitle">Se guardará el progreso y finalizará tu sesión actual.</div>
            </div>
            <div className="summary-list">
              <div className="summary-line">
                Leads gestionados
                <span>{campaignHandled} / {campaignTotal}</span>
              </div>
              <div className="summary-line">
                Tiempo en campaña
                <span>{formatDuration(campaignElapsed)}</span>
              </div>
              <div className="summary-line">
                Llamadas registradas
                <span>{callHistory.length}</span>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={cancelCloseCampaign}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={confirmCloseCampaign}>
                Cerrar campaña
              </button>
            </div>
          </div>
        </div>
      )}
      {showCampaignSummary && campaignSummary && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div>
              <div className="modal-title">
                {campaignSummary.mode === 'auto' ? 'Campaña completada' : 'Resumen de campaña'}
              </div>
              <div className="modal-subtitle">
                {campaignSummary.mode === 'auto' ? 'Se completaron todos los leads disponibles.' : 'Campaña cerrada manualmente.'}
              </div>
            </div>
            <div className="summary-list">
              <div className="summary-line">
                Progreso total
                <span>{campaignSummary.handledCount} / {campaignSummary.totalLeads}</span>
              </div>
              <div className="summary-line">
                Leads completados
                <span>{campaignSummary.completedCount}</span>
              </div>
              <div className="summary-line">
                Leads saltados
                <span>{campaignSummary.skippedCount}</span>
              </div>
              <div className="summary-line">
                Llamadas realizadas
                <span>{campaignSummary.callCount}</span>
              </div>
              <div className="summary-line">
                Tiempo en campaña
                <span>{formatDuration(campaignSummary.elapsedSeconds || 0)}</span>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={closeCampaignSummary}>
                {campaignSummary.mode === 'auto' ? 'Cerrar campaña' : 'Volver a campañas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
