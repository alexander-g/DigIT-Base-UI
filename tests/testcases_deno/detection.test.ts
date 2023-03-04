import * as util            from "./util.ts";
import { mock, asserts }    from "./dep.ts";
import { process_image }    from "../../frontend/ts/logic/detection.ts";
import { AppFile }          from "../../frontend/ts/state.ts";


Deno.test('process_image.fail', async (t:Deno.TestContext) => {
    const mockfile:AppFile = new AppFile(new File([], ''))

    await t.step('upload-fail', async () => {
        // fetch that throws an error
        util.mock_fetch_connection_error('Should be caught')
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await process_image(mockfile, error_spy)
        mock.assertSpyCalls(error_spy, 1)
    })
    mock.restore()

    await t.step('error-on-404', async () => {
        // fetch that throws an error
        util.mock_fetch_404()
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await process_image(mockfile, error_spy)
        mock.assertSpyCalls(error_spy, 1)
    })
    mock.restore()

})
