export function getImageUrl(value = '') {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (/^http:\/\//i.test(url) && url.includes('res.cloudinary.com')) {
    return url.replace(/^http:/i, 'https:');
  }
  if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url;
  return `/${url}`;
}
