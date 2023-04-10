// deno-lint-ignore-file no-explicit-any
import * as util            from "./util.ts";
import { mock, asserts }    from "./dep.ts";
import { process_image }    from "../../frontend/ts/logic/detection.ts";
import { InputFile, InputFileState, Result }  from "../../frontend/ts/state.ts";


Deno.test('process_image.fail', async (t:Deno.TestContext) => {
    const mockfile:InputFile = new InputFile(new File([], ''))

    await t.step('upload-fail', async () => {
        // fetch that throws an error
        util.mock_fetch_connection_error('Should be caught')
        //const error_spy: mock.Spy<any, [string], void> = mock.spy()
        const result:Result|undefined = await process_image(mockfile)
        asserts.assertEquals(result?.status, 'failed')
        //mock.assertSpyCalls(error_spy, 1)

        //mock.assertSpyCalls(set_result_spy, 2) //processing+failed = 2x
        /*asserts.assertEquals(
            set_result_spy.calls[0]?.args[0].status,
            'processing',
            //'Should mark result as processing'
        )*/

        /*asserts.assertEquals(
            set_result_spy.calls[1]?.args[0].status,
            'failed',
            //'Should mark result as processing'
        )*/
    })
    mock.restore();

    await t.step('error-on-404', async () => {
        // fetch that throws an error
        util.mock_fetch_404()
        //const error_spy: mock.Spy<any, [string], void> = mock.spy()
        const result: Result|undefined = await process_image(mockfile)
        asserts.assertEquals(result?.status, 'failed')
        //mock.assertSpyCalls(set_result_spy, 2) //processing+failed = 2x

    })
    mock.restore()


    await t.step('error.invalid-response', async () => {
        //fetch that returns invalid json
        util.mock_fetch( async () => await new Response('@!#%§&') );
        //const error_spy: mock.Spy<any, [string], void> = mock.spy()
        const result: Result|undefined = await process_image(mockfile)
        asserts.assertEquals(result?.status, 'failed')
        //mock.assertSpyCalls(set_result_spy, 2) //processing+failed = 2x
    })
    mock.restore()
})



Deno.test('process_image.basic-succcess', async () => {
    const mockfile:InputFile = new InputFileState(new File([], ''))

    util.mock_fetch( async () => await new Response(JSON.stringify({
        classmap: "banana.jpg",
        boxes:    [
            [10, 10, 100, 100],
            [50, 50, 300, 300],
        ],
        labels: [ "banana", "potato" ],
    })) );
    const result:Result|undefined = await process_image(mockfile, ()=>{})

    asserts.assertExists(result)
    asserts.assertEquals(result.status, 'processed')
    asserts.assertExists(result.classmap)
    asserts.assertExists(result.instances)
    asserts.assertEquals(result.instances.length, 2)
    asserts.assertEquals(result.instances[1]?.label, 'potato')


    mock.restore()
    util.mock_fetch( async () => await new Response(JSON.stringify({
        classmap: "banana.jpg",
        boxes:    [
            [10, 10, 100, 100],
        ],
        labels: [ 999 ],  //numbers not allowed (TODO: should give an error)
    })) );
    const result2:Result|undefined = await process_image(mockfile, ()=>{})
    asserts.assertExists(result2)
    asserts.assertEquals(result2.instances, undefined)
})



//TODO: process_files (multiple) + assert number of results and inputs is the same