'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  QrCode, 
  Scan, 
  X, 
  CheckCircle2,
  Package,
  Search,
  Camera,
  ScanLine
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/context/ToastContext';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function QRScanner({ onScan, onClose, isOpen }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen && !scannedData) {
      startScanning();
    }
    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async () => {
    try {
      setScanning(true);
      // Note: Actual camera access would require additional permissions
      // This is a simulated implementation
      showToast('Kamera erişimi isteniyor...', 'info');
    } catch (error) {
      showToast('Kamera erişimi sağlanamadı', 'error');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    setScanning(false);
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const handleManualInput = (value: string) => {
    if (value.length >= 5) {
      setScannedData(value);
      onScan(value);
      showToast('Barkod tarandı!', 'success');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900 dark:text-white">QR / Barkod Tara</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scanner Area */}
          <div className="p-6">
            {!scannedData ? (
              <>
                <div className="relative aspect-square max-w-[300px] mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden">
                  {/* Scanner Frame */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-48 h-48">
                      {/* Corner Markers */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-blue-600 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-blue-600 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-blue-600 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-blue-600 rounded-br-lg" />
                      
                      {/* Scan Line Animation */}
                      {scanning && (
                        <motion.div
                          className="absolute left-0 right-0 h-0.5 bg-blue-500 shadow-lg shadow-blue-500/50"
                          animate={{
                            top: ['0%', '100%', '0%'],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Camera Placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                  </div>

                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                  />
                </div>

                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
                  QR kodu veya barkodu çerçeve içine hizalayın
                </p>

                {/* Manual Input */}
                <div className="mt-6">
                  <p className="text-xs text-slate-500 text-center mb-2">veya manuel girin</p>
                  <input
                    type="text"
                    placeholder="Barkod numarası..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center text-lg tracking-wider font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    onChange={(e) => handleManualInput(e.target.value)}
                    autoFocus
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Başarıyla Tarandı!
                </h4>
                <p className="text-sm text-slate-500 font-mono break-all px-4">
                  {scannedData}
                </p>
                <button
                  onClick={() => {
                    setScannedData(null);
                    startScanning();
                  }}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-700"
                >
                  Yeniden Tara
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// QR Code Generator Component
interface QRGeneratorProps {
  value: string;
  size?: number;
  label?: string;
}

export function QRGenerator({ value, size = 200, label }: QRGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    
    // Simple QR-like visualization (in production, use a proper QR library like qrcode)
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Draw QR-like pattern
    const cellSize = size / 25;
    ctx.fillStyle = '#000000';

    // Position detection patterns (corners)
    const drawPositionPattern = (x: number, y: number) => {
      ctx.fillRect(x * cellSize, y * cellSize, 7 * cellSize, 7 * cellSize);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = '#000000';
      ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, 3 * cellSize, 3 * cellSize);
    };

    drawPositionPattern(2, 2);
    drawPositionPattern(16, 2);
    drawPositionPattern(2, 16);

    // Generate pseudo-random data pattern based on value
    for (let i = 0; i < value.length; i++) {
      const charCode = value.charCodeAt(i);
      const x = (i * 3) % 25;
      const y = Math.floor((i * 3) / 25) % 25;
      
      if (x > 9 || y > 9 || (x < 7 && y < 7) || (x > 15 && y < 7) || (x < 7 && y > 15)) {
        continue;
      }
      
      if (charCode % 2 === 0) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    // Add border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = cellSize;
    ctx.strokeRect(0, 0, size, size);
  }, [value, size]);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-lg shadow-lg"
      />
      {label && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center font-mono">
          {label}
        </p>
      )}
    </div>
  );
}

// Barcode Display Component
interface BarcodeDisplayProps {
  value: string;
  type?: 'code128' | 'ean13' | 'upc';
}

export function BarcodeDisplay({ value, type = 'code128' }: BarcodeDisplayProps) {
  // Simulated barcode using CSS patterns
  const generateBars = (text: string) => {
    const bars = [];
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      const width = (char % 3) + 1;
      const gap = char % 2 === 0;
      bars.push({ width, gap });
    }
    return bars;
  };

  const bars = generateBars(value);

  return (
    <div className="bg-white p-4 rounded-lg inline-block">
      <div className="flex items-end h-16 gap-0.5">
        {bars.map((bar, i) => (
          <div
            key={i}
            className={cn(
              "bg-black",
              bar.gap ? "bg-transparent" : ""
            )}
            style={{ width: `${bar.width * 2}px`, height: '100%' }}
          />
        ))}
      </div>
      <p className="text-center text-xs font-mono mt-2 tracking-widest text-black">
        {value}
      </p>
    </div>
  );
}

// Quick Scan Button Component
export function QuickScanButton({ onScan }: { onScan: (data: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all"
      >
        <ScanLine className="w-4 h-4" />
        Tara
      </button>
      
      <QRScanner
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onScan={(data) => {
          onScan(data);
          setIsOpen(false);
        }}
      />
    </>
  );
}
