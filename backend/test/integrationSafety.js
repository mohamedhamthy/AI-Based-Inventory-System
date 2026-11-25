import mongoose from 'mongoose';

export const assertDedicatedTestMongoUri = (uri) => {
  if (!uri) {
    throw new Error('MONGODB_TEST_URI is required; MONGODB_URI is never used by integration tests.');
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('MONGODB_TEST_URI must be a valid MongoDB connection URI.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')).split('?')[0];
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing integration test: database "${databaseName}" must end with "_test".`);
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGODB_TEST_URI must use mongodb:// or mongodb+srv://.');
  }
};

export const assertTransactionTopology = async (mongooseInstance = mongoose) => {
  const hello = await mongooseInstance.connection.db.admin().command({ hello: 1 });
  if (hello.msg !== 'isdbgrid' && !hello.setName) {
    throw new Error(
      'Transaction integration tests require a replica set or sharded cluster. '
      + 'Standalone MongoDB topology is not supported.',
    );
  }
};
