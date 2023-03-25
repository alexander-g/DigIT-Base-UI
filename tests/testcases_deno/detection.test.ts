// deno-lint-ignore-file no-explicit-any
import * as util            from "./util.ts";
import { mock, asserts }    from "./dep.ts";
import { process_image }    from "../../frontend/ts/logic/detection.ts";
import { AppFile, AppFileState }          from "../../frontend/ts/state.ts";


Deno.test('process_image.fail', async (t:Deno.TestContext) => {
    const mockfile:AppFile = new AppFile(new File([], ''))
    const set_result_spy: mock.Stub = mock.stub(mockfile, 'set_result', mock.spy())

    await t.step('upload-fail', async () => {
        // fetch that throws an error
        util.mock_fetch_connection_error('Should be caught')
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await process_image(mockfile, error_spy)
        mock.assertSpyCalls(error_spy, 1)

        mock.assertSpyCalls(set_result_spy, 2) //processing+failed = 2x
        asserts.assertEquals(
            set_result_spy.calls[0]?.args[0].status,
            'processing',
            //'Should mark result as processing'
        )

        asserts.assertEquals(
            set_result_spy.calls[1]?.args[0].status,
            'failed',
            //'Should mark result as processing'
        )
    })
    mock.restore();

    await t.step('error-on-404', async () => {
        // fetch that throws an error
        util.mock_fetch_404()
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await process_image(mockfile, error_spy)
        mock.assertSpyCalls(set_result_spy, 2) //processing+failed = 2x
    })
    mock.restore()


    await t.step('error.invalid-response', async () => {
        //fetch that returns invalid json
        util.mock_fetch( async () => await new Response('@!#%§&') );
        const error_spy: mock.Spy<any, [string], void> = mock.spy()
        await process_image(mockfile, error_spy)
        mock.assertSpyCalls(set_result_spy, 2) //processing+failed = 2x
    })
    mock.restore()
})



Deno.test('process_image.basic-succcess', async () => {
    const mockfile:AppFile = new AppFileState(new File([], ''))

    util.mock_fetch( async () => await new Response(JSON.stringify({
        classmap: "banana.jpg",
        boxes:    [
            [10, 10, 100, 100],
            [50, 50, 300, 300],
        ],
        labels: [ "banana", "potato" ],
    })) );
    await process_image(mockfile, ()=>{})

    asserts.assertEquals(mockfile.result.status, 'processed')
    asserts.assertExists(mockfile.result.classmap)
    asserts.assertExists(mockfile.result.instances)
    asserts.assertEquals(mockfile.result.instances.length, 2)
    asserts.assertEquals(mockfile.result.instances[1]?.label, 'potato')


    mock.restore()
    util.mock_fetch( async () => await new Response(JSON.stringify({
        classmap: "banana.jpg",
        boxes:    [
            [10, 10, 100, 100],
        ],
        labels: [ 999 ],  //numbers not allowed (TODO: should give an error)
    })) );
    await process_image(mockfile, ()=>{})
    asserts.assertEquals(mockfile.result.instances, undefined)
})
