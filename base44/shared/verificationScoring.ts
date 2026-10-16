// Shared 100-point identity & address evidence scoring engine.
// Pure functions used by verification backend functions. No entity writes here.

export async function getActivePolicy(base44) {
  const page = await base44.entities.VerificationScoringPolicy.filter({ config_name: 'default' }, { sort: '-updated_date', limit: 1 });
  return (page.items || [])[0] || null;
}

export function normalizeName(name) {
  if (!name) return '';
  return String(name).toLowerCase().replace(/[^a-z\s-]/g, '').replace(/\s+/g, ' ').trim();
}

export function nameTokens(name) {
  return new Set(normalizeName(name).split(/[\s-]+/).filter(Boolean));
}

// Tolerates legitimate variations: initials, hyphenation, missing middle names.
export function namesCompatible(declared, evidence) {
  const d = nameTokens(declared);
  const e = nameTokens(evidence);
  if (e.size === 0) return true; // no name extracted yet -> not a conflict
  for (const t of e) {
    const ok = [...d].some((dt) => dt === t || dt[0] === t || t[0] === dt);
    if (!ok) return false;
  }
  return true;
}

export function normalizeAddress(addr) {
  if (!addr) return '';
  return String(addr).toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function addressesCompatible(declared, evidence) {
  const d = normalizeAddress(declared);
  const e = normalizeAddress(evidence);
  if (!e) return true;
  if (d === e) return true;
  if (d && (d.includes(e) || e.includes(d))) return true; // tolerates recent address change detail differences
  return false;
}

export function dobCompatible(declared, evidence) {
  if (!evidence) return true;
  const norm = (s) => String(s).replace(/[^0-9-]/g, '').slice(0, 10);
  return norm(declared) === norm(evidence);
}

export function isExpired(evidence) {
  if (!evidence || !evidence.expiry_date) return false;
  const t = new Date(evidence.expiry_date).getTime();
  return Number.isFinite(t) && t < Date.now();
}

export function categoryMap(policy) {
  const map = {};
  for (const c of (policy && policy.categories) || []) {
    if (c && c.key) map[c.key] = c;
  }
  return map;
}

// Detect duplicate documents within a case. The later upload is marked duplicate.
// Duplicates by document_reference, else by type + extracted name + dob.
export function detectDuplicates(evidenceList) {
  const result = [];
  const seen = [];
  const sorted = [...evidenceList].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
  for (const e of sorted) {
    if (e.status === 'rejected') continue;
    const ref = (e.document_reference || '').trim();
    const key = ref
      ? `ref:${e.document_type}:${ref}`
      : `doc:${e.document_type}:${normalizeName(e.extracted_name)}:${(e.extracted_dob || '').slice(0, 10)}`;
    if (key === `doc:${e.document_type}::`) continue; // not enough to identify a duplicate
    if (seen.includes(key)) result.push({ id: e.id });
    else seen.push(key);
  }
  return result;
}

export function evaluateCase(evidenceList, policy, declared) {
  const map = categoryMap(policy);
  const target = (policy && policy.target_points) || 100;
  const duplicates = detectDuplicates(evidenceList);
  const dupIds = new Set(duplicates.map((d) => d.id));
  const usable = evidenceList.filter((e) => e.status !== 'rejected' && !dupIds.has(e.id));

  const byCategory = {};
  for (const e of usable) {
    const cat = map[e.document_type];
    if (!cat) continue;
    (byCategory[cat.key] = byCategory[cat.key] || []).push(e);
  }

  let total = 0;
  let supportingTotal = 0;
  for (const key of Object.keys(byCategory)) {
    const cat = map[key];
    const items = byCategory[key];
    const maxC = cat.max_contributions || 1;
    let count = 0;
    for (const e of items) {
      if (count >= maxC) break;
      if (cat.group === 'alternative_review') { count++; continue; } // contributes 0 toward identity/address
      const pts = cat.points || 0;
      total += pts;
      if (cat.group === 'supporting') supportingTotal += pts;
      count++;
    }
  }
  const maxSupp = (policy && policy.max_supporting_points) || 100;
  if (supportingTotal > maxSupp) total -= (supportingTotal - maxSupp);

  const hasPrimaryIdentity = usable.some((e) => (map[e.document_type] || {}).group === 'primary_identity');
  const hasAddressEvidence = usable.some((e) => (map[e.document_type] || {}).group === 'address');
  const combinationMet = hasPrimaryIdentity && hasAddressEvidence && total >= target;

  const flags = [];
  for (const e of usable) {
    const cat = map[e.document_type];
    if (e.extracted_name && !namesCompatible(declared && declared.legal_name, e.extracted_name)) {
      flags.push({ evidence_id: e.id, flag_type: 'conflicting_name', details: 'Submitted document name does not match declared legal name.', severity: 'high' });
    }
    if (e.extracted_dob && !dobCompatible(declared && declared.date_of_birth, e.extracted_dob)) {
      flags.push({ evidence_id: e.id, flag_type: 'conflicting_dob', details: 'Date of birth does not match declared value.', severity: 'high' });
    }
    if (e.extracted_address && !addressesCompatible(declared && declared.residential_address, e.extracted_address)) {
      flags.push({ evidence_id: e.id, flag_type: 'conflicting_address', details: 'Address on document does not match declared residential address.', severity: 'medium' });
    }
    if (cat && cat.requires_expiry_check && isExpired(e)) {
      flags.push({ evidence_id: e.id, flag_type: 'expired_document', details: 'Document has expired.', severity: 'high' });
    }
  }
  for (const d of duplicates) {
    flags.push({ evidence_id: d.id, flag_type: 'duplicate_document', details: 'Duplicate document submission detected.', severity: 'medium' });
  }
  if (!combinationMet) {
    flags.push({ flag_type: 'incomplete_evidence', details: 'Evidence does not meet the required combination or point target.', severity: 'medium' });
  }

  return {
    total_points: total,
    has_primary_identity: hasPrimaryIdentity,
    has_address_evidence: hasAddressEvidence,
    combination_met: combinationMet,
    duplicates: duplicates.map((d) => d.id),
    flags
  };
}

// Sanitized, user-facing explanation. Never exposes fraud-detection rules.
export function buildUserExplanation(evaluation, policy) {
  const target = (policy && policy.target_points) || 100;
  const missing = [];
  if (!evaluation.has_primary_identity) missing.push('a primary identity document (for example an Australian passport, birth certificate or citizenship certificate)');
  if (!evaluation.has_address_evidence) missing.push('a recent document showing your residential address');
  if (evaluation.total_points < target) missing.push('additional evidence to reach ' + target + ' points (currently ' + evaluation.total_points + ')');
  if (missing.length === 0 && !evaluation.combination_met) missing.push('an approved combination of independent evidence');
  if (missing.length) return 'To complete verification, please submit: ' + missing.join('; ') + '.';
  return 'Your evidence meets the point and combination requirements. Your case is awaiting manual review or external verification before it can be approved.';
}