/** BEYOND-01 bounded actor-bound legacy discovery, keeping media and full profiles out of the new card read. */
import {callRpc} from '@/lib/rpc';
import type {BeyondCategory} from '@tapuai/shared-types/beyondGame';
export type BeyondLegacyPost = {id:string;title:string;playerId:string;athleteName:string;category:'workout'|'service'};
/** Missing or malformed source stays unavailable, never a healthy empty feed. */
export async function fetchBeyondLegacyPosts(actor:string|null,category:Extract<BeyondCategory,'workout'|'service'>,maxRows=24):Promise<BeyondLegacyPost[]> {
 const bounded=Number.isFinite(maxRows)?Math.max(1,Math.min(24,Math.floor(maxRows))):24;
 const raw=await callRpc<unknown>('beyond_legacy_posts',{expected_actor_id:actor,category,max_rows:bounded});
 const bad=()=>new Error('Athlete clips returned unavailable data. Refresh before continuing.');
 if(!Array.isArray(raw)||raw.length>bounded)throw bad();
 return raw.map(value=>{
  if(!value||typeof value!=='object')throw bad();const r=value as Record<string,unknown>;
  if(typeof r.id!=='string'||!r.id||typeof r.player_id!=='string'||!r.player_id||typeof r.title!=='string'||Array.from(r.title).length>240||typeof r.athlete_name!=='string'||!r.athlete_name||Array.from(r.athlete_name).length>160||r.category!==category)throw bad();
  return {id:r.id,title:r.title.trim()||'Athlete moment',playerId:r.player_id,athleteName:r.athlete_name,category};
 });
}
