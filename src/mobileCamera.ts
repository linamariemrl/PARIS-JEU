import { ArcRotateCamera, Matrix, Scene, Vector3 } from '@babylonjs/core';
import { clamp } from './geo';
import { rotateWithFingers, tiltWithFingers, zoomAroundPinch } from './cameraGestures';

type Pointer = { x: number; y: number };
export class MobileCamera {
  readonly camera: ArcRotateCamera;
  private pointers=new Map<number,Pointer>();
  private center:Pointer|null=null;
  private distance=0;
  private angle=0;
  private tapStart:{x:number;y:number;time:number}|null=null;
  private tapMoved=false;
  private multi=false;
  private street=false;
  private saveView:{radius:number;beta:number}|null=null;
  private animation:{
    fromRadius:number;fromBeta:number;
    toRadius:number;toBeta:number;
    started:number
  }|null=null;
  onTap:(x:number,y:number)=>void=()=>{};

  constructor(private scene:Scene,private canvas:HTMLCanvasElement){
    this.camera=new ArcRotateCamera('camera',-Math.PI/2,.84,1250,Vector3.Zero(),scene);
    this.camera.inputs.clear();
    this.camera.lowerRadiusLimit=30;
    this.camera.upperRadiusLimit=4000;
    this.canvas.style.touchAction='none';
    this.canvas.addEventListener('pointerdown',this.onDown);
    this.canvas.addEventListener('pointermove',this.onMove);
    this.canvas.addEventListener('pointerup',this.onUp);
    this.canvas.addEventListener('pointercancel',this.onCancel);
    this.canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY*.001));
    },{passive:false});
    scene.activeCamera=this.camera;
    scene.onBeforeRenderObservable.add(()=>this.updateTransition());
  }
  zoom(factor:number){
    this.camera.radius=clamp(this.camera.radius*factor,30,4000);
  }
  recenter(){
    this.camera.target.set(0,0,0);
    this.camera.alpha=-Math.PI/2;
    this.camera.beta=.84;
    this.camera.radius=1250;
  }
  north(){this.camera.alpha=-Math.PI/2;}

  /** Vue proche des rues, 2,3 m environ de hauteur.
   * Le contrôle conserve la caméra de carte, ne génère pas de fausses rues
   * et ne revendique pas une véritable marche physique collisionnelle.
   */
  setStreetMode(value:boolean){
    if(value===this.street)return;
    this.street=value;
    if(value){
      this.saveView={radius:this.camera.radius,beta:this.camera.beta};
    }
    const targetRadius=value?64:Math.max(180,this.saveView?.radius??1250);
    const targetBeta=value?Math.acos(2.3/64):(this.saveView?.beta??.84);
    this.animation={
      fromRadius:this.camera.radius,fromBeta:this.camera.beta,
      toRadius:targetRadius,toBeta:targetBeta,started:performance.now()
    };
  }
  get isStreetMode(){return this.street;}
  /** Avancer, reculer, se déplacer latéralement en mètres dans la carte.
   * Vecteurs dérivés de l'orientation effective, sans inversion des axes.
   */
  moveStreet(forward:number,side:number){
    if(!this.street)return;
    const a=this.camera.alpha;
    const fx=-Math.cos(a),fz=-Math.sin(a);
    const rx=fz,rz=-fx;
    this.camera.target.x+=fx*forward+rx*side;
    this.camera.target.z+=fz*forward+rz*side;
  }
  private updateTransition(){
    const animation=this.animation;
    if(!animation)return;
    const t=Math.min(1,(performance.now()-animation.started)/620);
    const eased=t*t*(3-2*t);
    this.camera.radius=animation.fromRadius+
      (animation.toRadius-animation.fromRadius)*eased;
    this.camera.beta=animation.fromBeta+
      (animation.toBeta-animation.fromBeta)*eased;
    if(t>=1)this.animation=null;
  }

  /** Renvoie le point du sol réel sous une position CSS du doigt.
   * Permet de "saisir la carte" et la faire suivre sans signe inversé.
   * Une visée quasi parallèle au sol utilise le repli en mètres/pixel.
   */
  private groundAt(x:number,y:number):Vector3|null {
    const rect=this.canvas.getBoundingClientRect();
    const ray=this.scene.createPickingRay(
      x-rect.left,y-rect.top,Matrix.Identity(),this.camera,false
    );
    if(!Number.isFinite(ray.direction.y)||ray.direction.y>=-0.0001) return null;
    const t=-ray.origin.y/ray.direction.y;
    if(!Number.isFinite(t)||t<=0||t>12000)return null;
    return ray.origin.add(ray.direction.scale(t));
  }
  private grabMap(prev:Pointer,next:Pointer):void {
    const anchor=this.groundAt(prev.x,prev.y);
    const current=this.groundAt(next.x,next.y);
    if(anchor&&current){
      this.camera.target.x+=anchor.x-current.x;
      this.camera.target.z+=anchor.z-current.z;
      return;
    }
    // Repli à l'horizon : même convention qu'une carte à déplacer.
    const dx=next.x-prev.x,dy=next.y-prev.y;
    const factor=Math.max(.04,this.camera.radius/
      Math.max(200,this.canvas.clientHeight||600)*.75);
    const a=this.camera.alpha;
    const rx=-Math.sin(a),rz=Math.cos(a);
    const nx=-Math.cos(a),nz=-Math.sin(a);
    this.camera.target.x+=(-dx*rx+dy*nx)*factor;
    this.camera.target.z+=(-dx*rz+dy*nz)*factor;
  }
  private onDown=(e:PointerEvent)=>{
    if(this.canvas.setPointerCapture)this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.pointers.size===1){
      this.multi=false;this.tapMoved=false;
      this.tapStart={x:e.clientX,y:e.clientY,time:performance.now()};
    }else{
      this.multi=true;this.tapStart=null;this.tapMoved=true;
    }
    this.snapshot();
  };
  private onMove=(e:PointerEvent)=>{
    const previous=this.pointers.get(e.pointerId);
    if(!previous)return;
    const current={x:e.clientX,y:e.clientY};
    this.pointers.set(e.pointerId,current);
    if(this.pointers.size===1){
      if(this.street){
        this.animation=null;
        // En vue proche, un doigt tourne et incline le regard.
        // Le point de visée est rapproché, ce n'est pas une translation écran.
        this.camera.alpha+= (current.x-previous.x)*.004;
        this.camera.beta=clamp(this.camera.beta+
          (current.y-previous.y)*.0024,.80,1.55);
        this.tapMoved=true;
        return;
      }
      if(this.tapStart&&Math.hypot(
        current.x-this.tapStart.x,current.y-this.tapStart.y)>8){
        this.tapMoved=true;
      }
      this.grabMap(previous,current);
      return;
    }
    const [a,b]=[...this.pointers.values()];
    const nextCenter={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const nextDistance=Math.hypot(a.x-b.x,a.y-b.y);
    const nextAngle=Math.atan2(b.y-a.y,b.x-a.x);
    if(this.center&&this.distance){
      // Point de terrain sous le milieu des doigts AVANT la transformation.
      const anchor=this.groundAt(this.center.x,this.center.y);
      const dy=nextCenter.y-this.center.y;
      this.camera.radius=zoomAroundPinch(
        this.camera.radius,this.distance,nextDistance
      );
      this.camera.alpha=rotateWithFingers(this.camera.alpha,this.angle,nextAngle);
      // Deux doigts ensemble vers le haut = incliner vers l'horizon.
      if(Math.abs(nextDistance-this.distance)<12&&
         Math.abs(nextAngle-this.angle)<.09&&Math.abs(dy)>1){
        this.camera.beta=tiltWithFingers(this.camera.beta,dy);
      }
      const after=this.groundAt(nextCenter.x,nextCenter.y);
      if(anchor&&after){
        this.camera.target.x+=anchor.x-after.x;
        this.camera.target.z+=anchor.z-after.z;
      }else{
        this.grabMap(this.center,nextCenter);
      }
    }
    this.center=nextCenter;this.distance=nextDistance;this.angle=nextAngle;
  };
  private onUp=(e:PointerEvent)=>{
    if(this.tapStart&&!this.multi&&!this.tapMoved&&this.pointers.size===1){
      const displacement=Math.hypot(e.clientX-this.tapStart.x,e.clientY-this.tapStart.y);
      if(displacement<10&&performance.now()-this.tapStart.time<500){
        const rect=this.canvas.getBoundingClientRect();
        this.onTap(e.clientX-rect.left,e.clientY-rect.top);
      }
    }
    this.finishPointer(e.pointerId);
  };
  private onCancel=(e:PointerEvent)=>this.finishPointer(e.pointerId);
  private finishPointer(id:number){
    this.pointers.delete(id);
    this.tapStart=null;
    this.tapMoved=true;
    this.snapshot();
  }
  private snapshot(){
    if(this.pointers.size<2){
      this.center=null;this.distance=0;return;
    }
    const [a,b]=[...this.pointers.values()];
    this.center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    this.distance=Math.hypot(a.x-b.x,a.y-b.y);
    this.angle=Math.atan2(b.y-a.y,b.x-a.x);
  }
}
