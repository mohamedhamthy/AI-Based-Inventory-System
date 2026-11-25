import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import BootstrapState from '../models/BootstrapState.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import AppError from '../utils/AppError.js';
import { assertLocalDevelopmentDatabase } from '../config/bootstrapSafety.js';

const BOOTSTRAP_KEY = 'initial-admin';
export const RECOVERY_CONFIRMATION_PHRASE = 'RECOVER STALE ADMIN BOOTSTRAP';
const MAIN_WORKSPACE_NAME = 'Main workspace';

export const initializeAdminSetup = async ({
  name,
  email,
  password,
}, {
  UserModel = User,
  WorkspaceModel = Workspace,
  BootstrapStateModel = BootstrapState,
} = {}) => {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (cleanName.length < 2 || cleanName.length > 80) {
    throw new AppError('Administrator name must be between 2 and 80 characters', 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new AppError('A valid administrator email is required', 400);
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new AppError('Administrator password must be between 12 and 128 characters', 400);
  }
  const existingAdministrator = await UserModel.exists({ role: { $in: ['admin', 'super_admin'] } });
  if (existingAdministrator) {
    throw new AppError('An administrator already exists; bootstrap cannot create another one', 409);
  }

  const token = randomUUID();
  try {
    await BootstrapStateModel.create({
      _id: BOOTSTRAP_KEY,
      state: 'initializing',
      token,
      claimedAt: new Date(),
      hostname: hostname(),
      processId: process.pid,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('Initial administrator setup has already been used or is in progress', 409);
    }
    throw error;
  }

  let user;
  let workspace;
  try {
    const existingAccount = await UserModel.exists({ email: cleanEmail });
    if (existingAccount) {
      throw new AppError('An account already uses this email; bootstrap will not replace it', 409);
    }

    user = await UserModel.create({
      name: cleanName,
      email: cleanEmail,
      password,
      role: 'admin',
    });
    workspace = await WorkspaceModel.create({
      name: MAIN_WORKSPACE_NAME,
      systemKey: 'legacy-default',
      owner: user._id,
      members: [user._id],
    });

    const result = await BootstrapStateModel.updateOne(
      { _id: BOOTSTRAP_KEY, token, state: 'initializing' },
      { $set: { state: 'completed', admin: user._id } },
    );
    if (result.matchedCount !== 1) {
      throw new Error('Unable to finalize initial administrator setup');
    }

    return { user, workspace };
  } catch (error) {
    try {
      if (workspace) await WorkspaceModel.deleteOne({ _id: workspace._id });
      if (user) await UserModel.deleteOne({ _id: user._id });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Initial administrator setup failed and rollback was incomplete. Inspect local account and workspace records before using bootstrap recovery.',
        { cause: cleanupError },
      );
    }
    throw new Error(
      'Initial administrator setup failed. Any remaining initializing claim was intentionally retained. After this process exits, verify that no admin exists, then use the documented bootstrap recovery command if a stale claim remains.',
      { cause: error },
    );
  }
};

const getProcessStatus = (processId) => {
  try {
    process.kill(processId, 0);
    return 'running';
  } catch (error) {
    return error?.code === 'ESRCH' ? 'stopped' : 'unknown';
  }
};

const recoveryInstructions = 'Do not remove the claim manually. Verify the database, host, PID, and administrator accounts before trying recovery again.';

export const recoverAdminBootstrap = async (confirmation, {
  UserModel = User,
  BootstrapStateModel = BootstrapState,
  databaseSettings = {
    nodeEnv: process.env.NODE_ENV,
    mongoUri: process.env.MONGODB_URI,
  },
  currentHostname = hostname(),
  checkProcess = getProcessStatus,
} = {}) => {
  if (confirmation !== RECOVERY_CONFIRMATION_PHRASE) {
    throw new AppError(`Recovery confirmation did not match "${RECOVERY_CONFIRMATION_PHRASE}"`, 400);
  }

  try {
    assertLocalDevelopmentDatabase(databaseSettings);
  } catch (error) {
    throw new AppError(`${error.message}. ${recoveryInstructions}`, 403);
  }

  const existingAdministrator = await UserModel.exists({ role: { $in: ['admin', 'super_admin'] } });
  if (existingAdministrator) {
    throw new AppError(`An administrator exists; recovery is unsafe or unnecessary. ${recoveryInstructions}`, 409);
  }

  const claim = await BootstrapStateModel.findById(BOOTSTRAP_KEY).lean();
  if (!claim) {
    throw new AppError('No initial administrator bootstrap claim exists; no recovery is needed', 404);
  }
  if (claim.state !== 'initializing') {
    throw new AppError(`The bootstrap claim is not stale (state: ${claim.state}). ${recoveryInstructions}`, 409);
  }

  const claimedAt = new Date(claim.claimedAt);
  if (!claim.hostname || claim.hostname !== currentHostname
    || !Number.isSafeInteger(claim.processId) || claim.processId < 1
    || Number.isNaN(claimedAt.getTime()) || claimedAt.getTime() > Date.now()) {
    throw new AppError(`Bootstrap ownership cannot be verified. ${recoveryInstructions}`, 409);
  }

  const processStatus = checkProcess(claim.processId);
  if (processStatus !== 'stopped') {
    const reason = processStatus === 'running'
      ? `Bootstrap process ${claim.processId} is still running`
      : `Unable to verify bootstrap process ${claim.processId}`;
    throw new AppError(`${reason}; the claim was not removed. ${recoveryInstructions}`, 409);
  }

  const result = await BootstrapStateModel.deleteOne({
    _id: BOOTSTRAP_KEY,
    state: 'initializing',
    token: claim.token,
    claimedAt: claim.claimedAt,
    hostname: claim.hostname,
    processId: claim.processId,
  });
  if (result.deletedCount !== 1) {
    throw new AppError(`The bootstrap claim changed during recovery and was not removed. ${recoveryInstructions}`, 409);
  }

  return { recovered: true };
};
