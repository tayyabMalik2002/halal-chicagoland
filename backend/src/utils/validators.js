const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

const isEmail = (v) => typeof v === 'string' && EMAIL_RE.test(v);

const isPositiveNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

const isNonNegativeNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

const isPositiveInteger = (v) => Number.isInteger(v) && v > 0;

const isBoolean = (v) => typeof v === 'boolean';

const isDateString = (v) => typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v));

const isTimeString = (v) => typeof v === 'string' && TIME_RE.test(v);

const isOneOf = (v, allowed) => allowed.includes(v);

module.exports = {
  isNonEmptyString,
  isEmail,
  isPositiveNumber,
  isNonNegativeNumber,
  isPositiveInteger,
  isBoolean,
  isDateString,
  isTimeString,
  isOneOf,
};
