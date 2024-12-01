import { ImageControls }        from "../../frontend/ts/components/ImageComponents.tsx";
import { preact, JSX, Signal }  from "../../frontend/ts/dep.ts";

import { asserts }              from "./dep.ts";
import * as util                from "./util.ts";


Deno.test('ImageControls', async () => {
    const document:Document = await util.setup_jsdom()
    const window = document.defaultView;
    asserts.assertExists(window)

    const ref: preact.RefObject<ImageControls> = preact.createRef()
    const $size = new Signal({width:100, height:100})
    const imgctrl = <ImageControls $imagesize={ $size } ref={ref}>
    </ImageControls>

    preact.render(imgctrl, document.body)
    await util.wait(1)

    asserts.assertEquals( ref.current?.$scale.value!, 1.0 )
    const offset0 = ref.current?.$offset.value

    const viewbox = document.querySelector('.view-box')
    asserts.assertExists(viewbox)
    const tbox = viewbox.querySelector('.transform-box')
    asserts.assertExists(tbox)
    
    //test zoom
    const mousewheel_event:WheelEvent = new window.WheelEvent(
        'wheel', {shiftKey:true, deltaY:-10.0}
    )
    tbox.dispatchEvent(mousewheel_event)
    asserts.assert( ref.current?.$scale.value! > 1.0, 'Did not zoom' )
    const offset1 = ref.current?.$offset.value;
    asserts.assertEquals(offset0, offset1, 'Offset should not change on zoom before panning')

    //test pan
    const mouse_down: MouseEvent = new window.MouseEvent('mousedown', {shiftKey:true})
    tbox.dispatchEvent(mouse_down)
    const mouse_move: MouseEvent = new window.MouseEvent(
        'mousemove', {shiftKey:true, buttons:0x01, movementX:10} as MouseEventInit
    )
    document.dispatchEvent(mouse_move)
    const mouse_up: MouseEvent = new window.MouseEvent(
        'mouseup', {shiftKey:true, buttons:0x00}
    )
    document.dispatchEvent(mouse_up)
    
    const offset2 = ref.current?.$offset.value;
    //weak assert
    asserts.assertNotEquals(offset0, offset2)


    //test reset
    const dblclick:MouseEvent = new window.MouseEvent('dblclick', {shiftKey:true})
    viewbox.dispatchEvent(dblclick)
    asserts.assertEquals( ref.current?.$scale.value!, 1.0 , 'Did not reset after double-click')
    asserts.assertEquals(offset0, ref.current?.$offset.value)
    

    await util.wait(10)
})

