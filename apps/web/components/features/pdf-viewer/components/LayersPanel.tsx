'use client';

import React from 'react';
import { usePDFStore } from '@/stores/usePDFStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { FileText, Highlighter, Square, Eye, EyeOff, Info } from 'lucide-react';

interface LayersPanelProps {
  className?: string;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({ className }) => {
  // Store selectors
  const annotations = usePDFStore((state) => state.annotations);
  const formFields = usePDFStore((state) => state.formFields);
  
  const pdfContentVisible = usePDFStore((state) => state.pdfContentVisible);
  const pdfContentOpacity = usePDFStore((state) => state.pdfContentOpacity);
  const annotationLayerVisible = usePDFStore((state) => state.annotationLayerVisible);
  const annotationLayerOpacity = usePDFStore((state) => state.annotationLayerOpacity);
  const formLayerVisible = usePDFStore((state) => state.formLayerVisible);
  const formLayerOpacity = usePDFStore((state) => state.formLayerOpacity);
  
  // Store actions
  const setPdfContentVisible = usePDFStore((state) => state.setPdfContentVisible);
  const setPdfContentOpacity = usePDFStore((state) => state.setPdfContentOpacity);
  const setAnnotationLayerVisible = usePDFStore((state) => state.setAnnotationLayerVisible);
  const setAnnotationLayerOpacity = usePDFStore((state) => state.setAnnotationLayerOpacity);
  const setFormLayerVisible = usePDFStore((state) => state.setFormLayerVisible);
  const setFormLayerOpacity = usePDFStore((state) => state.setFormLayerOpacity);
  
  const layers = [
    {
      id: 'pdf-content',
      name: 'PDF İçeriği',
      icon: FileText,
      count: null,
      visible: pdfContentVisible,
      opacity: pdfContentOpacity,
      setVisible: setPdfContentVisible,
      setOpacity: setPdfContentOpacity,
      locked: true, // PDF content cannot be hidden
      color: 'text-slate-600 dark:text-slate-400',
    },
    {
      id: 'annotations',
      name: 'Açıklamalar',
      icon: Highlighter,
      count: annotations.length,
      visible: annotationLayerVisible,
      opacity: annotationLayerOpacity,
      setVisible: setAnnotationLayerVisible,
      setOpacity: setAnnotationLayerOpacity,
      locked: false,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      id: 'forms',
      name: 'Form Alanları',
      icon: Square,
      count: formFields.length,
      visible: formLayerVisible,
      opacity: formLayerOpacity,
      setVisible: setFormLayerVisible,
      setOpacity: setFormLayerOpacity,
      locked: false,
      color: 'text-green-600 dark:text-green-400',
    },
  ];
  
  return (
    <div className={cn('space-y-3', className)}>
      {/* Info Banner */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Katman Yönetimi</p>
            <p className="text-blue-600 dark:text-blue-400">
              Her katmanın görünürlüğünü ve opaklığını ayrı ayrı kontrol edebilirsiniz.
            </p>
          </div>
        </div>
      </div>
      
      {/* Layers */}
      {layers.map((layer) => {
        const Icon = layer.icon;
        const isDisabled = layer.count === 0 && !layer.locked;
        
        return (
          <div
            key={layer.id}
            className={cn(
              'p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border transition-all',
              layer.visible && !isDisabled
                ? 'border-slate-300 dark:border-slate-600'
                : 'border-slate-200 dark:border-slate-700 opacity-60'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-1">
                <Icon className={cn('h-5 w-5', layer.color)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {layer.name}
                    </span>
                    {layer.count !== null && (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-400">
                        {layer.count}
                      </span>
                    )}
                  </div>
                  {isDisabled && (
                    <p className="text-xs text-slate-500 mt-0.5">Öğe yok</p>
                  )}
                </div>
              </div>
              
              {/* Visibility Toggle */}
              <button
                onClick={() => !layer.locked && layer.setVisible(!layer.visible)}
                disabled={layer.locked || isDisabled}
                className={cn(
                  'p-2 rounded-md transition-colors',
                  layer.locked || isDisabled
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
                title={
                  layer.locked
                    ? 'PDF içeriği gizlenemez'
                    : layer.visible
                    ? 'Gizle'
                    : 'Göster'
                }
              >
                {layer.visible ? (
                  <Eye className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                ) : (
                  <EyeOff className="h-4 w-4 text-slate-400 dark:text-slate-600" />
                )}
              </button>
            </div>
            
            {/* Opacity Slider */}
            {layer.visible && !isDisabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Opaklık</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>
                
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={layer.opacity}
                    onChange={(e) => layer.setOpacity(parseFloat(e.target.value))}
                    disabled={layer.locked}
                    className={cn(
                      'w-full h-2 rounded-lg appearance-none cursor-pointer',
                      'bg-slate-200 dark:bg-slate-700',
                      '[&::-webkit-slider-thumb]:appearance-none',
                      '[&::-webkit-slider-thumb]:w-4',
                      '[&::-webkit-slider-thumb]:h-4',
                      '[&::-webkit-slider-thumb]:rounded-full',
                      '[&::-webkit-slider-thumb]:bg-blue-600',
                      '[&::-webkit-slider-thumb]:cursor-pointer',
                      '[&::-webkit-slider-thumb]:transition-all',
                      '[&::-webkit-slider-thumb]:hover:scale-110',
                      '[&::-moz-range-thumb]:w-4',
                      '[&::-moz-range-thumb]:h-4',
                      '[&::-moz-range-thumb]:rounded-full',
                      '[&::-moz-range-thumb]:bg-blue-600',
                      '[&::-moz-range-thumb]:border-0',
                      '[&::-moz-range-thumb]:cursor-pointer',
                      layer.locked && 'opacity-50 cursor-not-allowed'
                    )}
                  />
                  
                  {/* Opacity Preview Bar */}
                  <div
                    className="absolute top-0 left-0 h-2 rounded-lg pointer-events-none transition-all"
                    style={{
                      width: `${layer.opacity * 100}%`,
                      backgroundColor: layer.color.includes('blue')
                        ? '#3B82F6'
                        : layer.color.includes('green')
                        ? '#10B981'
                        : '#64748B',
                      opacity: layer.opacity,
                    }}
                  />
                </div>
                
                <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                  <span>Şeffaf</span>
                  <span>Opak</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      
      {/* Quick Actions */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => {
              setAnnotationLayerVisible(true);
              setFormLayerVisible(true);
              setAnnotationLayerOpacity(1);
              setFormLayerOpacity(1);
            }}
          >
            Tümünü Göster
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => {
              setAnnotationLayerVisible(false);
              setFormLayerVisible(false);
            }}
          >
            Tümünü Gizle
          </Button>
        </div>
      </div>
      
      {/* Statistics */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <div className="flex justify-between">
            <span>Toplam Açıklama:</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {annotations.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Toplam Form Alanı:</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {formFields.length}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
            <span>Aktif Katman:</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {[pdfContentVisible, annotationLayerVisible, formLayerVisible].filter(Boolean).length} / 3
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayersPanel;
