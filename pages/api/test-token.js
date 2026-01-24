// Test endpoint to validate token generation
const twilio = require('twilio');

export default async function handler(req, res) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    // Generate token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { identity: 'test_identity', ttl: 3600 }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);
    const jwt = token.toJwt();

    // Decode token to inspect payload
    const parts = jwt.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    // Try to validate by creating a Voice SDK Device simulation
    res.status(200).json({
      success: true,
      tokenLength: jwt.length,
      payload: payload,
      apiKeyUsed: apiKey.substring(0, 10) + '...',
      accountSid: accountSid.substring(0, 10) + '...',
      twimlAppSid: twimlAppSid.substring(0, 10) + '...'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
