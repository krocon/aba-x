// Phase 0 spike (2026-11-02): CAS capability probe for nerdamer 2.0.1 and nerdamer-prime 1.5.0.
// Run in an empty folder: npm i nerdamer@2.0.1 nerdamer-prime@1.5.0 && node cas-capabilities.cjs
// Results: docs/technical-evaluation.md §3.
const cases = [
 ['expand','(x+1)^2'],['expand','(x+1)^4'],['factor','x^2-1'],['factor','x^4-1'],['factor','x^3-6*x^2+11*x-6'],
 ['simplify','sin(x)^2+cos(x)^2'],['simplify','(x^2-1)/(x-1)'],
 ['diff','sin(x^2)'],['diff','x^x'],['diff','ln(x)/x'],['diff','atan(x)'],
 ['integrate','x^2'],['integrate','sin(x)*x'],['integrate','1/(x^2+1)'],['integrate','e^(-x^2)'],['integrate','1/x'],['integrate','x*e^x'],['integrate','sqrt(1-x^2)'],
 ['defint','x^2',0,1],['defint','sin(x)',0,'pi'],
 ['solve','x^2-4'],['solve','x^3-6*x^2+11*x-6'],['solve','x^2+1'],['solve','e^x-2'],['solve','sin(x)'],['solve','x^5-x-1'],
 ['limit','sin(x)/x',0],['limit','(1+1/x)^x','Infinity'],
 ['frac','1/3+1/6'],['frac','sqrt(8)'],['frac','2^100'],['frac','100!'],
];
function run(name, N){
  console.log('\n######', name);
  for (const [op,e,a,b] of cases){
    let r; const t=Date.now();
    try{
      switch(op){
        case 'expand': r=N.expand(e); break;
        case 'factor': r=N.factor(e); break;
        case 'simplify': r=N.simplify? N.simplify(e): N('simplify('+e+')'); break;
        case 'diff': r=N.diff(e,'x'); break;
        case 'integrate': r=N.integrate(e,'x'); break;
        case 'defint': r=N.defint(e,a,b,'x'); break;
        case 'solve': r=N.solve(e,'x'); break;
        case 'limit': r=N.limit(e,'x',String(a)); break;
        case 'frac': r=N(e); break;
      }
      r = r && r.text ? r.text() : r && r.toString();
    }catch(err){ r='ERR '+err.message.slice(0,80) }
    console.log(op.padEnd(9), String(e).padEnd(22), '->', String(r).slice(0,90), `(${Date.now()-t}ms)`);
  }
}
const N2=require('nerdamer'); run('nerdamer 2.0.1', N2);
const NP=require('nerdamer-prime'); require('nerdamer-prime/Algebra');require('nerdamer-prime/Calculus');require('nerdamer-prime/Solve');require('nerdamer-prime/Extra'); run('nerdamer-prime 1.5.0', NP);
