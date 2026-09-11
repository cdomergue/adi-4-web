import {calculationEntries,runCalculation} from './original-calculations.js';
export const supportedCalculations=new Set(Object.keys(calculationEntries));
// The original script uses indexes into an object structure. This adapter maps
// those indexes to OBJETID, retaining VALEUR and ETATID as separate quantities.
export function calculateSimulation(data,selected) {
  const states={...selected},values={},resolved=new Set(),objects=new Map(data.objects.map(o=>[Number(o.id),o]));
  for(const o of data.objects){
    const state=o.options.find(s=>s.id===selected[o.id]);
    if(state){values[o.id]=state.value;if(o.type!==1||!o.function)resolved.add(o.id);}
  }
  const v=new Array(16384).fill(0),stack=[],scratch={},cache03={};
  const field=(id,member)=>{
    if(member===0x12)return values[id];
    if(member===0x10)return states[id];
    return scratch[`${id}:${member}`]??0;
  };
  let pending={};
  const setField=(id,member,value)=>{
    if(member===0x15)pending[id]=Number(value);
    else if(member===0x12)values[id]=Number(value);
    else scratch[`${id}:${member}`]=value;
  };
  const service=address=>{
    if(address===0x35b2){v[0x1d6]=objects.has(v[0x1d3])?v[0x1d3]:-1;return;}
    if(address===0x3923){
      const id=String(v[0x1d4]);const row=data.lookup.find(r=>r.object===id&&Object.entries(r.conditions).every(([key,value])=>values[key]===value));
      if(row)pending[v[0x22c]]=row.value;return;
    }
    if(address===0x3946){
      const option=objects.get(v[0x235])?.options.find(o=>o.value===v[0x23a]);
      v[0x1d6]=option?.id??-1;v[0x48e]=option?.value??0;return;
    }
    // TEMP/SIM03.CLC is a six-value scratch file in the original game.
    if(address===0xabab){cache03[v[0x1d4]-13]=v[0x1d3];return;}
    if(address===0xabd3){v[0x1d6]=cache03[v[0x1d3]-13]??0;return;}
    throw new Error(`Unsupported calculation service ${address.toString(16)}`);
  };
  const context={v,stack,field,setField,array:(base,index)=>v[base+index],service,
    // Zero division occurs in the tomato zero-growth expression. The web port
    // defines it as zero; ordinary division follows the original integer maths.
    div:(a,b)=>b===0?0:Math.trunc(a/b)};
  const entry=calculationEntries[data.id];
  if(entry)for(let pass=0;pass<data.objects.length;pass++){
    let changed=false;
    // Sort by original object ID so dependencies (e.g. lightning scratch values)
    // are computed before downstream observations.
    for(const o of [...data.objects].sort((a,b)=>Number(a.id)-Number(b.id))){
      if(o.type!==1&&!o.function)continue;
      pending={};stack.length=0;v[0x1d4]=Number(o.id);v[0x22c]=Number(o.id);
      runCalculation(entry,context);
      for(const [id,value] of Object.entries(pending)){
        if(!Number.isFinite(value))continue;
        const option=objects.get(Number(id))?.options.find(s=>s.value===value);
        if(!option)continue;
        if(values[id]!==value||states[id]!==option.id){changed=true;values[id]=value;states[id]=option.id;}
        resolved.add(id);
      }
    }
    if(!changed)break;
  }
  return {values,states,resolved:[...resolved]};
}
export function checkChallenge(solutions,states) {
  return solutions.some(solution=>Object.keys(solution).length>0 && Object.entries(solution).every(([id,state])=>states[id]===state));
}
