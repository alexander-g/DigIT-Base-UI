import { FileList }         from "../../frontend/ts/components/DetectionTab.tsx"
import { AppFile }          from "../../frontend/ts/state.ts"
import * as util            from "./util.ts"
import { asserts }          from "./dep.ts"
import { preact }           from "../../frontend/ts/dep.ts"

Deno.test('FileList.basic', async () => {
    const document:Document = util.setup_jsdom()

    const files0:AppFile[] = [
        new AppFile([], 'file000.jpg'),
        new AppFile([], 'file001.jpg'),
    ]
    preact.render(<FileList files={files0}/>, document.body)

    await util.wait(1)
    const P: HTMLParagraphElement[] = Array.from(document.querySelectorAll('p') ?? [])
    asserts.assertEquals( P.length, files0.length )

    const contents:string[] = P.map( (x: HTMLParagraphElement) => x.textContent ?? '' )
    asserts.assertArrayIncludes(contents, files0.map( (f:AppFile) => f.name ))
})
