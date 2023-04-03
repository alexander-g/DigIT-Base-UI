import { asserts, fs, path } from "./dep.ts"
import * as preact from "../../backend/ts/preact.ts"


Deno.test('preact.compile_default', async () => {
    const tempdir:string = Deno.makeTempDirSync({ prefix: 'tests' });
    //TODO: create file in temporary directory. must be deleted afterwards
    //const tempfile:string = Deno.makeTempFileSync({dir:tempdir})
    //fs.ensureFileSync(tempfile)

    await preact.compile_default({static:tempdir})
    //asserts.assertFalse( fs.existsSync(tempfile) )
    
    const dir_contents: Deno.DirEntry[] = [...Deno.readDirSync(tempdir)]
    const files:string[] = dir_contents.map(e => e.name)
    asserts.assertArrayIncludes(files, ['index.html'])

    const expected_index_path:string = path.join(tempdir, 'index.html')
    const content:string = Deno.readTextFileSync(expected_index_path)
    asserts.assertStringIncludes(content, '<html>')

    Deno.removeSync(tempdir, {recursive:true})
})
