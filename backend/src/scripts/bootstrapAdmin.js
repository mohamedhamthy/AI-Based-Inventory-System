import mongoose from "mongoose";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { env } from "../config/env.js";
import { initializeAdminSetup } from "../services/bootstrapAdmin.js";
import { assertLocalDevelopmentDatabase } from "../config/bootstrapSafety.js";

const askSecret = (label) =>
  new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(
        new Error(
          "A terminal is required to enter the administrator password securely",
        ),
      );
      return;
    }

    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";

    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Administrator setup cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " " && character !== "\u001b") {
          value += character;
        }
      }
    };

    stdin.on("data", onData);
  });

const run = async () => {
  assertLocalDevelopmentDatabase(env);

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const name = (await prompt.question("Administrator name: ")).trim();
    const email = (await prompt.question("Administrator email: ")).trim();
    prompt.close();

    const password = await askSecret(
      "Administrator password (12+ characters): ",
    );
    const passwordConfirmation = await askSecret(
      "Confirm administrator password: ",
    );
    if (password !== passwordConfirmation) {
      throw new Error("The entered passwords do not match");
    }

    await mongoose.connect(env.mongoUri, { autoIndex: false });
    await initializeAdminSetup({ name, email, password });
    console.log(
      "Initial administrator and Main workspace created successfully.",
    );
  } finally {
    if (!prompt.closed) prompt.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(`Administrator bootstrap failed: ${error.message}`);
  process.exitCode = 1;
});
