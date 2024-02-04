import { ORT_Processing } from "../../frontend/ts/logic/ort_processing.ts";
import { ObjectdetectionResult } from "../../frontend/ts/logic/objectdetection.ts";

import { asserts, path } from "./dep.ts";


const PTZIP_FILEPATH:string = path.fromFileUrl(
    import.meta.resolve('./assets/frcnnmock.inference.pt.zip')
)
const TESTIMAGE_PATH:string = path.fromFileUrl(
    import.meta.resolve('./assets/test_image0.jpg')
)




Deno.test('ONNX_backend_basic_inference', async () => {
    await 0;
    const backend = new ORT_Processing<ObjectdetectionResult>(
        ObjectdetectionResult, {active_models: {detection:PTZIP_FILEPATH}}
    )
    const imagedata: Uint8Array = Deno.readFileSync(TESTIMAGE_PATH)
    const imagefile             = new File([imagedata], 'image0.jpg')
    const result = await backend.process(imagefile)
    
    asserts.assertEquals(result.status, 'processed')
    
    //the mock model returns a box the size of the image
    asserts.assertEquals(
        result.instances![0]?.box,
        {x0:0, y0:0, x1:128, y1:100}
    )

})

