import { ProcessAllButton } from "../../frontend/ts/components/FileTableMenu.tsx";
import { preact, signals }  from "../../frontend/ts/dep.ts";
import * as util            from "./util.ts";
import { asserts }          from "./dep.ts";




Deno.test('ProcessAllButton.enable-disable', async () => {
    const document:Document = await util.setup_jsdom()

    const processing = new signals.Signal(false)
    preact.render(
        <div>
            <ProcessAllButton {...(new ProcessAllButton.defaultprops(processing))}/>
        </div>,
        document.body,
    )

    const process_button_el:HTMLElement|null = document.querySelector('a.process-all')
    const cancel_button_el: HTMLElement|null = document.querySelector('a.cancel-processing')
    asserts.assertExists(process_button_el)
    asserts.assertExists(cancel_button_el)

    asserts.assert(!util.is_hidden(process_button_el), 'Process button should be visible')
    asserts.assert( util.is_hidden(cancel_button_el),  'Cancel button should not be visible')

    processing.value = true;
    await util.wait(1)

    asserts.assert( util.is_hidden(process_button_el), 'Process button should not be visible')
    asserts.assert(!util.is_hidden(cancel_button_el),  'Cancel button should be visible')
})

