import { FileTable }        from "../../frontend/ts/components/FileTable.tsx"
import { AppFileList, AppFile, Result }     from "../../frontend/ts/state.ts"
import * as util            from "./util.ts"
import { asserts, mock }    from "./dep.ts"
import { preact, signals }  from "../../frontend/ts/dep.ts"

Deno.test('FileTable.basic', async (t:Deno.TestContext) => {
    const document:Document = await util.setup_jsdom()
    util.mock_fomantic()

    const files: AppFileList = new AppFileList([])
    const processing         = new signals.Signal(false)

    await t.step('empty', async () => {
        preact.render(
            <FileTable files={files} sortable={false} processing={processing}/>,
            document.body
        )
        
        await util.wait(1)
        asserts.assertEquals(document.querySelectorAll('table tr').length, 0)
    })

    await t.step('non-empty', async () => {
        const files0:AppFile[] = [
            new AppFile(new File([], 'file000.jpg')),
            new AppFile(new File([], 'file001.jpg')),
        ]
        files.set_from_files(files0);

        await util.wait(1)
        const P: HTMLTableRowElement[] = Array.from(document.querySelectorAll('table tr.table-row') ?? [])
        asserts.assertEquals( P.length, files0.length )
    })

    await t.step('bold-with-result', async () => {
        const P: HTMLTableRowElement[] = Array.from(document.querySelectorAll('table tr.table-row') ?? [])
        const p2: HTMLTableRowElement  = P[1]!
        asserts.assertEquals(p2.style.fontWeight, 'normal')

        files.peek()[1]?.set_result(new Result('processed'))
        await util.wait(1)

        asserts.assertEquals(p2.style.fontWeight, 'bold')
    })
})
