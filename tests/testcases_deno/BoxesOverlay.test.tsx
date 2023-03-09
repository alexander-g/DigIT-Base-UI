import { BoxesOverlay }     from "../../frontend/ts/components/BoxesOverlay.tsx";
import { preact, signals }  from "../../frontend/ts/dep.ts";
import { Box, Instance }    from "../../frontend/ts/logic/boxes.ts";

import * as util            from "./util.ts";
import { asserts }          from "./dep.ts";



Deno.test('BoxesOverlay.basic', async () => {
    const document:Document = await util.setup_jsdom()

    const instances = new signals.Signal<Instance[]>([
        {label: 'banana', box:Box.from_array([0,0,10,10])},
        {label: 'banana', box:Box.from_array([50,50,100,100])},
    ])
    preact.render( <BoxesOverlay $instances={instances} />, document.body );
    await util.wait(1)
    asserts.assertEquals(document.querySelectorAll('.box').length, 2)

    instances.value = []
    await util.wait(1)
    asserts.assertEquals(document.querySelectorAll('.box').length, 0)
})
