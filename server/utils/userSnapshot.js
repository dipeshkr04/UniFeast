function deriveBtId(email = '') {
  const local = String(email || '').split('@')[0] || '';
  const match = local.match(/bt\d{2}[a-z0-9]+/i);
  return match ? match[0].toUpperCase() : local.toUpperCase();
}

function buildUserSnapshot(user = {}) {
  const email = String(user.email || '').toLowerCase();
  return {
    name: user.name || '',
    email,
    btId: user.btId || deriveBtId(email),
  };
}

module.exports = {
  buildUserSnapshot,
  deriveBtId,
};
