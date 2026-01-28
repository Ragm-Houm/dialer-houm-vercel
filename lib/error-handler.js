/**
 * Utilidad para manejo seguro de errores en APIs
 * No expone mensajes internos al cliente
 */

// Mensajes de error seguros por tipo de operación
const SAFE_MESSAGES = {
  auth: 'Error de autenticación',
  database: 'Error al acceder a los datos',
  pipedrive: 'Error al conectar con Pipedrive',
  twilio: 'Error al conectar con Twilio',
  validation: 'Datos de entrada inválidos',
  notFound: 'Recurso no encontrado',
  forbidden: 'No tienes permisos para esta acción',
  rateLimit: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.',
  default: 'Error interno del servidor'
};

/**
 * Detecta el tipo de error y devuelve un mensaje seguro
 * @param {Error} error - El error capturado
 * @param {string} context - Contexto de la operación (ej: 'pipedrive', 'auth')
 * @returns {string} Mensaje seguro para el cliente
 */
function getSafeErrorMessage(error, context = 'default') {
  const message = error?.message?.toLowerCase() || '';

  // Rate limit - permitimos que el usuario sepa que debe esperar
  if (message.includes('rate limit') || error?.response?.status === 429) {
    return SAFE_MESSAGES.rateLimit;
  }

  // Errores de autenticación específicos que son seguros mostrar
  if (message.includes('no autorizado') || message.includes('unauthorized')) {
    return SAFE_MESSAGES.auth;
  }

  // Errores de validación del dominio de email (seguro mostrar)
  if (message.includes('houm.com') || message.includes('dominio')) {
    return 'Solo se permite acceso con email de houm.com';
  }

  // Para otros errores, usar el mensaje genérico del contexto
  return SAFE_MESSAGES[context] || SAFE_MESSAGES.default;
}

/**
 * Wrapper para manejar errores en handlers de API
 * @param {Function} handler - El handler de la API
 * @param {string} context - Contexto para el mensaje de error
 */
function withErrorHandler(handler, context = 'default') {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(`Error en ${context}:`, error);
      const safeMessage = getSafeErrorMessage(error, context);
      res.status(500).json({ error: safeMessage });
    }
  };
}

module.exports = {
  getSafeErrorMessage,
  withErrorHandler,
  SAFE_MESSAGES
};
