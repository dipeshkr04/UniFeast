const { resolveMx } = require('dns').promises;

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
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
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !BASIC_EMAIL_REGEX.test(normalizedEmail)) {
    return {
      acceptable: false,
      normalizedEmail,
      reason: 'Enter a valid email format.'
    };
  }

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
  validateRegistrationEmail
};
