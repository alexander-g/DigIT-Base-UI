import * as boxeslib        from "../../frontend/ts/logic/boxes.ts";
import { asserts }          from "./dep.ts";



Deno.test('boxes.validate', () => {
    const raw0: number[][] = [
        [10, 10, 50, 50],
        [100,100,200,200],
        [130,120,100,101],  //should get sanitized
        [100,  0,110, 10],  //zero, actual bug
    ]
    const out0: boxeslib.Box[] | null = boxeslib.validate_boxes(raw0)
    asserts.assertExists(out0)
    asserts.assertEquals(out0.length, 4)
    asserts.assertEquals(out0[2]!.x0, raw0[2]![2]) //sanitize coordinates

    const out1: boxeslib.Box[] | null = boxeslib.validate_boxes([])
    //just to make sure doesnt throw
    asserts.assertExists(out1)
    asserts.assertEquals(out1.length, 0)

    asserts.assertThrows( 
        () => boxeslib.validate_boxes("banana")
    )

    asserts.assertThrows( 
        () => boxeslib.validate_boxes({})
    )
})
