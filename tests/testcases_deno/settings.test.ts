import { load_settings } from "../../frontend/ts/logic/settings.ts";
import { mock_fetch }   from "./util.ts";
import { mock }         from "./dep.ts";
import { asserts }      from "./dep.ts";

Deno.test('load_settings.basic', async (t: Deno.TestContext) => {

    await t.step('catch-errors', async () => {
        // fetch that throws an error
        mock_fetch( () => { throw new Error('Should not be caught!') } )
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await asserts.assertRejects(
            async () => { await load_settings(error_spy) }
        );
        mock.assertSpyCalls(error_spy, 1)
    })
    mock.restore()

    await t.step('handle-404', async () => {
        //fetch that returns a response with 404 status code
        mock_fetch(
            async () => await new Response('', {status:404})
        )
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        //await load_settings(error_spy)
        await asserts.assertRejects(
            async () => { await load_settings(error_spy) }
        );
        mock.assertSpyCalls(error_spy, 1)
    })
})

