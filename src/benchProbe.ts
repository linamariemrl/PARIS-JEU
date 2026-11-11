/** Sonde de mesure en LECTURE SEULE, active uniquement avec `?bench` dans
 * l'URL (banc scripts/browser/paris_route_benchmark.mjs). Elle n'altère ni
 * le rendu ni l'interface ; sans `?bench`, rien n'est exposé. */
export function installBenchProbe(read:()=>Record<string,unknown>):void{
 if(typeof location==='undefined'||!new URLSearchParams(location.search).has('bench'))return;
 (window as unknown as {__parisProbe:()=>Record<string,unknown>}).__parisProbe=read;
}
