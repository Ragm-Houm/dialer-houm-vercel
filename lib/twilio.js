const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

const client = twilio(accountSid, authToken);

// Generar Access Token para Twilio Client
function generateAccessToken(identity) {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(
    accountSid,
    apiKey,
    apiSecret,
    { identity: identity }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: false
  });

  token.addGrant(voiceGrant);

  return token.toJwt();
}

// Obtener números de Twilio (Caller IDs)
async function getCallerIds() {
  try {
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
  client
};
