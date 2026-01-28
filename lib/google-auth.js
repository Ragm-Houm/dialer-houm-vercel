const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ALLOWED_DOMAIN = 'houm.com';

let client = null;

function getClient() {
  if (client) return client;
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Missing GOOGLE_CLIENT_ID');
  }
  client = new OAuth2Client(GOOGLE_CLIENT_ID);
  return client;
}

async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error('Google idToken es requerido');
  }
  const oauthClient = getClient();
  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new Error('Token de Google invalido');
  }

  // Validación de expiración del token
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token de Google expirado');
  }

  // Validación del issuer (iss)
  const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (!payload.iss || !validIssuers.includes(payload.iss)) {
    throw new Error('Token de Google con issuer invalido');
  }

  // Validación de issued at (iat) - no aceptar tokens del futuro
  if (payload.iat && payload.iat > now + 60) {
    throw new Error('Token de Google con fecha invalida');
  }

  if (!payload.email_verified) {
    throw new Error('Email de Google no verificado');
  }
  if (payload.hd !== ALLOWED_DOMAIN) {
    throw new Error('Solo se permite dominio houm.com');
  }

  return {
    email: String(payload.email).toLowerCase(),
    name: payload.name || '',
    picture: payload.picture || ''
  };
}

module.exports = {
  verifyGoogleIdToken
};

