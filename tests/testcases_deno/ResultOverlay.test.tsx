import { ResultOverlays }   from "../../frontend/ts/components/ResultOverlay.tsx";
import { ImageOverlay }     from "../../frontend/ts/components/ResultOverlay.tsx";
import { preact, signals }  from "../../frontend/ts/dep.ts"
import * as util            from "./util.ts"
import { MaybeResultState, ResultState } from "../../frontend/ts/state.ts";
import { asserts, mock }    from "./dep.ts";


Deno.test('ResultOverlays.decide-which-to-display', async () => {
    const document:Document = await util.setup_jsdom()

    const result: signals.Signal<MaybeResultState> = new signals.Signal(null)
    preact.render(<ResultOverlays result={result} />, document.body)
    await util.wait(1);

    //no results => no overlays
    asserts.assertEquals( document.body.children.length, 0 )

    result.value = new ResultState()
    await util.wait(1)
    //still nothing because result value is empty
    asserts.assertEquals( document.body.children.length, 0 )

    const fetch_spy: mock.Spy = util.mock_fetch(async () => await new Response())
    result.value = ResultState.from_result({ classmap: "url-to-classmap.png" })
    await util.wait(1)
    //now there should be an image overlay
    asserts.assertEquals( document.body.children.length, 1 )
    asserts.assertEquals( document.body.querySelectorAll('img').length, 1)
    asserts.assertEquals(fetch_spy.calls.length, 1)

    mock.restore()
})


Deno.test('ImageOverlay.hide', async () => {
    const document:Document = await util.setup_jsdom()

    const $visible: signals.Signal<boolean> = new signals.Signal(true)

    util.mock_fetch(async () => await new Response())
    preact.render(<ImageOverlay imagename="" visible={$visible}/>, document.body)
    await util.wait(1)

    const img:HTMLImageElement|null = document.querySelector('img')
    asserts.assertExists(img)
    asserts.assertNotEquals(img.style.display, 'none')

    $visible.value = false;
    await util.wait(1)
    asserts.assertEquals(img.style.display, 'none')

    mock.restore()
})
