import * as util            from "./util.ts";
import { mock, asserts }    from "./dep.ts";

import * as files           from "../../frontend/ts/logic/files.ts";
import * as segmentation    from "../../frontend/ts/logic/segmentation.ts";
import * as objdet          from "../../frontend/ts/logic/objectdetection.ts";


Deno.test('segmentationprocessing', async (t:Deno.TestContext) => {
    const mockfile = new File([], 'mock.jpg')
    const sfp = new segmentation.SegmentationFlaskProcessing()

    await t.step('process:success', async () => {
        util.mock_fetch( async () => await new Response(JSON.stringify({
            classmap: "banana.jpg",
        })) );

        const result:segmentation.SegmentationResult 
            = await sfp.process( mockfile )

        
        asserts.assertInstanceOf(result, files.Result)
        asserts.assertEquals(result.classmap, 'banana.jpg')
    })
    mock.restore()

    await t.step('upload-fail', async () => {
        // fetch that throws an error
        util.mock_fetch_connection_error('Should be caught')
        
        const result:segmentation.SegmentationResult 
            = await sfp.process(mockfile)
        asserts.assertEquals(result?.status, 'failed')
    })
    mock.restore()

    await t.step('error-on-404', async () => {
        // fetch that throws an error
        util.mock_fetch_404()
        
        const result:segmentation.SegmentationResult = await sfp.process(mockfile)
        asserts.assertEquals(result?.status, 'failed')
    })
    mock.restore()


    await t.step('error.invalid-response', async () => {
        //fetch that returns invalid json
        util.mock_fetch( async () => await new Response('@!#%§&') );
        
        const result:segmentation.SegmentationResult = await sfp.process(mockfile)
        asserts.assertEquals(result?.status, 'failed')
    })
    mock.restore()
})



Deno.test('objdetprocessing', async (t:Deno.TestContext) => {
    util.mock_fetch( async () => await new Response(JSON.stringify({
        boxes:    [
            [10, 10, 100, 100],
            [50, 50, 300, 300],
        ],
        labels: [ "banana", "potato" ],
    })) );

    const odp = new objdet.ObjectdetectionFlaskProcessing()
    await t.step('process:success', async () => {
        const result:objdet.ObjectdetectionResult 
            = await odp.process( new File([], 'mock.jpg') )

        
        asserts.assertInstanceOf(result, files.Result)
        asserts.assertExists(result.instances)
        asserts.assertEquals(result.instances?.length, 2)
        asserts.assertEquals(result.instances[1]?.box.x1, 300)
    })
    mock.restore()
})

