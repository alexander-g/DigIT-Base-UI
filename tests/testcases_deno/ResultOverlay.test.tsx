import { ResultOverlays }   from "../../frontend/ts/components/ResultOverlay.tsx";
import { ImageOverlay }     from "../../frontend/ts/components/ResultOverlay.tsx";
import { preact, signals }  from "../../frontend/ts/dep.ts"
import * as util            from "./util.ts"
import { ResultState, Result }      from "../../frontend/ts/state.ts";
import { asserts, mock }    from "./dep.ts";


Deno.test('ResultOverlays.decide-which-to-display', async (t:Deno.TestContext) => {
    const document:Document = await util.setup_jsdom()

    const result: signals.Signal<ResultState> = new signals.Signal(new ResultState())
    const imagesize = {width:1000, height:1000}
    preact.render(<ResultOverlays $result={result} />, document.body)
    await util.wait(1);

    //no results => no overlays
    asserts.assertEquals( document.body.children.length, 0 )

    await t.step( 'emptyresult', async () => {
        result.value = new ResultState()
        await util.wait(1)
        //still nothing because result value is empty
        asserts.assertEquals( document.body.children.length, 0 )
    } )


    await t.step('classmap.overlay', async () => {
        const fetch_spy: mock.Spy = util.mock_fetch(async () => await new Response())
        result.value = ResultState.from_result(
            new Result('processed', { classmap: "url-to-classmap.png" })
        )
        await util.wait(1)
        //now there should be an image overlay
        asserts.assertEquals( document.body.children.length, 1 )
        asserts.assertEquals( document.body.querySelectorAll('img').length, 1)
        asserts.assertEquals(fetch_spy.calls.length, 1)
    })

    //TODO: should be a test of its own
    await t.step('boxes.overlay', async () => {
        const boxprops = {
            imagesize:            imagesize,
            $drawing_mode_active: new signals.Signal(false),
        }
        preact.render(
            <ResultOverlays 
                $result             =   {result} 
                boxoverlay_props    =   {boxprops} 
            />,
            document.body
        )
        await util.wait(1)
        //now there should be a boxes overlay and the image overlay still there
        asserts.assertEquals( document.body.querySelectorAll('.boxes.overlay').length, 1)
        asserts.assertEquals( document.body.querySelectorAll('img').length, 1)
    })

    mock.restore()
})


Deno.test('ImageOverlay.hide', async () => {
    const document:Document = await util.setup_jsdom()

    const $visible: signals.Signal<boolean> = new signals.Signal(true)

    util.mock_fetch(async () => await new Response())
    preact.render(<ImageOverlay imagename="" $visible={$visible}/>, document.body)
    await util.wait(1)

    const img:HTMLImageElement|null = document.querySelector('img')
    asserts.assertExists(img)
    asserts.assertNotEquals(img.style.display, 'none')

    $visible.value = false;
    await util.wait(1)
    asserts.assertEquals(img.style.display, 'none')

    mock.restore()
})


Deno.test('Result.set_instances', () => {
    const r0:Result = new Result()
    asserts.assertEquals(r0.status, 'unprocessed')

    r0.set_instances([])
    asserts.assertEquals(r0.status, 'processed')


    const r1:ResultState = ResultState.from_result(new Result())
    r1.set_instances([])
    asserts.assertEquals(r1.status, 'processed')
})
