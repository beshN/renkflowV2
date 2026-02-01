'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  FileText,
  Lock,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface DigitalSignature {
  id: string;
  name: string;
  reason?: string;
  location?: string;
  contactInfo?: string;
  signDate: Date;
  byteRange: number[];
  filter: string;
  subFilter: string;
  contents: string; // Base64 encoded signature
}

export interface SignatureValidation {
  isValid: boolean;
  isTrusted: boolean;
  isExpired: boolean;
  certificateInfo?: {
    subject: string;
    issuer: string;
    validFrom: Date;
    validTo: Date;
    serialNumber: string;
    algorithm: string;
  };
  verificationDate: Date;
  errors?: string[];
  warnings?: string[];
}

interface SignatureVerificationProps {
  signatures: DigitalSignature[];
  onVerify?: (signatureId: string) => Promise<SignatureValidation>;
  className?: string;
}

export const SignatureVerification: React.FC<SignatureVerificationProps> = ({
  signatures,
  onVerify,
  className,
}) => {
  const [verifications, setVerifications] = useState<Map<string, SignatureValidation>>(new Map());
  const [verifying, setVerifying] = useState<Set<string>>(new Set());
  const [expandedSignatures, setExpandedSignatures] = useState<Set<string>>(new Set());

  // Auto-verify all signatures on mount
  useEffect(() => {
    if (signatures.length > 0 && onVerify) {
      signatures.forEach((sig) => {
        handleVerifySignature(sig.id);
      });
    }
  }, [signatures.length]);

  const handleVerifySignature = async (signatureId: string) => {
    if (!onVerify || verifying.has(signatureId)) return;

    setVerifying((prev) => new Set(prev).add(signatureId));

    try {
      const validation = await onVerify(signatureId);
      setVerifications((prev) => new Map(prev).set(signatureId, validation));
    } catch (error) {
      console.error('Signature verification error:', error);
      setVerifications((prev) =>
        new Map(prev).set(signatureId, {
          isValid: false,
          isTrusted: false,
          isExpired: false,
          verificationDate: new Date(),
          errors: ['İmza doğrulama başarısız oldu'],
        })
      );
    } finally {
      setVerifying((prev) => {
        const next = new Set(prev);
        next.delete(signatureId);
        return next;
      });
    }
  };

  const toggleExpanded = (signatureId: string) => {
    setExpandedSignatures((prev) => {
      const next = new Set(prev);
      if (next.has(signatureId)) {
        next.delete(signatureId);
      } else {
        next.add(signatureId);
      }
      return next;
    });
  };

  const getSignatureStatus = (signature: DigitalSignature) => {
    const validation = verifications.get(signature.id);
    const isVerifying = verifying.has(signature.id);

    if (isVerifying) {
      return {
        icon: Loader2,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
        label: 'Doğrulanıyor...',
        description: 'İmza kriptografik olarak doğrulanıyor',
      };
    }

    if (!validation) {
      return {
        icon: Shield,
        color: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-50 dark:bg-slate-900',
        borderColor: 'border-slate-200 dark:border-slate-700',
        label: 'Doğrulanmadı',
        description: 'İmza henüz doğrulanmadı',
      };
    }

    if (!validation.isValid) {
      return {
        icon: ShieldX,
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        borderColor: 'border-red-200 dark:border-red-800',
        label: 'Geçersiz İmza',
        description: 'İmza doğrulanamadı veya bozulmuş',
      };
    }

    if (validation.isExpired) {
      return {
        icon: ShieldAlert,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-950/30',
        borderColor: 'border-orange-200 dark:border-orange-800',
        label: 'Süresi Dolmuş',
        description: 'İmza geçerli ancak sertifika süresi dolmuş',
      };
    }

    if (!validation.isTrusted) {
      return {
        icon: ShieldAlert,
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        label: 'Güvenilir Değil',
        description: 'İmza geçerli ancak sertifika güvenilir değil',
      };
    }

    return {
      icon: ShieldCheck,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800',
      label: 'Geçerli İmza',
      description: 'İmza doğrulandı ve güvenilir',
    };
  };

  if (signatures.length === 0) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <Shield className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Bu PDF dijital imza içermiyor
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
          Dijital imzalar belgenin özgünlüğünü doğrular
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Summary */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Dijital İmza Doğrulama</p>
            <p className="text-blue-600 dark:text-blue-400">
              Bu PDF {signatures.length} dijital imza içeriyor. İmzalar kriptografik olarak doğrulanıyor.
            </p>
          </div>
        </div>
      </div>

      {/* Signatures */}
      {signatures.map((signature) => {
        const status = getSignatureStatus(signature);
        const validation = verifications.get(signature.id);
        const isExpanded = expandedSignatures.has(signature.id);
        const StatusIcon = status.icon;

        return (
          <div
            key={signature.id}
            className={cn(
              'rounded-lg border transition-all',
              status.bgColor,
              status.borderColor
            )}
          >
            {/* Header */}
            <button
              onClick={() => toggleExpanded(signature.id)}
              className="w-full p-3 flex items-start gap-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div className={cn('p-2 rounded-lg bg-white dark:bg-slate-800', status.borderColor, 'border')}>
                <StatusIcon
                  className={cn('h-5 w-5', status.color, verifying.has(signature.id) && 'animate-spin')}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-sm font-semibold', status.color)}>
                    {status.label}
                  </span>
                  {validation?.isValid && (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                  {status.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <User className="h-3 w-3" />
                  <span className="font-medium truncate">{signature.name}</span>
                </div>
              </div>

              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-slate-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0" />
              )}
            </button>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                {/* Signature Info */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    İmza Bilgileri
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start gap-2">
                      <User className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-slate-500">İmzalayan:</span>
                        <span className="ml-2 text-slate-900 dark:text-white font-medium">
                          {signature.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-slate-500">Tarih:</span>
                        <span className="ml-2 text-slate-900 dark:text-white">
                          {signature.signDate.toLocaleString('tr-TR')}
                        </span>
                      </div>
                    </div>
                    {signature.reason && (
                      <div className="flex items-start gap-2">
                        <FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-slate-500">Sebep:</span>
                          <span className="ml-2 text-slate-900 dark:text-white">
                            {signature.reason}
                          </span>
                        </div>
                      </div>
                    )}
                    {signature.location && (
                      <div className="flex items-start gap-2">
                        <span className="text-slate-500">Konum:</span>
                        <span className="ml-2 text-slate-900 dark:text-white">
                          {signature.location}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Certificate Info */}
                {validation?.certificateInfo && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Sertifika Bilgileri
                    </h4>
                    <div className="space-y-1.5 text-xs bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                      <div>
                        <span className="text-slate-500">Konu:</span>
                        <span className="ml-2 text-slate-900 dark:text-white text-[10px] font-mono">
                          {validation.certificateInfo.subject}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Veren:</span>
                        <span className="ml-2 text-slate-900 dark:text-white text-[10px] font-mono">
                          {validation.certificateInfo.issuer}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="text-slate-500">Geçerlilik:</span>
                        <span className="text-slate-900 dark:text-white">
                          {validation.certificateInfo.validFrom.toLocaleDateString('tr-TR')} -{' '}
                          {validation.certificateInfo.validTo.toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Algoritma:</span>
                        <span className="ml-2 text-slate-900 dark:text-white">
                          {validation.certificateInfo.algorithm}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Errors */}
                {validation?.errors && validation.errors.length > 0 && (
                  <div className="space-y-1.5">
                    {validation.errors.map((error, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-xs"
                      >
                        <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <span className="text-red-700 dark:text-red-300">{error}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {validation?.warnings && validation.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    {validation.warnings.map((warning, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded text-xs"
                      >
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <span className="text-yellow-700 dark:text-yellow-300">{warning}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Verify Button */}
                {!validation && onVerify && (
                  <Button
                    onClick={() => handleVerifySignature(signature.id)}
                    disabled={verifying.has(signature.id)}
                    size="sm"
                    className="w-full"
                  >
                    {verifying.has(signature.id) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Doğrulanıyor...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        İmzayı Doğrula
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Info */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          <strong>Not:</strong> Dijital imza doğrulama, belgenin imzalandıktan sonra değiştirilmediğini
          ve imzalayanın kimliğini kriptografik olarak doğrular. Güvenilir sertifika otoritesi kontrolü
          yapılır.
        </p>
      </div>
    </div>
  );
};

export default SignatureVerification;
