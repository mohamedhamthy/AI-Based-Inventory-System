import AppError from "../utils/AppError.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { USER_ROLES } from "../constants/userRoles.js";
import { runInventoryTransaction } from "./inventoryService.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const userFields = "name email role isActive lastLogin createdAt updatedAt";
const USER_TRANSACTION_SUPPORT_ERROR =
  "Creating staff accounts requires MongoDB transactions, available on replica sets or sharded clusters. Configure the database accordingly; no account was created.";
const runUserTransaction = (operation) =>
  runInventoryTransaction(operation, {
    unsupportedMessage: USER_TRANSACTION_SUPPORT_ERROR,
  });

export const createUserAccount = async (
  { actor, workspaceId, name, email, password, role = "employee" },
  {
    UserModel = User,
    WorkspaceModel = Workspace,
    transaction = runUserTransaction,
  } = {},
) => {
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  if (cleanName.length < 2 || cleanName.length > 80) {
    throw new AppError("Name must be between 2 and 80 characters", 400);
  }
  if (!cleanEmail || cleanEmail.length > 254 || !cleanEmail.includes("@")) {
    throw new AppError("A valid email is required", 400);
  }
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new AppError("Password must be between 8 and 128 characters", 400);
  }
  if (!USER_ROLES.includes(role))
    throw new AppError("Role is not supported", 400);
  if (role === "super_admin" && actor.role !== "super_admin") {
    throw new AppError(
      "Only a super admin can create super admin accounts",
      403,
    );
  }

  try {
    return await transaction(async (session) => {
      const existingUser = await UserModel.findOne({
        email: cleanEmail,
      }).session(session);
      if (existingUser)
        throw new AppError("An account with this email already exists", 409);

      const [createdUser] = await UserModel.create(
        [
          {
            name: cleanName,
            email: cleanEmail,
            password,
            role,
          },
        ],
        { session },
      );

      const membership = await WorkspaceModel.updateOne(
        { _id: workspaceId, members: actor._id },
        { $addToSet: { members: createdUser._id } },
        { session },
      );
      if (!membership.matchedCount) {
        throw new AppError(
          "You do not have access to the selected workspace",
          403,
        );
      }

      return createdUser.toSafeObject();
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("An account with this email already exists", 409);
    }
    throw error;
  }
};

export const getUsersPage = async ({
  page,
  limit,
  search,
  role,
  status,
  includeSuperAdmins,
}) => {
  const filters = [];
  const visibleUsersFilter = includeSuperAdmins
    ? {}
    : { role: { $ne: "super_admin" } };

  if (search) {
    const escapedSearch = escapeRegex(search.slice(0, 100));
    filters.push({
      $or: [
        { name: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
      ],
    });
  }
  if (role) filters.push({ role });
  if (status === "active") filters.push({ isActive: true });
  if (status === "inactive") filters.push({ isActive: false });
  if (!includeSuperAdmins) filters.push(visibleUsersFilter);

  const query = filters.length ? { $and: filters } : {};
  const [users, totalItems, totalUsers, activeUsers, inactiveUsers] =
    await Promise.all([
      User.find(query)
        .select(userFields)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
      User.countDocuments(visibleUsersFilter),
      User.countDocuments({ ...visibleUsersFilter, isActive: true }),
      User.countDocuments({ ...visibleUsersFilter, isActive: false }),
    ]);
  const totalPages = Math.ceil(totalItems / limit);

  return {
    users,
    summary: { totalUsers, activeUsers, inactiveUsers },
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

export const updateUserAccount = async ({ actor, userId, changes }) => {
  const target = await User.findById(userId).select("role isActive");
  if (!target) throw new AppError("User not found", 404);

  const isSelf = target._id.equals(actor._id);
  if (isSelf && (changes.role !== undefined || changes.isActive === false)) {
    throw new AppError(
      "You cannot change your own role or deactivate your account",
      400,
    );
  }

  if (
    actor.role !== "super_admin" &&
    (target.role === "super_admin" || changes.role === "super_admin")
  ) {
    throw new AppError(
      "Only a super admin can manage super admin accounts",
      403,
    );
  }

  const demotesSuperAdmin =
    target.role === "super_admin" &&
    changes.role !== undefined &&
    changes.role !== "super_admin";
  const deactivatesSuperAdmin =
    target.role === "super_admin" && changes.isActive === false;
  if (demotesSuperAdmin || deactivatesSuperAdmin) {
    throw new AppError(
      "Super admin accounts cannot be demoted or deactivated through the API",
      403,
    );
  }

  if (changes.role !== undefined && !USER_ROLES.includes(changes.role)) {
    throw new AppError("Role is not supported", 400);
  }

  if (changes.isActive === false) {
    await Session.deleteMany({ user: target._id });
  }

  return User.findByIdAndUpdate(
    target._id,
    { $set: changes },
    { new: true, runValidators: true },
  )
    .select(userFields)
    .lean();
};
