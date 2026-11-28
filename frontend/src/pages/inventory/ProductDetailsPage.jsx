import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiEdit2 } from "react-icons/fi";
import PageHeader from "../../components/common/PageHeader";
import ProductDetailsCard from "../../components/inventory/ProductDetailsCard";
import { getProductById } from "../../services/productService";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission } from "../../utils/permissions";

const ProductDetailsPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setProduct(null);
      setIsLoading(true);
      setLoadError("");
      try {
        const data = await getProductById(id);
        if (active) setProduct(data);
      } catch (error) {
        if (active) setLoadError(error.message || "Unable to load this part.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id, loadAttempt]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={product?.productName || "Part details"}
        description="Part number, verified Yamaha model compatibility, pricing, stock status, storage location, and supplier information."
        action={
          <div className="flex flex-wrap gap-3">
            <Link
              to="/inventory"
              className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300"
            >
              <FiArrowLeft /> Back
            </Link>
            {hasPermission(user, "products:update") && (
              <Link
                to={`/inventory/${id}/edit`}
                className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                <FiEdit2 /> Edit Part
              </Link>
            )}
          </div>
        }
      />
      {isLoading ? (
        <p role="status" className="text-sm text-slate-400">
          Loading part details…
        </p>
      ) : null}
      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200"
        >
          {loadError}
          <button
            type="button"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      ) : null}
      {!isLoading && product ? <ProductDetailsCard product={product} /> : null}
    </div>
  );
};

export default ProductDetailsPage;
