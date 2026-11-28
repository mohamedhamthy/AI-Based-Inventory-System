import { env } from "./env.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";

export const ensureDemoEnvironment = async () => {
  if (!env.demoMode) {
    console.log("Demo environment is disabled for this deployment.");
    return;
  }

  const workspace = env.demoWorkspaceId
    ? await Workspace.findById(env.demoWorkspaceId)
    : await Workspace.findOne().sort({ createdAt: 1 });
  if (!workspace) {
    throw new Error(
      "Configured demo workspace does not exist; no demo account was created",
    );
  }
  env.demoWorkspaceId = String(workspace._id);

  let user = await User.findOne({ email: env.demoAccountEmail });
  if (!user) {
    user = await User.create({
      name: "Public Demo Viewer",
      email: env.demoAccountEmail,
      password: env.demoAccountPassword,
      role: "demo_viewer",
      accountType: "demo_user",
    });
  } else if (
    user.role !== "demo_viewer" ||
    user.accountType !== "demo_user" ||
    !user.isActive
  ) {
    throw new Error(
      "Configured demo account email is already in use by a non-demo or inactive account",
    );
  }

  const isWorkspaceMember = workspace.members.some(
    (memberId) => String(memberId) === String(user._id),
  );
  if (!isWorkspaceMember) {
    await Workspace.updateOne(
      { _id: workspace._id },
      { $addToSet: { members: user._id } },
    );
  }

  console.log(
    "Read-only demo account is connected to the configured existing workspace.",
  );
};
