// Simplified TwiML endpoint for testing
const twilio = require('twilio');

export default async function handler(req, res) {
  console.log('========== VOICE ENDPOINT CALLED ==========');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  if (req.method !== 'POST') {
    console.log('ERROR: Method not POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { To, From, CallSid, AccountSid } = req.body || {};

  console.log('Call Details:');
  console.log('  To:', To);
  console.log('  From:', From);
  console.log('  CallSid:', CallSid);
  console.log('  AccountSid:', AccountSid);

  // Validar que To y From existen
  if (!To || !From) {
    console.log('ERROR: Missing To or From');
    const response = new twilio.twiml.VoiceResponse();
    response.say('Sorry, there was an error. Missing phone numbers.');
    const twiml = response.toString();
    console.log('Error TwiML:', twiml);
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  const response = new twilio.twiml.VoiceResponse();

  // Marcar directamente al número del cliente
  response.dial({
    callerId: From,
    record: 'record-from-answer',
    timeout: 30,
    action: '/api/call-status'
  }, To);

  const twiml = response.toString();
  console.log('Generated TwiML:', twiml);
  console.log('========================================');

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
}
