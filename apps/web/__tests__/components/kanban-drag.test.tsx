import { fireEvent, render, screen } from '@testing-library/react';
import { RFKanbanView } from '@/components/shared/views/RFKanbanView';
import { useDroppable } from '@dnd-kit/core';
let mockContext: any;
jest.mock('@dnd-kit/core',()=>({
 DndContext:(props:any)=>{mockContext=props;return props.children;}, DragOverlay:({children}:any)=>children,
 useDroppable:jest.fn(()=>({setNodeRef:jest.fn(),isOver:false})),useSensor:jest.fn(),useSensors:jest.fn(),
 MouseSensor:jest.fn(),TouchSensor:jest.fn(),KeyboardSensor:jest.fn(),closestCorners:jest.fn(),pointerWithin:jest.fn(),
}));
jest.mock('@dnd-kit/sortable',()=>({
 SortableContext:({children}:any)=>children,sortableKeyboardCoordinates:jest.fn(),verticalListSortingStrategy:{},
 useSortable:()=>({attributes:{},listeners:{},setNodeRef:jest.fn(),setActivatorNodeRef:jest.fn(),isDragging:false}),
}));
const columns=[{id:'open',title:'Planlandı',items:[{id:'a'},{id:'b'},{id:'c'}]},{id:'in_progress',title:'Devam ediyor',items:[]}];
it('registers empty columns as drop targets and places the card there',()=>{
 const move=jest.fn();render(<RFKanbanView columns={columns} renderCard={item=><button>Kart {item.id}</button>} onDragEnd={move}/>);
 expect(useDroppable).toHaveBeenCalledWith(expect.objectContaining({id:'in_progress'}));
 mockContext.onDragEnd({active:{id:'a',rect:{current:{}}},over:{id:'in_progress'}});
 expect(move).toHaveBeenCalledWith('a','open','in_progress',0);
});
it('uses the actual hovered position when ordering cards in one column',()=>{
 const move=jest.fn();render(<RFKanbanView columns={columns} renderCard={item=><p>{item.id}</p>} onDragEnd={move}/>);
 mockContext.onDragEnd({active:{id:'a',rect:{current:{}}},over:{id:'c'}});
 expect(move).toHaveBeenCalledWith('a','open','open',2);
});
it('keeps the card open button separate from its mouse/touch/keyboard drag handle',()=>{
 const open=jest.fn();render(<RFKanbanView columns={columns} renderCard={item=><button onClick={open}>Kart {item.id}</button>} onDragEnd={jest.fn()}/>);
 expect(screen.getByRole('button',{name:'Kartı taşı: a'})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Kart a'}));expect(open).toHaveBeenCalledTimes(1);
});
