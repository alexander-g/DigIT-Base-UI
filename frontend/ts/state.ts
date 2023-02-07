import { signals } from "./dep.ts"


export class AppFile extends File {

}

export const files: signals.Signal<AppFile[]> = signals.signal([])

