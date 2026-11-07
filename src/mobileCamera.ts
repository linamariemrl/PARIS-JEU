import { ArcRotateCamera, Matrix, Scene, Vector3 } from '@babylonjs/core';
import { clamp } from './geo';
import {
  rotateWithFingers, tiltWithFingers, zoomAroundPinch,
  gestureRatio, gestureApply, wrapTwist
} from './cameraGestures';

type Point={x:number;y:number};
interface Transition{
  begin:number;
  fromRadius:number;toRadius:number;
  fromBeta:number;toBeta:number;
  fromEye:number;toEye:number;
  fromX:number;toX:number;
  fromZ:number;toZ:number;
  fromAlpha:number;toAlpha:number;
}
const WORLD_LIMIT=1e7;
const MAX_SPEED=650;
const expSmoothing=(speed:number,dt:number)=>1-Math.exp(-speed*dt);

/** Contrôleur original Babylon.js, Android.
 * Une touche pour déplacer la carte ou tourner en mode 360°, deux pour
 * zoomer/tourner/incliner. Gestes non inversés, inertie amortie et mode Rue.
 */
export class MobileCamera{
  readonly camera:ArcRotateCamera;
  private pointers=new Map<number,Point>();
  private center:Point|null=null;
  private distance=0;
  private angle=0;
  private tapStart:{x:number;y:number;time:number}|null=null;
  private tapMoved=false;
  private multi=false;
  private street=false;
  private orbit=false;
  private precision=false;
  private previousView:{radius:number;beta:number;eye:number}|null=null;
  private transition:Transition|null=null;
  private panX=0;
  private panZ=0;
  private yawVelocity=0;
  private pitchVelocity=0;
  private wheelRadius:number|null=null;
  private lastPointerTime=performance.now();
  onTap:(x:number,y:number)=>void=()=>{};

  constructor(private scene:Scene,private canvas:HTMLCanvasElement){
    this.camera=new ArcRotateCamera('camera',-Math.PI/2,.85,1100,Vector3.Zero(),scene);
    this.camera.inputs.clear();
    this.camera.lowerRadiusLimit=12;
    this.camera.upperRadiusLimit=4500;
    this.camera.lowerBetaLimit=.10;
    this.camera.upperBetaLimit=2.78;
    this.camera.minZ=.10;
    canvas.style.touchAction='none';
    canvas.addEventListener('pointerdown',this.onDown,{passive:false});
    canvas.addEventListener('pointermove',this.onMove,{passive:false});
    canvas.addEventListener('pointerup',this.onUp);
    canvas.addEventListener('pointercancel',this.onCancel);
    canvas.addEventListener('lostpointercapture',this.onLostPointer);
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY*.001));
    },{passive:false});
    scene.activeCamera=this.camera;
  }
  get isStreetMode(){return this.street;}
  get isOrbitMode(){return this.orbit;}
  get isPrecisionMode(){return this.precision;}
  setPrecisionMode(v:boolean){this.precision=v;}
  setOrbitMode(v:boolean){
    this.orbit=v&&!this.street;
    this.stopInertia();
  }
  zoom(factor:number){
    if(!Number.isFinite(factor)||factor<=0)return;
    const adjusted=gestureApply(1,factor,this.precision);
    const radius=this.wheelRadius??this.camera.radius;
    this.wheelRadius=clamp(radius*adjusted,12,4500);
  }
  north(){
    this.stopInertia();
    this.animateTo(this.camera.radius,this.camera.beta,
      this.street?2.5:this.eye(),this.camera.target.x,
      this.camera.target.z,-Math.PI/2,480);
  }
  recenter(){
    this.stopInertia();
    if(this.street)this.setStreetMode(false);
    this.orbit=false;
    this.animateTo(1100,.85,1100*Math.cos(.85),0,0,-Math.PI/2,700);
  }
  setStreetMode(value:boolean){
    if(value===this.street)return;
    this.stopInertia();
    this.orbit=false;
    if(value){
      this.previousView={
        radius:this.camera.radius,beta:this.camera.beta,eye:this.eye()
      };
    }
    this.street=value;
    const targetRadius=value?58:Math.max(100,this.previousView?.radius??1100);
    const beta=value?Math.PI/2:(this.previousView?.beta??.85);
    const eye=value?2.5:(this.previousView?.eye??targetRadius*Math.cos(beta));
    this.animateTo(targetRadius,beta,eye,
      this.camera.target.x,this.camera.target.z,this.camera.alpha,690);
  }
  moveStreet(forward:number,side:number){
    if(!this.street)return;
    const a=this.camera.alpha;
    const fx=-Math.cos(a),fz=-Math.sin(a);
    const rx=-fz,rz=fx;
    this.camera.target.x+=fx*forward+rx*side;
    this.camera.target.z+=fz*forward+rz*side;
    this.camera.target.x=clamp(this.camera.target.x,-WORLD_LIMIT,WORLD_LIMIT);
    this.camera.target.z=clamp(this.camera.target.z,-WORLD_LIMIT,WORLD_LIMIT);
  }
  /** Animation indépendante du nombre d'images par seconde. */
  step(dt:number){
    const elapsed=clamp(dt,0,.06);
    if(this.transition){
      const t=clamp((performance.now()-this.transition.begin)/
        (this.transitionEnd-this.transition.begin),0,1);
      const eased=t*t*(3-2*t);
      const tr=this.transition;
      this.camera.radius=tr.fromRadius+(tr.toRadius-tr.fromRadius)*eased;
      this.camera.beta=tr.fromBeta+(tr.toBeta-tr.fromBeta)*eased;
      this.camera.alpha=tr.fromAlpha+(tr.toAlpha-tr.fromAlpha)*eased;
      this.camera.target.x=tr.fromX+(tr.toX-tr.fromX)*eased;
      this.camera.target.z=tr.fromZ+(tr.toZ-tr.fromZ)*eased;
      const eye=tr.fromEye+(tr.toEye-tr.fromEye)*eased;
      this.camera.target.y=eye-this.camera.radius*Math.cos(this.camera.beta);
      if(t>=1)this.transition=null;
    }
    if(!this.pointers.size&&!this.transition){
      this.camera.target.x+=this.panX*elapsed;
      this.camera.target.z+=this.panZ*elapsed;
      this.camera.alpha+=this.yawVelocity*elapsed;
      if(Math.abs(this.pitchVelocity)>.001){
        this.camera.beta=clamp(this.camera.beta+this.pitchVelocity*elapsed,
          this.street?.20:.12,this.street?2.68:1.49);
      }
      const damping=Math.exp(-7.8*elapsed);
      this.panX*=damping;
      this.panZ*=damping;
      this.yawVelocity*=damping;
      this.pitchVelocity*=damping;
      if(this.wheelRadius!==null){
        this.camera.radius+=(this.wheelRadius-this.camera.radius)*
          expSmoothing(12,elapsed);
        if(Math.abs(this.wheelRadius-this.camera.radius)<.07)
          this.wheelRadius=null;
      }
    }
    if(this.street&&!this.transition)this.lockStreetEye();
  }
  private transitionEnd=0;
  private eye(){return this.camera.target.y+this.camera.radius*Math.cos(this.camera.beta);}
  private animateTo(radius:number,beta:number,eye:number,x:number,z:number,alpha:number,ms:number){
    const begin=performance.now();
    const nearest=this.camera.alpha+wrapTwist(alpha-this.camera.alpha);
    this.transition={
      begin,fromRadius:this.camera.radius,toRadius:radius,
      fromBeta:this.camera.beta,toBeta:beta,
      fromEye:this.eye(),toEye:eye,
      fromX:this.camera.target.x,toX:x,
      fromZ:this.camera.target.z,toZ:z,
      fromAlpha:this.camera.alpha,toAlpha:nearest
    };
    this.transitionEnd=begin+ms;
    this.wheelRadius=null;
  }
  private lockStreetEye(){
    // Le regard peut monter vers le ciel, sans faire passer la caméra sous terre.
    this.camera.target.y=2.5-this.camera.radius*Math.cos(this.camera.beta);
  }
  private stopInertia(){
    this.panX=0;this.panZ=0;
    this.yawVelocity=0;this.pitchVelocity=0;
    this.wheelRadius=null;
  }
  private groundAt(point:Point):Vector3|null{
    const rect=this.canvas.getBoundingClientRect();
    const ray=this.scene.createPickingRay(
      point.x-rect.left,point.y-rect.top,Matrix.Identity(),this.camera,false);
    if(ray.direction.y>=-.0005)return null;
    const t=-ray.origin.y/ray.direction.y;
    if(t<=0||t>16000||!Number.isFinite(t))return null;
    return ray.origin.add(ray.direction.scale(t));
  }
  private panMap(from:Point,to:Point):Point{
    const anchor=this.groundAt(from);
    const next=this.groundAt(to);
    let dx=0,dz=0;
    if(anchor&&next){
      dx=anchor.x-next.x;
      dz=anchor.z-next.z;
    }else{
      const screen=this.canvas.getBoundingClientRect();
      const scale=this.camera.radius/Math.max(250,screen.height)*.92;
      const diffX=to.x-from.x,diffY=to.y-from.y;
      const yaw=this.camera.alpha;
      dx=(-diffX*-Math.sin(yaw)+diffY*-Math.cos(yaw))*scale;
      dz=(-diffX*Math.cos(yaw)+diffY*-Math.sin(yaw))*scale;
    }
    dx=clamp(dx,-110,110);dz=clamp(dz,-110,110);
    this.camera.target.x=clamp(this.camera.target.x+dx,-WORLD_LIMIT,WORLD_LIMIT);
    this.camera.target.z=clamp(this.camera.target.z+dz,-WORLD_LIMIT,WORLD_LIMIT);
    return {x:dx,y:dz};
  }
  private onDown=(event:PointerEvent)=>{
    event.preventDefault();
    this.transition=null;
    this.stopInertia();
    try{this.canvas.setPointerCapture(event.pointerId);}catch{}
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(this.pointers.size===1){
      this.multi=false;
      this.tapMoved=false;
      this.tapStart={
        x:event.clientX,y:event.clientY,time:performance.now()
      };
    }else{
      this.multi=true;this.tapMoved=true;this.tapStart=null;
    }
    this.lastPointerTime=performance.now();
    this.snapshot();
  };
  private onMove=(event:PointerEvent)=>{
    const prev=this.pointers.get(event.pointerId);
    if(!prev)return;
    event.preventDefault();
    const current={x:event.clientX,y:event.clientY};
    this.pointers.set(event.pointerId,current);
    const now=performance.now();
    const dt=clamp((now-this.lastPointerTime)/1000,.012,.06);
    this.lastPointerTime=now;
    const fine=gestureRatio(this.precision);
    if(this.pointers.size===1){
      if(this.tapStart&&Math.hypot(
        current.x-this.tapStart.x,current.y-this.tapStart.y)>7)this.tapMoved=true;
      if(this.street||this.orbit){
        const yaw=(current.x-prev.x)*.0040*fine;
        // Faire glisser vers le haut oriente le regard vers le haut.
        const pitch=-(current.y-prev.y)*.0032*fine;
        this.camera.alpha+=yaw;
        this.camera.beta=clamp(this.camera.beta+pitch,
          this.street?.20:.12,this.street?2.68:1.49);
        if(this.street)this.lockStreetEye();
        this.yawVelocity=clamp(yaw/dt,-3.3,3.3);
        this.pitchVelocity=clamp(pitch/dt,-1.6,1.6);
      }else{
        const mapped={x:gestureApply(prev.x,current.x,this.precision),
          y:gestureApply(prev.y,current.y,this.precision)};
        const delta=this.panMap(prev,mapped);
        this.panX=clamp(delta.x/dt,-MAX_SPEED,MAX_SPEED);
        this.panZ=clamp(delta.y/dt,-MAX_SPEED,MAX_SPEED);
      }
      return;
    }
    if(this.pointers.size!==2)return;
    const [a,b]=[...this.pointers.values()];
    const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const distance=Math.hypot(a.x-b.x,a.y-b.y);
    const angle=Math.atan2(b.y-a.y,b.x-a.x);
    if(this.center&&this.distance>0){
      const anchor=this.street?null:this.groundAt(this.center);
      const delta=wrapTwist(angle-this.angle)*fine;
      this.camera.alpha=rotateWithFingers(this.camera.alpha,0,delta);
      this.camera.radius=zoomAroundPinch(this.camera.radius,this.distance,
        gestureApply(this.distance,distance,this.precision));
      this.wheelRadius=null;
      const down=(center.y-this.center.y)*fine;
      if(Math.abs(distance-this.distance)<15&&Math.abs(delta)<.10){
        this.camera.beta=clamp(tiltWithFingers(this.camera.beta,down),
          this.street?.20:.12,this.street?2.68:1.49);
      }
      const shifted={
        x:gestureApply(this.center.x,center.x,this.precision),
        y:gestureApply(this.center.y,center.y,this.precision)
      };
      const newGround=this.street?null:this.groundAt(shifted);
      if(anchor&&newGround){
        const x=clamp(anchor.x-newGround.x,-90,90);
        const z=clamp(anchor.z-newGround.z,-90,90);
        this.camera.target.x+=x;
        this.camera.target.z+=z;
      }
      if(this.street)this.lockStreetEye();
      this.yawVelocity=clamp(delta/dt,-2,2);
    }
    this.center=center;this.distance=distance;this.angle=angle;
  };
  private onUp=(event:PointerEvent)=>{
    const start=this.tapStart;
    if(start&&!this.multi&&!this.tapMoved&&this.pointers.size===1){
      if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<10&&
         performance.now()-start.time<500){
        const rect=this.canvas.getBoundingClientRect();
        this.onTap(event.clientX-rect.left,event.clientY-rect.top);
      }
    }
    this.finish(event.pointerId);
  };
  private onCancel=(event:PointerEvent)=>this.finish(event.pointerId);
  private onLostPointer=(event:PointerEvent)=>{
    if(this.pointers.has(event.pointerId))this.finish(event.pointerId);
  };
  private finish(id:number){
    this.pointers.delete(id);
    this.tapStart=null;
    this.tapMoved=true;
    if(this.pointers.size===1){
      // Ne pas continuer la rotation quand le deuxième doigt est retiré.
      this.stopInertia();
      this.multi=true;
    }
    this.snapshot();
  }
  private snapshot(){
    if(this.pointers.size!==2){
      this.center=null;this.distance=0;return;
    }
    const [a,b]=[...this.pointers.values()];
    this.center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    this.distance=Math.hypot(a.x-b.x,a.y-b.y);
    this.angle=Math.atan2(b.y-a.y,b.x-a.x);
  }
}
