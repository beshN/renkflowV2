import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AwningConfigurator } from '@/components/features/awning/AwningConfigurator';
import { ProductConfigurator } from '@/components/features/product-3d/ProductConfigurator';
import { DEFAULT_AWNING } from '@/lib/features/awning/configuration';
import { defaultVisualization } from '@/lib/features/product-3d/catalog';
const mockAwning = {setConfiguration:jest.fn(),capture:jest.fn(),dispose:jest.fn(),selectView:jest.fn(),setOpening:jest.fn(),setTime:jest.fn(),toggleAnimation:jest.fn()};
const mockProduct = {...mockAwning,setConfiguration:jest.fn().mockResolvedValue(undefined),dispose:jest.fn()};
jest.mock('@/lib/features/awning/scene',()=>({createAwningScene:()=>mockAwning}));
jest.mock('@/lib/features/product-3d/stage',()=>({createProductStage:async()=>mockProduct}));
beforeEach(()=>{jest.clearAllMocks();});
test('awning changes render live and incoming saved/template values refresh an already mounted scene',async()=>{
 const onChange=jest.fn(), view=render(<AwningConfigurator value={DEFAULT_AWNING} onChange={onChange}/>);
 await waitFor(()=>expect(mockAwning.setConfiguration).toHaveBeenCalled());
 fireEvent.change(screen.getByLabelText('En (mm)'),{target:{value:'7500'}});
 await waitFor(()=>expect(mockAwning.setConfiguration).toHaveBeenLastCalledWith(expect.objectContaining({widthMm:7500})));
 expect(onChange).toHaveBeenCalledWith(expect.objectContaining({widthMm:7500}));
 view.rerender(<AwningConfigurator value={{...DEFAULT_AWNING,widthMm:9000,bodyColor:'#e9e9e4'}} onChange={onChange}/>);
 await waitFor(()=>expect(mockAwning.setConfiguration).toHaveBeenLastCalledWith(expect.objectContaining({widthMm:9000,bodyColor:'#e9e9e4'})));
 expect(screen.getByLabelText('En (mm)')).toHaveValue(9000);
 view.unmount();expect(mockAwning.dispose).toHaveBeenCalledTimes(1);
});
test('unrelated parent render does not reset locally typed dimensions; invalid values do not reach the scene',async()=>{
 const view=render(<AwningConfigurator value={DEFAULT_AWNING} onChange={jest.fn()}/>);
 await waitFor(()=>expect(mockAwning.setConfiguration).toHaveBeenCalled());
 fireEvent.change(screen.getByLabelText('En (mm)'),{target:{value:'7'}});
 view.rerender(<AwningConfigurator value={{...DEFAULT_AWNING}} onChange={jest.fn()}/>);
 expect(screen.getByLabelText('En (mm)')).toHaveValue(7);
 expect(mockAwning.setConfiguration).not.toHaveBeenCalledWith(expect.objectContaining({widthMm:7}));
});
test('generic product scene follows externally restored values in editable and read-only modes',async()=>{
 const c=defaultVisualization('giyotin'),onChange=jest.fn();
 const view=render(<ProductConfigurator kind="giyotin" value={{configuration:c}} onChange={onChange}/>);
 await waitFor(()=>expect(mockProduct.setConfiguration).toHaveBeenCalled());
 view.rerender(<ProductConfigurator kind="giyotin" value={{configuration:{...c,widthMm:3200,bodyColor:'#202427'}}} onChange={onChange}/>);
 await waitFor(()=>expect(mockProduct.setConfiguration).toHaveBeenLastCalledWith(expect.objectContaining({widthMm:3200,bodyColor:'#202427'})));
 view.rerender(<ProductConfigurator readOnly kind="giyotin" value={{configuration:{...c,widthMm:3400}}}/>);
 await waitFor(()=>expect(mockProduct.setConfiguration).toHaveBeenLastCalledWith(expect.objectContaining({widthMm:3400})));
 view.unmount();expect(mockProduct.dispose).toHaveBeenCalledTimes(1);
});
