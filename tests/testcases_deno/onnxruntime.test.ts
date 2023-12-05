import * as ort from "../../frontend/ts/logic/onnxruntime.ts"
import { asserts, path } from "./dep.ts";
import * as util         from "./util.ts"

const ONNX_FILEPATH:string = path.fromFileUrl(
    import.meta.resolve('./assets/conv2d.onnx')
)

Deno.test('Session.initialize', async () => {
    const session: ort.Session|Error = await ort.Session.initialize(
        ONNX_FILEPATH
    )
    console.log(session)
    asserts.assertNotInstanceOf(session, Error)

    

})


Deno.test('Session.non-deno', async () => {
    util.simulate_browser()
    util.mock_fetch(
        async () => { 
            return await new Response(Deno.readFileSync(ONNX_FILEPATH))
        }
    )

    const session: ort.Session|Error = await ort.Session.initialize(
        ONNX_FILEPATH
    )
    console.log(session)
    asserts.assertNotInstanceOf(session, Error)

    

})


