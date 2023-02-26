import { ResultOverlays }   from "../../frontend/ts/components/ResultOverlay.tsx";
import { preact, signals }  from "../../frontend/ts/dep.ts"
import * as util            from "./util.ts"
import { MaybeResult }      from "../../frontend/ts/state.ts";
import { asserts, mock }    from "./dep.ts";


Deno.test('ResultOverlays.decide-which-to-display', async () => {
    const document:Document = await util.setup_jsdom()

    const result: signals.Signal<MaybeResult> = new signals.Signal(null)
    preact.render(<ResultOverlays result={result} />, document.body)
    await util.wait(1);

    //no results => no overlays
    asserts.assertEquals( document.body.children.length, 0 )

    result.value = {}
    await util.wait(1)
    //still nothing because result value is empty
    asserts.assertEquals( document.body.children.length, 0 )

    const fetch_spy: mock.Spy = util.mock_fetch(async () => await new Response())
    result.value = { classmap: "url-to-classmap.png" }
    await util.wait(1)
    //now there should be an image overlay
    asserts.assertEquals( document.body.children.length, 1 )
    asserts.assertEquals( document.body.querySelectorAll('img').length, 1)
    asserts.assertEquals(fetch_spy.calls.length, 1)
})

