import { 
    ProcessAllButton,
    DownloadAllButton,
    DownloadAllWithCSVAndAnnotations,
}                           from "../../frontend/ts/components/FileTableMenu.tsx";
import { preact, signals }  from "../../frontend/ts/dep.ts";
import { Result }           from "../../frontend/ts/logic/files.ts";
import * as util            from "./util.ts";
import { asserts, mock }    from "./dep.ts";




Deno.test('ProcessAllButton.enable-disable', async () => {
    const document:Document = await util.setup_jsdom()

    const $processing = new signals.Signal(false)
    preact.render(
        <div>
            <ProcessAllButton {...(new ProcessAllButton.defaultprops($processing))}/>
        </div>,
        document.body,
    )

    const process_button_el:HTMLElement|null = document.querySelector('a.process-all')
    const cancel_button_el: HTMLElement|null = document.querySelector('a.cancel-processing')
    asserts.assertExists(process_button_el)
    asserts.assertExists(cancel_button_el)

    asserts.assert(!util.is_hidden(process_button_el), 'Process button should be visible')
    asserts.assert( util.is_hidden(cancel_button_el),  'Cancel button should not be visible')

    $processing.value = true;
    await util.wait(1)

    asserts.assert( util.is_hidden(process_button_el), 'Process button should not be visible')
    asserts.assert(!util.is_hidden(cancel_button_el),  'Cancel button should be visible')
})



Deno.test('DownloadAllButton', async (t:Deno.TestContext) => {
    const document:Document = await util.setup_jsdom()

    const spy:mock.Spy = mock.spy();
    const $processing  = new signals.Signal(false)
    preact.render(
        <DownloadAllButton 
            $processing     = {$processing} 
            items           = {[]}
            on_download_all = {spy}
            submenu_callbacks = { {'Download Banana': spy} }
        />,
        document.body,
    )

    const download_button:HTMLElement|null = document.querySelector('.download-all')
    const download_banana:HTMLElement|null    = document.querySelector('.download-all .menu .item')
    asserts.assertExists(download_button)
    asserts.assertExists(download_banana)

    await t.step('callbacks-bind-this', async () => {
        download_button.click()
        await util.wait(1)

        mock.assertSpyCalls(spy, 1)
        //assert spy was called with DownloadAllButton as `this`
        asserts.assert( 
            spy.calls[0]?.self instanceof DownloadAllButton, 
            `callback called with ${spy.calls[0]?.self}.
             Expected the this argument to be an instance of DownloadAllButton` 
        )

        download_button.click()
        await util.wait(1)
        mock.assertSpyCalls(spy, 2)
        //same as above
        asserts.assert(spy.calls[1]?.self instanceof DownloadAllButton, 'Wrong this')
    })

    class MockResult{
        static export_combined: mock.Spy = mock.spy()
    }
    const mockresult = new signals.Signal((new MockResult as unknown as Result))
    preact.render(
        <DownloadAllWithCSVAndAnnotations 
            $processing     = {$processing} 
            items           = {[{input:new File([],''), $result:mockresult}]}
        />,
        document.body,
    )
    const download_csv:Element|undefined = document.querySelectorAll('.download-all .menu .item')[0]
    const download_ann:Element|undefined = document.querySelectorAll('.download-all .menu .item')[1]
    asserts.assertExists(download_csv)
    asserts.assertExists(download_ann)

    await t.step('export-csv-uses-statistics', async () => {
        (download_csv as HTMLElement).click()
        await util.wait(1)

        //const spy:mock.Spy = (mockresult.value.export as unknown as mock.Spy);
        const spy:mock.Spy = MockResult.export_combined;
        asserts.assertEquals(spy.calls[0]?.args[1], 'statistics');

        (download_ann as HTMLElement).click()
        await util.wait(1)
        asserts.assertEquals(spy.calls[1]?.args[1], 'annotations')
    })

    //TODO:
    //await t.step('enable-disable', () => {})

})
