/** Astronomie approchée, formules de position Soleil/Lune (usage visuel).
 * Le temps est un instant UTC; la latitude/longitude sont celles de Paris.
 * Précision suffisante pour le cycle visuel, pas pour la navigation.
 */
const RAD=Math.PI/180;
const EARTH_TILT=RAD*23.4397;
const J2000=2451545;
const J1970=2440588;
const DAY=86400000;
const SUN_DISTANCE=149598000;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const rightAscension=(l:number,b:number)=>
  Math.atan2(Math.sin(l)*Math.cos(EARTH_TILT)-Math.tan(b)*Math.sin(EARTH_TILT),Math.cos(l));
const declination=(l:number,b:number)=>
  Math.asin(Math.sin(b)*Math.cos(EARTH_TILT)+Math.cos(b)*Math.sin(EARTH_TILT)*Math.sin(l));
const days=(ms:number)=>ms/DAY-0.5+J1970-J2000;
const sidereal=(d:number,lw:number)=>RAD*(280.16+360.9856235*d)-lw;
function sunCoords(d:number){
  const m=RAD*(357.5291+0.98560028*d);
  const l=m+RAD*(1.9148*Math.sin(m)+0.02*Math.sin(2*m)+0.0003*Math.sin(3*m))
       +RAD*102.9372+Math.PI;
  return {ra:rightAscension(l,0),dec:declination(l,0)};
}
function moonCoords(d:number){
  const L=RAD*(218.316+13.176396*d);
  const M=RAD*(134.963+13.064993*d);
  const F=RAD*(93.272+13.229350*d);
  const longitude=L+RAD*6.289*Math.sin(M);
  const latitude=RAD*5.128*Math.sin(F);
  return {ra:rightAscension(longitude,latitude),
          dec:declination(longitude,latitude),
          dist:385001-20905*Math.cos(M)};
}
export interface BodyPosition{
  altitude:number; // radians above horizon
  azimuth:number; // radians measured from geographic South toward West
  east:number;
  north:number;
  up:number;
}
function position(d:number,lat:number,lon:number,coords:{ra:number;dec:number}):BodyPosition{
  const phi=lat*RAD;
  const hour=sidereal(d,-lon*RAD)-coords.ra;
  const altitude=Math.asin(Math.sin(phi)*Math.sin(coords.dec)+
                          Math.cos(phi)*Math.cos(coords.dec)*Math.cos(hour));
  const azimuth=Math.atan2(Math.sin(hour),
                          Math.cos(hour)*Math.sin(phi)-Math.tan(coords.dec)*Math.cos(phi));
  return {altitude,azimuth,
          east:-Math.sin(azimuth)*Math.cos(altitude),
          north:-Math.cos(azimuth)*Math.cos(altitude),
          up:Math.sin(altitude)};
}
export function solarPosition(epochMs:number,lat=48.8566,lon=2.3522):BodyPosition{
  const d=days(epochMs);
  return position(d,lat,lon,sunCoords(d));
}
export interface MoonPosition extends BodyPosition{fraction:number;phase:number;}
export function lunarPosition(epochMs:number,lat=48.8566,lon=2.3522):MoonPosition{
  const d=days(epochMs);
  const sun=sunCoords(d),moon=moonCoords(d);
  const separation=Math.acos(clamp(Math.sin(sun.dec)*Math.sin(moon.dec)+
          Math.cos(sun.dec)*Math.cos(moon.dec)*Math.cos(sun.ra-moon.ra),-1,1));
  const incidence=Math.atan2(SUN_DISTANCE*Math.sin(separation),
                             moon.dist-SUN_DISTANCE*Math.cos(separation));
  const angle=Math.atan2(Math.cos(sun.dec)*Math.sin(sun.ra-moon.ra),
                        Math.sin(sun.dec)*Math.cos(moon.dec)-
                        Math.cos(sun.dec)*Math.sin(moon.dec)*Math.cos(sun.ra-moon.ra));
  return {...position(d,lat,lon,moon),
          fraction:(1+Math.cos(incidence))/2,
          phase:(0.5+0.5*incidence*(angle<0?-1:1)/Math.PI)%1};
}
export function daylightFactor(sunAltitudeRad:number):number {
  const deg=sunAltitudeRad/RAD;
  return clamp((deg+6)/13,0,1);
}
export function lampFactor(sunAltitudeRad:number):number {
  const deg=sunAltitudeRad/RAD;
  // Allumage à la baisse de luminosité, pas à une heure fixe.
  return clamp((-deg-1.5)/6.5,0,1);
}
