import { signals } from "./dep.ts"


export class AppFile extends File {

}

export function createFiles(): signals.Signal<AppFile[]> {
    return signals.signal([])
}

export const files: signals.Signal<AppFile[]> = createFiles()

