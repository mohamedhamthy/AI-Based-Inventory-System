import Swal from 'sweetalert2';

const DeleteProductModal = async (product, onConfirm) => {
  const result = await Swal.fire({
    title: 'Delete product?',
    text: `You are about to remove ${product.productName} from inventory.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Delete',
  });

  if (result.isConfirmed) {
    await onConfirm(product.id);
  }
};

export default DeleteProductModal;
