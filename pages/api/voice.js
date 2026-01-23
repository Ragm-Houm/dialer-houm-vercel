// API route para TwiML - maneja llamadas salientes
const twilio = require('twilio');

export default function handler(req, res) {
  const { To, From } = req.body;

  const response = new twilio.twiml.VoiceResponse();

  // Marcar directamente al número del cliente
  response.dial({
    callerId: From,
    record: 'record-from-answer'
  }, To);

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(response.toString());
}
