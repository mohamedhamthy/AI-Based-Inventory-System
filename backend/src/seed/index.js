import dotenv from "dotenv";

dotenv.config();

const seedDemo = async () => {
  console.log("Demo seeding is disabled for this deployment.");
};

seedDemo().catch((error) => {
  console.error("Demo seeding setup failed:", error);
  process.exitCode = 1;
});
