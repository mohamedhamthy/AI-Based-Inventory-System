export const TEST_OWNED_RECORDS = [
  'Category',
  'Supplier',
  'Product',
  'Sale',
  'StockMovement',
  'PurchaseOrder',
  'MarketPrice',
  'MarketPriceForecast',
];

export const createTestOwnershipTracker = ({ suite, runId }) => {
  if (!suite || !runId) throw new Error('Test suite and run identifier are required');
  const workspaceIds = new Set();
  const userIds = new Set();
  const recordIds = new Set();

  return {
    suite,
    runId,
    registerWorkspace(id) {
      if (id) workspaceIds.add(String(id));
    },
    registerUser(id) {
      if (id) userIds.add(String(id));
    },
    registerRecord(id) {
      if (id) recordIds.add(String(id));
    },
    snapshot() {
      return {
        workspaceIds: [...workspaceIds],
        userIds: [...userIds],
        recordIds: [...recordIds],
      };
    },
  };
};

export const assertOwnedWorkspace = (workspace, suite, runId) => (
  workspace
  && Boolean(runId)
  && workspace.testSuite === suite
  && workspace.testRunId === runId
);

export const assertOwnedUser = (user, suite, runId) => (
  user
  && Boolean(runId)
  && user.testSuite === suite
  && user.testRunId === runId
);

const readQuery = async (Model, filter, selection) => {
  const query = Model.find(filter);
  return typeof query.select === 'function' ? query.select(selection) : query;
};

export const listOwnedRuns = async ({ suite, Workspace, User }) => {
  const workspaces = await readQuery(
    Workspace,
    { testSuite: suite },
    '_id name testSuite testRunId',
  );
  const users = await readQuery(
    User,
    { testSuite: suite },
    '_id testSuite testRunId testWorkspaceId',
  );
  const linkedWorkspaceIds = users
    .map((user) => user.testWorkspaceId)
    .filter(Boolean);
  const linkedWorkspaces = linkedWorkspaceIds.length
    ? await readQuery(Workspace, { _id: { $in: linkedWorkspaceIds } }, '_id testSuite testRunId')
    : [];

  const runs = new Map();
  const getRun = (runId) => {
    if (!runs.has(runId)) {
      runs.set(runId, {
        testSuite: suite,
        testRunId: runId,
        workspaces: [],
        users: [],
        orphanUsers: [],
      });
    }
    return runs.get(runId);
  };

  for (const workspace of workspaces) {
    if (!assertOwnedWorkspace(workspace, suite, workspace.testRunId)) continue;
    getRun(workspace.testRunId).workspaces.push({
      workspaceId: String(workspace._id),
      name: workspace.name,
    });
  }

  for (const user of users) {
    if (!assertOwnedUser(user, suite, user.testRunId)) continue;
    const run = getRun(user.testRunId);
    const linked = Boolean(user.testWorkspaceId && linkedWorkspaces.some(
      (workspace) => String(workspace._id) === String(user.testWorkspaceId),
    ));
    const listedUser = {
      userId: String(user._id),
      testSuite: user.testSuite,
      testRunId: user.testRunId,
      workspaceLinkExists: linked,
    };
    run.users.push(listedUser);
    if (!linked) run.orphanUsers.push(listedUser);
  }

  return [...runs.values()];
};

export const cleanupOwnedRun = async ({
  suite,
  runId,
  Workspace,
  User,
  records,
}) => {
  if (!suite || !runId) throw new Error('Exact test suite and run identifier are required');
  const ownershipFilter = { testSuite: suite, testRunId: runId };

  const workspaces = await readQuery(
    Workspace,
    ownershipFilter,
    '_id testSuite testRunId',
  );
  const ownedWorkspaces = workspaces.filter((workspace) => (
    assertOwnedWorkspace(workspace, suite, runId)
  ));

  const deletedRecords = [];
  for (const { name, Model } of records) {
    const result = await Model.deleteMany(ownershipFilter);
    deletedRecords.push({ collection: name, deletedCount: result.deletedCount || 0 });
  }

  const ownedWorkspaceIds = ownedWorkspaces.map((workspace) => workspace._id);
  const candidates = await readQuery(
    Workspace,
    { _id: { $in: ownedWorkspaceIds } },
    '_id owner members testSuite testRunId',
  );
  const exactRunUsers = await readQuery(User, ownershipFilter, '_id testSuite testRunId testWorkspaceId');
  const candidateUserIds = candidates.flatMap((workspace) => [
    workspace.owner,
    ...(workspace.members || []),
  ]).filter(Boolean).concat(exactRunUsers.map((user) => user._id));
  const linkedUsers = candidateUserIds.length
    ? await readQuery(User, { _id: { $in: candidateUserIds } }, '_id testSuite testRunId testWorkspaceId')
    : [];
  const linkedWorkspaceIds = linkedUsers.map((user) => user.testWorkspaceId).filter(Boolean);
  const existingLinkedWorkspaces = linkedWorkspaceIds.length
    ? await readQuery(Workspace, { _id: { $in: linkedWorkspaceIds } }, '_id testSuite testRunId')
    : [];
  const workspaceIdStrings = new Set(ownedWorkspaceIds.map(String));
  const deletableUsers = exactRunUsers.filter((user) => {
    if (!assertOwnedUser(user, suite, runId)) return false;
    if (!user.testWorkspaceId) return true;
    const linkedWorkspaceId = String(user.testWorkspaceId);
    if (workspaceIdStrings.has(linkedWorkspaceId)) return true;
    return !existingLinkedWorkspaces.some(
      (workspace) => String(workspace._id) === linkedWorkspaceId,
    );
  });
  const deletedUsers = await User.deleteMany({
    _id: { $in: deletableUsers.map((user) => user._id) },
    ...ownershipFilter,
  });

  const deletableWorkspaceIds = [];
  for (const workspace of candidates.filter((candidate) => assertOwnedWorkspace(candidate, suite, runId))) {
    const hasUnownedMembers = [workspace.owner, ...(workspace.members || [])]
      .filter(Boolean)
      .some((userId) => !deletableUsers.some((user) => String(user._id) === String(userId)));
    if (hasUnownedMembers) continue;

    const remainingRecordCounts = await Promise.all(records.map(({ Model }) => (
      Model.countDocuments({ workspaceId: workspace._id })
    )));
    if (remainingRecordCounts.every((count) => count === 0)) {
      deletableWorkspaceIds.push(workspace._id);
    }
  }
  const deletedWorkspaces = await Workspace.deleteMany({
    _id: { $in: deletableWorkspaceIds },
    ...ownershipFilter,
  });

  return {
    testSuite: suite,
    testRunId: runId,
    deletedRecords,
    deletedUserCount: deletedUsers.deletedCount || 0,
    deletedWorkspaceCount: deletedWorkspaces.deletedCount || 0,
    preservedWorkspaceCount: ownedWorkspaceIds.length - (deletedWorkspaces.deletedCount || 0),
  };
};

export const formatOwnedRuns = (runs, suite) => {
  if (runs.length === 0) return `Query succeeded: 0 matching ${suite} runs found.`;
  return JSON.stringify(runs, null, 2);
};
