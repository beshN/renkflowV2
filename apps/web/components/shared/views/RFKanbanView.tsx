'use client';

import { ReactNode, useId, useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCorners, pointerWithin, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface KanbanColumn<T> { id: string; title: string; color?: string; items: T[]; addEnabled?: boolean }
export interface RFKanbanViewProps<T extends { id: string }> {
  columns: KanbanColumn<T>[];
  renderCard: (item: T, overlay?: boolean) => ReactNode;
  getItemLabel?: (item: T) => string;
  onDragEnd?: (itemId: string, sourceColId: string, destColId: string, newIndex: number) => void;
  onAddCard?: (colId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const detectCollision: CollisionDetection = args => {
  const hits = pointerWithin(args);
  if (hits.length) {
    const cards = hits.filter(hit => args.droppableContainers.find(container => container.id === hit.id)?.data.current?.kind === 'card');
    return cards.length ? cards : hits;
  }
  return closestCorners(args);
};

function SortableItem({ id, columnId, label, disabled, children }: { id: string; columnId: string; label: string; disabled: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled, data: { kind: 'card', columnId } });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.25 : 1 }} className="group relative">
    {children}
    {!disabled && <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" aria-label={'Kartı taşı: ' + label} title="Sürükleyin veya boşluk tuşuyla seçip ok tuşlarıyla taşıyın" className="absolute right-1 top-1 z-10 flex h-11 w-11 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"><GripVertical size={16} /></button>}
  </div>;
}

function Column<T extends { id: string }>({ column, renderCard, getItemLabel, disabled, onAddCard }: { column: KanbanColumn<T>; renderCard: RFKanbanViewProps<T>['renderCard']; getItemLabel: (item: T) => string; disabled: boolean; onAddCard?: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled, data: { kind: 'column', columnId: column.id } });
  return <section ref={setNodeRef} aria-label={column.title + ' sütunu'} className={cn('flex w-[min(320px,calc(100vw-3rem))] shrink-0 flex-col rounded-2xl border border-border bg-muted/45 transition-colors', isOver && 'border-primary bg-primary/5 ring-2 ring-primary/20')}>
    <div className="flex items-center gap-2 px-4 py-4"><span className={cn('h-2.5 w-2.5 rounded-full', column.color || 'bg-slate-400')} /><h2 className="flex-1 text-sm font-semibold">{column.title}</h2><span className="rounded-md bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{column.items.length}</span></div>
    <div className="min-h-40 space-y-3 px-3 pb-3">
      <SortableContext id={column.id} items={column.items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        {column.items.map(item => <SortableItem key={item.id} id={item.id} columnId={column.id} label={getItemLabel(item)} disabled={disabled}>{renderCard(item)}</SortableItem>)}
      </SortableContext>
      {!column.items.length && <p className={cn('flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-xs text-muted-foreground', isOver && 'border-primary')}>{disabled ? 'Bu sütunda kart yok.' : 'Bir kartı buraya bırakın'}</p>}
      {onAddCard && column.addEnabled !== false && <button type="button" onClick={() => onAddCard(column.id)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground"><Plus size={17} />Kart ekle</button>}
    </div>
  </section>;
}

export function RFKanbanView<T extends { id: string }>({ columns, renderCard, getItemLabel = item => item.id, onDragEnd, onAddCard, isLoading, disabled = false }: RFKanbanViewProps<T>) {
  const id = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const activeItem = columns.flatMap(column => column.items).find(item => item.id === activeId);
  const finishDrag = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || disabled || active.id === over.id) return;
    const source = columns.find(column => column.items.some(item => item.id === active.id));
    const target = columns.find(column => column.id === over.id || column.items.some(item => item.id === over.id));
    if (!source || !target) return;
    const remaining = target.items.filter(item => item.id !== active.id);
    let index = remaining.findIndex(item => item.id === over.id);
    if (index < 0) index = remaining.length;
    else if (source.id === target.id) index = target.items.findIndex(item => item.id === over.id);
    else if (active.rect.current.translated && active.rect.current.translated.top + active.rect.current.translated.height / 2 > over.rect.top + over.rect.height / 2) index += 1;
    onDragEnd?.(String(active.id), source.id, target.id, Math.min(index, remaining.length));
  };
  if (isLoading) return <div aria-label="Pano yükleniyor" aria-busy="true" className="flex gap-4 overflow-x-auto pb-4">{[0,1,2,3].map(index => <div key={index} className="h-80 w-80 shrink-0 animate-pulse rounded-2xl bg-muted" />)}</div>;
  return <DndContext id={id} sensors={sensors} collisionDetection={detectCollision} onDragStart={event => setActiveId(String(event.active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={finishDrag} accessibility={{ screenReaderInstructions: { draggable: 'Kartı taşımak için boşluk tuşuna basın. Ok tuşlarıyla yer değiştirin, boşlukla bırakın, Escape ile vazgeçin.' }, announcements: { onDragStart: () => 'Kart seçildi.', onDragOver: ({ over }) => over ? 'Kart yeni konumun üzerinde.' : 'Bir sütun seçin.', onDragEnd: () => 'Taşıma sona erdi.', onDragCancel: () => 'Taşıma iptal edildi.' } }}>
    <div className="flex min-h-[400px] items-start gap-4 overflow-x-auto overscroll-x-contain pb-5" aria-label="İş emri panosu">{columns.map(column => <Column key={column.id} column={column} renderCard={renderCard} getItemLabel={getItemLabel} disabled={disabled || !onDragEnd} onAddCard={disabled ? undefined : onAddCard} />)}</div>
    <DragOverlay dropAnimation={null}>{activeItem ? <div aria-hidden="true" className="rotate-2 cursor-grabbing rounded-xl shadow-2xl ring-2 ring-primary/30">{renderCard(activeItem, true)}</div> : null}</DragOverlay>
  </DndContext>;
}
