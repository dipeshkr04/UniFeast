const { resolveMx } = require('dns').promises;

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_EMAIL_DOMAIN = String(process.env.ALLOWED_EMAIL_DOMAIN || 'iiitn.ac.in').trim().toLowerCase();
const DEFAULT_ADMIN_ALLOWED_EMAILS = ['admin@iiitn.ac.in'];
const DEFAULT_KITCHEN_ALLOWED_EMAILS = ['kitchen@iiitn.ac.in'];

function parseEmailAllowlist(rawValue, fallbackList) {
  const source = String(rawValue || '').trim();
  const values = source
    ? source.split(',').map((item) => normalizeEmail(item)).filter(Boolean)
    : fallbackList;

  return new Set(values);
}

const ADMIN_ALLOWED_EMAILS = parseEmailAllowlist(
  process.env.ADMIN_ALLOWED_EMAILS,
  DEFAULT_ADMIN_ALLOWED_EMAILS
);
const KITCHEN_ALLOWED_EMAILS = parseEmailAllowlist(
  process.env.KITCHEN_ALLOWED_EMAILS,
  DEFAULT_KITCHEN_ALLOWED_EMAILS
);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getReservedRoleForEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (ADMIN_ALLOWED_EMAILS.has(normalizedEmail)) {
    return 'admin';
  }

  if (KITCHEN_ALLOWED_EMAILS.has(normalizedEmail)) {
    return 'kitchen';
  }

  return null;
}

function isRoleEmailAllowed(email, role) {
  const normalizedEmail = normalizeEmail(email);

  if (role === 'admin') {
    return ADMIN_ALLOWED_EMAILS.has(normalizedEmail);
  }

  if (role === 'kitchen') {
    return KITCHEN_ALLOWED_EMAILS.has(normalizedEmail);
  }

  return true;
}

function validateInstitutionEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !BASIC_EMAIL_REGEX.test(normalizedEmail)) {
    return {
      acceptable: false,
      normalizedEmail,
      reason: 'Enter a valid email format.'
    };
  }

  const domain = normalizedEmail.split('@')[1];
  if (domain !== ALLOWED_EMAIL_DOMAIN) {
    return {
      acceptable: false,
      normalizedEmail,
      reason: `Only @${ALLOWED_EMAIL_DOMAIN} email addresses are allowed.`
    };
  }

  return {
    acceptable: true,
    normalizedEmail,
    reason: `Email matches @${ALLOWED_EMAIL_DOMAIN}.`
  };
}

async function checkMxRecord(domain) {
  try {
    const records = await resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch (_error) {
    return false;
  }
}

async function checkWithAbstractApi(email) {
  const apiKey = process.env.EMAIL_VALIDATION_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const encodedEmail = encodeURIComponent(email);
    const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodedEmail}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const hasValidFormat = data?.is_valid_format?.value === true;
    const hasMx = data?.is_mx_found?.value === true;
    const smtpValid = data?.is_smtp_valid?.value === true;
    const isDisposable = data?.is_disposable_email?.value === true;

    return {
      fromApi: true,
      acceptable: hasValidFormat && hasMx && smtpValid && !isDisposable,
      reason: isDisposable ? 'Disposable email is not allowed.' : 'Email failed provider verification.'
    };
  } catch (_error) {
    return null;
  }
}

async function validateRegistrationEmail(email) {
  const institutionValidation = validateInstitutionEmail(email);
  if (!institutionValidation.acceptable) {
    return institutionValidation;
  }

  const normalizedEmail = institutionValidation.normalizedEmail;

  const domain = normalizedEmail.split('@')[1];
  const hasMx = await checkMxRecord(domain);

  if (!hasMx) {
    return {
      acceptable: false,
      normalizedEmail,
      reason: 'Email domain cannot receive emails.'
    };
  }

  const apiValidation = await checkWithAbstractApi(normalizedEmail);

  if (apiValidation?.fromApi) {
    return {
      acceptable: apiValidation.acceptable,
      normalizedEmail,
      reason: apiValidation.acceptable ? 'Email verified.' : apiValidation.reason
    };
  }

  return {
    acceptable: true,
    normalizedEmail,
    reason: 'Email domain looks valid.'
  };
}

module.exports = {
  normalizeEmail,
  validateRegistrationEmail,
  validateInstitutionEmail,
  getReservedRoleForEmail,
  isRoleEmailAllowed
};
