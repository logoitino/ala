/** Security partners join the existing Engineering exit notices; no review or provider access is implied. */
const all = ['SECURITY','INFRA_SECURITY','SUPPLY_CHAIN_SECURITY','RECOVERY_SECURITY','THREAT_DETECTION'];
export function securityReviewers(area) {
  if (['schemas','tables','views','functions','policies','triggers','attachments','migrations','rpcCalls','tableCalls','storageBuckets'].includes(area)) return [...all,'RLS_SECURITY'];
  if (['authMethods','oauthProviders','publicEnv','serverEnv'].includes(area)) return [...all,'SESSION_SECURITY'];
  if (['buckets','realtimeTables','realtimeUse','channelNames'].includes(area)) return [...all,'RLS_SECURITY','SESSION_SECURITY'];
  if (['edgeFunctions','apiRoutes','functionInvokes','sdkCallsites','sourceFingerprints'].includes(area)) return [...all,'RLS_SECURITY','SESSION_SECURITY'];
  return [...all];
}
