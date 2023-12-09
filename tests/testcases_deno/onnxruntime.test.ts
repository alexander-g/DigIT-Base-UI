import * as ort from "../../frontend/ts/logic/onnxruntime.ts"
import { asserts, path } from "./dep.ts";
import * as util         from "./util.ts"

const PTZIP_FILEPATH:string = path.fromFileUrl(
    import.meta.resolve('./assets/conv2d.pt.zip')
)
const TESTIMAGE_PATH:string = path.fromFileUrl(
    import.meta.resolve('./assets/test_image2.tiff')
)

Deno.test('load_pt_zip', async () => {
    const loaded: ort.PT_ZIP|Error = await ort.load_pt_zip(PTZIP_FILEPATH)
    asserts.assertNotInstanceOf(loaded, Error)
})


Deno.test('Session.initialize', async () => {
    const session: ort.Session|Error 
        = await ort.Session.initialize(PTZIP_FILEPATH)
    
    //console.log(session)
    asserts.assertNotInstanceOf(session, Error)

    
    //const result = await session.process_image_from_path(TESTIMAGE_PATH)
    //asserts.assertNotInstanceOf(result, Error)

})


Deno.test('Session.initialize-non-deno', async () => {
    util.simulate_browser()
    util.mock_fetch(
        async () => { 
            return await new Response(Deno.readFileSync(PTZIP_FILEPATH))
        }
    )

    const session: ort.Session|Error 
        = await ort.Session.initialize(PTZIP_FILEPATH)
    
    //console.log(session)
    asserts.assertNotInstanceOf(session, Error)

})


