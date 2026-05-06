const VALID_TRANSITIONS = {
  pending: ['queued', 'cancelled'],
  queued: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
};

exports.validateTransition = (currentStatus, newStatus, isAdmin) => {
  const current = String(currentStatus || '').toLowerCase();
  const next = String(newStatus || '').toLowerCase();

  if (current === 'completed' || current === 'cancelled') {
    return { valid: false, error: 'Cannot transition from a terminal state.' };
  }

  if (current === 'preparing' && next === 'cancelled') {
    if (isAdmin) return { valid: true, requiresWasteLog: true };
    return { valid: false, error: 'Cannot cancel an order that is already preparing without admin privileges.' };
  }

  const allowed = VALID_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    return { valid: false, error: `Invalid transition from ${current} to ${next}` };
  }

  return { valid: true };
};

