import * as ui_util         from "../../frontend/ts/components/ui_util.ts";
import * as testutil        from "./util.ts";
import { asserts, mock }    from "./dep.ts";
import { ModelInfo }        from "../../frontend/ts/logic/settings.ts";
import { ObjectdetectionResult } from "../../frontend/ts/logic/objectdetection.ts";


//mostly just to run through once
Deno.test('start_drag', async () => {
    const document:Document = await testutil.setup_jsdom()
    const window: Window & typeof globalThis = document.defaultView!;

    const move_spy:mock.Spy = mock.spy()
    const end_spy:mock.Spy  = mock.spy()

    const mock_event:MouseEvent = {pageX:10, pageY:100} as MouseEvent;
    ui_util.start_drag(
        mock_event,
        document.body,
        undefined,
        move_spy,
        end_spy,
    )

    const move_event:any = new window.Event('mousemove');
    move_event.buttons = 1;

    const n = 11;
    for(let i=0; i<n; i++)
        document.dispatchEvent(move_event as MouseEvent)
    await testutil.wait(1)
    mock.assertSpyCalls(move_spy, n)
    mock.assertSpyCalls(end_spy, 0)

    const up_event:any = new window.Event('mouseup');
    up_event.buttons = 0;
    document.dispatchEvent(up_event as MouseEvent)
    mock.assertSpyCalls(move_spy, n)
    mock.assertSpyCalls(end_spy, 1)
})


Deno.test('collect_all_labels', () => {
    const active_model: ModelInfo = {
        name: 'dontcare',
        properties: {
            known_classes: ['background', 'potato', 'pineapple', 'banana']
        }
    }

    const raw:any = {
        labels: ['tomato', 'tomato', 'kumquat'],
        boxes: [ [0,0,0,0], [0,0,0,0], [0,0,0,0], ]
    }
    const all_results: ObjectdetectionResult[] = [
        new ObjectdetectionResult('unprocessed'),
        new ObjectdetectionResult('processed', raw),
        new ObjectdetectionResult('failed'),
    ]
    console.log(all_results)

    //testing ObjectdetectionResult constructor
    asserts.assertEquals(all_results[1]?.instances?.length, 3)
    
    const collected_labels: string[] = ui_util.collect_all_classes(
        all_results, active_model
    )

    //alphabetically sorted, no duplicates, no 'background'
    asserts.assertEquals(
        collected_labels, ['banana', 'kumquat', 'pineapple', 'potato', 'tomato']
    )
})

