import {RecipeSchema, calculateRecipe, validateRecipeExamples} from '@/lib/features/manufacturing/recipe-engine';
const id='10000000-0000-4000-8000-000000000001',f='10000000-0000-4000-8000-000000000002';
const params={widthMm:3000,projectionMm:2000,mountingHeightMm:3000,quantity:2,motor:true,led:false,customParameters:{armCount:3}};
const recipe=RecipeSchema.parse({code:'EXT',name:'Custom product',version:1,finishedItemId:f,parameterDefinitions:[{key:'armCount',label:'Makas',type:'number',minimum:1,maximum:8,integer:true}],constraints:[{formula:'if(led,motor,1)',message:'Motor gerekli'}],rules:[{itemId:id,kind:'material',uom:'adet',quantityFormula:'armCount*2',conditionFormula:'motor'}],operations:[{name:'Montaj',workCenterCode:'ASSEMBLY',minutesFormula:'armCount*quantity',setupMinutesFormula:'5'},{name:'LED',workCenterCode:'LED',minutesFormula:'10',conditionFormula:'led'}],limits:{minWidthMm:1,maxWidthMm:10000,minProjectionMm:1,maxProjectionMm:5000,minMountingHeightMm:1,maxMountingHeightMm:5000},examples:[]});
it('evaluates custom parameters, option dependencies and setup separately, with contiguous routing',()=>{
 const result=calculateRecipe(recipe,params);expect(result.materials[0].quantity).toBe(12);expect(result.operations).toHaveLength(1);expect(result.operations[0]).toMatchObject({position:0,plannedMinutes:6,setupMinutes:5});expect(result.parameters.customParameters).toEqual({armCount:3});expect(()=>calculateRecipe(recipe,{...params,led:true,motor:false})).toThrow('Motor gerekli');
});
it('rejects undefined, out-of-range, wrong-type and shadowing parameters',()=>{
 for(const customParameters of ([{},{armCount:9},{armCount:1.5},{armCount:true},{armCount:2,unknown:1}] as Record<string,number|boolean>[]))expect(()=>calculateRecipe(recipe,{...params,customParameters})).toThrow();
 expect(()=>RecipeSchema.parse({...recipe,parameterDefinitions:[{key:'widthMm',label:'Invalid',type:'number'}]})).toThrow();
});
it('uses validated defaults and requires distinct complete examples before publication',()=>{
 const withDefault={...recipe,parameterDefinitions:[{...recipe.parameterDefinitions![0],defaultValue:3}]};expect(calculateRecipe(withDefault,{...params,customParameters:{}}).materials[0].quantity).toBe(12);
 const examples=[{parameters:params,expected:[{itemId:id,quantity:12}]},{parameters:{...params,customParameters:{armCount:2}},expected:[{itemId:id,quantity:8}]}];expect(validateRecipeExamples({...recipe,examples})).toBe(true);
 expect(()=>validateRecipeExamples({...recipe,examples:[examples[0],{...examples[1],expected:[]}]})).toThrow();
});
