// Google Sheets API Helper usando acceso público
// El Sheet debe estar compartido como "Cualquiera con el enlace puede ver"

const axios = require('axios');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function getSheetData(sheetName) {
  try {
    // Usar Google Visualization API para leer sheets públicos
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
    const response = await axios.get(url);

    // Google retorna JSONP, extraer JSON
    const text = response.data;
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if (!jsonMatch) {
      throw new Error('No se pudo parsear respuesta de Google Sheets');
    }

    const data = JSON.parse(jsonMatch[1]);

    if (!data.table || !data.table.rows) {
      return [];
    }

    const rows = data.table.rows;
    const cols = data.table.cols;

    // Headers
    const headers = cols.map(col => col.label || '');

    // Convertir filas a objetos
    const result = [];
    for (let i = 0; i < rows.length; i++) {
      const obj = {};
      const row = rows[i];

      row.c.forEach((cell, index) => {
        obj[headers[index]] = cell && cell.v !== null ? cell.v : '';
      });

      result.push(obj);
    }

    return result;
  } catch (error) {
    console.error('Error obteniendo datos del Sheet:', error.message);
    throw error;
  }
}

async function getSiguienteLead(pais) {
  try {
    const sheetName = `${pais}_Base`;
    const leads = await getSheetData(sheetName);

    // Buscar primer lead PENDIENTE
    const lead = leads.find(l => {
      const estado = l.estado || '';
      return estado === '' || estado === 'PENDIENTE' || estado.toUpperCase() === 'PENDIENTE';
    });

    if (!lead) {
      return null;
    }

    return {
      leadId: lead.lead_id_interno,
      nombre: lead.nombre,
      telefono: lead.telefono_e164,
      pipedriveDealId: lead.pipedrive_deal_id,
      intentos: lead.intentos || 0
    };
  } catch (error) {
    console.error('Error obteniendo siguiente lead:', error);
    throw error;
  }
}

async function getEjecutivoInfo(email) {
  try {
    const ejecutivos = await getSheetData('Ejecutivos');
    const ejecutivo = ejecutivos.find(e => e.ejecutivo_email === email);

    if (!ejecutivo) {
      return null;
    }

    return {
      email: ejecutivo.ejecutivo_email,
      telefono: ejecutivo.telefono_ejecutivo_e164,
      activo: ejecutivo.activo === true || ejecutivo.activo === 'TRUE'
    };
  } catch (error) {
    console.error('Error obteniendo info de ejecutivo:', error);
    throw error;
  }
}

module.exports = {
  getSheetData,
  getSiguienteLead,
  getEjecutivoInfo
};
