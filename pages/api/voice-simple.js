// Simplified TwiML endpoint for testing
const twilio = require('twilio');

export default async function handler(req, res) {
  console.log('========== VOICE ENDPOINT CALLED ==========');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));

  if (req.method !== 'POST') {
    console.log('ERROR: Method not POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // En Voice SDK 2.x, los parámetros personalizados vienen directamente en el body
  // To y From del TwiML request son diferentes a los parámetros que enviamos
  const destinationNumber = req.body.To || req.body.destinationNumber;
  const callerIdNumber = req.body.From || req.body.callerIdNumber;
  const { CallSid, AccountSid } = req.body;

  console.log('Call Details:');
  console.log('  Destination Number:', destinationNumber);
  console.log('  Caller ID Number:', callerIdNumber);
  console.log('  CallSid:', CallSid);
  console.log('  AccountSid:', AccountSid);

  // Validar que tenemos los números necesarios
  if (!destinationNumber || !callerIdNumber) {
    console.log('ERROR: Missing destination or caller ID');
    const response = new twilio.twiml.VoiceResponse();
    response.say('Sorry, there was an error. Missing phone numbers.');
    const twiml = response.toString();
    console.log('Error TwiML:', twiml);
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  const response = new twilio.twiml.VoiceResponse();

  // Para Voice SDK 2.x (WebRTC en navegador):
  // El ejecutivo ya está conectado desde el navegador vía WebRTC
  // Solo necesitamos hacer Dial al número destino
  // El audio fluirá: Navegador <-> Twilio <-> Cliente

  console.log('Generando TwiML para WebRTC call...');

  response.dial({
    callerId: callerIdNumber,
    record: 'record-from-answer',
    timeout: 30,
    action: '/api/call-status',
    answerOnBridge: true  // Solo conecta cuando el cliente contesta
  }, destinationNumber);

  const twiml = response.toString();
  console.log('Generated TwiML:', twiml);
  console.log('========================================');

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
}
