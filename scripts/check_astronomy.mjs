import assert from 'node:assert/strict';
import { solarPosition, lunarPosition, daylightFactor, lampFactor } from '../src/astronomy.ts';
import { GameClock } from '../src/gameClock.ts';

const radToDeg = 180 / Math.PI;
const summerNoon = solarPosition(Date.parse('2026-06-21T12:00:00+02:00'));
const summerNight = solarPosition(Date.parse('2026-06-21T00:00:00+02:00'));
const winterNoon = solarPosition(Date.parse('2026-12-21T12:00:00+01:00'));
const summerAltitude = summerNoon.altitude * radToDeg;
const nightAltitude = summerNight.altitude * radToDeg;
const winterAltitude = winterNoon.altitude * radToDeg;
assert.ok(summerAltitude > 56 && summerAltitude < 68,
  'Solstice ete, altitude solaire de Paris a midi incoherente : ' + summerAltitude);
assert.ok(nightAltitude < -12,
  'Solstice ete, nuit parisienne non detectee : ' + nightAltitude);
assert.ok(winterAltitude > 12 && winterAltitude < 25,
  'Solstice hiver, altitude solaire de Paris a midi incoherente : ' + winterAltitude);
assert.ok(summerNoon.north < 0, 'A Paris le Soleil de midi est au sud');
assert.equal(daylightFactor(20*Math.PI/180),1);
assert.equal(daylightFactor(-20*Math.PI/180),0);
assert.equal(lampFactor(12*Math.PI/180),0);
assert.equal(lampFactor(-14*Math.PI/180),1);
const moon = lunarPosition(Date.parse('2026-11-07T20:00:00+01:00'));
assert.ok(moon.fraction >= 0 && moon.fraction <= 1);
assert.ok(moon.phase >= 0 && moon.phase <= 1);
assert.ok(Number.isFinite(moon.azimuth) && Number.isFinite(moon.altitude));

const t0=Date.parse('2026-11-07T12:00:00+01:00');
const clock=new GameClock(t0);
clock.tick(1000);
clock.tick(2000);
assert.equal(clock.current-t0, 60000,'Une seconde doit faire avancer une minute');
clock.setRate(0);
clock.tick(3000);
clock.tick(4000);
assert.equal(clock.current-t0,60000,'La pause doit figer le temps');
clock.setRate(60);
clock.tick(5000);
clock.tick(6000);
assert.equal(clock.current-t0,3660000,'Le facteur 60 doit accelerer le temps');

const beforeDST=new GameClock(Date.parse('2026-03-29T00:30:00Z')).label();
const afterDST=new GameClock(Date.parse('2026-03-29T01:30:00Z')).label();
assert.ok(beforeDST.includes('01:30'),'Avant le changement heure ete : '+beforeDST);
assert.ok(afterDST.includes('03:30'),'Apres le changement heure ete : '+afterDST);
const autumnBefore=new GameClock(Date.parse('2026-10-25T00:30:00Z')).label();
const autumnAfter=new GameClock(Date.parse('2026-10-25T01:30:00Z')).label();
assert.ok(autumnBefore.includes('02:30') && autumnAfter.includes('02:30'),
  'Heure hiver et heure ete doivent afficher deux fois 02:30');

console.log('Astronomie et horloge Europe/Paris : 15 assertions verifiees');
