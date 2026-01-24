// Endpoint para verificar credenciales de Twilio
const twilio = require('twilio');

export default async function handler(req, res) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    const results = {
      credentials: {
        accountSid: accountSid ? accountSid.substring(0, 10) + '...' : 'MISSING',
        apiKey: apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING',
        twimlAppSid: twimlAppSid ? twimlAppSid.substring(0, 10) + '...' : 'MISSING',
        authTokenPresent: !!authToken,
        apiSecretPresent: !!apiSecret
      }
    };

    // Verificar formato
    if (accountSid && !accountSid.startsWith('AC')) {
      results.error = 'Account SID debe empezar con AC';
      return res.status(200).json(results);
    }
    if (apiKey && !apiKey.startsWith('SK')) {
      results.error = 'API Key debe empezar con SK';
      return res.status(200).json(results);
    }
    if (twimlAppSid && !twimlAppSid.startsWith('AP')) {
      results.error = 'TwiML App SID debe empezar con AP';
      return res.status(200).json(results);
    }

    // Verificar que API Key pertenece a la cuenta
    try {
      const client = twilio(accountSid, authToken);
      const keys = await client.keys.list({ limit: 20 });
      const keyExists = keys.find(k => k.sid === apiKey);

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
      const client = twilio(accountSid, authToken);
      const app = await client.applications(twimlAppSid).fetch();
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
        accountSid,
        apiKey,
        apiSecret,
        { identity: 'test_user', ttl: 3600 }
      );

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true
      });

      token.addGrant(voiceGrant);
      const jwt = token.toJwt();

      results.tokenGeneration = {
        success: true,
        tokenLength: jwt.length,
        tokenPreview: jwt.substring(0, 50) + '...'
      };

      // Decodificar payload
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
      results.tokenPayload = {
        iss: payload.iss,
        sub: payload.sub,
        identity: payload.grants?.identity,
        hasVoiceGrant: !!payload.grants?.voice
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
