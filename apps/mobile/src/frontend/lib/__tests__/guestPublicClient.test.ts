/** Public preview/config SDK must not read or persist account session storage. Synthetic configuration only. */
import AsyncStorage from '@react-native-async-storage/async-storage';
const mockCreateClient=jest.fn<object,unknown[]>(()=>({}));
jest.mock('@supabase/supabase-js',()=>({createClient:(...args:unknown[])=>mockCreateClient(...args)}));
it('uses a separate cached client with session handling disabled and the selected public backend',async()=>{
 const oldUrl=process.env.EXPO_PUBLIC_SUPABASE_URL,oldKey=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
 process.env.EXPO_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321';process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='synthetic-public-key';
 try {
  let sdk!:typeof import('@/lib/supabase');
  jest.isolateModules(()=>{sdk=require('@/lib/supabase');});
  const publicClient=sdk.getGuestPreviewClient();expect(sdk.getGuestPreviewClient()).toBe(publicClient);
  expect(mockCreateClient).toHaveBeenCalledTimes(2);
  const [url,key,options]=mockCreateClient.mock.calls[1] as unknown as [string,string,{auth:Record<string,unknown>}];
  expect(url).toBe(mockCreateClient.mock.calls[0][0]);expect(key).toBe(mockCreateClient.mock.calls[0][1]);
  expect(options.auth).toEqual({persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
  expect(options.auth).not.toHaveProperty('storage');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
 } finally {if(oldUrl===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY=oldKey;}
});
