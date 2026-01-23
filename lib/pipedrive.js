const axios = require('axios');

const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const DOMAIN = process.env.PIPEDRIVE_DOMAIN;
const BASE_URL = `https://${DOMAIN}/api/v1`;

async function createNote(dealId, content) {
  try {
    const url = `${BASE_URL}/notes?api_token=${API_TOKEN}`;

    const response = await axios.post(url, {
      content: content,
      deal_id: parseInt(dealId)
    });

    if (response.data && response.data.success) {
      return {
        noteId: response.data.data.id,
        link: `https://${DOMAIN}/deal/${dealId}`
      };
    }

    throw new Error('No se pudo crear la nota en Pipedrive');
  } catch (error) {
    console.error('Error creando nota en Pipedrive:', error.message);
    throw error;
  }
}

module.exports = {
  createNote
};
