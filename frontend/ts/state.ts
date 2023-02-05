import { signal } from "https://esm.sh/v106/@preact/signals-core@1.2.3/dist/signals-core"
import { signals } from "./dep.ts"


export class AppFile extends File {

}

export const files: signals.Signal<AppFile[]> = signals.signal([])

export const numbers: signals.Signal<number[]> = signals.signal([0,0])
