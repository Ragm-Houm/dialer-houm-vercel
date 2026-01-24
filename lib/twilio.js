const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

function assertTwilioConfig() {
  const missing = [];
  if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
  if (!apiKey) missing.push('TWILIO_API_KEY');
  if (!apiSecret) missing.push('TWILIO_API_SECRET');
  if (!twimlAppSid) missing.push('TWILIO_TWIML_APP_SID');
  if (missing.length) {
    throw new Error(`Missing Twilio credentials: ${missing.join(', ')}`);
  }

  const invalid = [];
  if (!/^AC[a-fA-F0-9]{32}$/.test(accountSid)) invalid.push('TWILIO_ACCOUNT_SID must start with AC');
  if (!/^SK[a-fA-F0-9]{32}$/.test(apiKey)) invalid.push('TWILIO_API_KEY must start with SK');
  if (!/^AP[a-fA-F0-9]{32}$/.test(twimlAppSid)) invalid.push('TWILIO_TWIML_APP_SID must start with AP');
  if (authToken && !/^[a-fA-F0-9]{32}$/.test(authToken)) invalid.push('TWILIO_AUTH_TOKEN looks invalid');
  if (invalid.length) {
    throw new Error(`Invalid Twilio config: ${invalid.join('; ')}`);
  }
}

function getClient() {
  if (!accountSid || !authToken) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN for Twilio REST client.');
  }
  return twilio(accountSid, authToken);
}

// Generar Access Token para Twilio Client
function generateAccessToken(identity) {
  assertTwilioConfig();

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  // IMPORTANTE: Para Voice SDK 2.x, usar Account SID + Auth Token en vez de API Key
  // si hay problemas de validación
  const useAccountToken = (process.env.USE_ACCOUNT_TOKEN || '').trim() === 'true';

  let token;
  if (useAccountToken) {
    // Método alternativo: usar Account SID + Auth Token
    console.log('Using Account SID + Auth Token for token generation');
    token = new AccessToken(
      accountSid,
      accountSid,  // Usar Account SID como signing key
      authToken,   // Usar Auth Token como secret
      {
        identity: identity,
        ttl: 3600
      }
    );
  } else {
    // Método normal: usar API Key + Secret
    console.log('Using API Key + Secret for token generation');
    token = new AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      {
        identity: identity,
        ttl: 3600
      }
    );
  }

  // VoiceGrant para Voice SDK 2.x
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true  // Necesario para Voice SDK 2.x registration
  });

  token.addGrant(voiceGrant);

  const jwt = token.toJwt();

  console.log('Token generated for identity:', identity);
  console.log('Token length:', jwt.length);
  console.log('Token method:', useAccountToken ? 'Account SID + Auth Token' : 'API Key + Secret');

  return jwt;
}

// Obtener números de Twilio (Caller IDs)
async function getCallerIds() {
  try {
    const client = getClient();
    const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });

    return numbers.map(number => ({
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName
    }));
  } catch (error) {
    console.error('Error obteniendo Caller IDs:', error);
    throw error;
  }
}

module.exports = {
  generateAccessToken,
  getCallerIds,
  assertTwilioConfig,
  getClient
};
