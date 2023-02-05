import { preact } from "./dep.ts"
import * as STATE from "./state.ts"   //TODO: hard-coded

export function on_drag(event:preact.JSX.TargetedDragEvent<HTMLElement>): void {
    event.preventDefault()
}

export function on_drop(event:preact.JSX.TargetedDragEvent<HTMLElement>): void {
    event.preventDefault()
    STATE.files.value = Array.from(event.dataTransfer?.files ?? []);  //TODO: hard-coded
}

