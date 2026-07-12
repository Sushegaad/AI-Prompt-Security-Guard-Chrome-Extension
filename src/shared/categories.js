/* ============================================================================
 * AI Prompt - Security Guard — Detection category metadata (single source)
 * ----------------------------------------------------------------------------
 * Labels, risk levels, redaction labels and interrupt flags for every
 * detection category. Pure data, no engine code — safe to import from the
 * service worker, the detector, and every UI surface.
 *
 * UNMUTABLE_CATEGORIES is DERIVED from the risk:'critical' entries below, so
 * "critical secrets can never be muted" holds by construction (a retune test
 * snapshots the expected set to catch accidental risk-level edits).
 * ========================================================================== */

export const CATEGORY = Object.freeze({
  api_key:        { type: 'API key',          summary: 'API key',           redactLabel: '[API_KEY]', risk: 'critical' },
  password:       { type: 'Password',         summary: 'password',          redactLabel: '[SECRET]',  risk: 'critical' },
  connection_string:{ type: 'Database URL',   summary: 'database URL',      redactLabel: '[DB_URL]',  risk: 'critical' },
  private_key:    { type: 'Private key (PEM)', summary: 'private key',      redactLabel: '[PRIVATE_KEY]', risk: 'critical' },
  iban:           { type: 'IBAN',             summary: 'IBAN',              redactLabel: '[IBAN]',    risk: 'critical' },
  credit_card:    { type: 'Credit card',      summary: 'credit card',       redactLabel: '[CARD]',    risk: 'critical' },
  ssn:            { type: 'SSN',              summary: 'SSN',               redactLabel: '[SSN]',     risk: 'critical' },
  account_number: { type: 'Account number',   summary: 'account number',    redactLabel: '[ACCOUNT]', risk: 'high' },
  health:         { type: 'Health info',      summary: 'health information', redactLabel: '[HEALTH]',  risk: 'high' },
  financial:      { type: 'Financial data',   summary: 'financial data',    redactLabel: '[FINANCIAL]', risk: 'high' },
  legal:          { type: 'Legal language',   summary: 'legal language',    redactLabel: '[LEGAL]',   risk: 'high' },
  customer_data:  { type: 'Customer name',    summary: 'customer data',     redactLabel: '[NAME]',    risk: 'high' },
  internal_url:   { type: 'Internal URL',     summary: 'internal URL',      redactLabel: '[URL]',     risk: 'high' },
  email:          { type: 'Email address',    summary: 'email address',     redactLabel: '[EMAIL]',   risk: 'medium' },
  phone:          { type: 'Phone number',     summary: 'phone number',      redactLabel: '[PHONE]',   risk: 'medium' },
  address:        { type: 'Physical address', summary: 'physical address',  redactLabel: '[ADDRESS]', risk: 'medium' },
  // interrupt:false — code alone is context, not a leak (secrets INSIDE code are
  // caught by their own categories). Badge-only in every mode.
  source_code:    { type: 'Source code',      summary: 'source code',       redactLabel: '[CODE]',    risk: 'medium', interrupt: false },
  gov_id:          { type: 'Government ID',        summary: 'government ID',         redactLabel: '[GOV_ID]',    risk: 'critical' },
  education:       { type: 'Education record',     summary: 'education record',      redactLabel: '[EDU]',       risk: 'high' },
  workplace:       { type: 'Workplace/HR data',    summary: 'workplace data',        redactLabel: '[HR]',        risk: 'high' },
  special_category:{ type: 'Special-category data', summary: 'special-category data', redactLabel: '[SENSITIVE]', risk: 'high' },
  regulated:       { type: 'Regulated-data signal', summary: 'regulated-data signal', redactLabel: '[REGULATED]', risk: 'high' },
  restriction:     { type: 'Restriction notice',   summary: 'restriction notice',    redactLabel: '[RESTRICTED]', risk: 'high' },
  company_secret:  { type: 'Company secret',       summary: 'company secret',        redactLabel: '[INTERNAL]',  risk: 'high' },
  children:        { type: "Children's data",      summary: "children's data",       redactLabel: '[MINOR]',     risk: 'high' },
  location:        { type: 'Location/tracking',    summary: 'location data',         redactLabel: '[LOCATION]',  risk: 'high' },
  file_path:       { type: 'File path',            summary: 'file path',             redactLabel: '[PATH]',      risk: 'medium' },
});

/**
 * Categories that can never be muted: critical secrets where a single miss is
 * catastrophic. Derived, not duplicated — always exactly the critical set.
 */
export const UNMUTABLE_CATEGORIES = Object.freeze(
  Object.keys(CATEGORY).filter((k) => CATEGORY[k].risk === 'critical')
);
