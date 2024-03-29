import { BoxesOverlay }     from "../../frontend/ts/components/BoxesOverlay.tsx";
import { BoxOverlay }       from "../../frontend/ts/components/BoxesOverlay.tsx";
import { preact, signals }  from "../../frontend/ts/dep.ts";
import { Box, Instance }    from "../../frontend/ts/logic/boxes.ts";

import * as util            from "./util.ts";
import { asserts, mock }    from "./dep.ts";
import { MaybeInstances } from "../../frontend/ts/logic/objectdetection.ts";



Deno.test('BoxesOverlay.basic', async (t:Deno.TestContext) => {
    const document:Document = await util.setup_jsdom()

    const imagesize = {width:1000, height:1000}
    const instances = new signals.Signal<Instance[]>([
        {label: 'banana',     box:Box.from_array([0,0,10,10])},
        {label: 'banananana', box:Box.from_array([50,50,100,100])},
        {label: 'ananab',     box:Box.from_array([50,50,100,100])},
    ])

    const spy:mock.Spy = mock.spy()
    const $drawing_mode = new signals.Signal(false)
    preact.render(
        <BoxesOverlay 
            $instances              =   {instances} 
            imagesize               =   {imagesize} 
            on_new_instances        =   {spy}
            $drawing_mode_active    =   {$drawing_mode}
            $visible                =   {new signals.Signal(true)}
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

    const overlay: HTMLElement = document.querySelector('.boxes.overlay')!
    await t.step('drawing_active', async () => {
        //activate drawing mode
        $drawing_mode.value = true;
        await util.wait(1)

        //box overlay should indicate that drawing mode is on
        asserts.assertNotEquals(overlay.style.cursor, '')
    })
})


Deno.test('BoxesOverlay.add_boxes', () => {
    const $instances: signals.Signal<MaybeInstances> = new signals.Signal(null)
    const spy:mock.Spy<Instance[]> = mock.spy()
    const overlay = new BoxesOverlay({
        $instances           : $instances,
        $drawing_mode_active : new signals.Signal(false),
        on_new_instances     : spy,
        $visible             : new signals.Signal(true),
        imagesize            : null,
    })

    overlay.add_new_box(Box.from_array([50,50,100,100]))
    mock.assertSpyCalls(spy, 1)
    const new_instances0:Instance[] = spy.calls[0]?.args[0]
    asserts.assertEquals(new_instances0.length, 1)
})


Deno.test('BoxOverlay.modifiers', async () => {
    const instance:Instance = {box: Box.from_array([10,10,100,100]), label:'???'}
    const overlay = new BoxOverlay({
        instance:  instance,
        imagesize: {width: 500, height:500},
        index:     1,
        on_modify: () => {},
        on_remove: () => {}
    })

    const box0: Box = overlay.compute_modified_box()
    asserts.assertEquals(box0, instance.box)

    overlay.move_offset.value   = {x: 10, y:0}
    await util.wait(1)
    const box1: Box = overlay.compute_modified_box()
    asserts.assertEquals(box1, Box.from_array([20,10,110,100]))

    overlay.finalize_box()
    asserts.assertEquals(overlay.move_offset.value, {x: 0, y:0})

    overlay.resize_offset.value = {x: 25, y:30}
    await util.wait(1)
    const box2: Box = overlay.compute_modified_box()
    asserts.assertEquals(box2, Box.from_array([10,10,125,130]))

    overlay.finalize_box()
    asserts.assertEquals(overlay.resize_offset.value, {x: 0, y:0})
})

