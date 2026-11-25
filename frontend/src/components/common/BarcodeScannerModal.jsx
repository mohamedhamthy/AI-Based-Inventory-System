import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { FiCamera, FiX } from 'react-icons/fi';

const getCameraErrorMessage = (error) => {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Camera access was denied. Allow camera permission in your browser, or enter the part number or barcode manually below.';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'No camera was found. Enter the part number or barcode manually below.';
  }
  if (error?.name === 'NotSupportedError' || error?.name === 'SecurityError') {
    return 'Camera access is unavailable in this browser or page context. Enter the part number or barcode manually below.';
  }
  return 'Unable to start the camera. Enter the part number or barcode manually below.';
};

const BarcodeScannerModal = ({ onDetected, onClose }) => {
  const videoRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const detectedRef = useRef(false);
  const [status, setStatus] = useState('Requesting camera permission…');
  const [error, setError] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [hasSubmittedValue, setHasSubmittedValue] = useState(false);

  const submitValue = (value) => {
    const cleanValue = value.trim();
    if (!cleanValue || detectedRef.current) return;
    detectedRef.current = true;
    setHasSubmittedValue(true);
    onDetectedRef.current(cleanValue);
  };

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
  }, [onClose, onDetected]);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls;
    let disposed = false;

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _scanError, scannerControls) => {
      if (!result || disposed || detectedRef.current) return;
      scannerControls.stop();
      submitValue(result.getText());
    }).then((scannerControls) => {
      controls = scannerControls;
      if (disposed) scannerControls.stop();
      else setStatus('Camera ready');
    }).catch((cameraError) => {
      if (!disposed) {
        setError(getCameraErrorMessage(cameraError));
        setStatus('Camera unavailable');
      }
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      disposed = true;
      controls?.stop();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <button type="button" aria-label="Close barcode scanner" onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <section role="dialog" aria-modal="true" aria-labelledby="barcode-scanner-title" className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
              <FiCamera size={19} />
            </span>
            <div>
              <h2 id="barcode-scanner-title" className="font-semibold text-white">Scan barcode</h2>
              <p className="text-sm text-slate-400">{status}</p>
            </div>
          </div>
          <button type="button" aria-label="Close scanner" onClick={onClose} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10">
            <FiX size={18} />
          </button>
        </div>
        <div className="p-4 sm:p-5">
          <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-2xl bg-black object-cover" />
          {error ? <p role="alert" className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitValue(manualValue);
            }}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <label className="flex-1 text-sm text-slate-300">
              <span className="mb-2 block">Enter part number or barcode manually</span>
              <input
                autoFocus
                aria-label="Manual part number or barcode"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
              />
            </label>
            <button type="submit" disabled={!manualValue.trim() || hasSubmittedValue} className="self-end rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
              Use value
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default BarcodeScannerModal;