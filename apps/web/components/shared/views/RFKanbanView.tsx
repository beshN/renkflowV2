'use client';

import { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface KanbanColumn<T> {
  id: string;
  title: string;
  color?: string;
  items: T[];
}

export interface RFKanbanViewProps<T extends { id: string }> {
  columns: KanbanColumn<T>[];
  renderCard: (item: T) => ReactNode;
  onDragEnd?: (itemId: string, sourceColId: string, destColId: string, newIndex: number) => void;
  onAddCard?: (colId: string) => void;
  isLoading?: boolean;
}

function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing">
      {children}
    </div>
  );
}

export function RFKanbanView<T extends { id: string }>({
  columns,
  renderCard,
  onDragEnd,
  onAddCard,
  isLoading,
}: RFKanbanViewProps<T>) {
  // Dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    if (onDragEnd) {
      // Find source column
      let sourceColId = '';
      let destColId = '';
      
      for (const col of columns) {
        if (col.items.find(i => i.id === activeId)) sourceColId = col.id;
        if (col.id === overId || col.items.find(i => i.id === overId)) destColId = col.id;
      }
      
      if (sourceColId && destColId) {
         onDragEnd(activeId, sourceColId, destColId, 0);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-80 rounded-2xl bg-neutral-100/50 dark:bg-neutral-900/50 flex flex-col p-3 animate-pulse">
            <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-md mb-4" />
            <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded-xl mb-3" />
            <div className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4 items-start min-h-[500px]">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        {columns.map((col) => (
          <div key={col.id} className="flex-shrink-0 w-80 max-h-full flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
            {/* Column Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                {col.color && (
                  <div className={cn("w-2.5 h-2.5 rounded-full", col.color)} />
                )}
                <h3 className="font-semibold text-sm text-foreground">{col.title}</h3>
                <span className="bg-white dark:bg-neutral-800 text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                  {col.items.length}
                </span>
              </div>
              {onAddCard && (
                <button
                  onClick={() => onAddCard(col.id)}
                  className="p-1 rounded-md text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-foreground transition-colors"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {/* Column Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <SortableContext id={col.id} items={col.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {col.items.map((item) => (
                  <SortableItem key={item.id} id={item.id}>
                    {renderCard(item)}
                  </SortableItem>
                ))}
                {col.items.length === 0 && (
                  <div className="h-full min-h-[100px] border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-center">
                    <p className="text-xs text-muted-foreground text-center px-4">
                      Sürükleyip buraya bırakın
                    </p>
                  </div>
                )}
              </SortableContext>
            </div>
          </div>
        ))}
      </DndContext>
    </div>
  );
}
