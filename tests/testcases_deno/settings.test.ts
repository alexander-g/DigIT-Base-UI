import * as settings    from "../../frontend/ts/logic/settings.ts";
import * as util        from "./util.ts";
import { mock }         from "./dep.ts";
import { asserts }      from "./dep.ts";

Deno.test('load_settings.errorhandling', async (t: Deno.TestContext) => {
    const handler = new settings.BaseSettingsHandler;

    await t.step('do-catch-errors', async () => {
        // fetch that throws an error
        util.mock_fetch_connection_error('We are offline')
        const response = await handler.load()
        asserts.assertInstanceOf(response, Error)
    })
    mock.restore()

    await t.step('error-on-404', async () => {
        //fetch that returns a response with 404 status code
        util.mock_fetch_404()
        const response = await handler.load()
        asserts.assertInstanceOf(response, Error)
    })
    mock.restore()

    await t.step('error-on-invalid-json', async () => {
        //fetch that returns a response with invalid json data
        util.mock_fetch(async () => await new Response('$&"!'))
        const response = await handler.load()
        asserts.assertInstanceOf(response, Error)
    })
})





Deno.test('validate.basic', async () => {
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
    const response = new Response(test_string0)

    const handler = new settings.BaseSettingsHandler;
    //assert no error is thrown
    const result = await handler._validate_response(response)
    asserts.assertNotInstanceOf(result, Error)
    asserts.assertEquals(Object.keys(result.available_models.detection).length, 2)
})
