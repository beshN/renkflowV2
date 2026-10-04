import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {PDFViewerV2} from '@/components/features/pdf-viewer/PDFViewerV2';
import {usePDFStore} from '@/stores/usePDFStore';
jest.mock('@/components/features/pdf-viewer/components/PDFRenderer',()=>({PDFRenderer:()=> <div data-testid="pdf-renderer"/>}));
jest.mock('@/components/features/pdf-viewer/components/PDFToolbar',()=>({PDFToolbar:()=>null}));
jest.mock('@/components/features/pdf-viewer/components/PDFSidebar',()=>({PDFSidebar:()=>null}));
jest.mock('@/components/features/pdf-viewer/components/PDFSearch',()=>({PDFSearch:()=>null}));
jest.mock('@/components/features/pdf-viewer/components/AnnotationTools',()=>({AnnotationTools:()=>null}));
jest.mock('@/components/features/pdf-viewer/LoadingOverlay',()=>({LoadingOverlay:({onClose}:any)=><button onClick={onClose}>Yüklemeyi iptal et</button>}));
jest.mock('@/components/features/pdf-viewer/ErrorOverlay',()=>({ErrorOverlay:()=>null}));
afterEach(()=>usePDFStore.getState().resetDocument());
it('mounts the PDF engine while loading, avoiding the zero-percent deadlock',()=>{
 render(<PDFViewerV2 fileUrl="/api/orders/documents/test/content" fileName="test.pdf"/>);
 expect(usePDFStore.getState().loading).toBe(true);
 expect(screen.getByTestId('pdf-renderer')).toBeInTheDocument();
});
it('allows cancelling a pending load and clears document state on close',()=>{
 const close=jest.fn();const {unmount}=render(<PDFViewerV2 fileUrl="/file.pdf" fileName="file.pdf" onClose={close}/>);
 fireEvent.click(screen.getByText('Yüklemeyi iptal et'));expect(close).toHaveBeenCalledTimes(1);
 unmount();expect(usePDFStore.getState().fileUrl).toBeNull();
});
