import * as ContentMenu     from "../../frontend/ts/components/ContentMenu.tsx";
import { Result, Input }    from "../../frontend/ts/logic/files.ts"
import { preact, Signal }   from "../../frontend/ts/dep.ts"
import * as util            from "./util.ts"
import { asserts }          from "./dep.ts";


Deno.test('DownloadButton.enable', async () => {
    const document:Document = await util.setup_jsdom();

    const file:Input = new File([], 'file000.jpg')
    const $result:Signal<Result> = new Signal(new Result())
    const dbutton = <ContentMenu.DownloadButton $result={$result} />
    
    preact.render(dbutton, document.body)
    await util.wait(1)

    //should be disabled as long as no result is set
    asserts.assertEquals(document.querySelectorAll('a.download.disabled').length, 1)

    //set a dummy result
    $result.value = new Result('processed')
    await util.wait(1)
    //the disabled class should be gone
    asserts.assertEquals(document.querySelectorAll('a.download.disabled').length, 0)

    //remove result again
    $result.value = new Result('unprocessed')
    await util.wait(1)
    //the disabled class should be gone
    asserts.assertEquals(document.querySelectorAll('a.download.disabled').length, 1)
})


Deno.test('ViewMenu.show_results', async () => {
    const document:Document = await util.setup_jsdom();
    util.mock_jQ({checkbox:()=>{}})

    const $result:Signal<Result> = new Signal(new Result())
    const $result_visible:Signal<boolean> = new Signal(true)
    const menu_items = [
        <ContentMenu.ShowResultsCheckbox 
            $result  = {$result} 
            $visible = {$result_visible}
        />
    ]
    preact.render(
        <ContentMenu.ViewMenu menu_items={menu_items}/>,
        document.body
    )
    await util.wait(1)

    const checkbox: HTMLInputElement|null = document.querySelector('.show-results-checkbox')
    asserts.assertExists(checkbox)
    asserts.assertStringIncludes(checkbox.className, 'disabled')

    //set a dummy result
    $result.value = new Result('processed')
    await util.wait(1)
    //the disabled class should be gone
    asserts.assertFalse(checkbox.className.includes('disabled'), 'Checkbox not enabled')

    const input: HTMLInputElement|null = document.querySelector('input')
    asserts.assertExists(input)
    asserts.assert(input.checked, 'Results should be visible initially')
    
    input.click()
    asserts.assertFalse($result_visible.peek())

    input.click()
    asserts.assert($result_visible.peek())
})

