import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PINClaimModal } from '../PINClaimModal';
jest.mock('@/lib/operator',()=>({isOperatorPin:(v:string)=>v==='1234',OPERATOR_TEST_PIN:'1234'}));
jest.mock('@/hooks/useSheetFrame',()=>({useSheetFrame:()=>({dock:{},card:{}})}));
jest.mock('@/components/UI/MenuChrome',()=>({MenuBackdrop:()=>null}));
jest.mock('@/components/UI/SheetHandle',()=>({SheetHandle:()=>null}));
const game={id:'A',home_team:'Synthetic Home',away_team:'Synthetic Away'} as any;
const wait=()=>act(async()=>{jest.advanceTimersByTime(260);await Promise.resolve()});
beforeEach(()=>jest.useFakeTimers());afterEach(()=>jest.useRealTimers());
async function enter(){for(const digit of ['1','2','3','4'])await fireEvent.press(screen.getByLabelText('Digit '+digit))}
it('keeps a claim failure visible and makes the keypad retryable',async()=>{const unlock=jest.fn().mockRejectedValue(new Error('Synthetic claim failed'));await render(<PINClaimModal game={game} onClose={jest.fn()} onUnlock={unlock}/>);await enter();await wait();expect(await screen.findByText('Synthetic claim failed')).toBeTruthy();expect(screen.getByLabelText('Digit 1').props.accessibilityState?.disabled).not.toBe(true)});
it('does not dismiss while the success delay or claimed write is active',async()=>{let resolve!:()=>void;const pending=new Promise<void>(r=>resolve=r);const close=jest.fn();await render(<PINClaimModal game={game} onClose={close} onUnlock={()=>pending}/>);await enter();await fireEvent.press(screen.getByLabelText('Dismiss PIN sheet'));expect(close).not.toHaveBeenCalled();await wait();await fireEvent.press(screen.getByLabelText('Dismiss PIN sheet'));expect(close).not.toHaveBeenCalled();await act(async()=>resolve())});
it('does not unlock an outgoing game after the success delay changes target',async()=>{const unlock=jest.fn();const view=await render(<PINClaimModal game={game} onClose={jest.fn()} onUnlock={unlock}/>);await enter();await view.rerender(<PINClaimModal game={{...game,id:'B'}} onClose={jest.fn()} onUnlock={unlock}/>);await wait();expect(unlock).not.toHaveBeenCalled()});
