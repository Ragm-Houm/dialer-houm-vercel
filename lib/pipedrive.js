const axios = require('axios');

const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const DOMAIN = process.env.PIPEDRIVE_DOMAIN;
const BASE_URL = `https://${DOMAIN}/api/v1`;

// Timeout por defecto para llamadas HTTP (30 segundos)
const DEFAULT_TIMEOUT = 30000;

// Headers de autenticación para Pipedrive (más seguro que query params)
function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

// Configuración base de axios con timeout y headers
function getAxiosConfig(extraConfig = {}) {
  return {
    timeout: DEFAULT_TIMEOUT,
    headers: getAuthHeaders(),
    ...extraConfig
  };
}

function assertPipedriveConfig() {
  if (!API_TOKEN || !DOMAIN) {
    throw new Error('Missing Pipedrive configuration');
  }
}

function extractDealId(activity) {
  if (!activity) return null;
  const raw = activity.deal_id;
  if (!raw) return null;
  if (typeof raw === 'number' || typeof raw === 'string') {
    return String(raw);
  }
  if (typeof raw === 'object') {
    if (raw.id !== undefined && raw.id !== null) return String(raw.id);
    if (raw.value !== undefined && raw.value !== null) return String(raw.value);
  }
  return null;
}

function extractPersonId(value) {
  if (!value) return null;
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }
  if (typeof value === 'object') {
    if (value.id !== undefined && value.id !== null) return String(value.id);
    if (value.value !== undefined && value.value !== null) return String(value.value);
  }
  return null;
}

function toDt(dueDate, dueTime) {
  if (!dueDate) return null;
  const time = dueTime && String(dueTime).length ? dueTime : '00:00';
  const dt = new Date(`${dueDate}T${time}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function doneTime(activity) {
  if (!activity) return null;
  if (activity.marked_as_done_time) {
    const dt = new Date(activity.marked_as_done_time);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  if (activity.update_time) {
    const dt = new Date(activity.update_time);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

async function createNote(dealId, content, userId, personId) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/notes`;

    const payload = {
      content: content,
      deal_id: parseInt(dealId)
    };

    if (userId) {
      payload.user_id = userId;
    }
    if (personId) {
      payload.person_id = personId;
    }

    const response = await axios.post(url, payload, getAxiosConfig());

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

async function createCallActivity(dealId, subject, durationSeconds, noteContent, userId, personId) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/activities`;

    const payload = {
      subject: subject,
      type: 'call',
      done: 1,
      duration: durationSeconds ? Math.round(durationSeconds) : 0,
      deal_id: parseInt(dealId),
      note: noteContent || ''
    };

    if (userId) {
      payload.user_id = userId;
    }
    if (personId) {
      payload.person_id = personId;
    }

    const response = await axios.post(url, payload, getAxiosConfig());

    if (response.data && response.data.success) {
      return {
        activityId: response.data.data.id,
        link: `https://${DOMAIN}/deal/${dealId}`
      };
    }

    throw new Error('No se pudo crear la actividad en Pipedrive');
  } catch (error) {
    console.error('Error creando actividad en Pipedrive:', error.message);
    throw error;
  }
}

async function getDealById(dealId) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/deals/${dealId}`;
    const response = await axios.get(url, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data;
    }

    throw new Error('No se pudo obtener el deal de Pipedrive');
  } catch (error) {
    console.error('Error obteniendo deal en Pipedrive:', error.message);
    throw error;
  }
}

async function getPersonById(personId) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/persons/${personId}`;
    const response = await axios.get(url, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data;
    }

    throw new Error('No se pudo obtener la persona en Pipedrive');
  } catch (error) {
    console.error('Error obteniendo persona en Pipedrive:', error.message);
    throw error;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonSafe(url, { tag = '' } = {}) {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await sleep(250);
      const resp = await axios.get(url, {
        ...getAxiosConfig(),
        validateStatus: () => true,
        responseType: 'text'
      });
      const code = resp.status;
      const text = resp.data;

      if (code >= 200 && code < 300) {
        if (typeof text === 'object') return text;
        try {
          return JSON.parse(text);
        } catch (error) {
          console.warn(`Respuesta no JSON ${tag ? `[${tag}]` : ''} HTTP ${code}`);
          return null;
        }
      }

      if (code === 429 || (code >= 500 && code < 600)) {
        const backoff = Math.min(8000, attempt * 1000);
        console.warn(`Retry ${tag ? `[${tag}]` : ''} HTTP ${code} intento ${attempt}/${maxAttempts}`);
        await sleep(backoff);
        continue;
      }

      console.error(`HTTP ${code} ${tag ? `[${tag}]` : ''}`);
      return null;
    } catch (error) {
      const backoff = Math.min(8000, attempt * 1000);
      console.warn(`Exception ${tag ? `[${tag}]` : ''} intento ${attempt}/${maxAttempts}`, error.message);
      await sleep(backoff);
    }
  }
  return null;
}

async function listDealsByPipelineStage(pipelineId, stageId, limit = 100, options = {}) {
  try {
    assertPipedriveConfig();
    const deals = [];
    let start = 0;
    const pageSize = 50;
    const tag = options.tag || `${pipelineId}-${stageId}`;

    while (deals.length < limit) {
      const url = `${BASE_URL}/deals?status=open&pipeline_id=${pipelineId}&stage_id=${stageId}&start=${start}&limit=${pageSize}&sort=add_time%20ASC`;
      const response = await fetchJsonSafe(url, { tag });
      if (!response) {
        break;
      }
      if (!response.success) {
        throw new Error('No se pudieron obtener deals en Pipedrive');
      }
      const batch = response.data || [];
      deals.push(...batch);

      const moreItems =
        response.additional_data &&
        response.additional_data.pagination &&
        response.additional_data.pagination.more_items_in_collection;
      if (!moreItems || batch.length === 0) {
        break;
      }
      start += pageSize;
    }

    return deals.slice(0, limit);
  } catch (error) {
    console.error('Error obteniendo deals por pipeline/stage:', error.message);
    throw error;
  }
}

async function listDealsByPipelineStageAll(pipelineId, stageId, options = {}) {
  const maxLimit = 10000;
  return listDealsByPipelineStage(pipelineId, stageId, maxLimit, options);
}

async function getDealOwnerId(dealId) {
  const deal = await getDealById(dealId);
  if (!deal || !deal.user_id) {
    return null;
  }
  if (typeof deal.user_id === 'number') {
    return deal.user_id;
  }
  if (typeof deal.user_id === 'object' && deal.user_id.id) {
    return deal.user_id.id;
  }
  return null;
}

async function listDealNotes(dealId, limit = 5) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/notes?deal_id=${dealId}&start=0&limit=${limit}`;
    const response = await axios.get(url, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data || [];
    }

    throw new Error('No se pudieron obtener notas en Pipedrive');
  } catch (error) {
    console.error('Error obteniendo notas en Pipedrive:', error.message);
    return [];
  }
}

async function listDealActivities(dealId, { done, limit = 20 } = {}) {
  try {
    assertPipedriveConfig();
    // /activities?deal_id has returned mixed data; use the deal-scoped endpoint instead.
    const url = `${BASE_URL}/deals/${dealId}/activities?start=0&limit=${limit}`;
    const response = await axios.get(url, getAxiosConfig());

    if (response.data && response.data.success) {
      const items = response.data.data || [];
      if (done === undefined) {
        return items;
      }
      const doneFlag = done ? 1 : 0;
      return items.filter((activity) => (activity.done ? 1 : 0) === doneFlag);
    }

    throw new Error('No se pudieron obtener actividades en Pipedrive');
  } catch (error) {
    console.error('Error obteniendo actividades en Pipedrive:', error.message);
    return [];
  }
}

async function getDealContext(dealId) {
  try {
    const deal = await getDealById(dealId);
    const pipelineId = deal && deal.pipeline_id ? deal.pipeline_id : null;
    const [notes, pendingRaw, doneRaw] = await Promise.all([
      listDealNotes(dealId, 5),
      listDealActivities(dealId, { done: 0, limit: 100 }),
      listDealActivities(dealId, { done: 1, limit: 100 })
    ]);
    const stages = pipelineId ? await listStages(pipelineId) : [];
    const stageName = stages.find((stage) => stage.id === deal?.stage_id)?.name || null;

    const dealIdStr = String(dealId);
    const personIdStr = extractPersonId(deal?.person_id);
    const matchesDealOrPerson = (activity) => {
      const activityDealId = extractDealId(activity);
      if (activityDealId && activityDealId === dealIdStr) {
        return true;
      }
      const activityPersonId = extractPersonId(activity?.person_id);
      return !activityDealId && personIdStr && activityPersonId === personIdStr;
    };

    const pending = pendingRaw.filter(matchesDealOrPerson);
    const pendingWithDt = pending
      .map((activity) => ({ activity, dt: toDt(activity.due_date, activity.due_time) }))
      .filter((item) => item.dt);
    const anchor = pendingWithDt.length
      ? pendingWithDt.sort((a, b) => a.dt - b.dt)[0].dt
      : new Date();

    const recentDone = doneRaw
      .filter(matchesDealOrPerson)
      .map((activity) => ({ activity, dt: doneTime(activity) }))
      .filter((item) => item.dt && item.dt < anchor)
      .sort((a, b) => b.dt - a.dt)
      .slice(0, 2)
      .map((item) => item.activity);

    const ownerId = deal && deal.user_id
      ? (typeof deal.user_id === 'number' ? deal.user_id : deal.user_id.id)
      : null;
    const ownerName = deal && deal.user_id && deal.user_id.name ? deal.user_id.name : null;
    const personId = extractPersonId(deal?.person_id);
    const person = personId ? await getPersonById(personId) : null;
    const personName = person && person.name ? person.name : (deal && deal.person_id && typeof deal.person_id === 'object' ? deal.person_id.name : null);

    return {
      deal,
      ownerId,
      ownerName,
      personId,
      person,
      personName,
      stageName,
      stages,
      notes,
      activities: recentDone,
      openActivities: pending
    };
  } catch (error) {
    console.error('Error obteniendo contexto de deal:', error.message);
    return null;
  }
}

async function createActivity({ dealId, subject, type, done, durationSeconds, noteContent, userId, personId, dueDate, dueTime }) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/activities`;

    const payload = {
      subject: subject || 'Actividad',
      type: type || 'task',
      done: done ? 1 : 0,
      duration: durationSeconds ? Math.round(durationSeconds) : 0,
      deal_id: parseInt(dealId),
      note: noteContent || ''
    };

    if (userId) {
      payload.user_id = userId;
    }
    if (personId) {
      payload.person_id = personId;
    }

    if (dueDate) {
      payload.due_date = dueDate;
    }

    if (dueTime) {
      payload.due_time = dueTime;
    }

    const response = await axios.post(url, payload, getAxiosConfig());

    if (response.data && response.data.success) {
      return {
        activityId: response.data.data.id,
        link: `https://${DOMAIN}/deal/${dealId}`
      };
    }

    throw new Error('No se pudo crear la actividad en Pipedrive');
  } catch (error) {
    console.error('Error creando actividad en Pipedrive:', error.message);
    throw error;
  }
}

async function listOpenDealActivities(dealId, limit = 5) {
  try {
    return await listDealActivities(dealId, { done: 0, limit });
  } catch (error) {
    console.error('Error obteniendo actividades abiertas en Pipedrive:', error.message);
    return [];
  }
}

async function updateActivityDone(activityId, done) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/activities/${activityId}`;
    const response = await axios.put(url, { done: done ? 1 : 0 }, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data;
    }

    throw new Error('No se pudo actualizar la actividad en Pipedrive');
  } catch (error) {
    console.error('Error actualizando actividad en Pipedrive:', error.message);
    throw error;
  }
}

async function updateDealStage(dealId, stageId) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/deals/${dealId}`;
    const response = await axios.put(url, { stage_id: parseInt(stageId) }, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data;
    }

    throw new Error('No se pudo actualizar el deal en Pipedrive');
  } catch (error) {
    console.error('Error actualizando deal en Pipedrive:', error.message);
    throw error;
  }
}

async function updateDealOwner(dealId, ownerId) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/deals/${dealId}`;
    const response = await axios.put(url, { user_id: parseInt(ownerId) }, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data;
    }

    throw new Error('No se pudo actualizar el responsable del deal en Pipedrive');
  } catch (error) {
    console.error('Error actualizando responsable en Pipedrive:', error.message);
    throw error;
  }
}

async function updateDealStatus(dealId, status, lostReasonId) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/deals/${dealId}`;
    const payload = { status };
    if (lostReasonId) {
      payload.lost_reason_id = parseInt(lostReasonId);
    }
    const response = await axios.put(url, payload, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data;
    }

    throw new Error('No se pudo actualizar el estado del deal en Pipedrive');
  } catch (error) {
    console.error('Error actualizando estado del deal:', error.message);
    throw error;
  }
}

async function listLostReasons() {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/dealLostReasons`;
    const response = await axios.get(url, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data || [];
    }

    throw new Error('No se pudieron obtener motivos de pérdida en Pipedrive');
  } catch (error) {
    console.error('Error obteniendo motivos de pérdida:', error.message);
    return [];
  }
}

async function listStages(pipelineId) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/stages?pipeline_id=${pipelineId}`;
    const response = await axios.get(url, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data || [];
    }

    throw new Error('No se pudieron obtener etapas en Pipedrive');
  } catch (error) {
    console.error('Error obteniendo etapas en Pipedrive:', error.message);
    return [];
  }
}

async function listUsers(limit = 200) {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/users?start=0&limit=${limit}`;
    const response = await axios.get(url, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data || [];
    }

    throw new Error('No se pudieron obtener usuarios en Pipedrive');
  } catch (error) {
    console.error('Error obteniendo usuarios en Pipedrive:', error.message);
    return [];
  }
}

async function listDealLabels() {
  try {
    assertPipedriveConfig();
    const url = `${BASE_URL}/dealLabels`;
    const response = await axios.get(url, getAxiosConfig());

    if (response.data && response.data.success) {
      return response.data.data || [];
    }

    throw new Error('No se pudieron obtener labels en Pipedrive');
  } catch (error) {
    console.error('Error obteniendo labels en Pipedrive:', error.message);
    return [];
  }
}

module.exports = {
  createNote,
  createCallActivity,
  createActivity,
  getDealById,
  getDealOwnerId,
  listDealNotes,
  listDealActivities,
  listOpenDealActivities,
  updateActivityDone,
  updateDealStage,
  updateDealOwner,
  updateDealStatus,
  listLostReasons,
  listStages,
  listUsers,
  listDealLabels,
  getPersonById,
  listDealsByPipelineStage,
  listDealsByPipelineStageAll,
  getDealContext
};
