const { createNote, createCallActivity, createActivity, getDealById, listOpenDealActivities, updateActivityDone } = require('../../lib/pipedrive');
const { requireCsrf } = require('../../lib/csrf');
const { requireRateLimit } = require('../../lib/rate-limit');
const { requireUser } = require('../../lib/auth');

function extractId(value) {
  if (!value) return null;
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (typeof value === 'object') {
    if (value.id !== undefined && value.id !== null) return String(value.id);
    if (value.value !== undefined && value.value !== null) return String(value.value);
  }
  return null;
}

function activityMatches(activity, dealIdStr, personIdStr) {
  const activityDealId = extractId(activity?.deal_id);
  if (activityDealId && activityDealId === dealIdStr) return true;
  const activityPersonId = extractId(activity?.person_id);
  return !activityDealId && personIdStr && activityPersonId === personIdStr;
}

function toDt(dueDate, dueTime) {
  if (!dueDate) return null;
  const time = dueTime && String(dueTime).length ? dueTime : '00:00';
  const dt = new Date(`${dueDate}T${time}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function buildNote({ lead, resultado, notas, proximaAccion, duracion, status, nextTaskDate, nextTaskTime, nextTaskType }) {
  const lines = [
    `Resultado: ${resultado || status || 'sin resultado'}`,
    `Duracion: ${duracion || 0}s`,
    `Proxima accion: ${proximaAccion || 'n/a'}`
  ];

  if (lead && lead.nombre) {
    lines.unshift(`Lead: ${lead.nombre} (${lead.telefono || ''})`);
  }

  if (nextTaskDate || nextTaskType) {
    const taskDate = nextTaskDate || 'n/a';
    const taskTime = nextTaskTime || 'n/a';
    const taskType = nextTaskType || 'n/a';
    lines.push(`Proxima tarea: ${taskType} (${taskDate} ${taskTime})`);
  }

  if (notas) {
    lines.push(`Notas: ${notas}`);
  }

  return lines.join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting para Pipedrive
  if (!requireRateLimit(req, res, 'pipedrive')) {
    return;
  }

  // Validar CSRF token
  if (!requireCsrf(req, res)) {
    return;
  }

  // Validar usuario autenticado
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { dealId, lead, resultado, notas, proximaAccion, duracion, status, nextTaskDate, nextTaskTime, nextTaskType } = req.body || {};

    if (!dealId) {
      return res.status(400).json({ error: 'dealId es requerido' });
    }

    const noteContent = buildNote({ lead, resultado, notas, proximaAccion, duracion, status, nextTaskDate, nextTaskTime, nextTaskType });
    const deal = await getDealById(dealId);
    const ownerId = deal && deal.user_id
      ? (typeof deal.user_id === 'number' ? deal.user_id : deal.user_id.id)
      : null;
    const personId = deal && deal.person_id
      ? (typeof deal.person_id === 'number' ? deal.person_id : deal.person_id.value)
      : null;
    const dealIdStr = String(dealId);
    const personIdStr = extractId(personId);

    const note = await createNote(dealId, noteContent, ownerId, personId);
    const subject = `Llamada: ${resultado || status || 'sin resultado'}`;
    const activity = await createCallActivity(dealId, subject, duracion, noteContent, ownerId, personId);

    let followUp = null;
    let closedActivity = null;
    if (nextTaskDate || nextTaskType) {
      const openActivities = await listOpenDealActivities(dealId, 20);
      const matchingOpen = openActivities.filter((activity) => activityMatches(activity, dealIdStr, personIdStr));
      if (matchingOpen.length > 0) {
        const sortedOpen = [...matchingOpen].sort((a, b) => {
        const dtA = toDt(a.due_date, a.due_time) || new Date('9999-12-31T00:00:00');
        const dtB = toDt(b.due_date, b.due_time) || new Date('9999-12-31T00:00:00');
        return dtA - dtB;
      });
      const latestOpen = sortedOpen[0];
        try {
          closedActivity = await updateActivityDone(latestOpen.id, true);
        } catch (closeError) {
          console.error('Error cerrando actividad previa:', closeError.message);
        }
      }

      const typeMap = {
        llamada: 'call',
        whatsapp: 'task',
        email: 'email',
        visita: 'meeting',
        seguimiento: 'task',
        tarea: 'task'
      };
      const followType = typeMap[nextTaskType] || 'task';
      if (nextTaskType && !typeMap[nextTaskType]) {
        console.warn(`Tipo de actividad desconocido: "${nextTaskType}", usando "task" como fallback`);
      }
      const followSubject = `Seguimiento: ${nextTaskType || 'tarea'}`;
      followUp = await createActivity({
        dealId,
        subject: followSubject,
        type: followType,
        done: 0,
        durationSeconds: 0,
        noteContent: noteContent,
        userId: ownerId,
        personId,
        dueDate: nextTaskDate || null,
        dueTime: nextTaskDate ? (nextTaskTime || '09:00') : null
      });
    }

    res.status(200).json({ note, activity, followUp, closedActivity });
  } catch (error) {
    console.error('Error en pipedrive-log:', error);
    res.status(500).json({ error: 'Error al registrar en Pipedrive' });
  }
}
