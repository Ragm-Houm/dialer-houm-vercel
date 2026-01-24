// API route para debugging de credenciales Twilio
const twilio = require('twilio');

export default async function handler(req, res) {
  if (process.env.ENABLE_DEBUG_ENDPOINT !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

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

    // Verificar que existan
    const checks = {
      accountSid: accountSid ? accountSid.substring(0, 8) + '...' : 'MISSING',
      authToken: authToken ? 'exists (length: ' + authToken.length + ')' : 'MISSING',
      apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING',
      apiSecret: apiSecret ? 'exists (length: ' + apiSecret.length + ')' : 'MISSING',
      twimlAppSid: twimlAppSid ? twimlAppSid.substring(0, 8) + '...' : 'MISSING'
    };

    // Verificar que API Key pertenece a la cuenta
    const client = twilio(accountSid, authToken);

    try {
      const apiKeys = await client.keys.list({ limit: 20 });
      const keyExists = apiKeys.find(k => k.sid === apiKey);
      checks.apiKeyValid = keyExists ? 'YES' : 'NO - API Key not found in account';
    } catch (e) {
      checks.apiKeyValid = 'ERROR: ' + e.message;
    }

    // Verificar que TwiML App existe
    try {
      const app = await client.applications(twimlAppSid).fetch();
      checks.twimlAppValid = 'YES - ' + app.friendlyName;
      checks.voiceUrl = app.voiceUrl;
    } catch (e) {
      checks.twimlAppValid = 'NO - ' + e.message;
    }

    // Intentar generar un token de prueba
    try {
      const AccessToken = twilio.jwt.AccessToken;
      const VoiceGrant = AccessToken.VoiceGrant;

      const token = new AccessToken(
        accountSid,
        apiKey,
        apiSecret,
        { identity: 'test_user' }
      );

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: false
      });

      token.addGrant(voiceGrant);
      const jwt = token.toJwt();

      checks.tokenGeneration = 'SUCCESS (length: ' + jwt.length + ')';

      // Intentar decodificar el token para ver su contenido
      const decoded = Buffer.from(jwt.split('.')[1], 'base64').toString();
      checks.tokenPayload = JSON.parse(decoded);
    } catch (e) {
      checks.tokenGeneration = 'ERROR: ' + e.message;
    }

    res.status(200).json(checks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
