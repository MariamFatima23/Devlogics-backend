const validTransitions = {
  Pending: ['Under Review', 'Approved', 'Rejected'],
  'Under Review': ['Approved', 'Rejected'],
};

const isValidStatusTransition = (currentStatus, nextStatus) => {
  if (!currentStatus || !nextStatus) return false;
  return (validTransitions[currentStatus] || []).includes(nextStatus);
};

const getStatusTransitionError = (currentStatus, nextStatus) => {
  if (isValidStatusTransition(currentStatus, nextStatus)) {
    return null;
  }

  if (currentStatus === 'Approved' || currentStatus === 'Rejected') {
    return 'This application has already been reviewed and cannot be changed.';
  }

  return 'This status change is not allowed.';
};

module.exports = {
  isValidStatusTransition,
  getStatusTransitionError,
};
