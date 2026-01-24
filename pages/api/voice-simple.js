// Simplified TwiML endpoint for testing
const twilio = require('twilio');

export default async function handler(req, res) {
  console.log('Voice endpoint called');
  console.log('Method:', req.method);
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { To, From } = req.body || {};

  console.log('To:', To);
  console.log('From:', From);

  const response = new twilio.twiml.VoiceResponse();

  // Marcar directamente al número del cliente
  response.dial({
    callerId: From,
    record: 'record-from-answer'
  }, To);

  const twiml = response.toString();
  console.log('TwiML response:', twiml);

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
}
