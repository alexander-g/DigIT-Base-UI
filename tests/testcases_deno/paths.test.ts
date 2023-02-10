import * as paths from "../../backend/ts/paths.ts"
import { asserts, fs } from "./dep.ts"



Deno.test('paths.root', ():void => {
    const root_path:string = paths.root()

    const dir_contents:Deno.DirEntry[] = [...Deno.readDirSync(root_path)]
    const files:string[] = dir_contents.map((entry:Deno.DirEntry):string => entry.name)
    asserts.assert(files.includes('deno.jsonc'))
})

Deno.test('paths.index_tsx', ():void => {
    const index_tsx_path:string = paths.index_tsx()

    asserts.assert( fs.existsSync(index_tsx_path) )
})

