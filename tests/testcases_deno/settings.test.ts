// deno-lint-ignore-file no-explicit-any
import * as settings    from "../../frontend/ts/logic/settings.ts";
import * as util        from "./util.ts";
import { mock }         from "./dep.ts";
import { asserts }      from "./dep.ts";

Deno.test('load_settings.errorhandling', async (t: Deno.TestContext) => {

    await t.step('do-catch-errors', async () => {
        // fetch that throws an error
        util.mock_fetch_connection_error('Should not be caught')
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await asserts.assertRejects(
            async () => { await settings.load_settings(error_spy) }
        );
        mock.assertSpyCalls(error_spy, 1)
    })
    mock.restore()

    await t.step('error-on-404', async () => {
        //fetch that returns a response with 404 status code
        util.mock_fetch_404()
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await asserts.assertRejects(
            async () => { await settings.load_settings(error_spy) }
        );
        mock.assertSpyCalls(error_spy, 1)
    })
    mock.restore()

    await t.step('error-on-invalid-json', async () => {
        //fetch that returns a response with invalid json data
        util.mock_fetch(async () => await new Response('$&"!'))
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await asserts.assertRejects(
            async () => { await settings.load_settings(error_spy) }
        );
        mock.assertSpyCalls(error_spy, 1)
    })
})





Deno.test('validate.basic', () => {
    const test_string0 = `{
        "available_models": {
          "detection": [
            {
              "name": "model_A", 
              "properties": null
            }, 
            {
              "name": "model_B", 
              "properties": null
            }
          ]
        }, 
        "settings": {
          "active_models": {
            "detection": "model_A"
          }
        }
      }`

    //assert no error is thrown
    const result = settings.validate_settings_response(test_string0)
    asserts.assertFalse(result instanceof Error)
})
