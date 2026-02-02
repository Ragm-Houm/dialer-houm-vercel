import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ChevronRight, Loader2, ShieldAlert, Trash2, Plus, User, BarChart3, Phone, XCircle, CheckCircle2, Clock, CalendarClock, RotateCcw, FileText, Zap, ToggleLeft, ToggleRight, Info, X, Filter, HelpCircle, AlertTriangle } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useToast } from '../components/Toast';
import { useSession } from '../lib/session';
import { buildPhoneCandidates, getCountryConfig } from '../lib/review';

const AGE_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'lt7', label: '0 – 6 dias' },
  { value: 'between7_15', label: '7 – 15 dias' },
  { value: 'between15_30', label: '16 – 30 dias' },
  { value: 'gt30', label: '31+ dias' }
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
    between7_15: 0,
    between15_30: 0,
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
      else if (ageDays <= 15) ageBuckets.between7_15 += 1;
      else if (ageDays <= 30) ageBuckets.between15_30 += 1;
      else ageBuckets.gt30 += 1;
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
    { value: 'contacto_efectivo', label: '🟢 Contacto efectivo', description: 'Se logró contacto positivo con el lead' },
    { value: 'conversion', label: '🏆 Conversión', description: 'Se logró cierre, agenda o avance concreto' },
    { value: 'no_contacto', label: '📵 Sin contacto', description: 'No se logró hablar con el lead' },
    { value: 'seguimiento', label: '🔄 Seguimiento', description: 'Requiere recontacto o espera futura' },
    { value: 'descarte', label: '🚫 Descarte', description: 'Lead descartado definitivamente' },
    { value: 'otro', label: '📋 Otro', description: 'No clasificado en las categorías anteriores' }
  ];
  const router = useRouter();
  const { session, isSessionReady, sessionError, clearSession, csrfFetch } = useSession();
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');

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
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, danger: false });
  const toast = useToast();
  const [outcomes, setOutcomes] = useState([]);
  const [outcomesLoading, setOutcomesLoading] = useState(false);
  const [newOutcomeLabel, setNewOutcomeLabel] = useState('');
  const [newOutcomeType, setNewOutcomeType] = useState('final');
  const [newOutcomeBucket, setNewOutcomeBucket] = useState('otro');
  const [newOutcomeCategory, setNewOutcomeCategory] = useState('negative');
  const [outcomeError, setOutcomeError] = useState('');
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeCategoryFilter, setOutcomeCategoryFilter] = useState('all');
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
    if (!email || !wizardCountry) return;
    try {
      setWizardOwnersLoading(true);
      const usersRes = await fetch(
        `/api/users?email=${encodeURIComponent(email)}`
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
)}`
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
    if (!email) return;
    try {
      setCampaignsLoading(true);
      const statusParam = filter && filter !== 'all' ? `&status=${filter}` : '';
      const res = await fetch(
        `/api/campaigns?country=${country}${statusParam}&email=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCampaigns([]);
        return;
      }
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Error cargando campañas:', error);
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadOutcomes = async () => {
    if (!email) return;
    try {
      setOutcomesLoading(true);
      const res = await fetch(
        `/api/outcomes?email=${encodeURIComponent(email)}`
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
    if (!email) return;
    loadCampaigns(campaignsFilter);
    loadOutcomes();
  }, [email, country, campaignsFilter]);

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
      { label: '0 – 6 dias', value: wizardPreview.ageBuckets.lt7, filter: 'lt7' },
      { label: '7 – 15 dias', value: wizardPreview.ageBuckets.between7_15, filter: 'between7_15' },
      { label: '16 – 30 dias', value: wizardPreview.ageBuckets.between15_30, filter: 'between15_30' },
      { label: '31+ dias', value: wizardPreview.ageBuckets.gt30, filter: 'gt30' }
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
        return buckets.between7_15 || 0;
      case 'between15_30':
        return buckets.between15_30 || 0;
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
  }, [wizardOpen, wizardStep, wizardCountry, wizardStageId, email, wizardSource, wizardFileRows]);

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
    if (!email) return;
    try {
      const res = await csrfFetch(`/api/users?email=${encodeURIComponent(email)}`);
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
  }, [wizardOpen, wizardStep, wizardCountry, wizardAllowAllExecs, email]);

  useEffect(() => {
    if (!wizardOpen || wizardStep !== 2) return;
    if (wizardSource !== 'auto') return;
    loadWizardOwners();
  }, [wizardOpen, wizardStep, wizardCountry, wizardOwnerMode, email, wizardSource]);

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
          email
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
          status
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
          noTimeLimit: reactivateNoLimit
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

  const handleDeleteCampaign = (campaignKey) => {
    if (!campaignKey) return;
    setConfirmModal({
      open: true,
      title: 'Eliminar campaña',
      message: '¿Estás seguro? Se eliminarán también todos los leads asociados. Esta acción no se puede deshacer.',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        try {
          const res = await csrfFetch('/api/campaigns', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignKey })
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error || 'No se pudo eliminar la campaña.');
            return;
          }
          setDetail(null);
          setDetailStatusNote('');
          loadCampaigns();
          toast.success('Campaña eliminada correctamente.');
        } catch (error) {
          console.error('Error eliminando campaña:', error);
          toast.error('Error eliminando la campaña.');
        }
      }
    });
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
          category: newOutcomeCategory
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
      setNewOutcomeCategory('negative');
      setShowOutcomeModal(false);
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
          id
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
          category: updates.category,
          actionConfig: updates.action_config
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

  // Helper para toggle de una acción en el action_config de un outcome
  const toggleActionConfig = (outcome, key, value) => {
    const config = { ...(outcome.action_config || {}) };
    if (value !== undefined) {
      config[key] = value;
    } else {
      config[key] = !config[key];
    }
    // Dependencias: si mark_lost es false, desactivar require_lost_reason
    if (key === 'mark_lost' && !config.mark_lost) config.require_lost_reason = false;
    if (key === 'assign_owner' && !config.assign_owner) config.allow_change_owner = false;
    updateOutcome(outcome.id, { ...outcome, action_config: config });
  };

  // Definición de las acciones disponibles para mostrar en el UI
  const ACTION_STEPS = [
    { key: 'assign_owner', label: 'Auto-asignar responsable', icon: User, type: 'toggle', tooltip: 'Al guardar, el lead se asigna automáticamente al ejecutivo que hizo la llamada en Pipedrive' },
    { key: 'allow_change_owner', label: 'Permitir cambiar responsable', icon: User, type: 'toggle', depends: 'assign_owner', tooltip: 'Muestra un dropdown para que el ejecutivo elija otro responsable en vez de auto-asignarse' },
    { key: 'change_stage', label: 'Cambiar etapa Pipedrive', icon: BarChart3, type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'optional', label: 'Opcional' }, { value: 'required', label: 'Obligatorio' }], tooltip: 'Permite mover el negocio a otra etapa del pipeline. Opcional = el ejecutivo decide, Obligatorio = debe seleccionar etapa' },
    { key: 'log_pipedrive', label: 'Registrar llamada en Pipedrive', icon: Phone, type: 'always', tooltip: 'Siempre se registra la actividad de llamada con notas y duración en Pipedrive' },
    { key: 'mark_lost', label: 'Marcar como perdido', icon: XCircle, type: 'toggle', tooltip: 'Marca el negocio como perdido en Pipedrive. Útil para resultados negativos definitivos' },
    { key: 'require_lost_reason', label: 'Pedir motivo de pérdida', icon: FileText, type: 'toggle', depends: 'mark_lost', tooltip: 'Obliga al ejecutivo a seleccionar un motivo de pérdida de Pipedrive antes de guardar' },
    { key: 'create_followup', label: 'Crear tarea de seguimiento', icon: CalendarClock, type: 'toggle', tooltip: 'Crea una actividad de seguimiento en Pipedrive para llamar al lead después' },
    { key: 'mark_done', label: 'Finalizar lead en campaña', icon: CheckCircle2, type: 'toggle', tooltip: 'Marca el lead como completado en la campaña. Si está apagado, el lead vuelve a la cola' },
    { key: 'allow_retry', label: 'Permitir reintento inmediato', icon: RotateCcw, type: 'toggle', tooltip: 'Muestra botón para volver a llamar al lead inmediatamente sin registrar resultado' },
    { key: 'require_retry_time', label: 'Pedir tiempo de reintento', icon: Clock, type: 'toggle', tooltip: 'Pide seleccionar en cuántas horas reintentar la llamada (1h, 2h, 3h, etc.)' },
    { key: 'require_future_delay', label: 'Pedir plazo futuro', icon: CalendarClock, type: 'toggle', tooltip: 'Pide seleccionar en cuántos días el lead estará disponible (15, 30, 45+ días)' }
  ];

  const getCategoryEmoji = (cat) => {
    if (cat === 'positive') return '🟢';
    if (cat === 'neutral') return '🟡';
    return '🔴';
  };

  const getCategoryLabel = (cat) => {
    if (cat === 'positive') return 'Positivo';
    if (cat === 'neutral') return 'Neutro';
    return 'Negativo';
  };

  const openDetail = async (campaignKey) => {
    try {
      setDetailLoading(true);
      const res = await csrfFetch(
        `/api/campaign-detail?campaignKey=${encodeURIComponent(campaignKey)}`
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
              {campaigns.map((campaign) => {
                const cTotal = (campaign.handled || 0) + (campaign.pending || 0);
                const cPct = cTotal > 0 ? Math.round(((campaign.handled || 0) / cTotal) * 100) : 0;
                const eff = campaign.effective_status || campaign.status;
                const statusLabel = { active: 'Activa', inactive: 'Inactiva', terminated: 'Terminada' }[eff] || eff;
                const statusColor = { active: '#22c55e', inactive: '#f59e0b', terminated: '#ef4444' }[eff] || '#94a3b8';
                return (
                  <button
                    key={campaign.campaign_key}
                    type="button"
                    className="campaign-card"
                    onClick={() => openDetail(campaign.campaign_key)}
                  >
                    <div className="campaign-card-header">
                      <span className={`status-dot ${eff}`}>
                        <span className={`status-dot-inner ${eff}`} />
                      </span>
                      <span className="campaign-card-name">{campaign.name}</span>
                      <span className="campaign-card-badge" style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}33` }}>
                        {statusLabel}
                      </span>
                      <ChevronRight style={{ width: 18, height: 18, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
                    </div>
                    <div className="campaign-card-meta">
                      {campaign.country} · {campaign.stage_name || `Etapa ${campaign.stage_id}`}
                      {campaign.effective_status === 'active' && (
                        <> · {campaign.no_time_limit ? 'Sin límite' : `Cierre: ${formatCountdown(campaign.close_at) || 'calculando'}`}</>
                      )}
                    </div>
                    <div className="campaign-card-kpis">
                      <div className="campaign-card-kpi">
                        <div className="campaign-card-kpi-val">{cTotal}</div>
                        <div className="campaign-card-kpi-lbl">Total</div>
                      </div>
                      <div className="campaign-card-kpi kpi-g">
                        <div className="campaign-card-kpi-val">{campaign.handled || 0}</div>
                        <div className="campaign-card-kpi-lbl">Contactados</div>
                      </div>
                      <div className="campaign-card-kpi kpi-y">
                        <div className="campaign-card-kpi-val">{campaign.pending || 0}</div>
                        <div className="campaign-card-kpi-lbl">Pendientes</div>
                      </div>
                    </div>
                    <div className="campaign-card-progress">
                      <div className="campaign-card-bar">
                        <div className="campaign-card-fill" style={{ width: `${cPct}%` }} />
                      </div>
                      <span className="campaign-card-pct">{cPct}%</span>
                    </div>
                  </button>
                );
              })}
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
              <h2><Zap style={{width:18,height:18,verticalAlign:'middle',marginRight:6}} />Resultados de llamada</h2>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {outcomesLoading && <Loader2 className="icon-sm spin" />}
                {userRole === 'admin' && (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => setShowOutcomeModal(true)}
                    style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,padding:'8px 16px'}}
                  >
                    <Plus style={{width:14,height:14}} /> Agregar nuevo
                  </button>
                )}
              </div>
            </div>

            <div className="outcome-filter-bar">
              {[
                { value: 'all', label: 'Todos', emoji: '' },
                { value: 'positive', label: 'Positivo', emoji: '🟢' },
                { value: 'neutral', label: 'Neutro', emoji: '🟡' },
                { value: 'negative', label: 'Negativo', emoji: '🔴' }
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`filter-chip ${outcomeCategoryFilter === f.value ? 'active' : ''} ${f.value !== 'all' ? 'filter-' + f.value : ''}`}
                  onClick={() => setOutcomeCategoryFilter(f.value)}
                >
                  {f.emoji} {f.label}
                  {f.value !== 'all' && (
                    <span className="filter-count">
                      {outcomes.filter(o => (o.category || 'negative') === f.value).length}
                    </span>
                  )}
                  {f.value === 'all' && (
                    <span className="filter-count">{outcomes.length}</span>
                  )}
                </button>
              ))}
            </div>

            {outcomeError && <div className="auth-error" style={{marginTop:8}}>{outcomeError}</div>}

            <div className="zapier-cards">
              {outcomes.filter(o => outcomeCategoryFilter === 'all' || (o.category || 'negative') === outcomeCategoryFilter).length === 0 && (
                <div className="empty">Sin resultados {outcomeCategoryFilter !== 'all' ? `en categoría ${getCategoryLabel(outcomeCategoryFilter)}` : 'definidos'}</div>
              )}
              {outcomes
                .filter(o => outcomeCategoryFilter === 'all' || (o.category || 'negative') === outcomeCategoryFilter)
                .map((outcome) => {
                const config = outcome.action_config || {};
                const cat = outcome.category || 'negative';
                return (
                  <div key={outcome.id} className={`zapier-card zapier-${cat}`}>
                    <div className="zapier-header">
                      <div className="zapier-title">
                        <span className="zapier-emoji">{getCategoryEmoji(cat)}</span>
                        <span className="zapier-name">{outcome.label}</span>
                        <span className={`zapier-badge zapier-badge-${cat}`}>{getCategoryLabel(cat)}</span>
                      </div>
                      <div className="zapier-header-actions">
                        {userRole === 'admin' && (
                          <>
                            <button
                              type="button"
                              className={`zapier-toggle ${outcome.activo !== false ? 'on' : 'off'}`}
                              onClick={() => updateOutcome(outcome.id, { ...outcome, activo: outcome.activo === false ? true : false })}
                              title={outcome.activo !== false ? 'Activo — click para desactivar' : 'Inactivo — click para activar'}
                            >
                              {outcome.activo !== false
                                ? <ToggleRight style={{width:22,height:22}} />
                                : <ToggleLeft style={{width:22,height:22}} />
                              }
                            </button>
                            <button
                              type="button"
                              className="icon-btn subtle-delete"
                              onClick={() => setConfirmModal({ open: true, title: 'Eliminar resultado', message: `¿Eliminar "${outcome.label}"? Esta acción no se puede deshacer.`, danger: true, onConfirm: () => { setConfirmModal(prev => ({ ...prev, open: false })); deleteOutcome(outcome.id); } })}
                              title={`Eliminar ${outcome.label}`}
                            >
                              <Trash2 style={{width:14,height:14}} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="zapier-steps">
                      {ACTION_STEPS.map((step, idx) => {
                        const StepIcon = step.icon;
                        const isEnabled = step.type === 'always' ? true : (step.type === 'select' ? config[step.key] !== 'no' : !!config[step.key]);
                        const parentDisabled = step.depends && !config[step.depends];
                        if (parentDisabled && !config[step.key]) return null;

                        return (
                          <div key={step.key} className={`zapier-step ${isEnabled ? 'enabled' : 'disabled'} ${parentDisabled ? 'dep-disabled' : ''}`}>
                            {idx > 0 && <div className="zapier-connector" />}
                            <div className="zapier-step-row">
                              <div className="zapier-step-icon">
                                <StepIcon style={{width:14,height:14}} />
                              </div>
                              <div className="zapier-step-label">
                                {step.label}
                                <span className="zapier-tooltip-trigger">
                                  <Info style={{width:12,height:12}} />
                                  <span className="zapier-tooltip-popup">{step.tooltip}</span>
                                </span>
                              </div>
                              <div className="zapier-step-control">
                                {step.type === 'always' && (
                                  <span className="zapier-always">Siempre</span>
                                )}
                                {step.type === 'toggle' && userRole === 'admin' && (
                                  <button
                                    type="button"
                                    className={`zapier-step-toggle ${isEnabled ? 'on' : 'off'}`}
                                    onClick={() => toggleActionConfig(outcome, step.key)}
                                    disabled={parentDisabled}
                                  >
                                    {isEnabled
                                      ? <ToggleRight style={{width:20,height:20}} />
                                      : <ToggleLeft style={{width:20,height:20}} />
                                    }
                                  </button>
                                )}
                                {step.type === 'toggle' && userRole !== 'admin' && (
                                  <span className={`zapier-readonly ${isEnabled ? 'on' : 'off'}`}>
                                    {isEnabled ? '✓' : '✗'}
                                  </span>
                                )}
                                {step.type === 'select' && userRole === 'admin' && (
                                  <select
                                    className="zapier-step-select"
                                    value={config[step.key] || 'no'}
                                    onChange={(e) => toggleActionConfig(outcome, step.key, e.target.value)}
                                  >
                                    {step.options.map((opt) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                )}
                                {step.type === 'select' && userRole !== 'admin' && (
                                  <span className="zapier-readonly">
                                    {(step.options.find(o => o.value === (config[step.key] || 'no'))?.label) || 'No'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {userRole === 'admin' && (
                      <div className="zapier-meta">
                        <select
                          value={outcome.outcome_type || 'final'}
                          onChange={(event) => updateOutcome(outcome.id, { ...outcome, outcome_type: event.target.value })}
                          className="zapier-meta-select"
                          title="Tipo: Final = cierra gestión, Intermedio = puede reintentar"
                        >
                          {OUTCOME_TYPES.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <select
                          value={outcome.metric_bucket || 'otro'}
                          onChange={(event) => updateOutcome(outcome.id, { ...outcome, metric_bucket: event.target.value })}
                          className="zapier-meta-select"
                          title="Clasificación métrica: determina cómo se agrupa en reportes"
                        >
                          {OUTCOME_BUCKETS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal para crear nuevo resultado */}
          {showOutcomeModal && (
            <div className="outcome-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowOutcomeModal(false); }}>
              <div className="outcome-modal">
                <div className="outcome-modal-header">
                  <h3><Plus style={{width:18,height:18}} /> Nuevo resultado de llamada</h3>
                  <button type="button" className="outcome-modal-close" onClick={() => setShowOutcomeModal(false)}>
                    <X style={{width:18,height:18}} />
                  </button>
                </div>

                <div className="outcome-modal-body">
                  <div className="outcome-modal-field">
                    <label>Nombre del resultado</label>
                    <input
                      type="text"
                      placeholder="Ej: Interesado, No contesta, Información falsa..."
                      value={newOutcomeLabel}
                      onChange={(event) => setNewOutcomeLabel(event.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="outcome-modal-field">
                    <label>Categoría <span className="zapier-tooltip-trigger"><Info style={{width:12,height:12}} /><span className="zapier-tooltip-popup">Positivo = resultado favorable. Neutro = sin contacto o pendiente. Negativo = resultado desfavorable o pérdida.</span></span></label>
                    <div className="outcome-modal-cats">
                      {['positive', 'neutral', 'negative'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`cat-chip cat-${cat} ${newOutcomeCategory === cat ? 'active' : ''}`}
                          onClick={() => {
                            setNewOutcomeCategory(cat);
                            const defaultBucket = cat === 'positive' ? 'contacto_efectivo' : cat === 'neutral' ? 'no_contacto' : 'descarte';
                            setNewOutcomeBucket(defaultBucket);
                          }}
                        >
                          {getCategoryEmoji(cat)} {getCategoryLabel(cat)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="outcome-modal-row">
                    <div className="outcome-modal-field">
                      <label>Tipo <span className="zapier-tooltip-trigger"><Info style={{width:12,height:12}} /><span className="zapier-tooltip-popup">Final = cierra la gestión del lead. Intermedio = el lead puede volver a la cola para reintentar.</span></span></label>
                      <select value={newOutcomeType} onChange={(event) => setNewOutcomeType(event.target.value)}>
                        {OUTCOME_TYPES.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="outcome-modal-field">
                      <label>Clasificación métrica <span className="zapier-tooltip-trigger"><Info style={{width:12,height:12}} /><span className="zapier-tooltip-popup">Agrupa este resultado en reportes: Contacto efectivo (se habló), Conversión (agenda/cierre), Sin contacto (no contestó), Seguimiento (futuro), Descarte (perdido).</span></span></label>
                      <select value={newOutcomeBucket} onChange={(event) => setNewOutcomeBucket(event.target.value)}>
                        {OUTCOME_BUCKETS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="outcome-modal-preview">
                    <div className="outcome-modal-preview-title">Vista previa de acciones</div>
                    <div className="outcome-modal-preview-desc">
                      Al crearse, se asignarán las acciones predeterminadas para la categoría <strong>{getCategoryLabel(newOutcomeCategory)}</strong>. Podrás editarlas después.
                    </div>
                  </div>

                  {outcomeError && <div className="auth-error">{outcomeError}</div>}
                </div>

                <div className="outcome-modal-footer">
                  <button className="btn btn-secondary" type="button" onClick={() => setShowOutcomeModal(false)}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="button" onClick={createOutcome} disabled={!newOutcomeLabel.trim()}>
                    <Plus style={{width:14,height:14}} /> Crear resultado
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {detail && (() => {
        const t = detail.totals;
        const total = (t.contacted || 0) + (t.pending || 0);
        const contactedPct = total > 0 ? Math.round(((t.contacted || 0) / total) * 100) : 0;
        const av = t.availability || {};
        const effStatus = detail.campaign.effective_status || detail.campaign.status;
        const statusLabels = { active: 'Activa', inactive: 'Inactiva', terminated: 'Terminada' };
        const statusColors = { active: '#22c55e', inactive: '#f59e0b', terminated: '#ef4444' };

        const bucketGroups = [
          { emoji: '🟢', label: 'Contacto efectivo', keys: ['contacto_efectivo', 'interesado', 'contactado'], color: '#22c55e' },
          { emoji: '🏆', label: 'Conversión', keys: ['conversion', 'agendado', 'publicada', 'reservada', 'arrendada'], color: '#a855f7' },
          { emoji: '📵', label: 'Sin contacto', keys: ['no_contacto', 'no_contesta'], color: '#64748b' },
          { emoji: '🔄', label: 'Seguimiento', keys: ['seguimiento', 'futuro'], color: '#3b82f6' },
          { emoji: '🚫', label: 'Descarte', keys: ['descarte', 'perdido', 'falso', 'caro'], color: '#ef4444' },
          { emoji: '📋', label: 'Otro', keys: ['otro'], color: '#94a3b8' }
        ];
        const b = t.buckets || {};
        const bucketData = bucketGroups.map(g => ({
          ...g,
          total: g.keys.reduce((s, k) => s + (b[k] || 0), 0)
        })).filter(bd => bd.total > 0);
        const maxBucket = Math.max(...bucketData.map(bd => bd.total), 1);

        const avItems = [
          { label: 'Pendientes totales', value: av.totalPending || 0, tip: 'Total de leads que aún no han sido contactados en esta campaña' },
          { label: 'Disponibles ahora', value: av.eligible || 0, tip: 'Leads listos para ser asignados a un ejecutivo en este momento' },
          { label: 'Sin teléfono', value: av.noPhone || 0, tip: 'Leads que no tienen un número de teléfono registrado' },
          { label: 'En cooldown', value: av.cooldown || 0, tip: 'Leads en espera entre intentos de llamada' },
          { label: 'Max intentos', value: av.maxAttempts || 0, tip: 'Leads que ya alcanzaron el máximo de intentos de contacto' },
          { label: 'Bloqueados', value: av.locked || 0, tip: 'Leads actualmente asignados a otro ejecutivo' }
        ];

        return (
          <div className="modal detail-overlay">
            <div className="detail-modal">
              {/* Header */}
              <div className="detail-header">
                <div className="detail-header-info">
                  <div className="detail-title-row">
                    <h2 className="detail-title">{detail.campaign.name}</h2>
                    <span className="detail-badge" style={{ background: `${statusColors[effStatus]}18`, color: statusColors[effStatus], border: `1px solid ${statusColors[effStatus]}33` }}>
                      <span className="detail-badge-dot" style={{ background: statusColors[effStatus] }} />
                      {statusLabels[effStatus] || effStatus}
                    </span>
                  </div>
                  <div className="detail-meta">
                    {detail.campaign.country && <span>{detail.campaign.country}</span>}
                    {detail.campaign.stage_name && <><span>·</span><span>{detail.campaign.stage_name}</span></>}
                    {detail.campaign.close_at && !detail.campaign.no_time_limit && (
                      <><span>·</span><span>Cierre: {new Date(detail.campaign.close_at).toLocaleDateString()}</span></>
                    )}
                    {detail.campaign.no_time_limit && <><span>·</span><span>Sin límite de tiempo</span></>}
                  </div>
                </div>
                <button className="detail-close" onClick={() => setDetail(null)} title="Cerrar">
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>

              <div className="detail-body">
                {/* Progreso */}
                <div className="detail-section">
                  <div className="detail-section-title">
                    <BarChart3 style={{ width: 16, height: 16 }} /> Progreso de campaña
                  </div>
                  <div className="detail-kpi-grid">
                    <div className="detail-kpi">
                      <div className="detail-kpi-value">{total}</div>
                      <div className="detail-kpi-label">
                        Total leads
                        <span className="zapier-tooltip-trigger"><HelpCircle style={{width:13,height:13}} /><span className="zapier-tooltip-popup">Cantidad total de leads cargados en esta campaña</span></span>
                      </div>
                    </div>
                    <div className="detail-kpi kpi-success">
                      <div className="detail-kpi-value">{t.contacted || 0}</div>
                      <div className="detail-kpi-label">
                        Contactados
                        <span className="zapier-tooltip-trigger"><HelpCircle style={{width:13,height:13}} /><span className="zapier-tooltip-popup">Leads que ya fueron contactados y tienen un resultado registrado</span></span>
                      </div>
                    </div>
                    <div className="detail-kpi kpi-warning">
                      <div className="detail-kpi-value">{t.pending || 0}</div>
                      <div className="detail-kpi-label">
                        Pendientes
                        <span className="zapier-tooltip-trigger"><HelpCircle style={{width:13,height:13}} /><span className="zapier-tooltip-popup">Leads que aún no han sido contactados</span></span>
                      </div>
                    </div>
                    <div className="detail-kpi kpi-primary">
                      <div className="detail-kpi-value">{av.eligible || 0}</div>
                      <div className="detail-kpi-label">
                        Disponibles
                        <span className="zapier-tooltip-trigger"><HelpCircle style={{width:13,height:13}} /><span className="zapier-tooltip-popup">Leads listos para ser asignados ahora mismo a un ejecutivo</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="detail-progress-row">
                    <div className="detail-progress-bar">
                      <div className="detail-progress-fill" style={{ width: `${contactedPct}%` }} />
                    </div>
                    <span className="detail-progress-pct">{contactedPct}%</span>
                  </div>
                </div>

                {/* Disponibilidad */}
                {t.availability && (
                  <div className="detail-section">
                    <div className="detail-section-title">
                      <Phone style={{ width: 16, height: 16 }} /> Disponibilidad de leads
                    </div>
                    <div className="detail-avail-grid">
                      {avItems.map(item => (
                        <div key={item.label} className="detail-avail-item">
                          <div className="detail-avail-value">{item.value}</div>
                          <div className="detail-avail-label">
                            {item.label}
                            <span className="zapier-tooltip-trigger"><HelpCircle style={{width:12,height:12}} /><span className="zapier-tooltip-popup">{item.tip}</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clasificación por buckets */}
                {bucketData.length > 0 && (
                  <div className="detail-section">
                    <div className="detail-section-title">
                      <Zap style={{ width: 16, height: 16 }} /> Clasificación de resultados
                    </div>
                    <div className="detail-bucket-list">
                      {bucketData.map(bd => (
                        <div key={bd.label} className="detail-bucket-row">
                          <div className="detail-bucket-info">
                            <span className="detail-bucket-emoji">{bd.emoji}</span>
                            <span className="detail-bucket-name">{bd.label}</span>
                            <span className="detail-bucket-count">{bd.total}</span>
                          </div>
                          <div className="detail-bucket-bar">
                            <div className="detail-bucket-fill" style={{ width: `${(bd.total / maxBucket) * 100}%`, background: bd.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resultados individuales */}
                {detail.outcomes.length > 0 && (
                  <div className="detail-section">
                    <div className="detail-section-title">
                      <FileText style={{ width: 16, height: 16 }} /> Resultados por tipo
                    </div>
                    <div className="detail-outcomes-grid">
                      {detail.outcomes.map(outcome => {
                        const count = t.outcomes[outcome.key] || 0;
                        return (
                          <div key={outcome.key} className={`detail-outcome-chip ${count > 0 ? 'has-count' : ''}`}>
                            <span className="detail-outcome-label">{outcome.label}</span>
                            <span className="detail-outcome-count">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ejecutivos */}
                <div className="detail-section">
                  <div className="detail-section-title">
                    <User style={{ width: 16, height: 16 }} /> Ejecutivos en campaña
                    <span className="zapier-tooltip-trigger"><HelpCircle style={{width:13,height:13}} /><span className="zapier-tooltip-popup">Ejecutivos asignados a esta campaña con su progreso individual</span></span>
                  </div>
                  {detail.executives.length === 0 && <div className="empty">Sin ejecutivos asignados aún</div>}
                  <div className="detail-exec-list">
                    {detail.executives.map(exec => {
                      const execPct = exec.handled > 0 ? Math.round((exec.contacted / exec.handled) * 100) : 0;
                      const initial = (exec.email || '?')[0].toUpperCase();
                      return (
                        <div key={exec.email} className="detail-exec-card">
                          <div className="detail-exec-header">
                            <div className="detail-exec-avatar">{initial}</div>
                            <div className="detail-exec-info">
                              <div className="detail-exec-email">{exec.email}</div>
                              <div className="detail-exec-stats">
                                {exec.handled} gestionados · {exec.contacted} contactados
                              </div>
                            </div>
                          </div>
                          <div className="detail-exec-bar">
                            <div className="detail-exec-fill" style={{ width: `${execPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="detail-footer">
                <div className="detail-footer-left">
                  <div className="switch-row">
                    <span>Estado</span>
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
                    <span className="zapier-tooltip-trigger"><HelpCircle style={{width:13,height:13}} /><span className="zapier-tooltip-popup">Activa o desactiva esta campaña. Al desactivarla, no aparecerá en el dialer</span></span>
                  </div>
                  {detailStatusNote && <div className="status-note">{detailStatusNote}</div>}
                </div>
                {userRole !== 'ejecutivo' && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDeleteCampaign(detail.campaign.campaign_key)}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
                    {wizardAgeStats.map((stat) => {
                      const isActive = wizardAgeFilter === 'all' || wizardAgeFilter === stat.filter;
                      return (
                        <div
                          key={stat.label}
                          className={`age-row ${isActive ? 'active' : ''}`}
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
                      );
                    })}
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
        <div className="modal modal-top">
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

      {confirmModal.open && (
        <div className="modal modal-top">
          <div className="confirm-modal-card">
            <div className="confirm-icon-wrap" style={{ background: confirmModal.danger ? 'var(--danger-bg, rgba(244,67,54,0.12))' : 'var(--warning-bg, rgba(255,176,32,0.16))' }}>
              <AlertTriangle style={{ width: 28, height: 28, color: confirmModal.danger ? 'var(--danger-strong, #e0564e)' : 'var(--warning, #b36b00)' }} />
            </div>
            <h3 className="confirm-title">{confirmModal.title}</h3>
            <p className="confirm-message">{confirmModal.message}</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}>Cancelar</button>
              <button className={`btn ${confirmModal.danger ? 'btn-danger' : 'btn-primary'}`} onClick={confirmModal.onConfirm}>
                Confirmar
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
          display: flex;
          align-items: center;
        }

        /* Filter bar */
        .outcome-filter-bar {
          display: flex;
          gap: 6px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        .filter-chip {
          padding: 6px 14px;
          border-radius: 20px;
          border: 1.5px solid var(--border);
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.15s;
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .filter-chip.active {
          border-color: var(--primary, #6366f1);
          background: rgba(99,102,241,0.1);
          color: var(--primary, #6366f1);
        }
        .filter-chip.active.filter-positive { border-color: #22c55e; background: rgba(34,197,94,0.1); color: #22c55e; }
        .filter-chip.active.filter-neutral { border-color: #f59e0b; background: rgba(245,158,11,0.1); color: #f59e0b; }
        .filter-chip.active.filter-negative { border-color: #ef4444; background: rgba(239,68,68,0.1); color: #ef4444; }
        .filter-count {
          font-size: 10px;
          font-weight: 700;
          background: rgba(128,128,128,0.15);
          padding: 1px 7px;
          border-radius: 10px;
        }
        .filter-chip.active .filter-count {
          background: rgba(255,255,255,0.2);
        }

        /* Category chips for modal */
        .cat-chip {
          padding: 8px 16px;
          border-radius: 20px;
          border: 1.5px solid var(--border);
          background: transparent;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.15s;
          color: var(--text-secondary);
        }
        .cat-chip.active.cat-positive { border-color: #22c55e; background: rgba(34,197,94,0.12); color: #22c55e; }
        .cat-chip.active.cat-neutral { border-color: #f59e0b; background: rgba(245,158,11,0.12); color: #f59e0b; }
        .cat-chip.active.cat-negative { border-color: #ef4444; background: rgba(239,68,68,0.12); color: #ef4444; }

        /* Tooltips */
        .zapier-tooltip-trigger {
          position: relative;
          display: inline-flex;
          align-items: center;
          margin-left: 4px;
          color: var(--text-muted);
          cursor: help;
          opacity: 0.5;
          transition: opacity 0.15s;
          vertical-align: middle;
        }
        .zapier-tooltip-trigger:hover {
          opacity: 1;
          color: var(--primary, #6366f1);
        }
        .zapier-tooltip-popup {
          display: none;
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(15, 18, 30, 0.95);
          color: #e2e8f0;
          font-size: 12px;
          font-weight: 400;
          line-height: 1.5;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          white-space: normal;
          width: 240px;
          z-index: 9999;
          pointer-events: none;
          text-align: left;
        }
        :global(body[data-theme='light']) .zapier-tooltip-popup {
          background: rgba(255, 255, 255, 0.97);
          color: #1e293b;
          border: 1px solid rgba(0,0,0,0.1);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        .zapier-tooltip-popup::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: rgba(15, 18, 30, 0.95);
        }
        :global(body[data-theme='light']) .zapier-tooltip-popup::after {
          border-top-color: rgba(255, 255, 255, 0.97);
        }
        .zapier-tooltip-trigger:hover .zapier-tooltip-popup {
          display: block;
        }
        .tooltip-inline {
          position: relative;
          display: inline-flex;
          align-items: center;
          margin-left: 4px;
          color: var(--text-muted);
          cursor: help;
          opacity: 0.5;
          vertical-align: middle;
        }
        .tooltip-inline:hover {
          opacity: 1;
          color: var(--primary, #6366f1);
        }

        /* Modal overlay */
        .outcome-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          background: rgba(0,0,0,0.45);
        }
        .outcome-modal {
          background: var(--surface, #fff);
          border-radius: 20px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
          overflow: visible;
          box-sizing: border-box;
        }
        .outcome-modal *,
        .outcome-modal *::before,
        .outcome-modal *::after {
          box-sizing: border-box;
        }
        .outcome-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--border);
          border-radius: 20px 20px 0 0;
          background: var(--surface, #fff);
        }
        .outcome-modal-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-primary);
        }
        .outcome-modal-close {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          transition: background 0.15s;
        }
        .outcome-modal-close:hover {
          background: var(--surface-alt);
        }
        .outcome-modal-body {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          overflow-x: hidden;
        }
        .outcome-modal-field label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .outcome-modal-field input,
        .outcome-modal-field select {
          width: 100%;
          box-sizing: border-box;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          padding: 10px 14px;
          font-size: 14px;
          font-family: inherit;
        }
        .outcome-modal-field input:focus,
        .outcome-modal-field select:focus {
          outline: none;
          border-color: var(--primary, #6366f1);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
        }
        .outcome-modal-cats {
          display: flex;
          gap: 8px;
        }
        .outcome-modal-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .outcome-modal-preview {
          padding: 12px 14px;
          background: var(--surface-alt);
          border-radius: 12px;
          border: 1px dashed var(--border);
        }
        .outcome-modal-preview-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .outcome-modal-preview-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .outcome-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 24px;
          border-top: 1px solid var(--border);
          background: var(--surface-alt);
        }

        /* Zapier cards grid */
        .zapier-cards {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 16px;
        }
        .zapier-card {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface);
          overflow: visible;
          transition: box-shadow 0.15s;
        }
        .zapier-card:hover {
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }
        .zapier-positive { border-top: 3px solid #22c55e; }
        .zapier-neutral { border-top: 3px solid #f59e0b; }
        .zapier-negative { border-top: 3px solid #ef4444; }

        .zapier-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
        }
        .zapier-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .zapier-emoji {
          font-size: 16px;
        }
        .zapier-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .zapier-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .zapier-badge-positive { background: rgba(34,197,94,0.12); color: #22c55e; }
        .zapier-badge-neutral { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .zapier-badge-negative { background: rgba(239,68,68,0.12); color: #ef4444; }

        .zapier-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .zapier-toggle {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          transition: color 0.15s;
        }
        .zapier-toggle.on { color: #22c55e; }
        .zapier-toggle.off { color: var(--text-muted); }
        .icon-btn {
          background: transparent;
          border: none;
          color: var(--danger);
          cursor: pointer;
          padding: 2px;
        }
        .subtle-delete {
          opacity: 0.4;
          transition: opacity 0.15s;
        }
        .zapier-card:hover .subtle-delete { opacity: 1; }

        /* Steps */
        .zapier-steps {
          padding: 0 16px 12px;
        }
        .zapier-step {
          position: relative;
        }
        .zapier-connector {
          position: absolute;
          left: 13px;
          top: -6px;
          width: 2px;
          height: 6px;
          background: var(--border);
        }
        .zapier-step-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 0;
          border-bottom: 1px solid rgba(128,128,128,0.08);
        }
        .zapier-step:last-child .zapier-step-row {
          border-bottom: none;
        }
        .zapier-step-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: var(--surface-alt);
          color: var(--text-secondary);
        }
        .zapier-step.enabled .zapier-step-icon {
          background: rgba(99,102,241,0.12);
          color: #6366f1;
        }
        .zapier-step.disabled .zapier-step-icon {
          opacity: 0.4;
        }
        .zapier-step-label {
          flex: 1;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-primary);
        }
        .zapier-step.disabled .zapier-step-label {
          color: var(--text-muted);
          text-decoration: line-through;
        }
        .zapier-step.dep-disabled .zapier-step-label {
          color: var(--text-muted);
          font-style: italic;
        }
        .zapier-step-control {
          flex-shrink: 0;
        }
        .zapier-step-toggle {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          transition: color 0.15s;
        }
        .zapier-step-toggle.on { color: #22c55e; }
        .zapier-step-toggle.off { color: var(--text-muted); }
        .zapier-step-toggle:disabled { opacity: 0.3; cursor: not-allowed; }
        .zapier-always {
          font-size: 10px;
          font-weight: 600;
          color: #6366f1;
          background: rgba(99,102,241,0.1);
          padding: 2px 8px;
          border-radius: 10px;
        }
        .zapier-readonly {
          font-size: 11px;
          font-weight: 600;
        }
        .zapier-readonly.on { color: #22c55e; }
        .zapier-readonly.off { color: var(--text-muted); }
        .zapier-step-select {
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          padding: 4px 8px;
          font-size: 11px;
        }

        /* Meta row */
        .zapier-meta {
          display: flex;
          gap: 6px;
          padding: 8px 16px 12px;
          border-top: 1px solid var(--border);
        }
        .zapier-meta-select {
          flex: 1;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-secondary);
          padding: 6px 8px;
          font-size: 11px;
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

        /* ── Campaign cards redesign ── */
        .campaign-card {
          width: 100%;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          border-radius: 16px;
          padding: 16px 18px;
          cursor: pointer;
          text-align: left;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .campaign-card:hover {
          border-color: var(--accent);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.1);
        }
        .campaign-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .campaign-card-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }
        .campaign-card-badge {
          display: inline-flex;
          align-items: center;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 9px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .campaign-card-meta {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
          padding-left: 28px;
        }
        .campaign-card-kpis {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 14px;
        }
        .campaign-card-kpi {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 10px;
          text-align: center;
        }
        .campaign-card-kpi.kpi-g {
          border-color: rgba(34,197,94,0.25);
          background: rgba(34,197,94,0.05);
        }
        .campaign-card-kpi.kpi-y {
          border-color: rgba(245,158,11,0.25);
          background: rgba(245,158,11,0.05);
        }
        .campaign-card-kpi-val {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.1;
        }
        .campaign-card-kpi.kpi-g .campaign-card-kpi-val { color: #22c55e; }
        .campaign-card-kpi.kpi-y .campaign-card-kpi-val { color: #f59e0b; }
        .campaign-card-kpi-lbl {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.2px;
          margin-top: 2px;
        }
        .campaign-card-progress {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
        }
        .campaign-card-bar {
          flex: 1;
          height: 6px;
          background: var(--surface);
          border-radius: 99px;
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .campaign-card-fill {
          height: 100%;
          background: linear-gradient(90deg, #22c55e, #16a34a);
          border-radius: 99px;
          transition: width 0.5s ease;
        }
        .campaign-card-pct {
          font-size: 12px;
          font-weight: 700;
          color: #22c55e;
          min-width: 32px;
          text-align: right;
        }
        @media (max-width: 480px) {
          .campaign-card-kpis { grid-template-columns: repeat(3, 1fr); gap: 6px; }
          .campaign-card-kpi-val { font-size: 16px; }
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
        .modal-top {
          z-index: 55;
        }
        .confirm-modal-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px 24px 20px;
          max-width: 400px;
          width: 100%;
          text-align: center;
          box-shadow: var(--shadow-strong);
          animation: confirmPop 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes confirmPop {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .confirm-icon-wrap {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
        }
        .confirm-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 6px;
        }
        .confirm-message {
          font-size: 0.88rem;
          color: var(--text-muted);
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .confirm-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .confirm-actions .btn {
          flex: 1;
          max-width: 160px;
        }
        .btn-danger {
          background: var(--danger-strong, #e0564e);
          color: #fff;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .btn-danger:hover {
          opacity: 0.85;
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

        /* ── Detail modal overlay fix ── */
        .detail-overlay {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 48px 24px 24px;
          overflow-y: auto;
          z-index: 50;
        }

        /* ── Detail modal redesign ── */
        .detail-modal {
          background: var(--surface);
          border-radius: 20px;
          border: 1px solid var(--border-subtle);
          width: min(780px, 95vw);
          max-height: calc(100vh - 96px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          flex-shrink: 0;
        }
        .detail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
        }
        .detail-header-info {
          flex: 1;
          min-width: 0;
        }
        .detail-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .detail-title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .detail-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
        .detail-badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .detail-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-muted);
          flex-wrap: wrap;
        }
        .detail-close {
          background: var(--surface-alt);
          border: 1px solid var(--border);
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 10px;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .detail-close:hover {
          background: var(--danger-bg);
          border-color: var(--danger-border);
          color: var(--danger-strong);
        }
        .detail-body {
          padding: 20px 24px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 24px;
          overscroll-behavior: contain;
        }
        .detail-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .detail-section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--text-secondary);
        }
        .detail-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .detail-kpi {
          background: var(--surface-alt);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          text-align: center;
        }
        .detail-kpi.kpi-success { border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.06); }
        .detail-kpi.kpi-warning { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.06); }
        .detail-kpi.kpi-primary { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.06); }
        .detail-kpi-value {
          font-size: 28px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.1;
        }
        .detail-kpi.kpi-success .detail-kpi-value { color: #22c55e; }
        .detail-kpi.kpi-warning .detail-kpi-value { color: #f59e0b; }
        .detail-kpi.kpi-primary .detail-kpi-value { color: #6366f1; }
        .detail-kpi-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .detail-progress-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .detail-progress-bar {
          flex: 1;
          height: 8px;
          background: var(--surface-alt);
          border-radius: 99px;
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .detail-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #22c55e, #16a34a);
          border-radius: 99px;
          transition: width 0.5s ease;
        }
        .detail-progress-pct {
          font-size: 14px;
          font-weight: 700;
          color: #22c55e;
          min-width: 40px;
          text-align: right;
        }
        .detail-avail-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .detail-avail-item {
          background: var(--surface-alt);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 12px;
          text-align: center;
        }
        .detail-avail-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .detail-avail-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }
        .detail-bucket-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .detail-bucket-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .detail-bucket-info {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 200px;
          flex-shrink: 0;
        }
        .detail-bucket-emoji {
          font-size: 16px;
        }
        .detail-bucket-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .detail-bucket-count {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          margin-left: auto;
        }
        .detail-bucket-bar {
          flex: 1;
          height: 10px;
          background: var(--surface-alt);
          border-radius: 99px;
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .detail-bucket-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.4s ease;
        }
        .detail-outcomes-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .detail-outcome-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          font-size: 12px;
        }
        .detail-outcome-chip.has-count {
          border-color: rgba(99,102,241,0.25);
          background: rgba(99,102,241,0.06);
        }
        .detail-outcome-label {
          font-weight: 500;
          color: var(--text-secondary);
        }
        .detail-outcome-count {
          font-weight: 700;
          color: var(--text-primary);
        }
        .detail-outcome-chip.has-count .detail-outcome-count {
          color: #6366f1;
        }
        .detail-exec-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .detail-exec-card {
          background: var(--surface-alt);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .detail-exec-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .detail-exec-avatar {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }
        .detail-exec-info {
          flex: 1;
          min-width: 0;
        }
        .detail-exec-email {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .detail-exec-stats {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .detail-exec-bar {
          margin-top: 8px;
          height: 5px;
          background: var(--surface);
          border-radius: 99px;
          overflow: hidden;
        }
        .detail-exec-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          border-radius: 99px;
          transition: width 0.4s ease;
        }
        .detail-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 24px;
          border-top: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
        }
        .detail-footer-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        @media (max-width: 640px) {
          .detail-kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .detail-avail-grid { grid-template-columns: repeat(2, 1fr); }
          .detail-bucket-info { min-width: 140px; }
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
          grid-template-columns: 100px 1fr 48px;
          align-items: center;
          gap: 10px;
          opacity: 0.35;
          transition: opacity 0.2s ease;
        }
        .age-row.active {
          opacity: 1;
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
