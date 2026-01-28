/**
 * Rate Limiting Middleware
 *
 * Implementación en memoria (sin Redis) para proteger contra:
 * - Ataques de fuerza bruta
 * - Abuso de APIs
 * - DoS básico
 *
 * Nota: En Vercel serverless, cada instancia tiene su propio cache.
 * Para rate limiting distribuido real, se necesitaría Redis/Upstash.
 * Esta implementación es suficiente para protección básica.
 */

// Cache en memoria para tracking de requests
// Key: identifier (IP o email), Value: { count, resetTime }
const rateLimitCache = new Map();

// Limpieza periódica del cache (cada 5 minutos)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, value] of rateLimitCache.entries()) {
    if (value.resetTime < now) {
      rateLimitCache.delete(key);
    }
  }
}

/**
 * Configuraciones predefinidas de rate limiting
 */
const RATE_LIMIT_CONFIGS = {
  // Para endpoints de autenticación - más estricto
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 10,          // 10 intentos por ventana
    message: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.'
  },
  // Para endpoints de API general
  api: {
    windowMs: 60 * 1000,      // 1 minuto
    maxRequests: 60,          // 60 requests por minuto
    message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.'
  },
  // Para endpoints críticos (crear campañas, etc.)
  strict: {
    windowMs: 60 * 1000,      // 1 minuto
    maxRequests: 10,          // 10 requests por minuto
    message: 'Límite de solicitudes alcanzado. Espera un momento.'
  },
  // Para endpoints de escritura a Pipedrive
  pipedrive: {
    windowMs: 60 * 1000,      // 1 minuto
    maxRequests: 30,          // 30 requests por minuto (Pipedrive tiene sus propios límites)
    message: 'Límite de solicitudes a Pipedrive alcanzado. Espera un momento.'
  }
};

/**
 * Obtiene el identificador del cliente (IP o email)
 */
function getClientIdentifier(req) {
  // Intentar obtener IP real (considerando proxies)
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];

  let ip = '127.0.0.1';
  if (forwardedFor) {
    ip = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ip = realIp;
  } else if (req.socket?.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  // Si hay email en el body o query, usarlo como identificador adicional
  const email = req.body?.email || req.query?.email;
  if (email) {
    return `${ip}:${email.toLowerCase()}`;
  }

  return ip;
}

/**
 * Verifica si el cliente ha excedido el límite de requests
 *
 * @param {string} identifier - Identificador del cliente (IP o IP:email)
 * @param {object} config - Configuración de rate limit
 * @returns {object} { allowed: boolean, remaining: number, resetTime: number }
 */
function checkRateLimit(identifier, config) {
  cleanupExpiredEntries();

  const now = Date.now();
  const key = `${identifier}:${config.windowMs}`;
  const entry = rateLimitCache.get(key);

  if (!entry || entry.resetTime < now) {
    // Primera request o ventana expirada
    rateLimitCache.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs
    };
  }

  if (entry.count >= config.maxRequests) {
    // Límite excedido
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }

  // Incrementar contador
  entry.count += 1;
  rateLimitCache.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Middleware de rate limiting
 *
 * Uso:
 * ```
 * import { withRateLimit } from '../../lib/rate-limit';
 *
 * async function handler(req, res) {
 *   // tu código
 * }
 *
 * export default withRateLimit(handler, 'auth');
 * ```
 */
function withRateLimit(handler, configName = 'api') {
  const config = RATE_LIMIT_CONFIGS[configName] || RATE_LIMIT_CONFIGS.api;

  return async (req, res) => {
    const identifier = getClientIdentifier(req);
    const result = checkRateLimit(identifier, config);

    // Agregar headers de rate limit
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      return res.status(429).json({
        error: config.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter
      });
    }

    return handler(req, res);
  };
}

/**
 * Verificación manual de rate limit (para uso en handlers existentes)
 * Retorna true si está permitido, o envía 429 y retorna false
 */
function requireRateLimit(req, res, configName = 'api') {
  const config = RATE_LIMIT_CONFIGS[configName] || RATE_LIMIT_CONFIGS.api;
  const identifier = getClientIdentifier(req);
  const result = checkRateLimit(identifier, config);

  // Agregar headers
  res.setHeader('X-RateLimit-Limit', config.maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfter);

    res.status(429).json({
      error: config.message,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter
    });
    return false;
  }

  return true;
}

/**
 * Combina múltiples middlewares (rate limit + CSRF, etc.)
 */
function combineMiddleware(...middlewares) {
  return (handler) => {
    return middlewares.reduceRight((acc, middleware) => {
      return middleware(acc);
    }, handler);
  };
}

module.exports = {
  withRateLimit,
  requireRateLimit,
  checkRateLimit,
  getClientIdentifier,
  combineMiddleware,
  RATE_LIMIT_CONFIGS
};
