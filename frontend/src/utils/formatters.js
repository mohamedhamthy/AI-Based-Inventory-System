const BUSINESS_TIME_ZONE = 'Asia/Colombo';

const asValidDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatLkr = (value, options = {}) => {
  const amount = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(amount)) return '—';
  return `LKR ${amount.toLocaleString('en-LK', {
    maximumFractionDigits: 2,
    ...options,
  })}`;
};

export const formatBusinessDate = (value) => {
  const date = asValidDate(value);
  return date
    ? date.toLocaleDateString('en-LK', { timeZone: BUSINESS_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
};

export const formatBusinessDateTime = (value) => {
  const date = asValidDate(value);
  return date
    ? date.toLocaleString('en-LK', {
      timeZone: BUSINESS_TIME_ZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : '—';
};

export const toBusinessDateInputValue = (value = new Date()) => {
  const date = asValidDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
};
