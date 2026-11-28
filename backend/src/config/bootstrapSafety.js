export const assertLocalDevelopmentDatabase = ({ nodeEnv, mongoUri }) => {
  if (nodeEnv === "production") {
    throw new Error(
      "Administrator bootstrap and recovery are disabled when NODE_ENV=production",
    );
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(mongoUri);
  } catch {
    throw new Error(
      "Administrator bootstrap and recovery require a valid local MongoDB URI",
    );
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname)) {
    throw new Error(
      "Administrator bootstrap and recovery only connect to a loopback MongoDB host",
    );
  }
};
