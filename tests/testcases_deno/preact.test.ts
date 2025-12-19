import { asserts, fs, path } from "./dep.ts"
import * as preact from "../../backend/ts/build.ts"


Deno.test(
    'preact.compile_default', 
    {sanitizeOps:false, sanitizeResources:false},   //TODO: remove
    async () => {

    const tempdir:string = Deno.makeTempDirSync({ prefix: 'tests' });
    //TODO: create file in temporary directory. must be deleted afterwards
    //const tempfile:string = Deno.makeTempFileSync({dir:tempdir})
    //fs.ensureFileSync(tempfile)

    // additional dummy bundle for testing
    const extra:string = path.fromFileUrl(
        import.meta.resolve('../../frontend/ts/util.ts')
    )

    const maybe_error:boolean|Error = await preact.compile_default({
        static: tempdir,
        extra_bundle: [extra]
    })
    asserts.assertFalse(maybe_error instanceof Error, maybe_error.toString())
    //asserts.assertFalse( fs.existsSync(tempfile) )
    
    const dir_contents: Deno.DirEntry[] = [...Deno.readDirSync(tempdir)]
    const files:string[] = dir_contents.map(e => e.name)
    asserts.assertArrayIncludes(files, ['index.html'])

    const expected_index_path:string = path.join(tempdir, 'index.html')
    const content:string = Deno.readTextFileSync(expected_index_path)
    asserts.assertStringIncludes(content, '<html>')

    asserts.assertArrayIncludes(files, ['util.ts.js'])

    Deno.removeSync(tempdir, {recursive:true})
})
