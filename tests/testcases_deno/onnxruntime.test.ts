import * as ort from "../../frontend/ts/logic/onnxruntime.ts"
import { asserts } from "./dep.ts";

Deno.test('Session.initialize', async () => {
    const session: ort.Session|Error = await ort.Session.initialize(
        //import.meta.resolve('./assets/add.onnx')
        import.meta.resolve('../../fx2.DELETE.onnx').replace('file://','')
    )
    console.log(session)
    asserts.assertNotInstanceOf(session, Error)

    

})

