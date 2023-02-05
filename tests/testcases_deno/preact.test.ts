import { asserts, fs, path } from "./dep.ts"
import * as preact from "../../backend/ts/preact.ts"


Deno.test('preact.compile_index', async () => {
    const tempdir:string = Deno.makeTempDirSync({ prefix: 'tests' });
    await preact.compile_index(tempdir)

    const should_be_index_path:string = path.join(tempdir, 'index.html')
    const content:string = Deno.readTextFileSync(should_be_index_path)

    asserts.assertStringIncludes(content, '<html>')

    Deno.removeSync(tempdir, {recursive:true})
})


Deno.test('preact.compile_default', async () => {
    const tempdir:string = Deno.makeTempDirSync({ prefix: 'tests' });
    //TODO: create file in temporary directory. must be deleted afterwards
    //const tempfile:string = Deno.makeTempFileSync({dir:tempdir})
    //fs.ensureFileSync(tempfile)

    await preact.compile_default(tempdir)
    //asserts.assertFalse( fs.existsSync(tempfile) )
    
    const dir_contents: Deno.DirEntry[] = [...Deno.readDirSync(tempdir)]
    const files:string[] = dir_contents.map(e => e.name)
    asserts.assertArrayIncludes(files, ['dep.ts'])

    Deno.removeSync(tempdir, {recursive:true})
})
