import { ImageOverlay }     from "../../frontend/ts/components/ImageOverlay.tsx";
import { preact, signals }  from "../../frontend/ts/dep.ts"
import * as util            from "./util.ts"
import { asserts, mock }    from "./dep.ts";



Deno.test('ImageOverlay.hide', async () => {
    const document:Document = await util.setup_jsdom()

    const $visible: signals.Signal<boolean> = new signals.Signal(true)

    util.mock_fetch(async () => await new Response())
    preact.render(<ImageOverlay image="" $visible={$visible}/>, document.body)
    await util.wait(1)

    const img:HTMLImageElement|null = document.querySelector('img')
    asserts.assertExists(img)
    asserts.assertNotEquals(img.style.display, 'none')

    $visible.value = false;
    await util.wait(1)
    asserts.assertEquals(img.style.display, 'none')

    mock.restore()
})

