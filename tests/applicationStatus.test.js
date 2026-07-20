const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidStatusTransition, getStatusTransitionError } = require('../utils/applicationStatus');

test('allows pending to under review, approved, or rejected', () => {
  assert.equal(isValidStatusTransition('Pending', 'Under Review'), true);
  assert.equal(isValidStatusTransition('Pending', 'Approved'), true);
  assert.equal(isValidStatusTransition('Pending', 'Rejected'), true);
});

test('allows under review to approved or rejected', () => {
  assert.equal(isValidStatusTransition('Under Review', 'Approved'), true);
  assert.equal(isValidStatusTransition('Under Review', 'Rejected'), true);
});

test('blocks changes after review is complete', () => {
  assert.equal(isValidStatusTransition('Approved', 'Pending'), false);
  assert.equal(isValidStatusTransition('Rejected', 'Approved'), false);

  assert.equal(
    getStatusTransitionError('Approved', 'Pending'),
    'This application has already been reviewed and cannot be changed.'
  );
});
