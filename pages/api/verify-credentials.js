// Endpoint para verificar credenciales de Twilio
// PROTEGIDO: requiere DEBUG habilitado y API key
const twilio = require('twilio');

export default async function handler(req, res) {
  // Solo permitir si DEBUG está habilitado (igual que debug.js)
  if (process.env.ENABLE_DEBUG_ENDPOINT !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  // Requiere API key para acceso
  const debugKey = process.env.DEBUG_API_KEY;
  if (!debugKey || req.headers['x-api-key'] !== debugKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    // Limpiar igual que lib/twilio.js
    const cleanApiKey = apiKey?.trim().replace(/^["']|["']$/g, '');
    const cleanAccountSid = accountSid?.trim().replace(/^["']|["']$/g, '');
    const cleanAuthToken = authToken?.trim().replace(/^["']|["']$/g, '');
    const cleanApiSecret = apiSecret?.trim().replace(/^["']|["']$/g, '');
    const cleanTwimlAppSid = twimlAppSid?.trim().replace(/^["']|["']$/g, '');

    const results = {
      credentials: {
        accountSid: cleanAccountSid ? cleanAccountSid.substring(0, 10) + '...' : 'MISSING',
        apiKey: cleanApiKey ? cleanApiKey.substring(0, 10) + '...' : 'MISSING',
        apiKeyLength: apiKey?.length,
        apiKeyCleanLength: cleanApiKey?.length,
        apiKeyHasWhitespace: apiKey !== cleanApiKey,
        twimlAppSid: cleanTwimlAppSid ? cleanTwimlAppSid.substring(0, 10) + '...' : 'MISSING',
        authTokenPresent: !!cleanAuthToken,
        apiSecretPresent: !!cleanApiSecret,
        apiSecretLength: apiSecret?.length,
        apiSecretCleanLength: cleanApiSecret?.length
      }
    };

    // Verificar formato
    if (cleanAccountSid && !cleanAccountSid.startsWith('AC')) {
      results.error = 'Account SID debe empezar con AC';
      return res.status(200).json(results);
    }
    if (cleanApiKey && !cleanApiKey.startsWith('SK')) {
      results.error = 'API Key debe empezar con SK';
      return res.status(200).json(results);
    }
    if (cleanTwimlAppSid && !cleanTwimlAppSid.startsWith('AP')) {
      results.error = 'TwiML App SID debe empezar con AP';
      return res.status(200).json(results);
    }

    // Verificar que API Key pertenece a la cuenta
    try {
      const client = twilio(cleanAccountSid, cleanAuthToken);
      const keys = await client.keys.list({ limit: 20 });
      const keyExists = keys.find(k => k.sid === cleanApiKey);

      results.apiKeyValidation = keyExists ? 'API Key existe en la cuenta' : 'API Key NO existe en esta cuenta';

      if (!keyExists) {
        results.availableKeys = keys.map(k => ({
          sid: k.sid,
          friendlyName: k.friendlyName
        }));
      }
    } catch (e) {
      results.apiKeyValidation = 'Error verificando: ' + e.message;
    }

    // Verificar TwiML App
    try {
      const client = twilio(cleanAccountSid, cleanAuthToken);
      const app = await client.applications(cleanTwimlAppSid).fetch();
      results.twimlAppValidation = {
        exists: true,
        name: app.friendlyName,
        voiceUrl: app.voiceUrl
      };
    } catch (e) {
      results.twimlAppValidation = {
        exists: false,
        error: e.message
      };
    }

    // Intentar generar token de prueba
    try {
      const AccessToken = twilio.jwt.AccessToken;
      const VoiceGrant = AccessToken.VoiceGrant;

      const token = new AccessToken(
        cleanAccountSid,
        cleanApiKey,
        cleanApiSecret,
        { identity: 'test_user', ttl: 3600 }
      );

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: cleanTwimlAppSid,
        incomingAllow: true
      });

      token.addGrant(voiceGrant);
      const jwt = token.toJwt();

      results.tokenGeneration = {
        success: true
        // No exponemos detalles del token por seguridad
      };
    } catch (e) {
      results.tokenGeneration = {
        success: false,
        error: e.message
      };
    }

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
