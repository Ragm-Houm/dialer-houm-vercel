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

  // Usar API Key + Secret (método correcto para Voice SDK 2.x)
  console.log('Generating token with API Key + Secret');
  const token = new AccessToken(
    accountSid,
    apiKey,
    apiSecret,
    {
      identity: identity,
      ttl: 3600
    }
  );

  // VoiceGrant para Voice SDK 2.x
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true  // Necesario para Voice SDK 2.x registration
  });

  token.addGrant(voiceGrant);

  const jwt = token.toJwt();

  console.log('Token generated for identity:', identity);
  console.log('Token length:', jwt.length);
  console.log('Issuer (API Key):', apiKey);

  return jwt;
}

// Obtener Caller IDs verificados de Twilio
async function getCallerIds() {
  try {
    const client = getClient();
    const callerIds = [];

    // Obtener números entrantes (comprados)
    console.log('Obteniendo números comprados...');
    const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 50 });
    incomingNumbers.forEach(number => {
      callerIds.push({
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName || number.phoneNumber
      });
    });

    // Obtener Caller IDs verificados (outgoing)
    console.log('Obteniendo Caller IDs verificados...');
    const outgoingCallerIds = await client.outgoingCallerIds.list({ limit: 50 });
    outgoingCallerIds.forEach(caller => {
      // Evitar duplicados
      if (!callerIds.find(c => c.phoneNumber === caller.phoneNumber)) {
        callerIds.push({
          phoneNumber: caller.phoneNumber,
          friendlyName: caller.friendlyName || caller.phoneNumber
        });
      }
    });

    console.log(`Total Caller IDs cargados: ${callerIds.length}`);
    return callerIds;
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
