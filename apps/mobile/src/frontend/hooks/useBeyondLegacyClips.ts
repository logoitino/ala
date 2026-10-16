/** BEYOND-01 minimal legacy cards reuse the independently reviewed foreground/account/focus lifecycle. */
import {useCallback} from 'react';
import type {BeyondCategory} from '@tapuai/shared-types/beyondGame';
import {fetchBeyondLegacyPosts} from '@/lib/beyondLegacy';
import {useChallenges} from '@/hooks/useChallenges';
export function useBeyondLegacyClips(category:BeyondCategory,active:boolean) {
 const legacy=category==='workout'||category==='service';
 const read=useCallback((actor:string|null)=>legacy?fetchBeyondLegacyPosts(actor,category as 'workout'|'service',24):Promise.resolve([]),[category,legacy]);
 return useChallenges(`beyond-legacy:${category}`,active&&legacy,read,true);
}
