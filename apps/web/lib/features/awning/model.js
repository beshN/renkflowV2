// Adapted from the user-provided WINMAX configurator. Three.js: MIT.
import * as T from 'three';
export function dimensions(state){
 const w=state.width/100,d=state.depth/100,h=state.height/100,n=Math.max(5,Math.round(d/.48));
 const span=.082+(d/n-.082)*state.opening/100,link=Math.hypot(d/n,.3),drop=Math.sqrt(link*link-span*span);
 return {w,d,h,n,span,drop,reach:span*n,link};
}
const vY=new T.Vector3(0,1,0);
export function createAwning(state){
 const boxGeometry=new T.BoxGeometry(1,1,1),pinGeometry=new T.CylinderGeometry(.025,.025,.028,12);
 const g=new T.Group(),materials=[],dynamic=[],rails=[],lights=[],cables=[],carriages=[],ownedGeometries=[];
 const {w,d,h,n}=dimensions(state);
 const mat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.55,...extra});materials.push(m);return m};
 const metal=new T.MeshPhysicalMaterial({color:state.body,metalness:.35,roughness:.3,clearcoat:.25,clearcoatRoughness:.45});materials.push(metal);const steel=mat('#c8c9c7',{metalness:.8,roughness:.23}),rubber=mat('#242727'),fabric=mat(state.fabric,{roughness:.92,side:T.DoubleSide,transparent:false,opacity:1,depthWrite:true});
 const weaveData=new Uint8Array(32*32*4);for(let yy=0;yy<32;yy++)for(let xx=0;xx<32;xx++){const value=((xx%4<2)===(yy%4<2))?205:245,idx=(yy*32+xx)*4;weaveData.set([value,value,value,255],idx)}const weave=new T.DataTexture(weaveData,32,32,T.RGBAFormat);weave.wrapS=weave.wrapT=T.RepeatWrapping;weave.repeat.set(w*32,d*32);weave.needsUpdate=true;for(const m of [fabric]){m.bumpMap=weave;m.bumpScale=.00065}
 const lit=state.light!=='off'&&state.brightness>0,ledColor=state.light==='warm'?'#ffd9a0':'#e2f1ff';
 const led=mat(lit?ledColor:'#d0d1c9',{emissive:ledColor,emissiveIntensity:lit?state.brightness/100*3:0});
 function box(s,x,y,z,m=metal){const o=new T.Mesh(boxGeometry,m);o.scale.set(...s);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o}
 function pin(x,y,z){const o=new T.Group();o.position.set(x,y,z);const washer=new T.Mesh(pinGeometry,steel);washer.rotation.z=Math.PI/2;washer.scale.set(.72,1,.72);o.add(washer);const head=new T.Mesh(hexGeo,steel);head.rotation.z=Math.PI/2;head.position.x=-.018;o.add(head);g.add(o);return o}
 const hexGeo=new T.CylinderGeometry(.012,.012,.014,6);ownedGeometries.push(hexGeo);
 // Extruded flat links with rounded end caps, in separate crossing planes.
 const armShape=new T.Shape(),r=.028;
 armShape.moveTo(-r,-.5+r);armShape.lineTo(-r,.5-r);armShape.absarc(0,.5-r,r,Math.PI,0,true);armShape.lineTo(r,-.5+r);armShape.absarc(0,-.5+r,r,0,-Math.PI,true);
 const armGeo=new T.ExtrudeGeometry(armShape,{depth:.008,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.0015,bevelThickness:.0015,curveSegments:8});armGeo.rotateY(Math.PI/2);armGeo.translate(-.004,0,0);ownedGeometries.push(armGeo);
 function rod(){const o=new T.Mesh(armGeo,metal);o.castShadow=true;o.receiveShadow=true;g.add(o);return o}
 function poseRod(mesh,a,b){const av=new T.Vector3(...a),bv=new T.Vector3(...b);mesh.position.copy(av).add(bv).multiplyScalar(.5);mesh.scale.y=av.distanceTo(bv);mesh.quaternion.setFromUnitVectors(vY,bv.sub(av).normalize())}
 const top=z=>h-.085*z;
 box([w+.18,.16,.17],0,h-.05,.005);box([w+.25,.045,n*.082+.18],0,h+.17,n*.082/2+.045);
 const roller=new T.Mesh(new T.CylinderGeometry(.085,.085,w+.03,32),fabric);roller.rotation.z=Math.PI/2;roller.position.set(0,h+.035,.15);roller.castShadow=true;g.add(roller);
 // Side discs reveal winding rotation without attaching the fabric to the support rails.
 const winding=new T.Group();winding.position.copy(roller.position);g.add(winding);for(const x of [-w/2-.02,w/2+.02]){const disc=new T.Mesh(new T.CylinderGeometry(.096,.096,.028,24),steel);disc.rotation.z=Math.PI/2;disc.position.x=x;winding.add(disc);const mark=new T.Mesh(boxGeometry,rubber);mark.scale.set(.032,.02,.07);mark.position.set(x,.045,.025);winding.add(mark)}
 // One arm per started 4 m: 2 up to 8 m, 3 up to 12 m, 4 beyond.
 const armCount=w<=8?2:w<=12?3:4,rows=Array.from({length:armCount},(_,k)=>-w/2+w*k/(armCount-1));
 for(const x of rows){
  box([.15,1.0,.035],x,h-.42,-.035);
  for(const side of [-1,1])box([.026,1.0,.14],x+side*.07,h-.42,.035);
  box([.18,.085,.2],x,h-.88,.025);box([.18,.075,.2],x,h+.03,.025);
  for(const y of [h-.8,h-.08]){const bolt=pin(x-.091,y,.04);bolt.rotation.y=Math.PI/2}
  const carriage=new T.Group();g.add(carriage);const plate=new T.Mesh(boxGeometry,steel);plate.scale.set(.102,.105,.11);carriage.add(plate);
  for(const side of [-1,1]){const wheel=new T.Mesh(pinGeometry,rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(side*.059,0,.007);carriage.add(wheel)}carriages.push({x,mesh:carriage});
  const upper=box([.075,.09,.19],x,h-.013,.072);pin(x-.025,h-.012,.15);
  for(let i=0;i<n;i++){
   // Terminal short link connects the preceding upper pivot to the long arm midpoint.
   const down=rod(),up=rod();const pins=[pin(x-.027,0,0),pin(x-.027,0,0)];pins.push(pin(x-.027,0,0));dynamic.push({x,i,down,up,pins});
 }}
 // Grooved transverse aluminium profiles, black end caps, short LED modules.
 const cableMaterial=mat('#aaa99f',{roughness:.75}),housing=mat('#deded7',{roughness:.42});
 const lampGeo=new T.CapsuleGeometry(.016,.235,4,10);lampGeo.rotateZ(Math.PI/2);ownedGeometries.push(lampGeo);
 for(let i=0;i<=n;i++){
  const rail=box([w,.065,.074],0,0,0);rails.push({i,mesh:rail});
  for(const side of [-1,1]){const groove=box([w,.006,.008],0,0,0,metal);rails.push({i,mesh:groove,offset:-.025,zOffset:side*.032});const cap=box([.02,.059,.068],side*(w/2+.008),0,0,rubber);rails.push({i,mesh:cap,x:side*(w/2+.008)})}
  if(i>0&&i<n&&state.light!=='off'){
   const count=Math.max(2,Math.round(w/1.4));
   for(let j=0;j<count;j++){const x=-w/2+w*(j+.5)/count;const holder=box([.295,.026,.057],x,0,0,housing);rails.push({i,mesh:holder,x,offset:-.043});const lamp=new T.Mesh(lampGeo,led);g.add(lamp);rails.push({i,mesh:lamp,x,offset:-.058});}
   // Limit real light sources; visible modules remain present on every profile.
   if(i%Math.max(2,Math.floor(n/3))===0)for(const x of [-w*.27,w*.27]){const light=new T.SpotLight(ledColor,lit?state.brightness/100*26:0,8,Math.PI*.42,.8,1.5);g.add(light,light.target);lights.push({i,light,x})}
  }
 }
 // Separate power wire spans. Their fixed length becomes a deeper loop as rails approach.
 if(state.light!=='off')for(let i=0;i<n-1;i++){
  const steps=24,sides=6,geo=new T.BufferGeometry(),positions=new Float32Array((steps+1)*sides*3),indices=[];
  for(let j=0;j<steps;j++)for(let k=0;k<sides;k++){const a=j*sides+k,b=j*sides+(k+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides)}
  geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setIndex(indices);const mesh=new T.Mesh(geo,cableMaterial);g.add(mesh);cables.push({i,mesh,steps,sides});
  for(const x of [-w/2+.085]){const connector=box([.025,.025,.027],x,0,0,rubber);rails.push({i,mesh:connector,x,offset:-.031})}
 }
 // Three-piece U-shaped front gutter, connected only to the rising terminal link.
 const gutter=new T.Group();g.add(gutter);for(const [size,y,z] of [[[w+.13,.035,.17],-.04,0],[[w+.13,.22,.03],-.025,.073],[[w+.13,.07,.025],-.005,-.072]]){const mesh=new T.Mesh(boxGeometry,metal);mesh.scale.set(...size);mesh.position.set(0,y,z);mesh.castShadow=true;mesh.receiveShadow=true;gutter.add(mesh)}
 for(const x of [-w/2-.045,w/2+.045]){const cap=new T.Mesh(boxGeometry,metal);cap.scale.set(.025,.22,.17);cap.position.set(x,.015,0);gutter.add(cap)}
 // Independent taut textile, resting above rails and winding continuously onto the rear roll.
 const cloths=[],across=1;
 for(let k=0;k<across;k++){const geo=new T.PlaneGeometry(w/across,1,1,32);const mesh=new T.Mesh(geo,fabric);mesh.castShadow=true;mesh.receiveShadow=false;g.add(mesh);cloths.push({mesh,k})}
 function update(s){const {span,drop,reach}=dimensions(s);for(const {x,i,down,up,pins} of dynamic){const z0=.15+i*span,z1=z0+span,y0=top(z0),y1=top(z1);
  poseRod(down,[x,y0,z0],i===n-1?[x,(y0+y1-drop)/2,(z0+z1-.085*drop)/2]:[x,y1-drop,z1-.085*drop]);poseRod(up,[x+.022,y0-drop,z0-.085*drop],[x+.022,y1,z1]);pins[0].position.set(x-.025,y0-drop,z0-.085*drop);pins[1].position.set(x-.025,y1,z1);if(pins[2])pins[2].position.set(x-.025,(y0+y1-drop)/2,(z0+z1)/2-.085*drop/2);
 }
 for(const {i,mesh,offset=0,x=0,zOffset=0} of rails){const z=.15+i*span;mesh.position.set(x,top(z)+.003+offset,z+zOffset)}
 for(const {x,mesh} of carriages)mesh.position.set(x,top(.15)-drop,.15-.085*drop);
 for(const {i,mesh,steps,sides} of cables){const z0=.15+i*span,z1=z0+span,y0=top(z0)-.04,y1=top(z1)-.04;
  // Solve a constant-length parabolic cable arc instead of stretching the wire.
  const cableLength=d/n+.07,arcLength=sag=>{let len=0,py=y0,pz=z0;for(let j=1;j<=32;j++){const u=j/32,y=y0+(y1-y0)*u-4*sag*u*(1-u),z=z0+span*u;len+=Math.hypot(y-py,z-pz);py=y;pz=z}return len};let lo=0,hi=cableLength/2;for(let j=0;j<12;j++){const mid=(lo+hi)/2;if(arcLength(mid)>cableLength)hi=mid;else lo=mid}const sag=(lo+hi)/2,pos=mesh.geometry.attributes.position;
  for(let j=0;j<=steps;j++){const u=j/steps,cy=y0+(y1-y0)*u-4*sag*u*(1-u),cz=z0+span*u,dy=y1-y0-4*sag*(1-2*u),norm=Math.hypot(dy,span);for(let k=0;k<sides;k++){const a=k/sides*Math.PI*2,rr=.0017;pos.setXYZ(j*sides+k,-w/2+.085+Math.cos(a)*rr,cy+Math.sin(a)*rr*span/norm,cz-Math.sin(a)*rr*dy/norm)}}pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
 }
 gutter.position.set(0,top(.15+reach)+.008,.15+reach);
 for(const {i,light,x} of lights){const z=.15+i*span;light.position.set(x,top(z)-.075,z);light.target.position.set(x,0,z+.2)}
 const radius=Math.sqrt(.065**2+Math.max(0,d-reach)*.0015/Math.PI);roller.scale.set(radius/.085,1,radius/.085);roller.position.y=top(.15)+.066-radius;winding.position.y=roller.position.y;winding.rotation.x=(d-reach)/radius;
 for(const {mesh,k} of cloths){const pos=mesh.geometry.attributes.position;for(let j=0;j<pos.count;j++){const row=Math.floor(j/2),u=row/32,z=.15+u*reach,x=-w/2+(k+(j%2))/across*w;pos.setXYZ(j,x,top(z)+.066,z)}pos.needsUpdate=true;const uv=mesh.geometry.attributes.uv;for(let j=0;j<uv.count;j++)uv.setY(j,Math.floor(j/2)/32*reach/d);uv.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere()}
 g.userData={reach,span,drop,terminalLinks:rows.length,terminalShortLinks:rows.length,clothClearance:.0305,cableSpans:cables.length,sliderPositions:carriages.map(c=>c.mesh.position.y),clothAttachment:'front-gutter',clothMode:'rear-roll'};
 }
 update(state);return {group:g,update,setAppearance(next){metal.color.set(next.body);fabric.color.set(next.fabric);const color=next.light==='warm'?'#ffd9a0':'#e2f1ff',lit=next.light!=='off';led.color.set(lit?color:'#d0d1c9');led.emissive.set(color);led.emissiveIntensity=lit?next.brightness/100*3:0;for(const {light} of lights){light.color.set(color);light.intensity=lit?next.brightness/100*26:0}},dispose(){g.traverse(o=>{if(o.geometry)o.geometry.dispose()});ownedGeometries.forEach(g=>g.dispose());weave.dispose();materials.forEach(m=>m.dispose())}};
}
