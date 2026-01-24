# 🎯 Dialer Houm - Vercel + Next.js

Sistema de marcación 1 a 1 con Twilio Client (WebRTC) + Google Sheets + Pipedrive.

## 🚀 Deploy Rápido

### 1. Sube a GitHub

```bash
git remote add origin https://github.com/TU_USUARIO/dialer-houm.git
git push -u origin main
```

### 2. Despliega en Vercel

```bash
vercel
```

### 3. Configura variables de entorno en Vercel

Ve a: Settings → Environment Variables

```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_API_KEY
TWILIO_API_SECRET
TWILIO_TWIML_APP_SID
PIPEDRIVE_API_TOKEN
PIPEDRIVE_DOMAIN
GOOGLE_SHEET_ID
TWILIO_ALLOWED_CALLER_IDS (opcional, CSV en E.164)
ENABLE_DEBUG_ENDPOINT (opcional, "true" para habilitar /api/debug)
DEBUG_API_KEY (requerido si ENABLE_DEBUG_ENDPOINT es "true")
```

### 4. Actualiza TwiML App en Twilio

URL: `https://tu-proyecto.vercel.app/api/voice`

## 🎧 Uso

1. Selecciona país
2. Selecciona Caller ID
3. Inicia sesión
4. Toma lead
5. Haz clic en "Llamar"
6. ¡Habla desde el navegador con WebRTC!

## ✅ Funciona con:

- ✅ Twilio Client (WebRTC)
- ✅ Google Sheets (base de datos)
- ✅ Pipedrive (CRM)
- ✅ Audio bidireccional en el navegador
