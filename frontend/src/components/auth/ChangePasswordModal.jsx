import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import { changePassword } from "../../services/authService";

const createInitialForm = () => ({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const createInitialVisibility = () => ({
  currentPassword: false,
  newPassword: false,
  confirmPassword: false,
});

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [form, setForm] = useState(createInitialForm);
  const [showPasswords, setShowPasswords] = useState(createInitialVisibility);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const validateForm = () => {
    const errors = {};
    if (!form.currentPassword)
      errors.currentPassword = "Current password is required.";
    if (!form.newPassword) {
      errors.newPassword = "New password is required.";
    } else if (form.newPassword.length < 8) {
      errors.newPassword = "New password must be at least 8 characters.";
    } else if (form.newPassword.length > 128) {
      errors.newPassword = "New password must be 128 characters or fewer.";
    } else if (
      form.currentPassword &&
      form.newPassword === form.currentPassword
    ) {
      errors.newPassword =
        "New password must be different from current password.";
    }
    if (!form.confirmPassword) {
      errors.confirmPassword = "Please confirm your new password.";
    } else if (form.newPassword !== form.confirmPassword) {
      errors.confirmPassword = "New password and confirm password must match.";
    }
    return errors;
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    setFormError("");
  };

  const toggleVisibility = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setFieldErrors({});

    try {
      const response = await changePassword(form);
      toast.success(response?.message || "Password changed successfully.");
      setForm(createInitialForm());
      setShowPasswords(createInitialVisibility());
      setFieldErrors({});
      onClose();
    } catch (error) {
      const details = Array.isArray(error.details) ? error.details : [];
      if (details.length > 0) {
        const nextErrors = {};
        details.forEach((detail) => {
          if (detail?.field && detail?.message)
            nextErrors[detail.field] = detail.message;
        });
        if (Object.keys(nextErrors).length > 0) setFieldErrors(nextErrors);
      }
      const message =
        error.message || "Unable to change password. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPasswordField = (field, label, autoComplete) => {
    const isVisible = showPasswords[field];
    const error = fieldErrors[field];
    return (
      <label className="block">
        <span className="mb-2 block text-sm text-slate-300">{label}</span>
        <div
          className={`flex items-center gap-2 rounded-2xl border bg-slate-900/70 px-3 py-2.5 transition focus-within:ring-2 focus-within:ring-cyan-400/20 ${error ? "border-rose-400/40 focus-within:border-rose-400/60" : "border-white/10 focus-within:border-cyan-400/40"}`}
        >
          <input
            type={isVisible ? "text" : "password"}
            value={form[field]}
            onChange={handleChange(field)}
            autoComplete={autoComplete}
            disabled={isSubmitting}
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
            placeholder={label}
          />
          <button
            type="button"
            onClick={() => toggleVisibility(field)}
            aria-label={
              isVisible
                ? `Hide ${label.toLowerCase()}`
                : `Show ${label.toLowerCase()}`
            }
            disabled={isSubmitting}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isVisible ? <FiEyeOff size={18} /> : <FiEye size={18} />}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      </label>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2
              id="change-password-title"
              className="text-xl font-semibold text-white"
            >
              Change Password
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Update your account password securely. Other active sessions will
              be signed out.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close change password dialog"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <FiX size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {formError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200"
            >
              {formError}
            </p>
          ) : null}
          {renderPasswordField(
            "currentPassword",
            "Current Password",
            "current-password",
          )}
          {renderPasswordField("newPassword", "New Password", "new-password")}
          {renderPasswordField(
            "confirmPassword",
            "Confirm New Password",
            "new-password",
          )}
          <p className="text-xs text-slate-400">
            Use at least 8 characters and choose a password different from your
            current one.
          </p>
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Changing password..." : "Change Password"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default ChangePasswordModal;
