import * as ContentMenu     from "../../frontend/ts/components/ContentMenu.tsx";
import { AppFileState, ResultState }     from "../../frontend/ts/state.ts"
import { preact }           from "../../frontend/ts/dep.ts"
import * as util            from "./util.ts"
import { asserts }          from "./dep.ts";


Deno.test('DownloadButton.enable', async () => {
    const document:Document = await util.setup_jsdom();

    const file:AppFileState = new AppFileState(new File([], 'file000.jpg'))
    const dbutton = <ContentMenu.DownloadButton file={file} />
    
    preact.render(dbutton, document.body)
    await util.wait(1)

    //should be disabled as long as no result is set
    asserts.assertEquals(document.querySelectorAll('a.download.disabled').length, 1)

    //set a dummy result
    file.set_result({})
    await util.wait(1)
    //the disabled class should be gone
    asserts.assertEquals(document.querySelectorAll('a.download.disabled').length, 0)

    //remove result again
    file.set_result(null)
    await util.wait(1)
    //the disabled class should be gone
    asserts.assertEquals(document.querySelectorAll('a.download.disabled').length, 1)
})


Deno.test('ViewMenu.show_results', async () => {
    const document:Document = await util.setup_jsdom();
    util.mock_jQ({checkbox:()=>{}})

    const file:AppFileState = new AppFileState(new File([], 'file000.jpg'))
    preact.render(<ContentMenu.ViewMenu file={file}/>, document.body)
    await util.wait(1)

    const checkbox: HTMLInputElement|null = document.querySelector('.show-results-checkbox')
    asserts.assertExists(checkbox)
    asserts.assertStringIncludes(checkbox.className, 'disabled')

    //set a dummy result
    const result:ResultState = new ResultState()
    file.set_result(result)
    await util.wait(1)
    //the disabled class should be gone
    asserts.assertFalse(checkbox.className.includes('disabled'), 'Checkbox not enabled')

    const input: HTMLInputElement|null = document.querySelector('input')
    asserts.assertExists(input)
    asserts.assert(input.checked, 'Results should be visible initially')
    
    input.click()
    asserts.assertFalse(result.$visible.peek())

    input.click()
    asserts.assert(result.$visible.peek())
})

