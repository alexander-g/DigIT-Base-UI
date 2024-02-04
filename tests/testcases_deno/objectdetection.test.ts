import * as objdet from "../../frontend/ts/logic/objectdetection.ts"
import { asserts } from "./dep.ts";



const sample_onnx_output = {
    boxes: {
        dims: [3,4],
        type: 'float32',
        data: Float32Array.from([0,0,40,40,  10,10,15,15,  50,50,60,80])
    },
    scores: {
        dims: [3],
        type: 'float32',
        data: Float32Array.from([0.9, 0.5, 0.3])
    },
    classes: {
        dims: [3],
        type: 'int64',
        data: BigInt64Array.from([7, 2, 9].map(BigInt))
    }
}


Deno.test('onnx-output-validation', () => {
    const invalid0 = {}
    const should_be_null0 = objdet.validate_onnx_output(invalid0)
    asserts.assertEquals(should_be_null0, null)

    const invalid1 = {
        boxes:   sample_onnx_output.boxes,
        classes: {            //inconsistent length
            dims: [4],
            type: 'int64',
            data: BigInt64Array.from([7, 2, 9, 9].map(BigInt))
        },
        scores:  sample_onnx_output.scores,
    }
    const should_be_null1 = objdet.validate_onnx_output(invalid1)
    asserts.assertEquals(should_be_null1, null)


    const valid = sample_onnx_output;
    const onnx_output = objdet.validate_onnx_output(valid)
    asserts.assertExists(onnx_output)
    //asserts.assertEquals(onnx_output, valid)

    const instances = objdet.onnx_output_to_instances(onnx_output)
    asserts.assertEquals(instances.length, 3)
})

