// API route para TwiML - maneja llamadas salientes
const twilio = require('twilio');
const { getCallerIds } = require('../../lib/twilio');

const E164_REGEX = /^\+[1-9]\d{7,14}$/;
let cachedCallerIds = [];
let cachedAt = 0;

function getRequestUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}${req.url}`;
}

async function isAllowedCallerId(fromNumber) {
  const allowlist = process.env.TWILIO_ALLOWED_CALLER_IDS;
  if (allowlist) {
    const allowed = allowlist.split(',').map(item => item.trim()).filter(Boolean);
    return allowed.includes(fromNumber);
  }

  const now = Date.now();
  if (!cachedCallerIds.length || now - cachedAt > 5 * 60 * 1000) {
    const numbers = await getCallerIds();
    cachedCallerIds = numbers.map(number => number.phoneNumber);
    cachedAt = now;
  }

  return cachedCallerIds.includes(fromNumber);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return res.status(500).json({ error: 'Missing TWILIO_AUTH_TOKEN' });
  }

  const signature = req.headers['x-twilio-signature'];
  const url = getRequestUrl(req);
  const params = req.body || {};
  const isValid = twilio.validateRequest(authToken, signature, url, params);
  if (!isValid) {
    return res.status(403).json({ error: 'Invalid Twilio signature' });
  }

  const { To, From } = params;
  if (!To || !From || !E164_REGEX.test(To) || !E164_REGEX.test(From)) {
    return res.status(400).json({ error: 'Invalid To/From format' });
  }

  try {
    const allowed = await isAllowedCallerId(From);
    if (!allowed) {
      return res.status(403).json({ error: 'Caller ID not allowed' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Unable to validate Caller ID' });
  }

  const response = new twilio.twiml.VoiceResponse();

  // Marcar directamente al número del cliente
  response.dial({
    callerId: From,
    record: 'record-from-answer'
  }, To);

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(response.toString());
}
