// deno-lint-ignore-file no-explicit-any
import * as util            from "./util.ts";
import { mock, asserts }    from "./dep.ts";
import { process_image }    from "../../frontend/ts/logic/detection.ts";
import { AppFile }          from "../../frontend/ts/state.ts";


Deno.test('process_image.fail', async (t:Deno.TestContext) => {
    const mockfile:AppFile = new AppFile(new File([], ''))
    const set_result_spy: mock.Stub = mock.stub(mockfile, 'set_result', mock.spy())

    await t.step('upload-fail', async () => {
        // fetch that throws an error
        util.mock_fetch_connection_error('Should be caught')
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await process_image(mockfile, error_spy)
        mock.assertSpyCalls(error_spy, 1)

        mock.assertSpyCalls(set_result_spy, 1)
        asserts.assert(set_result_spy.calls[0]?.args[0] == null, 'Should reset result before processing')
    })
    mock.restore();

    await t.step('error-on-404', async () => {
        // fetch that throws an error
        util.mock_fetch_404()
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await process_image(mockfile, error_spy)
        mock.assertSpyCalls(error_spy, 1)
    })
    mock.restore()


    await t.step('error.invalid-response', async () => {
        //fetch that returns invalid json
        util.mock_fetch( async () => await new Response('@!#%§&') );
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await process_image(mockfile, error_spy)
        mock.assertSpyCalls(error_spy, 1)
    })
})



/* Deno.test('process_image.set-reset-result', async () => {
    const mockfile:AppFile = new AppFile(new File([], ''))
    const mockresult = {}
    mockfile.set_result(mockresult)

    const set_result_spy: mock.Stub = mock.stub(mockfile, 'set_result', mock.spy())

    util.mock_fetch( async () => await new Response('') );
    await process_image(mockfile, ()=>{})

    mock.assertSpyCalls(set_result_spy, 2)
    asserts.assert(set_result_spy.calls[0]?.args[0] == null, 'Should reset result before processing')
})

 */