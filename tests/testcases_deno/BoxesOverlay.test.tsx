import { BoxesOverlay }     from "../../frontend/ts/components/BoxesOverlay.tsx";
import { preact, signals }  from "../../frontend/ts/dep.ts";
import { Box, Instance }    from "../../frontend/ts/logic/boxes.ts";

import * as util            from "./util.ts";
import { asserts, mock }    from "./dep.ts";



Deno.test('BoxesOverlay.basic', async () => {
    const document:Document = await util.setup_jsdom()

    const imagesize = {width:1000, height:1000}
    const instances = new signals.Signal<Instance[]>([
        {label: 'banana',     box:Box.from_array([0,0,10,10])},
        {label: 'banananana', box:Box.from_array([50,50,100,100])},
        {label: 'ananab',     box:Box.from_array([50,50,100,100])},
    ])

    const spy:mock.Spy = mock.spy()
    preact.render(
        <BoxesOverlay 
            $instances          =   {instances} 
            imagesize           =   {imagesize} 
            on_new_instances    =   {spy}
        />, document.body 
    );
    await util.wait(1)
    asserts.assertEquals(document.querySelectorAll('.box').length, 3)
    const boxlabels: HTMLParagraphElement[] 
        = Array.from(document.querySelectorAll('p.box-label'))
    asserts.assertEquals(boxlabels[0]?.innerHTML, instances.value[0]?.label)
    asserts.assertEquals(boxlabels[1]?.innerHTML, instances.value[1]?.label)

    //simulate removing the first box
    const close_button: HTMLElement|null = document.querySelector('.box i.close.icon')
    asserts.assertExists(close_button)
    close_button.click()
    await util.wait(1)
    mock.assertSpyCallArg(spy, 0, 0, [instances.value[1], instances.value[2]])

    //set the instance list to empty
    instances.value = []
    await util.wait(1)
    asserts.assertEquals(document.querySelectorAll('.box').length, 0)
})
