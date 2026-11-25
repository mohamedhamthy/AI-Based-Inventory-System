import mongoose from 'mongoose';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { env } from '../config/env.js';
import { RECOVERY_CONFIRMATION_PHRASE, recoverAdminBootstrap } from '../services/bootstrapAdmin.js';
import { assertLocalDevelopmentDatabase } from '../config/bootstrapSafety.js';

const run = async () => {
  assertLocalDevelopmentDatabase(env);

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    console.log('Recovery only removes an initializing claim after verifying its recorded process is no longer running.');
    const confirmation = await prompt.question(`Type "${RECOVERY_CONFIRMATION_PHRASE}" to continue: `);
    if (confirmation !== RECOVERY_CONFIRMATION_PHRASE) {
      throw new Error(`Confirmation did not match "${RECOVERY_CONFIRMATION_PHRASE}". No database connection was made.`);
    }

    await mongoose.connect(env.mongoUri, { autoIndex: false });
    await recoverAdminBootstrap(confirmation, {
      databaseSettings: env,
    });
    console.log('The stale bootstrap claim was removed. You may now run the documented bootstrap command.');
  } finally {
    prompt.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(`Administrator bootstrap recovery failed: ${error.message}`);
  process.exitCode = 1;
});
