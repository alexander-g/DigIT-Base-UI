// deno-lint-ignore-file no-explicit-any
import { load_settings } from "../../frontend/ts/logic/settings.ts";
import * as util        from "./util.ts";
import { mock }         from "./dep.ts";
import { asserts }      from "./dep.ts";

Deno.test('load_settings.errorhandling', async (t: Deno.TestContext) => {

    await t.step('dont-catch-errors', async () => {
        // fetch that throws an error
        util.mock_fetch_connection_error('Should not be caught')
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await asserts.assertRejects(
            async () => { await load_settings(error_spy) }
        );
        mock.assertSpyCalls(error_spy, 1)
    })
    mock.restore()

    await t.step('error-on-404', async () => {
        //fetch that returns a response with 404 status code
        util.mock_fetch_404()
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await asserts.assertRejects(
            async () => { await load_settings(error_spy) }
        );
        mock.assertSpyCalls(error_spy, 1)
    })
    mock.restore()

    await t.step('error-on-invalid-json', async () => {
        //fetch that returns a response with invalid json data
        util.mock_fetch(async () => await new Response('$&"!'))
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await asserts.assertRejects(
            async () => { await load_settings(error_spy) }
        );
        mock.assertSpyCalls(error_spy, 1)
    })
})

