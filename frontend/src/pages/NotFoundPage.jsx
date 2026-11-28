import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaHome, FaSearch } from "react-icons/fa";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_45%),linear-gradient(135deg,_#020617,_#0f172a)] px-6 py-12 text-white">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl shadow-cyan-500/10 backdrop-blur-xl sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
          <FaSearch className="text-3xl" />
        </div>

        <p className="mt-6 text-sm uppercase tracking-[0.35em] text-cyan-300">
          AHS Motors · Yamaha Spare Parts · Sammanthurai
        </p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          The page may have moved or the address may be incorrect. Return to the
          parts management dashboard to continue.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            <FaHome />
            Go to Dashboard
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/70 px-4 py-3 font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300"
          >
            <FaArrowLeft />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
