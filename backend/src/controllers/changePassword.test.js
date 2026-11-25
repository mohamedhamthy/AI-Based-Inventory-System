import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

process.env.PORT = '5000';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/ai_inventory_test';
process.env.JWT_SECRET = 'security-test-secret-that-is-long-enough';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_URL = 'http://localhost:5173';

const [
  { default: User },
  { default: Session },
  { default: AppError },
  authRoutesModule,
  controllerModule,
  validationModule,
  demoAccessModule,
  authMiddlewareModule,
] = await Promise.all([
  import('../models/User.js'),
  import('../models/Session.js'),
  import('../utils/AppError.js'),
  import('../routes/authRoutes.js'),
  import('../controllers/authController.js'),
  import('../validators/validation.js'),
  import('../middleware/demoAccessMiddleware.js'),
  import('../middleware/authMiddleware.js'),
]);

const authRoutes = authRoutesModule.default;
const { changePassword } = controllerModule;
const { validate, validateChangePassword } = validationModule;
const { preventDemoWrites, verifyCsrfToken } = demoAccessModule;
const { protect } = authMiddlewareModule;

const createRes = () => {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const flushAsync = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

const runValidation = async (req, chains = validateChangePassword) => {
  for (const chain of chains) {
    await chain.run(req);
  }
  const res = createRes();
  let nextCalled = false;
  validate(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled, res };
};

const buildPasswordUser = ({ id = '507f1f77bcf86cd799439011', compareResult = true, saveImpl, isActive = true } = {}) => ({
  _id: id,
  isActive,
  password: 'hashed-current-password',
  comparePassword: mock.fn(async () => compareResult),
  save: mock.fn(saveImpl || (async () => {})),
});

test.afterEach(() => {
  mock.restoreAll();
});

test('change-password route is protected and follows existing auth/CSRF conventions', () => {
  const route = authRoutes.stack.find((layer) => layer.route?.path === '/change-password')?.route;
  assert.ok(route, 'change-password route should exist');
  assert.deepEqual(route.methods, { post: true });
  const handlers = route.stack.map((layer) => layer.handle);
  assert.equal(handlers[0], protect);
  assert.equal(handlers[1], preventDemoWrites);
  assert.equal(handlers[2], verifyCsrfToken);
  assert.equal(handlers[handlers.length - 2], validate);
  assert.equal(handlers[handlers.length - 1], changePassword);
  // Three express-validator chains for currentPassword/newPassword/confirmPassword sit between CSRF and validate.
  assert.equal(handlers.length, 8);
});

test('validateChangePassword rejects password shorter than 8 characters', async () => {
  const req = { body: { currentPassword: 'OldPass123', newPassword: 'short7', confirmPassword: 'short7' } };
  const { nextCalled, res } = await runValidation(req);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.errors, [{ field: 'newPassword', message: 'New password must be between 8 and 128 characters' }]);
});

test('validateChangePassword rejects password confirmation mismatch', async () => {
  const req = { body: { currentPassword: 'OldPass123', newPassword: 'NewPass123', confirmPassword: 'Different123' } };
  const { nextCalled, res } = await runValidation(req);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.errors, [{ field: 'confirmPassword', message: 'New password and confirm password must match' }]);
});

test('validateChangePassword rejects new password identical to current password', async () => {
  const req = { body: { currentPassword: 'SamePass123', newPassword: 'SamePass123', confirmPassword: 'SamePass123' } };
  const { nextCalled, res } = await runValidation(req);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.errors.some((error) => error.field === 'newPassword' && /different from current password/i.test(error.message)));
});

test('validateChangePassword accepts a valid password change payload', async () => {
  const req = { body: { currentPassword: 'OldPass123', newPassword: 'NewPass123', confirmPassword: 'NewPass123' } };
  const { nextCalled, res } = await runValidation(req);
  assert.equal(nextCalled, true);
  assert.equal(res.body, undefined);
});

test('changePassword rejects incorrect current password', async () => {
  const user = buildPasswordUser({ compareResult: false });
  const findQuery = { select: mock.fn(async () => user) };
  mock.method(User, 'findById', () => findQuery);
  const deleteMany = mock.method(Session, 'deleteMany', async () => ({ deletedCount: 0 }));

  const req = {
    user: { _id: '507f1f77bcf86cd799439011', role: 'admin', isActive: true },
    authSession: { _id: 'session-current' },
    body: { currentPassword: 'WrongPass123', newPassword: 'NewPass123', confirmPassword: 'NewPass123' },
  };
  const res = createRes();
  let nextError;

  await changePassword(req, res, (error) => { nextError = error; });
  await flushAsync();

  assert.ok(nextError instanceof AppError);
  assert.equal(nextError.statusCode, 400);
  assert.match(nextError.message, /current password is incorrect/i);
  assert.equal(user.comparePassword.mock.callCount(), 1);
  assert.deepEqual(user.comparePassword.mock.calls[0].arguments, ['WrongPass123']);
  assert.equal(user.save.mock.callCount(), 0);
  assert.equal(deleteMany.mock.callCount(), 0);
});

test('changePassword rejects a new password identical to the current password hash', async () => {
  const user = buildPasswordUser({ compareResult: true });
  user.comparePassword = mock.fn(async (candidate) => candidate === 'SamePass123' || candidate === 'OldPass123');
  const findQuery = { select: mock.fn(async () => user) };
  mock.method(User, 'findById', () => findQuery);
  const deleteMany = mock.method(Session, 'deleteMany', async () => ({ deletedCount: 0 }));

  const req = {
    user: { _id: '507f1f77bcf86cd799439011', role: 'manager', isActive: true },
    authSession: { _id: 'session-current' },
    body: { currentPassword: 'OldPass123', newPassword: 'SamePass123', confirmPassword: 'SamePass123' },
  };
  const res = createRes();
  let nextError;

  // First compare call verifies current password; second detects same-as-current via comparePassword(newPassword)
  user.comparePassword = mock.fn(async (candidate) => candidate === 'OldPass123' || candidate === 'SamePass123');
  await changePassword(req, res, (error) => { nextError = error; });
  await flushAsync();

  assert.ok(nextError instanceof AppError);
  assert.equal(nextError.statusCode, 400);
  assert.match(nextError.message, /different from current password/i);
  assert.equal(user.save.mock.callCount(), 0);
  assert.equal(deleteMany.mock.callCount(), 0);
});

test('changePassword updates the authenticated user password, revokes other sessions, and keeps current session', async () => {
  const user = buildPasswordUser({ compareResult: true });
  // current password valid, new password not equal to current hash
  user.comparePassword = mock.fn(async (candidate) => candidate === 'OldPass123');
  const findQuery = { select: mock.fn(async () => user) };
  mock.method(User, 'findById', () => findQuery);
  const deleteMany = mock.method(Session, 'deleteMany', async () => ({ deletedCount: 2 }));

  const req = {
    user: { _id: '507f1f77bcf86cd799439011', role: 'employee', isActive: true },
    authSession: { _id: 'session-current' },
    body: { currentPassword: 'OldPass123', newPassword: 'NewPass123!', confirmPassword: 'NewPass123!' },
  };
  const res = createRes();

  let nextError;
  await changePassword(req, res, (error) => { nextError = error; });
  await flushAsync();

  assert.equal(nextError, undefined);
  assert.equal(User.findById.mock.callCount(), 1);
  assert.deepEqual(User.findById.mock.calls[0].arguments, ['507f1f77bcf86cd799439011']);
  assert.equal(findQuery.select.mock.callCount(), 1);
  assert.deepEqual(findQuery.select.mock.calls[0].arguments, ['+password']);
  assert.equal(user.password, 'NewPass123!');
  assert.equal(user.save.mock.callCount(), 1);
  assert.equal(deleteMany.mock.callCount(), 1);
  assert.deepEqual(Session.deleteMany.mock.calls[0].arguments, [{ user: '507f1f77bcf86cd799439011', _id: { $ne: 'session-current' } }]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, message: 'Password changed successfully.' });
  assert.equal(Object.prototype.hasOwnProperty.call(res.body, 'password'), false);
});

for (const role of ['admin', 'manager', 'employee']) {
  test(`changePassword allows authenticated ${role} users to change only their own password`, async () => {
    const user = buildPasswordUser({ id: `user-${role}`, compareResult: true });
    user.comparePassword = mock.fn(async (candidate) => candidate === 'OldPass123');
    const findQuery = { select: mock.fn(async () => user) };
    mock.method(User, 'findById', () => findQuery);
    mock.method(Session, 'deleteMany', async () => ({ deletedCount: 0 }));

    const req = {
      user: { _id: `user-${role}`, role, isActive: true },
      authSession: { _id: `session-${role}` },
      // Even if a caller attempts to supply another user id, the controller must ignore it.
      body: { userId: 'someone-else', currentPassword: 'OldPass123', newPassword: 'NewPass123', confirmPassword: 'NewPass123' },
    };
    const res = createRes();

    let nextError;
    await changePassword(req, res, (error) => { nextError = error; });
    await flushAsync();

    assert.equal(nextError, undefined);
    assert.deepEqual(User.findById.mock.calls[0].arguments, [`user-${role}`]);
    assert.deepEqual(Session.deleteMany.mock.calls[0].arguments, [{ user: `user-${role}`, _id: { $ne: `session-${role}` } }]);
    assert.equal(res.body.success, true);
  });
}

test('preventDemoWrites blocks demo role accounts from password changes', () => {
  const req = { method: 'POST', user: { role: 'demo', accountType: 'demo_user' } };
  let nextArg;
  preventDemoWrites(req, {}, (error) => { nextArg = error; });
  assert.ok(nextArg instanceof AppError);
  assert.equal(nextArg.statusCode, 403);
  assert.match(nextArg.message, /read-only/i);
});

test('preventDemoWrites blocks read-only demo account types on unsafe requests', () => {
  const req = { method: 'POST', user: { role: 'viewer', accountType: 'demo_user' } };
  let nextArg;
  preventDemoWrites(req, {}, (error) => { nextArg = error; });
  assert.ok(nextArg instanceof AppError);
  assert.equal(nextArg.statusCode, 403);
});

test('preventDemoWrites allows non-demo authenticated users to submit password changes', () => {
  const req = { method: 'POST', user: { role: 'admin', accountType: 'standard' } };
  let called = false;
  preventDemoWrites(req, {}, (error) => {
    assert.equal(error, undefined);
    called = true;
  });
  assert.equal(called, true);
});

test('verifyCsrfToken rejects cookie-authenticated requests with missing or invalid CSRF token', () => {
  const req = {
    method: 'POST',
    cookies: { inventory_session: 'jwt-cookie' },
    authSession: { csrfToken: 'expected-token' },
    get(header) {
      if (header.toLowerCase() === 'origin') return 'http://localhost:5173';
      if (header.toLowerCase() === 'x-csrf-token') return 'wrong-token';
      return undefined;
    },
  };
  let nextArg;
  verifyCsrfToken(req, {}, (error) => { nextArg = error; });
  assert.ok(nextArg instanceof AppError);
  assert.equal(nextArg.statusCode, 403);
  assert.match(nextArg.message, /csrf/i);
});

test('verifyCsrfToken allows cookie-authenticated requests with matching CSRF token and trusted origin', () => {
  const req = {
    method: 'POST',
    cookies: { inventory_session: 'jwt-cookie' },
    authSession: { csrfToken: 'expected-token' },
    get(header) {
      if (header.toLowerCase() === 'origin') return 'http://localhost:5173';
      if (header.toLowerCase() === 'x-csrf-token') return 'expected-token';
      return undefined;
    },
  };
  let called = false;
  verifyCsrfToken(req, {}, (error) => {
    assert.equal(error, undefined);
    called = true;
  });
  assert.equal(called, true);
});
