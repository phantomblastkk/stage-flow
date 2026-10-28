// Matches the current JSON RPC SQL contracts. A full-size snapshot cannot prove completeness.
export const THREAD_SNAPSHOT_LIMIT=80;
export const MESSAGE_SNAPSHOT_LIMIT=200;
export const THREAD_RENDER_STEP=20;
export const MESSAGE_RENDER_STEP=50;
export function historyWindow<T>(items:readonly T[],visible:number,side:"start"|"end"){
 if(!Number.isSafeInteger(visible)||visible<1)throw new Error("Janela de histórico inválida.");
 const count=Math.min(visible,items.length);
 return {items:side==="end"?items.slice(items.length-count):items.slice(0,count),
  hidden:items.length-count,loaded:items.length};
}
export function snapshotMayBeLimited(count:number,limit:number){
 if(!Number.isSafeInteger(count)||count<0||!Number.isSafeInteger(limit)||limit<1)throw new Error("Limite de histórico inválido.");
 return count>=limit;
}
