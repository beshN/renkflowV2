'use client';

import React from 'react';
import { usePDFStore } from '@/stores/usePDFStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/kit';
import {
  Highlighter,
  Underline,
  Strikethrough,
  StickyNote,
  Type,
  Square,
  Circle,
  ArrowRight,
  Pencil,
  PenTool,
  MousePointer,
  Hand,
  Undo,
  Redo,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type { ToolMode } from '@/stores/usePDFStore';

interface AnnotationToolsProps {
  onSave?: () => void;
  onClear?: () => void;
  className?: string;
}

const ANNOTATION_TOOLS = [
  { mode: 'select' as ToolMode, icon: MousePointer, label: 'Seç', category: 'basic' },
  { mode: 'hand' as ToolMode, icon: Hand, label: 'El', category: 'basic' },
  { mode: 'highlight' as ToolMode, icon: Highlighter, label: 'Vurgula', category: 'text' },
  { mode: 'underline' as ToolMode, icon: Underline, label: 'Alt Çizgi', category: 'text' },
  { mode: 'strikethrough' as ToolMode, icon: Strikethrough, label: 'Üstü Çizili', category: 'text' },
  { mode: 'note' as ToolMode, icon: StickyNote, label: 'Not', category: 'annotation' },
  { mode: 'text' as ToolMode, icon: Type, label: 'Metin', category: 'annotation' },
  { mode: 'rectangle' as ToolMode, icon: Square, label: 'Dikdörtgen', category: 'shape' },
  { mode: 'circle' as ToolMode, icon: Circle, label: 'Daire', category: 'shape' },
  { mode: 'arrow' as ToolMode, icon: ArrowRight, label: 'Ok', category: 'shape' },
  { mode: 'freehand' as ToolMode, icon: Pencil, label: 'Serbest', category: 'draw' },
  { mode: 'signature' as ToolMode, icon: PenTool, label: 'İmza', category: 'draw' },
];

const COLOR_PALETTE = [
  { color: '#FFEB3B', name: 'Sarı' },
  { color: '#FFC107', name: 'Amber' },
  { color: '#FF9800', name: 'Turuncu' },
  { color: '#FF5722', name: 'Kırmızı Turuncu' },
  { color: '#F44336', name: 'Kırmızı' },
  { color: '#E91E63', name: 'Pembe' },
  { color: '#9C27B0', name: 'Mor' },
  { color: '#673AB7', name: 'Derin Mor' },
  { color: '#3F51B5', name: 'İndigo' },
  { color: '#2196F3', name: 'Mavi' },
  { color: '#03A9F4', name: 'Açık Mavi' },
  { color: '#00BCD4', name: 'Cyan' },
  { color: '#009688', name: 'Teal' },
  { color: '#4CAF50', name: 'Yeşil' },
  { color: '#8BC34A', name: 'Açık Yeşil' },
  { color: '#CDDC39', name: 'Lime' },
];

export const AnnotationTools: React.FC<AnnotationToolsProps> = ({
  onSave,
  onClear,
  className,
}) => {
  const toolMode = usePDFStore((state) => state.toolMode);
  const annotationColor = usePDFStore((state) => state.annotationColor);
  const annotationOpacity = usePDFStore((state) => state.annotationOpacity);
  const canUndo = usePDFStore((state) => state.canUndo);
  const canRedo = usePDFStore((state) => state.canRedo);
  const annotations = usePDFStore((state) => state.annotations);
  const showAnnotationTools = usePDFStore((state) => state.showAnnotationTools);
  
  const setToolMode = usePDFStore((state) => state.setToolMode);
  const setAnnotationColor = usePDFStore((state) => state.setAnnotationColor);
  const setAnnotationOpacity = usePDFStore((state) => state.setAnnotationOpacity);
  const toggleAnnotationTools = usePDFStore((state) => state.toggleAnnotationTools);
  const undo = usePDFStore((state) => state.undo);
  const redo = usePDFStore((state) => state.redo);
  const clearAnnotations = usePDFStore((state) => state.clearAnnotations);
  const [confirm, confirmDialog] = useConfirm();
  
  const handleSave = () => {
    onSave?.();
    // Export annotations as JSON
    const data = JSON.stringify(annotations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `annotations-${Date.now()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };
  
  const handleClear = async () => {
    if (await confirm({ title: 'Tüm açıklamalar silinsin mi?', description: 'Bu belgedeki bütün işaretler kaldırılır.', confirmLabel: 'Tümünü sil' })) {
      clearAnnotations();
      onClear?.();
    }
  };
  
  return (
    <div className={cn('relative', className)}>
      {confirmDialog}
      {/* Toolbar Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleAnnotationTools}
        title="Açıklama Araçları"
        className={cn(
          'h-10 w-10 relative',
          showAnnotationTools && 'bg-blue-100 dark:bg-blue-900/30'
        )}
      >
        <Highlighter className="h-5 w-5" />
        {annotations.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {annotations.length}
          </span>
        )}
      </Button>
      
      {/* Annotation Tools Panel */}
      {showAnnotationTools && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl z-50 p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Açıklama Araçları
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={toggleAnnotationTools}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Tool Selection */}
          <div className="space-y-4">
            {/* Basic Tools */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">
                Temel Araçlar
              </label>
              <div className="grid grid-cols-4 gap-1">
                {ANNOTATION_TOOLS.filter(t => t.category === 'basic').map(({ mode, icon: Icon, label }) => (
                  <Button
                    key={mode}
                    variant={toolMode === mode ? 'default' : 'outline'}
                    size="sm"
                    className="h-14 flex flex-col items-center justify-center gap-1 text-[10px] p-1"
                    onClick={() => setToolMode(mode)}
                    title={label}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate w-full text-center leading-tight">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Text Annotation Tools */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">
                Metin Açıklamaları
              </label>
              <div className="grid grid-cols-4 gap-1">
                {ANNOTATION_TOOLS.filter(t => t.category === 'text').map(({ mode, icon: Icon, label }) => (
                  <Button
                    key={mode}
                    variant={toolMode === mode ? 'default' : 'outline'}
                    size="sm"
                    className="h-14 flex flex-col items-center justify-center gap-1 text-[10px] p-1"
                    onClick={() => setToolMode(mode)}
                    title={label}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate w-full text-center leading-tight">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Annotation Tools */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">
                Notlar
              </label>
              <div className="grid grid-cols-4 gap-1">
                {ANNOTATION_TOOLS.filter(t => t.category === 'annotation').map(({ mode, icon: Icon, label }) => (
                  <Button
                    key={mode}
                    variant={toolMode === mode ? 'default' : 'outline'}
                    size="sm"
                    className="h-14 flex flex-col items-center justify-center gap-1 text-[10px] p-1"
                    onClick={() => setToolMode(mode)}
                    title={label}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate w-full text-center leading-tight">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Shape Tools */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">
                Şekiller
              </label>
              <div className="grid grid-cols-4 gap-1">
                {ANNOTATION_TOOLS.filter(t => t.category === 'shape').map(({ mode, icon: Icon, label }) => (
                  <Button
                    key={mode}
                    variant={toolMode === mode ? 'default' : 'outline'}
                    size="sm"
                    className="h-14 flex flex-col items-center justify-center gap-1 text-[10px] p-1"
                    onClick={() => setToolMode(mode)}
                    title={label}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate w-full text-center leading-tight">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Drawing Tools */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">
                Çizim
              </label>
              <div className="grid grid-cols-4 gap-1">
                {ANNOTATION_TOOLS.filter(t => t.category === 'draw').map(({ mode, icon: Icon, label }) => (
                  <Button
                    key={mode}
                    variant={toolMode === mode ? 'default' : 'outline'}
                    size="sm"
                    className="h-14 flex flex-col items-center justify-center gap-1 text-[10px] p-1"
                    onClick={() => setToolMode(mode)}
                    title={label}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate w-full text-center leading-tight">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Color Picker */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">
                Renk
              </label>
              <div className="grid grid-cols-8 gap-1.5">
                {COLOR_PALETTE.map(({ color, name }) => (
                  <button
                    key={color}
                    className={cn(
                      'w-7 h-7 rounded-md border-2 transition-all hover:scale-110',
                      annotationColor === color
                        ? 'border-slate-900 dark:border-white scale-110 ring-2 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setAnnotationColor(color)}
                    title={name}
                  />
                ))}
              </div>
            </div>
            
            {/* Opacity Slider */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 flex items-center justify-between">
                <span>Opaklık</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  {Math.round(annotationOpacity * 100)}%
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={annotationOpacity}
                onChange={(e) => setAnnotationOpacity(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Şeffaf</span>
                <span>Opak</span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9"
                onClick={undo}
                disabled={!canUndo}
                title="Geri Al (Ctrl+Z)"
              >
                <Undo className="h-4 w-4 mr-1.5" />
                Geri Al
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9"
                onClick={redo}
                disabled={!canRedo}
                title="Yinele (Ctrl+Y)"
              >
                <Redo className="h-4 w-4 mr-1.5" />
                Yinele
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9"
                onClick={handleSave}
                disabled={annotations.length === 0}
                title="Açıklamaları Kaydet"
              >
                <Save className="h-4 w-4 mr-1.5" />
                Kaydet
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={handleClear}
                disabled={annotations.length === 0}
                title="Tümünü Temizle"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Temizle
              </Button>
            </div>
            
            {/* Stats */}
            {annotations.length > 0 && (
              <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                Toplam {annotations.length} açıklama
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnotationTools;
