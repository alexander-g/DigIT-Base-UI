import * as ui_util         from "../../frontend/ts/components/ui_util.ts";
import * as testutil        from "./util.ts";
import { asserts, mock }    from "./dep.ts";


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

