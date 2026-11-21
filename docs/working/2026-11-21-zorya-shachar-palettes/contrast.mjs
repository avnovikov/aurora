const P = {
  zorya: { c: { background:"#0057b7", surface:"#004a9c", foreground:"#ffffff", muted:"#d6e6ff", accent:"#ffd500", onAccent:"#0b1a33", alert:"#ffccd5", edge:"#2a74c9", controlEdge:"#9fc3f0" },
    hr: { easy:"#bfe0ff", steady:"#a8f0c0", work:"#ffd500", hard:"#ffb15a", max:"#ffb0dc" } },
  shachar: { c: { background:"#ffd9c7", surface:"#ffe9de", foreground:"#1a0f14", muted:"#5c4038", accent:"#1f4fa3", onAccent:"#ffffff", alert:"#a3001b", edge:"#f2bfa8", controlEdge:"#8a6a5e" },
    hr: { easy:"#1a4f8b", steady:"#146c3e", work:"#7a4a00", hard:"#a33b00", max:"#9a0058" } },
};
const lin = v => (v/=255) <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4;
const L = h => { const n=parseInt(h.slice(1),16); return 0.2126*lin(n>>16)+0.7152*lin((n>>8)&255)+0.0722*lin(n&255); };
const cr = (a,b) => { const [x,y]=[L(a),L(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
let bad=0;
for (const [k,{c,hr}] of Object.entries(P)) {
  const checks = [];
  for (const r of ["foreground","muted","accent","alert"]) for (const s of ["background","surface"]) checks.push([`${r}/${s}`, cr(c[r],c[s]), 4.5]);
  checks.push(["onAccent/accent", cr(c.onAccent,c.accent), 4.5]);
  for (const s of ["background","surface"]) checks.push([`controlEdge/${s}`, cr(c.controlEdge,c[s]), 3]);
  for (const [z,v] of Object.entries(hr)) checks.push([`hr.${z}/surface`, cr(v,c.surface), 4.5]);
  for (const [n,v,min] of checks) { const ok=v>=min; if(!ok) bad++; console.log(`${k.padEnd(8)} ${n.padEnd(22)} ${v.toFixed(2).padStart(6)} ${ok?"ok":"FAIL <"+min}`); }
}
process.exit(bad?1:0);
