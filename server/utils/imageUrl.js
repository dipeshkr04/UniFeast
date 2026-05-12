function normalizeImageUrl(value = '') {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (/^http:\/\//i.test(url) && url.includes('res.cloudinary.com')) {
    return url.replace(/^http:/i, 'https:');
  }
  return url;
}

function getUploadedFileUrl(file) {
  return normalizeImageUrl(file?.secure_url || file?.path || file?.url || file?.location || '');
}

module.exports = {
  normalizeImageUrl,
  getUploadedFileUrl,
};
