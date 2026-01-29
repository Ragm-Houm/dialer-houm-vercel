import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ChevronRight, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useSession } from '../lib/session';
import { buildPhoneCandidates, getCountryConfig } from '../lib/review';

const AGE_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'lt7', label: 'Menos de 7 dias' },
  { value: 'between7_15', label: 'De 7 a 15 dias' },
  { value: 'between15_30', label: 'De 15 dias a 30 dias' },
  { value: 'gt30', label: 'Mas de 30 dias' }
];

const COUNTRY_OPTIONS = [
  { value: 'CO', label: 'Colombia', flag: '🇨🇴' },
  { value: 'MX', label: 'Mexico', flag: '🇲🇽' },
  { value: 'CL', label: 'Chile', flag: '🇨🇱' }
];

const TIMEZONES = {
  CO: 'America/Bogota',
  MX: 'America/Mexico_City',
  CL: 'America/Santiago'
};

const REVIEW_ALLOWED_ROLES = ['admin', 'supervisor'];

function getTimeZoneOffset(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const utcTime = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return utcTime - date.getTime();
}

function toUtcFromTimeZone(localDateTime, timeZone) {
  if (!localDateTime) return null;
  const [datePart, timePart] = localDateTime.split('T');
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute || 0, 0));
  const offset = getTimeZoneOffset(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset).toISOString();
}

function toUtcFromDateTimeParts(datePart, timePart, timeZone) {
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute || 0, 0));
  const offset = getTimeZoneOffset(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset).toISOString();
}

function getLocalDateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
}

function computeCloseAtFromPreset(preset, timeZone) {
  const now = new Date();
  if (preset === '2h') {
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const { date, time } = getLocalDateParts(later, timeZone);
    return toUtcFromDateTimeParts(date, time, timeZone);
  }
  if (preset === '4h') {
    const later = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const { date, time } = getLocalDateParts(later, timeZone);
    return toUtcFromDateTimeParts(date, time, timeZone);
  }
  if (preset === 'today') {
    const { date } = getLocalDateParts(now, timeZone);
    return toUtcFromDateTimeParts(date, '23:59', timeZone);
  }
  if (preset === 'tomorrow') {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { date } = getLocalDateParts(tomorrow, timeZone);
    return toUtcFromDateTimeParts(date, '23:59', timeZone);
  }
  if (preset === 'week') {
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { date } = getLocalDateParts(week, timeZone);
    return toUtcFromDateTimeParts(date, '23:59', timeZone);
  }
  return null;
}

function formatCountdown(closeAt) {
  if (!closeAt) return null;
  const diffMs = new Date(closeAt).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return null;
  if (diffMs <= 0) return 'Cerrada';
  const minutes = Math.floor(diffMs / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes - days * 24 * 60) / 60);
  const mins = minutes % 60;
  return `${days}d ${hours}h ${mins}m`;
}

function isAgeBarActive(filter, label) {
  if (!filter || !label) return false;
  if (filter === 'all') return true;
  if (filter === 'lt7') return label.includes('< 7');
  if (filter === 'between7_15') return label.includes('> 7') || label.includes('< 15');
  if (filter === 'between15_30') return label.includes('> 15') || label.includes('< 30');
  if (filter === 'gt30') return label.includes('> 30');
  return false;
}

const MANUAL_SOURCE_OPTIONS = [
  { value: 'auto', label: 'Automatica (Pipedrive)' },
  { value: 'manual', label: 'Subida manual (CSV / Excel)' }
];

const LABEL_OPTIONS = [
  { id: '156', label: 'RENTAL' },
  { id: '1117', label: 'ALIANZA' },
  { id: '96', label: 'SALES' },
  { id: '206', label: 'SALES / RENTAL' },
  { id: '839', label: 'REPUBLICACIÓN' },
  { id: '889', label: 'REPUBLICACIÓN VIP' }
];

const MANUAL_HEADER_ALIASES = {
  country: ['country', 'pais', 'país'],
  pipeline_id: ['pipeline_id', 'pipeline', 'pipelineid', 'pipeline id'],
  stage_id: ['stage_id', 'stageid', 'etapa_id', 'etapa id', 'etapa'],
  stage_name: ['stage_name', 'etapa_nombre', 'etapa nombre', 'stage name'],
  deal_id: ['deal_id', 'dealid', 'negocio_id', 'negocio id', 'id', 'deal id'],
  deal_title: ['deal_title', 'titulo', 'título', 'nombre', 'deal title'],
  phone_primary: ['phone_primary', 'telefono_principal', 'telefono principal', 'phone1', 'telefono1', 'telefono'],
  phone_secondary: ['phone_secondary', 'telefono_secundario', 'telefono secundario', 'phone2', 'telefono2'],
  add_time: ['add_time', 'created_at', 'fecha_creacion', 'fecha creación', 'created time']
};

const MANUAL_REQUIRED_FIELDS = ['pipeline_id', 'stage_id', 'deal_id', 'deal_title', 'add_time'];
const MANUAL_TEMPLATE_HEADERS = [
  'pipeline_id',
  'stage_id',
  'stage_name',
  'deal_id',
  'deal_title',
  'phone_primary',
  'phone_secondary',
  'add_time'
];

function normalizeHeaderKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '');
}

function buildHeaderMap(headers) {
  const map = new Map();
  (headers || []).forEach((raw) => {
    const norm = normalizeHeaderKey(raw);
    if (!norm) return;
    Object.entries(MANUAL_HEADER_ALIASES).forEach(([canonical, aliases]) => {
      const match = aliases.map(normalizeHeaderKey).includes(norm);
      if (match && !map.has(canonical)) {
        map.set(canonical, raw);
      }
    });
  });
  return map;
}

function parseDateFlexible(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+([.,]\d+)?$/.test(raw)) {
    const normalized = raw.replace(',', '.');
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      return new Date(excelEpoch + numeric * 86400000);
    }
  }
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso;
  const withTime = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (withTime) {
    const [, dd, mm, yyyy, hh, min] = withTime;
    const dt = new Date(`${yyyy}-${mm}-${dd}T${String(hh).padStart(2, '0')}:${min}:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const m = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const dt = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function normalizeManualRows(rawRows) {
  if (!Array.isArray(rawRows)) return { rows: [], error: 'Archivo sin datos' };
  const headers = rawRows.length ? Object.keys(rawRows[0]) : [];
  const headerMap = buildHeaderMap(headers);
  const missing = MANUAL_REQUIRED_FIELDS.filter((field) => !headerMap.get(field));
  if (missing.length > 0) {
    return {
      rows: [],
      error: `Faltan columnas requeridas: ${missing.join(', ')}`
    };
  }

  const rows = rawRows
    .map((row) => {
      const mapped = {};
      headerMap.forEach((original, canonical) => {
        mapped[canonical] = row[original];
      });
      const country = String(mapped.country || '').toUpperCase().trim();
      const pipelineId = mapped.pipeline_id ? String(mapped.pipeline_id).trim() : '';
      const stageId = mapped.stage_id ? String(mapped.stage_id).trim() : '';
      const stageName = mapped.stage_name ? String(mapped.stage_name).trim() : '';
      const dealId = mapped.deal_id ? String(mapped.deal_id).trim() : '';
      const dealTitle = mapped.deal_title ? String(mapped.deal_title).trim() : '';
      const parsedDate = parseDateFlexible(mapped.add_time);
      const addTime = parsedDate ? parsedDate.toISOString() : mapped.add_time;
      return {
        country,
        pipeline_id: pipelineId,
        stage_id: stageId,
        stage_name: stageName,
        deal_id: dealId,
        deal_title: dealTitle,
        phone_primary: mapped.phone_primary ? String(mapped.phone_primary).trim() : '',
        phone_secondary: mapped.phone_secondary ? String(mapped.phone_secondary).trim() : '',
        add_time: addTime
      };
    })
    .filter((row) => row.deal_id);

  return { rows, error: '' };
}

function buildManualPreview(rows) {
  let total = 0;
  let withOne = 0;
  let withTwo = 0;
  let withoutValid = 0;
  const ageBuckets = {
    lt7: 0,
    gt7: 0,
    lt15: 0,
    gt15: 0,
    lt30: 0,
    gt30: 0
  };

  rows.forEach((row) => {
    total += 1;
    const phoneInputs = [row.phone_primary, row.phone_secondary].filter(Boolean);
    const person = { phone: phoneInputs.map((value) => ({ value })) };
    const candidates = buildPhoneCandidates(person, row.country || 'CO');
    const validCount = candidates.candidates.length;
    if (validCount >= 2) withTwo += 1;
    else if (validCount === 1) withOne += 1;
    else withoutValid += 1;

    const dt = parseDateFlexible(row.add_time);
    if (dt) {
      const diffMs = Date.now() - dt.getTime();
      const ageDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (ageDays < 7) ageBuckets.lt7 += 1;
      if (ageDays >= 7 && ageDays <= 15) ageBuckets.gt7 += 1;
      if (ageDays < 15) ageBuckets.lt15 += 1;
      if (ageDays > 15) ageBuckets.gt15 += 1;
      if (ageDays < 30) ageBuckets.lt30 += 1;
      if (ageDays > 30) ageBuckets.gt30 += 1;
    }
  });

  return {
    total,
    withOne,
    withTwo,
    withoutValid,
    ready: withOne + withTwo,
    blockedActive: 0,
    ageBuckets
  };
}

export default function ReviewPage() {
  const OUTCOME_TYPES = [
    { value: 'final', label: 'Final' },
    { value: 'intermediate', label: 'Intermedio' }
  ];
  const OUTCOME_BUCKETS = [
    { value: 'interesado', label: 'Interesado' },
    { value: 'agendado', label: 'Fotos agendadas' },
    { value: 'perdido', label: 'Perdido' },
    { value: 'no_contesta', label: 'No contesta' },
    { value: 'falso', label: 'Información falsa' },
    { value: 'futuro', label: 'Disponibilidad futura' },
    { value: 'contactado', label: 'Contactado' },
    { value: 'otro', label: 'Otro' }
  ];
  const router = useRouter();
  const { session, isSessionReady, sessionError, clearSession, csrfFetch } = useSession();
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [idToken, setIdToken] = useState('');
  const [userRole, setUserRole] = useState('ejecutivo');
  const [country, setCountry] = useState('CO');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardCountry, setWizardCountry] = useState('');
  const [wizardSource, setWizardSource] = useState('auto');
  const [wizardFileName, setWizardFileName] = useState('');
  const [wizardFileRows, setWizardFileRows] = useState([]);
  const [wizardFileError, setWizardFileError] = useState('');
  const [wizardFileLoading, setWizardFileLoading] = useState(false);
  const [wizardStageId, setWizardStageId] = useState('');
  const [wizardStageName, setWizardStageName] = useState('');
  const [wizardStages, setWizardStages] = useState([]);
  const [wizardStageLoading, setWizardStageLoading] = useState(false);
  const [wizardOwnerMode, setWizardOwnerMode] = useState('all');
  const [wizardOwnerOptions, setWizardOwnerOptions] = useState([]);
  const [wizardSelectedOwners, setWizardSelectedOwners] = useState([]);
  const [wizardOwnersLoading, setWizardOwnersLoading] = useState(false);
  const [wizardLabelInclude, setWizardLabelInclude] = useState(['156']);
  const [wizardLabelExclude, setWizardLabelExclude] = useState([]);
  const [wizardPreviewLoading, setWizardPreviewLoading] = useState(false);
  const [wizardPreview, setWizardPreview] = useState(null);
  const [wizardProgress, setWizardProgress] = useState(0);
  const [wizardPreviewStatus, setWizardPreviewStatus] = useState('');
  const [wizardPreviewError, setWizardPreviewError] = useState('');
  const [wizardAgeFilter, setWizardAgeFilter] = useState('lt7');
  const [wizardImpactNote, setWizardImpactNote] = useState('');
  const [wizardNoTimeLimit, setWizardNoTimeLimit] = useState(false);
  const [wizardClosePreset, setWizardClosePreset] = useState('2h');
  const [wizardCreateProgress, setWizardCreateProgress] = useState(0);
  const [wizardCreateStatus, setWizardCreateStatus] = useState('');
  const [wizardCreateLogs, setWizardCreateLogs] = useState([]);
  const [wizardCreateDone, setWizardCreateDone] = useState(false);
  const [wizardAllowAllExecs, setWizardAllowAllExecs] = useState(true);
  const [wizardExecutives, setWizardExecutives] = useState([]);
  const [wizardSelectedExecs, setWizardSelectedExecs] = useState([]);
  const [wizardCampaignName, setWizardCampaignName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createNotice, setCreateNotice] = useState('');
  const [createError, setCreateError] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsFilter, setCampaignsFilter] = useState('all');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailStatusNote, setDetailStatusNote] = useState('');
  const [reactivateCampaign, setReactivateCampaign] = useState(null);
  const [reactivateNoLimit, setReactivateNoLimit] = useState(false);
  const [reactivatePreset, setReactivatePreset] = useState('2h');
  const [outcomes, setOutcomes] = useState([]);
  const [outcomesLoading, setOutcomesLoading] = useState(false);
  const [newOutcomeLabel, setNewOutcomeLabel] = useState('');
  const [newOutcomeType, setNewOutcomeType] = useState('final');
  const [newOutcomeBucket, setNewOutcomeBucket] = useState('otro');
  const [outcomeError, setOutcomeError] = useState('');
  const wizardRestoreRef = useRef(false);
  const wizardStorageKey = useMemo(() => (email ? `reviewWizard:${email}` : 'reviewWizard'), [email]);

  const clearWizardDraft = () => {
    if (typeof window === 'undefined') return;
    if (!wizardStorageKey) return;
    sessionStorage.removeItem(wizardStorageKey);
    wizardRestoreRef.current = false;
  };

  useEffect(() => {
    if (!isSessionReady) return;
    setAuthError(sessionError || '');
    if (!session?.email) {
      clearWizardDraft();
      router.replace('/login');
      return;
    }
    if (!REVIEW_ALLOWED_ROLES.includes(session.role)) {
      setAuthError('Tu rol no tiene acceso a Campañas');
      router.replace('/login');
      return;
    }
    setEmail(session.email);
    setIdToken('__cookie__');
    setUserRole(session.role || 'ejecutivo');
    const baseCountry = session.country || 'CO';
    setCountry(baseCountry);
    setWizardCountry(baseCountry);
  }, [isSessionReady, session, sessionError, router]);

  const handleLogout = () => {
    clearWizardDraft();
    clearSession();
    router.replace('/login');
  };

  useEffect(() => {
    if (!wizardOpen) return;
    if (wizardRestoreRef.current) return;
    if (wizardStep > 1) return;
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem(wizardStorageKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (!saved || !saved.step || saved.step < 3) return;
      setWizardCountry(saved.country || wizardCountry || '');
      setWizardSource(saved.source || 'auto');
      setWizardStageId(saved.stageId || '');
      setWizardStageName(saved.stageName || '');
      setWizardOwnerMode(saved.ownerMode || 'all');
      setWizardSelectedOwners(saved.selectedOwners || []);
      setWizardLabelInclude(saved.labelInclude || ['156']);
      setWizardLabelExclude(saved.labelExclude || []);
      setWizardAgeFilter(saved.ageFilter || 'lt7');
      setWizardNoTimeLimit(Boolean(saved.noTimeLimit));
      setWizardClosePreset(saved.closePreset || '2h');
      setWizardAllowAllExecs(saved.allowAllExecs !== false);
      setWizardSelectedExecs(saved.selectedExecs || []);
      setWizardCampaignName(saved.campaignName || '');
      setWizardFileName(saved.fileName || '');
      setWizardFileRows(saved.fileRows || []);
      setWizardPreview(saved.preview || null);
      setWizardStep(saved.step);
      setWizardPreviewError('');
      setWizardPreviewLoading(false);
    } catch (error) {
      console.warn('No se pudo restaurar wizard:', error.message);
    } finally {
      wizardRestoreRef.current = true;
    }
  }, [wizardOpen, wizardStorageKey, wizardCountry, wizardStep]);

  useEffect(() => {
    if (!wizardOpen || wizardStep < 3) return;
    if (wizardPreviewLoading) return;
    if (wizardSource === 'manual' && wizardFileRows.length === 0) return;
    if (!wizardPreview) return;
    if (typeof window === 'undefined') return;
    const snapshot = {
      step: wizardStep,
      country: wizardCountry,
      source: wizardSource,
      stageId: wizardStageId,
      stageName: wizardStageName,
      ownerMode: wizardOwnerMode,
      selectedOwners: wizardSelectedOwners,
      labelInclude: wizardLabelInclude,
      labelExclude: wizardLabelExclude,
      ageFilter: wizardAgeFilter,
      noTimeLimit: wizardNoTimeLimit,
      closePreset: wizardClosePreset,
      allowAllExecs: wizardAllowAllExecs,
      selectedExecs: wizardSelectedExecs,
      campaignName: wizardCampaignName,
      fileName: wizardFileName,
      fileRows: wizardFileRows,
      preview: wizardPreview
    };
    try {
      sessionStorage.setItem(wizardStorageKey, JSON.stringify(snapshot));
    } catch (error) {
      console.warn('No se pudo guardar wizard:', error.message);
    }
  }, [
    wizardOpen,
    wizardStep,
    wizardPreview,
    wizardPreviewLoading,
    wizardSource,
    wizardFileRows,
    wizardCountry,
    wizardStageId,
    wizardStageName,
    wizardOwnerMode,
    wizardSelectedOwners,
    wizardLabelInclude,
    wizardLabelExclude,
    wizardAgeFilter,
    wizardNoTimeLimit,
    wizardClosePreset,
    wizardAllowAllExecs,
    wizardSelectedExecs,
    wizardFileName,
    wizardStorageKey
  ]);

  const downloadManualTemplate = async (type = 'csv') => {
    const sample = {
      pipeline_id: String(getCountryConfig(wizardCountry || 'CO')?.pipelineId || '60'),
      stage_id: String(wizardStageId || getCountryConfig(wizardCountry || 'CO')?.defaultStageId || '605'),
      stage_name: wizardStageName || 'No contesta',
      deal_id: '123456',
      deal_title: 'Ejemplo Lead',
      phone_primary: '+573001112233',
      phone_secondary: '',
      add_time: new Date().toISOString().slice(0, 10)
    };

    if (type === 'xlsx') {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet([sample], { header: MANUAL_TEMPLATE_HEADERS });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'template');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plantilla_campana.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return;
    }

    const headerLine = MANUAL_TEMPLATE_HEADERS.join(',');
    const valuesLine = MANUAL_TEMPLATE_HEADERS.map((key) => sample[key] ?? '').join(',');
    const csv = `${headerLine}\n${valuesLine}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_campana.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const loadManualFile = async (file) => {
    if (!file) return;
    setWizardFileLoading(true);
    setWizardFileError('');
    setWizardFileName(file.name || '');
    setWizardPreview(null);
    setWizardPreviewError('');
    setWizardPreviewStatus('Leyendo archivo');
    setWizardProgress(10);
    setWizardPreviewLoading(true);

    try {
      const ext = (file.name || '').split('.').pop().toLowerCase();
      let rawRows = [];
      if (ext === 'csv') {
        const Papa = (await import('papaparse')).default;
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rawRows = parsed.data || [];
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      } else {
        throw new Error('Formato no soportado. Usa CSV o XLSX.');
      }

      setWizardPreviewStatus('Normalizando columnas');
      setWizardProgress(35);
      const { rows, error } = normalizeManualRows(rawRows);
      if (error) {
        throw new Error(error);
      }
      if (rows.length === 0) {
        throw new Error('No se encontraron filas validas en el archivo.');
      }

      const enrichedRows = rows.map((row) => ({
        ...row,
        country: row.country || (wizardCountry ? wizardCountry.toUpperCase() : '')
      }));
      const first = enrichedRows[0];
      if (wizardCountry && first.country && first.country !== wizardCountry) {
        throw new Error(`El archivo es del pais ${first.country} y no coincide con ${wizardCountry}.`);
      }
      const sameStage = enrichedRows.every((row) => row.stage_id === first.stage_id);
      const samePipeline = enrichedRows.every((row) => row.pipeline_id === first.pipeline_id);
      if (!sameStage || !samePipeline) {
        throw new Error('El archivo debe contener una sola etapa y pipeline.');
      }

      setWizardStageId(String(first.stage_id || ''));
      setWizardStageName(first.stage_name || `Etapa ${first.stage_id}`);
      setWizardFileRows(enrichedRows);
      setWizardPreviewStatus('Calculando resumen');
      setWizardProgress(70);
      setWizardPreview(buildManualPreview(enrichedRows));
      setWizardProgress(100);
      setWizardPreviewStatus('Archivo cargado');
    } catch (error) {
      console.error('Error leyendo archivo manual:', error);
      setWizardFileError(error.message || 'No se pudo cargar el archivo.');
      setWizardFileRows([]);
      setWizardPreview(null);
    } finally {
      setWizardPreviewLoading(false);
      setWizardFileLoading(false);
      setTimeout(() => {
        setWizardProgress(0);
        setWizardPreviewStatus('');
      }, 1200);
    }
  };

  const loadWizardStages = async (nextCountry) => {
    if (!nextCountry) return;
    try {
      setWizardStageLoading(true);
      const res = await fetch(`/api/review-stages?country=${nextCountry}`);
      if (!res.ok) {
        setWizardStages([]);
        return;
      }
      const data = await res.json();
      const stages = data.stages || [];
      setWizardStages(stages);
      const first = stages[0];
      setWizardStageId(first ? String(first.id) : '');
      setWizardStageName(first ? first.name : '');
    } catch (error) {
      console.error('Error cargando etapas:', error);
      setWizardStages([]);
    } finally {
      setWizardStageLoading(false);
    }
  };

  const loadWizardOwners = async () => {
    if (!email || !idToken || !wizardCountry) return;
    try {
      setWizardOwnersLoading(true);
      const usersRes = await fetch(
        `/api/users?email=${encodeURIComponent(email)}&idToken=${encodeURIComponent(idToken)}`
      );
      const usersData = await usersRes.json();
      if (!usersRes.ok) {
        setWizardOwnerOptions([]);
        return;
      }
      const execEmails = (usersData.users || [])
        .filter((user) => user.activo !== false && user.role === 'ejecutivo' && user.country === wizardCountry)
        .map((user) => String(user.email).toLowerCase());

      const pdRes = await csrfFetch('/api/pipedrive-users');
      const pdData = await pdRes.json();
      if (!pdRes.ok) {
        setWizardOwnerOptions([]);
        return;
      }
      const options = (pdData.users || [])
        .filter((user) => user.email && execEmails.includes(String(user.email).toLowerCase()))
        .map((user) => ({
          id: String(user.id),
          email: user.email,
          name: user.name || user.email
        }));
      setWizardOwnerOptions(options);
      if (wizardOwnerMode === 'all') {
        setWizardSelectedOwners(options.map((opt) => opt.id));
      }
    } catch (error) {
      console.error('Error cargando ejecutivos Pipedrive:', error);
      setWizardOwnerOptions([]);
    } finally {
      setWizardOwnersLoading(false);
    }
  };

  useEffect(() => {
    if (!wizardCountry) return;
    if (wizardSource !== 'auto') return;
    loadWizardStages(wizardCountry);
  }, [wizardCountry, wizardSource]);

  useEffect(() => {
    if (wizardSource !== 'manual') return;
    setWizardFileName('');
    setWizardFileRows([]);
    setWizardFileError('');
    setWizardPreview(null);
  }, [wizardCountry, wizardSource]);

  useEffect(() => {
    if (!wizardOpen) return;
    setWizardStageId('');
    setWizardStageName('');
    setWizardPreview(null);
    setWizardPreviewError('');
    setWizardPreviewStatus('');
    setWizardProgress(0);
    if (wizardSource === 'manual') {
      setWizardOwnerMode('all');
      setWizardSelectedOwners([]);
      setWizardStages([]);
    }
    if (wizardSource === 'auto') {
      setWizardLabelInclude(['156']);
      setWizardLabelExclude([]);
    }
  }, [wizardSource, wizardOpen]);

  const loadWizardPreview = async () => {
    if (!wizardCountry || !wizardStageId) return;
    if (wizardSource === 'manual') {
      if (!wizardFileRows || wizardFileRows.length === 0) return;
      setWizardPreviewError('');
      setWizardPreviewLoading(true);
      setWizardPreviewStatus('Procesando archivo...');
      setWizardProgress(30);
      const preview = buildManualPreview(wizardFileRows);
      setWizardPreview(preview);
      setWizardProgress(100);
      setWizardPreviewStatus('Listo');
      setWizardPreviewLoading(false);
      return;
    }
    try {
      setWizardProgress(10);
      setWizardPreviewLoading(true);
      setWizardPreviewStatus('Consultando Pipedrive...');
      setWizardPreviewError('');
      const ownerIdsParam = wizardOwnerMode === 'all' ? '' : `&ownerIds=${wizardSelectedOwners.join(',')}`;
      const includeLabelsParam =
        wizardLabelInclude.length > 0 ? `&includeLabels=${wizardLabelInclude.join(',')}` : '';
      const excludeLabelsParam =
        wizardLabelExclude.length > 0 ? `&excludeLabels=${wizardLabelExclude.join(',')}` : '';
      const res = await fetch(
        `/api/campaign-preview?country=${wizardCountry}&stageId=${wizardStageId}${ownerIdsParam}${includeLabelsParam}${excludeLabelsParam}&email=${encodeURIComponent(
          email
        )}&idToken=${encodeURIComponent(idToken)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setWizardPreview(null);
        const message = data.error || 'No se pudo cargar el resumen';
        setWizardPreviewError(message);
        return;
      }
      setWizardProgress(80);
      setWizardPreviewStatus('Procesando resultados...');
      setWizardPreview(data);
    } catch (error) {
      console.error('Error cargando preview:', error);
      setWizardPreview(null);
      setWizardPreviewError('Error cargando resumen. Intenta de nuevo.');
    } finally {
      setWizardProgress(100);
      setWizardPreviewStatus('Listo');
      setWizardPreviewLoading(false);
    }
  };

  const loadCampaigns = async (filter = campaignsFilter) => {
    if (!email || !idToken) return;
    try {
      setCampaignsLoading(true);
      const statusParam = filter && filter !== 'all' ? `&status=${filter}` : '';
      const res = await fetch(
        `/api/campaigns?country=${country}${statusParam}&email=${encodeURIComponent(email)}&idToken=${encodeURIComponent(idToken)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCampaigns([]);
        return;
      }
      const active = data.campaigns || [];
      const now = Date.now();
      const expired = active.filter(
        (campaign) =>
          campaign.status === 'active' &&
          !campaign.no_time_limit &&
          campaign.close_at &&
          new Date(campaign.close_at).getTime() <= now
      );
      if (expired.length > 0) {
        await Promise.all(
          expired.map((campaign) =>
            csrfFetch('/api/campaigns', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignKey: campaign.campaign_key,
                status: 'inactive',
                email,
                idToken
              })
            })
          )
        );
      }
      const updated = active.map((campaign) =>
        expired.find((item) => item.campaign_key === campaign.campaign_key)
          ? { ...campaign, status: 'inactive' }
          : campaign
      );
      setCampaigns(updated);
    } catch (error) {
      console.error('Error cargando campañas:', error);
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadOutcomes = async () => {
    if (!email || !idToken) return;
    try {
      setOutcomesLoading(true);
      const res = await fetch(
        `/api/outcomes?email=${encodeURIComponent(email)}&idToken=${encodeURIComponent(idToken)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setOutcomeError(data.error || 'No se pudieron cargar los estados');
        return;
      }
      setOutcomes(data.outcomes || []);
      setOutcomeError('');
    } catch (error) {
      console.error('Error cargando outcomes:', error);
      setOutcomeError('Error cargando estados');
    } finally {
      setOutcomesLoading(false);
    }
  };

  useEffect(() => {
    if (!email || !idToken) return;
    loadCampaigns(campaignsFilter);
    loadOutcomes();
  }, [email, idToken, country, campaignsFilter]);

  useEffect(() => {
    if (!createNotice) return;
    const timer = setTimeout(() => setCreateNotice(''), 4200);
    return () => clearTimeout(timer);
  }, [createNotice]);

  useEffect(() => {
    if (wizardOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    document.body.style.overflow = '';
  }, [wizardOpen]);

  const wizardAgeStats = useMemo(() => {
    if (!wizardPreview?.ageBuckets) return [];
    return [
      { label: '< 7 dias', value: wizardPreview.ageBuckets.lt7 },
      { label: '> 7 dias', value: wizardPreview.ageBuckets.gt7 },
      { label: '< 15 dias', value: wizardPreview.ageBuckets.lt15 },
      { label: '> 15 dias', value: wizardPreview.ageBuckets.gt15 },
      { label: '< 30 dias', value: wizardPreview.ageBuckets.lt30 },
      { label: '> 30 dias', value: wizardPreview.ageBuckets.gt30 }
    ];
  }, [wizardPreview]);

  const wizardImpactCount = useMemo(() => {
    if (!wizardPreview?.ageBuckets) return 0;
    const buckets = wizardPreview.ageBuckets;
    switch (wizardAgeFilter) {
      case 'all':
        return wizardPreview.total || 0;
      case 'lt7':
        return buckets.lt7 || 0;
      case 'between7_15':
        return (buckets.gt7 || 0) + (buckets.lt15 || 0);
      case 'between15_30':
        return (buckets.gt15 || 0) + (buckets.lt30 || 0);
      case 'gt30':
        return buckets.gt30 || 0;
      default:
        return 0;
    }
  }, [wizardAgeFilter, wizardPreview]);

  const campaignNamePreview = useMemo(() => {
    if (!wizardCountry) return '';
    const stageLabel = wizardStageName || (wizardStageId ? `Etapa ${wizardStageId}` : 'Etapa');
    const dateStr = new Date().toISOString().slice(0, 10);
    const prefix = wizardCampaignName ? `${wizardCampaignName} - ` : '';
    return `${prefix}${wizardCountry}-${stageLabel}-${dateStr}`;
  }, [wizardCampaignName, wizardCountry, wizardStageId, wizardStageName]);

  useEffect(() => {
    if (!wizardPreview) {
      setWizardImpactNote('');
      return;
    }
    const label = AGE_FILTERS.find((filter) => filter.value === wizardAgeFilter)?.label || '';
    setWizardImpactNote(`Campaña para: <span class="impact-count">${wizardImpactCount}</span> leads (${label}).`);
  }, [wizardAgeFilter, wizardPreview, wizardImpactCount]);

  useEffect(() => {
    if (!wizardOpen || wizardStep < 3) return;
    loadWizardPreview();
  }, [wizardOpen, wizardStep, wizardCountry, wizardStageId, email, idToken, wizardSource, wizardFileRows]);

  useEffect(() => {
    if (!wizardPreviewLoading) return;
    let progress = 10;
    setWizardProgress(progress);
    setWizardPreviewStatus('Iniciando carga...');
    const timer = setInterval(() => {
      progress = Math.min(85, progress + Math.floor(Math.random() * 4) + 2);
      setWizardProgress(progress);
    }, 700);
    return () => clearInterval(timer);
  }, [wizardPreviewLoading]);

  const loadExecutives = async () => {
    if (!email || !idToken) return;
    try {
      const res = await fetch(`/api/users?email=${encodeURIComponent(email)}&idToken=${encodeURIComponent(idToken)}`);
      const data = await res.json();
      if (!res.ok) {
        return;
      }
      const users = (data.users || []).filter(
        (user) => user.activo !== false && user.role === 'ejecutivo' && user.country === wizardCountry
      );
      setWizardExecutives(users);
      if (wizardAllowAllExecs) {
        setWizardSelectedExecs(users.map((user) => user.email));
      }
    } catch (error) {
      console.error('Error cargando ejecutivos:', error);
    }
  };

  useEffect(() => {
    if (!wizardOpen || wizardStep !== 5) return;
    loadExecutives();
  }, [wizardOpen, wizardStep, wizardCountry, wizardAllowAllExecs, email, idToken]);

  useEffect(() => {
    if (!wizardOpen || wizardStep !== 2) return;
    if (wizardSource !== 'auto') return;
    loadWizardOwners();
  }, [wizardOpen, wizardStep, wizardCountry, wizardOwnerMode, email, idToken, wizardSource]);

  const handleWizardStageChange = (value) => {
    setWizardStageId(value);
    const match = wizardStages.find((stage) => String(stage.id) === String(value));
    setWizardStageName(match ? match.name : '');
    setWizardPreview(null);
    setWizardProgress(0);
  };

  const resetWizard = () => {
    setWizardStep(1);
    setWizardCountry(country || 'CO');
    setWizardSource('auto');
    setWizardFileName('');
    setWizardFileRows([]);
    setWizardFileError('');
    setWizardFileLoading(false);
    setWizardStageId('');
    setWizardStageName('');
    setWizardPreview(null);
    setWizardPreviewError('');
    setWizardProgress(0);
    setWizardPreviewStatus('');
    setWizardAgeFilter('lt7');
    setWizardNoTimeLimit(false);
    setWizardClosePreset('2h');
    setWizardAllowAllExecs(true);
    setWizardExecutives([]);
    setWizardSelectedExecs([]);
    setWizardCampaignName('');
    setWizardOwnerMode('all');
    setWizardOwnerOptions([]);
    setWizardSelectedOwners([]);
    setWizardLabelInclude(['156']);
    setWizardLabelExclude([]);
    setCreateError('');
    setWizardCreateProgress(0);
    setWizardCreateStatus('');
    setWizardCreateLogs([]);
    setWizardCreateDone(false);
  };

  const handleWizardCreate = async () => {
    if (!wizardCountry || !wizardStageId) return;
    try {
      setWizardStep(7);
      setCreating(true);
      setCreateError('');
      setWizardCreateProgress(10);
      setWizardCreateStatus('Validando configuración...');
      setWizardCreateLogs(['Validando configuración...']);
      const closeTz = TIMEZONES[wizardCountry] || 'America/Bogota';
      const closeAt = wizardNoTimeLimit ? null : computeCloseAtFromPreset(wizardClosePreset, closeTz);
      setWizardCreateProgress(30);
      const creatingLabel =
        wizardSource === 'manual' ? 'Creando campaña desde archivo...' : 'Creando campaña en Pipedrive...';
      setWizardCreateStatus(creatingLabel);
      setWizardCreateLogs((prev) => [...prev, 'Creando campaña...']);
      const res = await csrfFetch('/api/campaign-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country: wizardCountry,
            stageId: wizardStageId,
            stageName: wizardStageName,
            ageFilter: wizardAgeFilter,
            ownerIds: wizardSource === 'auto' && wizardOwnerMode !== 'all' ? wizardSelectedOwners : [],
            includeLabels: wizardSource === 'auto' ? wizardLabelInclude : [],
            excludeLabels: wizardSource === 'auto' ? wizardLabelExclude : [],
            campaignName: wizardCampaignName,
            closeAt,
            closeTz,
            noTimeLimit: wizardNoTimeLimit,
          allowAllExecs: wizardAllowAllExecs,
          allowedExecs: wizardAllowAllExecs ? [] : wizardSelectedExecs,
          source: wizardSource,
          manualRows: wizardSource === 'manual' ? wizardFileRows : [],
          email,
          idToken
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || 'No se pudo crear la campana';
        setCreateError(message);
        setWizardCreateStatus('Error');
        setWizardCreateLogs((prev) => [...prev, message]);
        return;
      }
      setWizardCreateProgress(70);
      setWizardCreateStatus('Asignando campaña al dialer...');
      setWizardCreateLogs((prev) => [...prev, 'Asignando campaña al dialer...']);
      setCreateNotice(`Campaña creada: ${data.name}`);
      loadCampaigns();
      setWizardCreateProgress(100);
      setWizardCreateStatus('Campaña creada exitosamente.');
      setWizardCreateLogs((prev) => [...prev, 'Campaña creada exitosamente.']);
      setWizardCreateDone(true);
      clearWizardDraft();
    } catch (error) {
      console.error('Error creando campaña:', error);
      setCreateError('Error creando campaña. Intenta nuevamente.');
      setWizardCreateStatus('Error');
      setWizardCreateLogs((prev) => [...prev, 'Error creando campaña.']);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleCampaign = async (campaignKey, status) => {
    if (status === 'active' && detail?.campaign?.campaign_key === campaignKey && detail?.campaign?.status !== 'active') {
      setReactivateCampaign(detail.campaign);
      setReactivateNoLimit(false);
      setReactivatePreset('2h');
      return;
    }
    try {
      await csrfFetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignKey,
          status,
          email,
          idToken
        })
      });
      setDetailStatusNote(`Campaña ${status === 'active' ? 'activada' : 'inactivada'}.`);
      loadCampaigns();
      if (detail?.campaign?.campaign_key === campaignKey) {
        setDetail((prev) => prev && { ...prev, campaign: { ...prev.campaign, status } });
      }
      setTimeout(() => setDetailStatusNote(''), 2800);
    } catch (error) {
      console.error('Error actualizando campaña:', error);
    }
  };

  const confirmReactivateCampaign = async () => {
    if (!reactivateCampaign) return;
    const closeTz = TIMEZONES[reactivateCampaign.country] || 'America/Bogota';
    const closeAt = reactivateNoLimit ? null : computeCloseAtFromPreset(reactivatePreset, closeTz);
    try {
      const res = await csrfFetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignKey: reactivateCampaign.campaign_key,
          status: 'active',
          closeAt,
          closeTz,
          noTimeLimit: reactivateNoLimit,
          email,
          idToken
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailStatusNote(data.error || 'No se pudo reactivar la campaña.');
        return;
      }
      setReactivateCampaign(null);
      setDetailStatusNote('Campaña reactivada.');
      loadCampaigns();
      if (detail?.campaign?.campaign_key === reactivateCampaign.campaign_key) {
        setDetail((prev) =>
          prev && {
            ...prev,
            campaign: {
              ...prev.campaign,
              status: 'active',
              close_at: data.campaign?.close_at || null,
              close_tz: data.campaign?.close_tz || null,
              no_time_limit: data.campaign?.no_time_limit || false
            }
          }
        );
      }
      setTimeout(() => setDetailStatusNote(''), 2800);
    } catch (error) {
      console.error('Error reactivando campaña:', error);
      setDetailStatusNote('Error reactivando campaña.');
    }
  };

  const handleDeleteCampaign = async (campaignKey) => {
    if (!campaignKey) return;
    const confirmed = window.confirm('¿Eliminar esta campaña? Se borrarán también sus leads asociados.');
    if (!confirmed) return;
    try {
      const res = await csrfFetch('/api/campaigns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignKey, email, idToken })
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailStatusNote(data.error || 'No se pudo eliminar la campaña.');
        return;
      }
      setDetail(null);
      setDetailStatusNote('');
      loadCampaigns();
    } catch (error) {
      console.error('Error eliminando campaña:', error);
      setDetailStatusNote('Error eliminando campaña.');
    }
  };

  const createOutcome = async () => {
    if (!newOutcomeLabel.trim()) return;
    try {
      const res = await csrfFetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newOutcomeLabel.trim(),
          outcomeType: newOutcomeType,
          metricBucket: newOutcomeBucket,
          email,
          idToken
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setOutcomeError(data.error || 'No se pudo crear');
        return;
      }
      setNewOutcomeLabel('');
      setNewOutcomeType('final');
      setNewOutcomeBucket('otro');
      loadOutcomes();
    } catch (error) {
      console.error('Error creando outcome:', error);
      setOutcomeError('Error creando estado');
    }
  };

  const deleteOutcome = async (id) => {
    try {
      const res = await csrfFetch('/api/outcomes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          email,
          idToken
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setOutcomeError(data.error || 'No se pudo eliminar');
        return;
      }
      loadOutcomes();
    } catch (error) {
      console.error('Error eliminando outcome:', error);
      setOutcomeError('Error eliminando estado');
    }
  };

  const updateOutcome = async (outcomeId, updates) => {
    try {
      const res = await csrfFetch('/api/outcomes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: outcomeId,
          outcomeType: updates.outcome_type,
          metricBucket: updates.metric_bucket,
          sortOrder: updates.sort_order,
          activo: updates.activo,
          email,
          idToken
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setOutcomeError(data.error || 'No se pudo actualizar');
        return;
      }
      setOutcomes((prev) =>
        prev.map((item) => (item.id === outcomeId ? { ...item, ...data.outcome } : item))
      );
    } catch (error) {
      console.error('Error actualizando outcome:', error);
      setOutcomeError('Error actualizando estado');
    }
  };

  const openDetail = async (campaignKey) => {
    try {
      setDetailLoading(true);
      const res = await fetch(
        `/api/campaign-detail?campaignKey=${encodeURIComponent(campaignKey)}&email=${encodeURIComponent(email)}&idToken=${encodeURIComponent(idToken)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setDetail(null);
        return;
      }
      setDetail(data);
    } catch (error) {
      console.error('Error cargando detalle campaña:', error);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Campañas</title>
      </Head>

      <div className="page">
        {email && <AppHeader email={email} role={userRole} picture={session?.picture} onLogout={handleLogout} />}

        <div className="container">
          <div className="hero">
            <div className="hero-cta">
              <div>
                <h1>Campañas</h1>
                <p>Configura y activa campañas por país, etapa, ejecutivo.</p>
              </div>
              <button
                className="btn btn-primary glow cta"
                type="button"
                onClick={() => {
                  resetWizard();
                  setWizardOpen(true);
                }}
              >
                Crear campaña
              </button>
            </div>
          </div>

          {authError && (
            <div className="card alert">
              <ShieldAlert className="icon-sm" />
              {authError}
            </div>
          )}

          {campaigns.find((c) => c.status === 'active') && (
            <div className="card active-campaign-card">
              <div className="active-header">
                <div>
                  <h2>Campaña activa</h2>
                  <div className="active-name">
                    {campaigns.find((c) => c.status === 'active')?.name}
                  </div>
                  <div className="history-sub">
                    {campaigns.find((c) => c.status === 'active')?.country} ·{' '}
                    {campaigns.find((c) => c.status === 'active')?.stage_name}
                  </div>
                </div>
                <span className="status-dot active">
                  <span className="status-dot-inner active" />
                </span>
              </div>
              <div className="active-metrics">
                <div>
                  <div className="stat-label">Gestionados</div>
                  <div className="stat-value">
                    {campaigns.find((c) => c.status === 'active')?.handled || 0}
                  </div>
                </div>
                <div>
                  <div className="stat-label">Sin gestionar</div>
                  <div className="stat-value">
                    {campaigns.find((c) => c.status === 'active')?.pending || 0}
                  </div>
                </div>
              </div>
              <div className="active-actions">
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() =>
                    openDetail(campaigns.find((c) => c.status === 'active')?.campaign_key)
                  }
                >
                  Detalles
                </button>
              </div>
            </div>
          )}

          <div className="card history-card">
            <div className="history-header">
              <h2>Campañas</h2>
              <div className="history-actions">
                <div className="history-filters">
                  {['all', 'active', 'inactive', 'terminated'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`filter-chip ${campaignsFilter === status ? 'active' : ''}`}
                      onClick={() => setCampaignsFilter(status)}
                    >
                      {status === 'all'
                        ? 'Todas'
                        : status === 'active'
                          ? 'Activas'
                          : status === 'inactive'
                            ? 'Inactivas'
                            : 'Terminadas'}
                    </button>
                  ))}
                </div>
                {campaignsLoading && <Loader2 className="icon-sm spin" />}
              </div>
            </div>
            {campaigns.length === 0 && <div className="empty">Sin campañas registradas</div>}
            <div className="history-list">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.campaign_key}
                  type="button"
                  className="history-item"
                  onClick={() => openDetail(campaign.campaign_key)}
                >
                  <div>
                    <div className="history-title">{campaign.name}</div>
                    <div className="history-sub">
                      {campaign.country} · {campaign.stage_name || `Etapa ${campaign.stage_id}`}
                    </div>
                    <div className="history-metric">
                      {campaign.handled || 0} gestionados · {campaign.pending || 0} sin gestionar
                    </div>
                    <div className="history-timer">
                      {campaign.status === 'active'
                        ? campaign.no_time_limit
                          ? 'Sin limite'
                          : `Cierre estimado: ${formatCountdown(campaign.close_at) || 'calculando'}`
                        : 'Campaña inactiva'}
                    </div>
                  </div>
                  <div className="history-meta">
                    <span className={`status-dot ${campaign.status}`}>
                      <span className={`status-dot-inner ${campaign.status}`} />
                    </span>
                    <ChevronRight className="icon-sm" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {createNotice && (
            <div className="card notice">
              <ShieldAlert className="icon-sm" />
              {createNotice}
            </div>
          )}

          <div className="card outcomes-card">
            <div className="history-header">
              <h2>Creación o eliminación de estados de llamada</h2>
              {outcomesLoading && <Loader2 className="icon-sm spin" />}
            </div>
            {userRole === 'admin' && (
              <div className="outcome-form">
                <input
                  type="text"
                  placeholder="Nombre del nuevo estado"
                  value={newOutcomeLabel}
                  onChange={(event) => setNewOutcomeLabel(event.target.value)}
                />
                <select value={newOutcomeType} onChange={(event) => setNewOutcomeType(event.target.value)}>
                  {OUTCOME_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select value={newOutcomeBucket} onChange={(event) => setNewOutcomeBucket(event.target.value)}>
                  {OUTCOME_BUCKETS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button className="btn btn-primary" type="button" onClick={createOutcome}>
                  Agregar estado
                </button>
              </div>
            )}
            <div className="outcomes-title">Estados actuales</div>
            <div className="outcomes-grid">
              {outcomes.map((outcome) => (
                <div key={outcome.id} className="outcome-chip">
                  <div className="outcome-name">{outcome.label}</div>
                  {userRole === 'admin' && (
                    <div className="outcome-controls">
                      <select
                        value={outcome.outcome_type || 'final'}
                        onChange={(event) =>
                          updateOutcome(outcome.id, {
                            ...outcome,
                            outcome_type: event.target.value
                          })
                        }
                      >
                        {OUTCOME_TYPES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={outcome.metric_bucket || 'otro'}
                        onChange={(event) =>
                          updateOutcome(outcome.id, {
                            ...outcome,
                            metric_bucket: event.target.value
                          })
                        }
                      >
                        {OUTCOME_BUCKETS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="icon-btn subtle-delete"
                        onClick={() => deleteOutcome(outcome.id)}
                        aria-label={`Eliminar ${outcome.label}`}
                      >
                        <Trash2 className="icon-sm" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {outcomes.length === 0 && <div className="empty">Sin estados definidos</div>}
            </div>
            {outcomeError && <div className="auth-error">{outcomeError}</div>}
          </div>
        </div>
      </div>

      {detail && (
        <div className="modal">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <div className="modal-title">{detail.campaign.name}</div>
                <div className="modal-sub">{detail.campaign.country} · {detail.campaign.stage_name}</div>
              </div>
              <button className="btn btn-secondary" onClick={() => setDetail(null)}>Cerrar</button>
            </div>
            <div className="modal-stats">
              <div className="card stat-card">
                <div className="stat-label">Contactados</div>
                <div className="stat-value">{detail.totals.contacted}</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Sin contactar (total)</div>
                <div className="stat-value">{detail.totals.pending}</div>
              </div>
              {detail.totals?.availability && (
                <div className="card stat-card">
                  <div className="stat-label">Disponibles</div>
                  <div className="stat-value">{detail.totals.availability.eligible || 0}</div>
                </div>
              )}
            </div>
            {detail.totals?.availability && (
              <div className="status-note" style={{ marginTop: '10px' }}>
                Pendientes: {detail.totals.availability.totalPending || 0} · Sin teléfono: {detail.totals.availability.noPhone || 0} · En cooldown: {detail.totals.availability.cooldown || 0} · Max intentos: {detail.totals.availability.maxAttempts || 0} · Bloqueados: {detail.totals.availability.locked || 0}
              </div>
            )}
            <div className="outcomes">
              {detail.outcomes.map((outcome) => (
                <div key={outcome.key} className="outcome">
                  <span>{outcome.label}</span>
                  <strong>{detail.totals.outcomes[outcome.key] || 0}</strong>
                </div>
              ))}
            </div>
            {detail.totals?.buckets && (
              <div className="outcomes" style={{ marginTop: '12px' }}>
                {Object.entries(detail.totals.buckets).map(([bucket, value]) => (
                  <div key={bucket} className="outcome">
                    <span>{bucket.replace(/_/g, ' ')}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="executives">
              <div className="exec-title">Ejecutivos en campaña</div>
              {detail.executives.length === 0 && <div className="empty">Sin registros aun</div>}
              {detail.executives.map((exec) => (
                <div key={exec.email} className="exec-row">
                  <span>{exec.email}</span>
                  <span>{exec.handled} gestionados</span>
                  <span>{exec.contacted} contactados</span>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <div className="switch-row">
                <span>Estado de campaña</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={detail.campaign.status === 'active'}
                    onChange={(event) =>
                      handleToggleCampaign(detail.campaign.campaign_key, event.target.checked ? 'active' : 'inactive')
                    }
                  />
                  <span className="slider" />
                </label>
              </div>
              {detailStatusNote && <div className="status-note">{detailStatusNote}</div>}
              {userRole !== 'ejecutivo' && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDeleteCampaign(detail.campaign.campaign_key)}
                >
                  Eliminar campaña
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {wizardOpen && (
        <div className="modal wizard-modal">
          <div className="modal-card wizard">
            <div className="modal-header">
              <div>
                <div className="modal-title">Crear campaña</div>
                <div className="modal-sub">Paso {wizardStep} de 7</div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setWizardOpen(false);
                  resetWizard();
                }}
              >
                Cerrar
              </button>
            </div>

            {wizardStep === 1 && (
              <div className="wizard-section">
                <h3>Selecciona país</h3>
                <div className="flag-grid">
                  {COUNTRY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`flag-btn ${wizardCountry === option.value ? 'active' : ''}`}
                      onClick={() => {
                        setWizardCountry(option.value);
                        setWizardPreview(null);
                        setWizardProgress(0);
                      }}
                    >
                      <span className="flag-icon">{option.flag}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="wizard-section">
                <h3>Selecciona origen de campaña</h3>
                <div className="source-toggle">
                  {MANUAL_SOURCE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`source-chip ${wizardSource === option.value ? 'active' : ''}`}
                      onClick={() => setWizardSource(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {wizardSource === 'manual' && (
                  <div className="upload-box">
                    <div className="upload-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => downloadManualTemplate('csv')}>
                        Descargar plantilla CSV
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => downloadManualTemplate('xlsx')}
                      >
                        Descargar plantilla Excel
                      </button>
                    </div>
                    <div
                      className="upload-drop"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const file = event.dataTransfer.files?.[0];
                        loadManualFile(file);
                      }}
                    >
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={(event) => loadManualFile(event.target.files?.[0])}
                      />
                      <div>
                        <strong>Arrastra tu CSV o Excel</strong>
                        <div className="upload-sub">o haz clic para seleccionar el archivo</div>
                      </div>
                    </div>
                    <div className="upload-hint">
                      Columnas requeridas: pipeline_id, stage_id, stage_name, deal_id, deal_title, phone_primary,
                      phone_secondary, add_time
                    </div>
                    {wizardFileName && (
                      <div className="upload-meta">Archivo cargado: {wizardFileName}</div>
                    )}
                    {wizardFileLoading && <div className="impact-note">Procesando archivo...</div>}
                    {wizardFileError && <div className="impact-note">{wizardFileError}</div>}
                  </div>
                )}

                {wizardSource === 'auto' ? (
                  <>
                    <div className="divider" />
                    <h3>Filtra por lead de un ejecutivo especifico (opcional)</h3>
                    <div className="switch-row">
                      <span>Sin filtro por ejecutivo</span>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={wizardOwnerMode === 'all'}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setWizardOwnerMode(checked ? 'all' : 'filtered');
                            if (checked) {
                              setWizardSelectedOwners(wizardOwnerOptions.map((opt) => opt.id));
                            } else {
                              setWizardSelectedOwners([]);
                            }
                            setWizardPreview(null);
                          }}
                        />
                        <span className="slider" />
                      </label>
                    </div>
                    {wizardOwnersLoading && <div className="empty">Cargando ejecutivos...</div>}
                    {!wizardOwnersLoading && wizardOwnerMode === 'filtered' && (
                      <div className="exec-grid">
                        {wizardOwnerOptions.length === 0 && <div className="empty">Sin ejecutivos disponibles</div>}
                        {wizardOwnerOptions.map((owner) => (
                          <label key={owner.id} className="exec-option">
                            <input
                              type="checkbox"
                              checked={wizardSelectedOwners.includes(owner.id)}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setWizardSelectedOwners((prev) => [...prev, owner.id]);
                                } else {
                                  setWizardSelectedOwners((prev) => prev.filter((item) => item !== owner.id));
                                }
                              }}
                            />
                            <span>{owner.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="divider" />
                    <h3>Etiquetas a incluir (Pipedrive)</h3>
                    <div className="hint">
                      Selecciona las etiquetas que quieres incluir. Si solo seleccionas <strong>RENTAL</strong>,
                      se filtran negocios con etiqueta única RENTAL.
                    </div>
                    <div className="label-grid">
                      {LABEL_OPTIONS.map((option) => (
                        <label key={`inc-${option.id}`} className="label-option">
                          <input
                            type="checkbox"
                            checked={wizardLabelInclude.includes(option.id)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setWizardLabelInclude((prev) => [...prev, option.id]);
                              } else {
                                setWizardLabelInclude((prev) => prev.filter((item) => item !== option.id));
                              }
                              setWizardPreview(null);
                            }}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="divider" />
                    <h3>Etiquetas a excluir (opcional)</h3>
                    <div className="hint">Si un negocio tiene alguna de estas etiquetas, se excluye.</div>
                    <div className="label-grid">
                      {LABEL_OPTIONS.map((option) => (
                        <label key={`exc-${option.id}`} className="label-option">
                          <input
                            type="checkbox"
                            checked={wizardLabelExclude.includes(option.id)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setWizardLabelExclude((prev) => [...prev, option.id]);
                              } else {
                                setWizardLabelExclude((prev) => prev.filter((item) => item !== option.id));
                              }
                              setWizardPreview(null);
                            }}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="divider" />
                    <h3>Selecciona etapa</h3>
                    {wizardStageLoading && <div className="impact-note">Cargando etapas...</div>}
                    <select
                      value={wizardStageId}
                      onChange={(event) => handleWizardStageChange(event.target.value)}
                      disabled={wizardStageLoading}
                    >
                      {wizardStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                    {!wizardStageLoading && wizardStages.length === 0 && (
                      <div className="impact-note">No hay etapas disponibles para este país.</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="divider" />
                    <h3>Etapa detectada desde archivo</h3>
                    <div className="impact-note">
                      {wizardStageId ? `${wizardStageName || `Etapa ${wizardStageId}`}` : 'Carga un archivo para continuar.'}
                    </div>
                  </>
                )}
              </div>
            )}

            {wizardStep === 3 && (
              <div className="wizard-section">
                <h3>Selecciona antiguedad de leads</h3>
                <div className={`age-filters ${!wizardPreview ? 'disabled' : ''}`}>
                  {AGE_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      className={`age-chip ${wizardAgeFilter === filter.value ? 'active' : ''}`}
                      onClick={() => setWizardAgeFilter(filter.value)}
                      disabled={!wizardPreview}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                {wizardImpactNote && (
                  <div className="impact-note" dangerouslySetInnerHTML={{ __html: wizardImpactNote }} />
                )}
                {wizardPreview && wizardPreview.total === 0 && (
                  <div className="impact-note">
                    No hay leads en la etapa seleccionada para esta configuracion.
                  </div>
                )}
                <div className="divider" />
                <h3>Resumen de etapa</h3>
                {wizardPreviewLoading && (
                  <div className="loading-box">
                    <div className="loading-text">
                      Cargando datos... {wizardProgress}% {wizardPreviewStatus ? `· ${wizardPreviewStatus}` : ''}
                    </div>
                    <div className="loading-bar">
                      <div className="loading-fill" style={{ width: `${wizardProgress}%` }} />
                    </div>
                  </div>
                )}
                {wizardPreviewError && <div className="impact-note">{wizardPreviewError}</div>}
                {!wizardPreviewLoading && wizardPreview && (
                  <div className="wizard-stats">
                    <div className="stat-card">
                      <div className="stat-label">Leads en etapa</div>
                      <div className="stat-value">{wizardPreview.total}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">En campañas activas sin gestión</div>
                      <div className="stat-value">{wizardPreview.blockedActive}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Listos para dialer</div>
                      <div className="stat-value">{wizardPreview.ready}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Sin numero válido</div>
                      <div className="stat-value">{wizardPreview.withoutValid}</div>
                    </div>
                  </div>
                )}
                {wizardAgeStats.length > 0 && (
                  <div className="age-chart">
                    {wizardAgeStats.map((stat) => (
                      <div
                        key={stat.label}
                        className={`age-row ${isAgeBarActive(wizardAgeFilter, stat.label) ? 'active' : ''}`}
                      >
                        <div className="age-label">{stat.label}</div>
                        <div className="age-bar">
                          <div
                            className="age-fill"
                            style={{
                              width: `${wizardPreview && wizardPreview.total ? (stat.value / wizardPreview.total) * 100 : 0}%`
                            }}
                          />
                        </div>
                        <div className="age-value">{stat.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {wizardStep === 4 && (
              <div className="wizard-section">
                <h3>Tiempo limite para realizar campaña</h3>
                <div className="switch-row">
                  <span>¿Activar tiempo limite?</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!wizardNoTimeLimit}
                      onChange={(event) => setWizardNoTimeLimit(!event.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>
                {!wizardNoTimeLimit && (
                  <div className="time-box">
                    <label>Selecciona tiempo limite</label>
                    <div className="time-grid">
                      {[
                        { value: '2h', label: '2 Horas' },
                        { value: '4h', label: '4 Horas' },
                        { value: 'today', label: 'Hoy' },
                        { value: 'tomorrow', label: 'Mañana' },
                        { value: 'week', label: 'Semana' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`time-chip ${wizardClosePreset === option.value ? 'active' : ''}`}
                          onClick={() => setWizardClosePreset(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="time-note">
                      Hora local de {wizardCountry || 'CO'} ({TIMEZONES[wizardCountry]})
                    </div>
                  </div>
                )}
              </div>
            )}

            {wizardStep === 5 && (
              <div className="wizard-section">
                <h3>Nombre de la campaña</h3>
                <input
                  type="text"
                  placeholder="Nombre de campaña"
                  value={wizardCampaignName}
                  onChange={(event) => setWizardCampaignName(event.target.value)}
                />
                <h3>Selecciona ejecutivos</h3>
                <div className="switch-row">
                  <span>Todos los ejecutivos del país</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={wizardAllowAllExecs}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setWizardAllowAllExecs(checked);
                        if (checked) {
                          setWizardSelectedExecs(wizardExecutives.map((user) => user.email));
                        } else {
                          setWizardSelectedExecs([]);
                        }
                      }}
                    />
                    <span className="slider" />
                  </label>
                </div>
                {!wizardAllowAllExecs && (
                  <div className="exec-grid">
                    {wizardExecutives.map((exec) => (
                      <label key={exec.email} className="exec-option">
                        <input
                          type="checkbox"
                          checked={wizardSelectedExecs.includes(exec.email)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setWizardSelectedExecs((prev) => [...prev, exec.email]);
                            } else {
                              setWizardSelectedExecs((prev) => prev.filter((item) => item !== exec.email));
                            }
                          }}
                        />
                        <span>{exec.email}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {wizardStep === 6 && (
              <div className="wizard-section">
                <h3>Resumen</h3>
                <div className="summary-grid">
                  <div>
                    <div className="stat-label">Campaña</div>
                    <div className="stat-value">{campaignNamePreview}</div>
                  </div>
                  <div>
                    <div className="stat-label">País</div>
                    <div className="stat-value">{wizardCountry}</div>
                  </div>
                  <div>
                    <div className="stat-label">Etapa</div>
                    <div className="stat-value">{wizardStageName || `Etapa ${wizardStageId}`}</div>
                  </div>
                  <div>
                    <div className="stat-label">Origen</div>
                    <div className="stat-value">
                      {wizardSource === 'manual' ? 'Archivo (manual)' : 'Pipedrive (automático)'}
                    </div>
                  </div>
                  {wizardSource === 'manual' && (
                    <div>
                      <div className="stat-label">Archivo</div>
                      <div className="stat-value">{wizardFileName || 'Sin nombre'}</div>
                    </div>
                  )}
                  <div>
                    <div className="stat-label">Antigüedad</div>
                    <div className="stat-value">
                      {AGE_FILTERS.find((filter) => filter.value === wizardAgeFilter)?.label}
                    </div>
                  </div>
                  <div>
                    <div className="stat-label">Cierre</div>
                    <div className="stat-value">
                      {wizardNoTimeLimit ? 'Sin limite' : wizardClosePreset || 'Sin definir'}
                    </div>
                  </div>
                  <div>
                    <div className="stat-label">Ejecutivos</div>
                    <div className="stat-value">
                      {wizardAllowAllExecs ? 'Todos' : `${wizardSelectedExecs.length} seleccionados`}
                    </div>
                  </div>
                  {wizardSource === 'auto' && (
                    <div>
                      <div className="stat-label">Filtro Pipedrive</div>
                      <div className="stat-value">
                        {wizardOwnerMode === 'all' ? 'Sin filtro' : `${wizardSelectedOwners.length} ejecutivos`}
                      </div>
                    </div>
                  )}
                  {wizardSource === 'auto' && (
                    <div>
                      <div className="stat-label">Etiquetas incluidas</div>
                      <div className="stat-value">
                        {wizardLabelInclude.length > 0
                          ? wizardLabelInclude
                              .map((id) => LABEL_OPTIONS.find((opt) => opt.id === id)?.label || id)
                              .join(', ')
                          : 'Sin filtro'}
                      </div>
                    </div>
                  )}
                  {wizardSource === 'auto' && (
                    <div>
                      <div className="stat-label">Etiquetas excluidas</div>
                      <div className="stat-value">
                        {wizardLabelExclude.length > 0
                          ? wizardLabelExclude
                              .map((id) => LABEL_OPTIONS.find((opt) => opt.id === id)?.label || id)
                              .join(', ')
                          : 'Ninguna'}
                      </div>
                    </div>
                  )}
                </div>
                {createError && <div className="auth-error">{createError}</div>}
              </div>
            )}

            {wizardStep === 7 ? (
              <>
                <div className="loading-box">
                  <div className="loading-text">
                    {wizardCreateStatus} {wizardCreateProgress}%
                  </div>
                  <div className="loading-bar">
                    <div className="loading-fill" style={{ width: `${wizardCreateProgress}%` }} />
                  </div>
                </div>
                <div className="create-logs">
                  {wizardCreateLogs.map((log, idx) => (
                    <div key={`${log}-${idx}`} className="create-log-item">
                      {log}
                    </div>
                  ))}
                </div>
                {wizardCreateDone && (
                  <div className="wizard-actions">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => {
                        setWizardOpen(false);
                        resetWizard();
                      }}
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="wizard-actions">
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setWizardStep((prev) => Math.max(1, prev - 1))}
                  disabled={wizardStep === 1}
                >
                  Anterior
                </button>
                {wizardStep < 6 ? (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => setWizardStep((prev) => Math.min(6, prev + 1))}
                  disabled={
                    (wizardStep === 1 && !wizardCountry) ||
                    (wizardStep === 2 &&
                      (wizardSource === 'auto'
                        ? wizardStageLoading ||
                          !wizardStageId ||
                          (wizardOwnerMode === 'filtered' && wizardSelectedOwners.length === 0)
                        : wizardFileLoading ||
                          !wizardStageId ||
                          wizardFileError ||
                          wizardFileRows.length === 0)) ||
                    (wizardStep === 3 &&
                      (!wizardPreview || wizardPreviewLoading || (wizardPreview && wizardPreview.total === 0))) ||
                    (wizardStep === 4 && !wizardNoTimeLimit && !wizardClosePreset) ||
                    (wizardStep === 5 && !wizardAllowAllExecs && wizardSelectedExecs.length === 0)
                  }
                >
                    Siguiente
                  </button>
                ) : (
                  <button className="btn btn-primary" type="button" onClick={handleWizardCreate} disabled={creating}>
                    {creating ? 'Creando...' : 'Crear campaña'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {reactivateCampaign && (
        <div className="modal">
          <div className="modal-card wizard">
            <div className="modal-header">
              <div>
                <div className="modal-title">Reactivar campaña</div>
                <div className="modal-sub">{reactivateCampaign.name}</div>
              </div>
              <button className="btn btn-secondary" onClick={() => setReactivateCampaign(null)}>
                Cerrar
              </button>
            </div>
            <div className="wizard-section">
              <h3>Tiempo limite para reactivación</h3>
              <div className="switch-row">
                <span>¿Sin tiempo limite?</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={reactivateNoLimit}
                    onChange={(event) => setReactivateNoLimit(event.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
              {!reactivateNoLimit && (
                <div className="time-box">
                  <label>Selecciona tiempo limite</label>
                  <div className="time-grid">
                    {[
                      { value: '2h', label: '2 Horas' },
                      { value: '4h', label: '4 Horas' },
                      { value: 'today', label: 'Hoy' },
                      { value: 'tomorrow', label: 'Mañana' },
                      { value: 'week', label: 'Semana' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`time-chip ${reactivatePreset === option.value ? 'active' : ''}`}
                        onClick={() => setReactivatePreset(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="time-note">
                    Hora local de {reactivateCampaign.country} ({TIMEZONES[reactivateCampaign.country]})
                  </div>
                </div>
              )}
            </div>
            <div className="wizard-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setReactivateCampaign(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={confirmReactivateCampaign}>
                Reactivar campaña
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 28px 20px 60px;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }
        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .hero-cta {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
        }
        .cta {
          min-width: 180px;
        }
        h1 {
          margin: 0;
          font-size: 28px;
        }
        p {
          margin: 6px 0 0;
          color: var(--text-muted);
        }
        .card {
          background: var(--surface);
          border: 1px solid var(--border-subtle);
          border-radius: 18px;
          padding: 16px;
          box-shadow: var(--shadow-soft);
        }
        :global(body[data-theme='light']) .card {
          box-shadow: 0 10px 24px rgba(40, 28, 16, 0.08);
          border-color: var(--border);
        }
        .notice {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--success);
          font-weight: 600;
        }
        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--danger);
          font-weight: 600;
        }
        .auth-error {
          color: var(--danger);
          font-size: 12px;
        }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 4px;
        }
        .section-header h2 {
          margin: 0;
          font-size: 20px;
        }
        .filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .filter label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--text-subtle);
          font-weight: 600;
        }
        select {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          padding: 10px 12px;
          color: var(--text-primary);
          font-weight: 600;
        }
        .filter-value {
          margin-top: 8px;
          font-size: 18px;
          font-weight: 700;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .age-grid {
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }
        .stat-card {
          display: grid;
          gap: 6px;
        }
        .stat-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--text-subtle);
        }
        .stat-value {
          font-size: 22px;
          font-weight: 700;
        }
        .empty {
          color: var(--text-muted);
          font-size: 13px;
        }
        .create-card h2 {
          margin: 0 0 6px;
        }
        .create-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .create-name {
          font-size: 12px;
          color: var(--text-muted);
        }
        .age-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 14px 0;
        }
        .age-chip {
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .age-chip.active {
          border-color: var(--accent);
          background: var(--accent-soft);
          color: var(--text-primary);
        }
        .create-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .btn {
          border-radius: 12px;
          padding: 10px 16px;
          border: 1px solid transparent;
          font-weight: 700;
          cursor: pointer;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: var(--text-on-accent);
        }
        .glow {
          box-shadow: 0 0 0 rgba(0, 0, 0, 0);
          transition: box-shadow 0.25s ease, transform 0.2s ease;
        }
        .glow:hover {
          box-shadow: 0 0 24px rgba(249, 71, 47, 0.35);
          transform: translateY(-1px);
        }
        .btn-secondary {
          background: var(--surface-alt);
          border: 1px solid var(--border);
          color: var(--text-primary);
        }
        .btn-danger {
          background: var(--danger-bg);
          border: 1px solid var(--danger-border);
          color: var(--danger-strong);
        }
        .create-summary {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .history-card h2 {
          margin: 0;
        }
        .outcomes-card h2 {
          margin: 0;
        }
        .outcomes-title {
          font-size: 12px;
          color: var(--text-subtle);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 8px;
        }
        .outcomes-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .outcome-chip {
          display: grid;
          gap: 8px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          min-width: 220px;
        }
        .outcome-name {
          font-size: 13px;
          font-weight: 700;
        }
        .outcome-controls {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 8px;
          align-items: center;
        }
        .outcome-controls select {
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-primary);
          padding: 6px 8px;
          font-size: 12px;
        }
        .icon-btn {
          background: transparent;
          border: none;
          color: var(--danger);
          cursor: pointer;
          padding: 0;
        }
        .subtle-delete {
          opacity: 0.6;
        }
        .outcome-chip:hover .subtle-delete {
          opacity: 1;
        }
        .outcome-form {
          margin-top: 12px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .outcome-form input {
          flex: 1;
          min-width: 180px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          padding: 10px 12px;
        }
        .outcome-form select {
          min-width: 160px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          padding: 10px 12px;
          font-size: 13px;
        }
        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .history-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .history-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .filter-chip {
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .filter-chip.active {
          border-color: var(--accent);
          background: var(--accent-soft);
          color: var(--text-primary);
        }
        .history-list {
          display: grid;
          gap: 10px;
        }
        .history-item {
          border: 1px solid var(--border);
          background: var(--surface-alt);
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          text-align: left;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .history-item:hover {
          border-color: var(--accent);
          background: var(--surface-soft);
          transform: translateY(-1px);
        }
        .history-title {
          font-weight: 700;
          color: var(--text-primary);
        }
        .history-sub {
          font-size: 12px;
          color: var(--text-muted);
        }
        .history-metric {
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-subtle);
        }
        .history-timer {
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-soft);
        }
        .active-campaign-card {
          border: 1px solid var(--border-strong);
          background: var(--surface-strong);
        }
        .active-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .active-name {
          font-weight: 700;
          margin-top: 4px;
        }
        .active-metrics {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .active-actions {
          margin-top: 12px;
          display: flex;
          gap: 10px;
        }
        .history-meta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-muted);
        }
        .status-dot {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          border: 1px solid var(--border);
          background: var(--surface);
        }
        .status-dot-inner {
          width: 8px;
          height: 8px;
          border-radius: 999px;
        }
        .status-dot.active {
          border-color: var(--success-border);
          background: var(--success-bg);
        }
        .status-dot-inner.active {
          background: var(--success);
        }
        .status-dot.inactive {
          border-color: var(--warning-border);
          background: var(--warning-bg);
        }
        .status-dot-inner.inactive {
          background: var(--warning);
        }
        .status-dot.terminated {
          border-color: var(--danger-border);
          background: var(--danger-bg);
        }
        .status-dot-inner.terminated {
          background: var(--danger-strong);
        }
        .modal {
          position: fixed;
          inset: 0;
          background: var(--overlay-bg);
          backdrop-filter: blur(8px);
          display: grid;
          place-items: center;
          padding: 24px;
          z-index: 20;
          overflow: auto;
        }
        .wizard-modal {
          z-index: 60;
          padding-top: 96px;
        }
        .modal-card {
          background: var(--surface);
          border-radius: 18px;
          border: 1px solid var(--border-subtle);
          padding: 18px;
          width: min(720px, 95vw);
          display: grid;
          gap: 12px;
          max-height: min(86vh, 900px);
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .modal-card.wizard {
          width: min(760px, 95vw);
          background: var(--surface-strong);
          border: 1px solid var(--border-strong);
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .modal-title {
          font-size: 20px;
          font-weight: 700;
        }
        .modal-sub {
          font-size: 12px;
          color: var(--text-muted);
        }
        .modal-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .outcomes {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }
        .outcome {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
        }
        .executives {
          display: grid;
          gap: 8px;
        }
        .exec-title {
          font-weight: 700;
        }
        .exec-row {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr 0.8fr;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .modal-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .wizard-section {
          display: grid;
          gap: 12px;
        }
        .wizard-section h3 {
          margin: 0;
          font-size: 18px;
        }
        .flag-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }
        .flag-btn {
          border: 1px solid var(--border);
          background: linear-gradient(135deg, var(--surface), var(--surface-alt));
          border-radius: 14px;
          padding: 12px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          justify-content: center;
          font-weight: 600;
        }
        :global(body[data-theme='dark']) .flag-btn {
          color: #ffffff;
        }
        .flag-btn.active {
          border-color: var(--accent);
          background: linear-gradient(135deg, var(--accent-soft), var(--surface));
          color: var(--text-primary);
        }
        .flag-icon {
          font-size: 20px;
        }
        .source-toggle {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .source-chip {
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .source-chip.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .upload-box {
          display: grid;
          gap: 8px;
        }
        .upload-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .upload-drop {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px dashed var(--border-strong);
          background: var(--surface-alt);
          border-radius: 14px;
          padding: 14px;
          cursor: pointer;
        }
        .upload-drop input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }
        .upload-sub {
          font-size: 12px;
          color: var(--text-muted);
        }
        .upload-meta {
          font-size: 12px;
          color: var(--text-muted);
        }
        .upload-hint {
          font-size: 11px;
          color: var(--text-subtle);
        }
        .wizard-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }
        .wizard-stats .stat-card {
          background: linear-gradient(135deg, var(--surface), var(--surface-soft));
          border: 1px solid var(--border);
        }
        .loading-box {
          display: grid;
          gap: 8px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
        }
        .create-logs {
          display: grid;
          gap: 6px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-soft);
          font-size: 12px;
          color: var(--text-muted);
        }
        .create-log-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .loading-text {
          font-size: 12px;
          color: var(--text-muted);
        }
        .loading-bar {
          width: 100%;
          height: 8px;
          border-radius: 999px;
          background: var(--surface-soft-2);
          overflow: hidden;
        }
        .loading-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          transition: width 0.35s ease;
        }
        .age-chart {
          display: grid;
          gap: 8px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
        }
        .age-row {
          display: grid;
          grid-template-columns: 90px 1fr 48px;
          align-items: center;
          gap: 10px;
        }
        .age-row.active .age-fill {
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        }
        .age-row .age-fill {
          background: var(--surface-soft-2);
        }
        .impact-note {
          margin-top: 10px;
          font-size: 12px;
          color: var(--text-muted);
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-soft);
        }
        .impact-count {
          color: var(--accent);
          font-weight: 700;
        }
        .age-label {
          font-size: 12px;
          color: var(--text-subtle);
        }
        .age-bar {
          height: 8px;
          border-radius: 999px;
          background: var(--surface-soft-2);
          overflow: hidden;
        }
        .age-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        }
        .age-value {
          font-size: 12px;
          font-weight: 600;
          text-align: right;
        }
        .wizard-subtitle {
          font-size: 12px;
          color: var(--text-subtle);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .age-filters.disabled {
          opacity: 0.5;
          pointer-events: none;
        }
        .time-box {
          display: grid;
          gap: 8px;
        }
        .time-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }
        .time-chip {
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          border-radius: 999px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .time-chip.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .time-box input {
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-primary);
          padding: 10px 12px;
        }
        .time-note {
          font-size: 12px;
          color: var(--text-muted);
        }
        .exec-grid {
          display: grid;
          gap: 8px;
        }
        .exec-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: linear-gradient(135deg, var(--surface), var(--surface-alt));
          font-size: 13px;
        }
        .label-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }
        .label-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: linear-gradient(135deg, var(--surface), var(--surface-alt));
          font-size: 13px;
        }
        .hint {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .summary-grid > div {
          border: 1px solid var(--border);
          background: var(--surface-soft);
          border-radius: 12px;
          padding: 12px;
        }
        .wizard-actions {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 4px;
        }
        .switch-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          font-weight: 600;
        }
        .divider {
          height: 1px;
          width: 100%;
          background: var(--border);
          margin: 8px 0;
        }
        .switch {
          position: relative;
          display: inline-block;
          width: 52px;
          height: 28px;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background: var(--surface-soft-2);
          border-radius: 999px;
          transition: 0.2s;
          border: 1px solid var(--border);
        }
        .slider:before {
          position: absolute;
          content: '';
          height: 22px;
          width: 22px;
          left: 3px;
          top: 2px;
          background: var(--text-primary);
          border-radius: 50%;
          transition: 0.2s;
        }
        .switch input:checked + .slider {
          background: var(--accent);
          border-color: var(--accent);
        }
        .switch input:checked + .slider:before {
          transform: translateX(22px);
          background: var(--text-on-accent);
        }
        .status-note {
          font-size: 12px;
          color: var(--text-muted);
          padding-left: 4px;
        }
        .spin {
          animation: spin 1.1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 720px) {
          .hero {
            flex-direction: column;
            align-items: flex-start;
          }
          .hero-cta {
            width: 100%;
            justify-content: space-between;
          }
          .exec-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
