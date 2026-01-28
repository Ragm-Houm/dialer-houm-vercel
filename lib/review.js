const COUNTRY_CONFIG = {
  CL: { pipelineId: 59, defaultStageId: 590, countryCode: '+56', nationalLength: 9 },
  MX: { pipelineId: 61, defaultStageId: 620, countryCode: '+52', nationalLength: 10 },
  CO: { pipelineId: 60, defaultStageId: 605, countryCode: '+57', nationalLength: 10 }
};

function getCountryConfig(country) {
  return COUNTRY_CONFIG[country] || null;
}

function buildCampaignKey(country, pipelineId, stageId) {
  return `${country}-${pipelineId}-${stageId}`;
}

function extractPhoneCandidates(raw) {
  if (!raw) return [];
  const str = String(raw);
  const matches = str.match(/\+?\d[\d\s().\-\/,;]{6,}\d/g);
  if (!matches) return [];

  const tokens = [];
  matches.forEach((match) => {
    match
      .split(/[,;/\n|]+/g)
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => tokens.push(token));
  });
  return tokens;
}

function stripExtension(value) {
  if (!value) return '';
  const extMatch = value.match(/^(.*?)(?:\s*(ext\.?|x|#)\s*\d+.*)$/i);
  return extMatch ? extMatch[1].trim() : value.trim();
}

function cleanPhone(value) {
  let phone = String(value || '').toLowerCase();
  if (!phone) return '';

  phone = phone.replace(/(ext\.?\s*\d+.*)$/g, '');
  phone = phone.replace(/(x\s*\d+.*)$/g, '');
  phone = phone.replace(/(#\s*\d+.*)$/g, '');
  phone = phone.replace(/^00/, '+');
  phone = phone.replace(/[^\d+]/g, '');

  if (phone.indexOf('+') > 0) {
    phone = `+${phone.replace(/\+/g, '')}`;
  }

  return phone;
}

function normalizeByCountry(phone, country) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1${digits.slice(-10)}`;
  }
  if (digits.length === 12 && digits.startsWith('57')) {
    return `+57${digits.slice(-10)}`;
  }
  if (digits.length === 11 && digits.startsWith('56')) {
    return `+56${digits.slice(-9)}`;
  }
  if (digits.length === 12 && digits.startsWith('52')) {
    return `+${digits}`;
  }
  if (digits.length === 13 && digits.startsWith('521')) {
    return `+52${digits.slice(3)}`;
  }

  if (country === 'CO') {
    if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
    if (digits.length === 11 && digits.startsWith('03')) {
      const trimmed = digits.slice(1);
      if (trimmed.length === 10 && trimmed.startsWith('3')) return `+57${trimmed}`;
    }
    return null;
  }

  if (country === 'MX') {
    if (digits.length === 10) return `+52${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+52${digits.slice(1)}`;
    return null;
  }

  if (country === 'CL') {
    if (digits.length === 9 && digits.startsWith('9')) return `+56${digits}`;
    if (digits.length === 11 && digits.startsWith('569')) return `+${digits}`;
    return null;
  }

  return null;
}

function extractPersonPhones(person) {
  if (!person) return [];
  if (Array.isArray(person.phone)) {
    return person.phone.map((p) => p && p.value).filter(Boolean);
  }
  if (person.phone) return [person.phone];
  return [];
}

function isPreferredMobile(phone, country) {
  if (!phone) return false;
  if (country === 'CO') return /^\+573/.test(phone);
  if (country === 'CL') return /^\+569/.test(phone);
  if (country === 'MX') return /^\+52\d{10}$/.test(phone);
  return false;
}

function buildPhoneCandidates(person, country) {
  const config = getCountryConfig(country);
  if (!config) {
    return { primaryCandidate: '', secondaryCandidate: '', candidates: [], stats: {} };
  }

  const rawPhones = extractPersonPhones(person);
  const tokens = rawPhones.flatMap((raw) => {
    const extracted = extractPhoneCandidates(raw);
    return extracted.length > 0 ? extracted : [String(raw)];
  });

  const cleanedTokens = tokens.map(stripExtension).map(cleanPhone).filter(Boolean);
  const normalized = cleanedTokens.map((t) => normalizeByCountry(t, country)).filter(Boolean);

  const deduped = Array.from(new Set(normalized));
  const ranked = deduped.sort((a, b) => {
    const aMobile = isPreferredMobile(a, country) ? 1 : 0;
    const bMobile = isPreferredMobile(b, country) ? 1 : 0;
    return bMobile - aMobile;
  });

  const primaryCandidate = ranked[0] || '';
  const secondaryCandidate = ranked[1] && ranked[1] !== primaryCandidate ? ranked[1] : '';

  const stats = {
    rawCount: rawPhones.length,
    tokenCount: cleanedTokens.length,
    validCount: ranked.length,
    duplicateCount: normalized.length - deduped.length,
    discardedCount: cleanedTokens.length - normalized.length,
    mobileCount: ranked.filter((p) => isPreferredMobile(p, country)).length
  };

  return {
    primaryCandidate,
    secondaryCandidate,
    candidates: secondaryCandidate ? [primaryCandidate, secondaryCandidate] : primaryCandidate ? [primaryCandidate] : [],
    stats
  };
}

module.exports = {
  COUNTRY_CONFIG,
  getCountryConfig,
  buildCampaignKey,
  buildPhoneCandidates
};
