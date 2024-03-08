import * as image_j from "../../frontend/ts/logic/image_j.ts"
import { asserts }  from "./dep.ts"
import { path }     from "./dep.ts"



Deno.test('minmax-points', () => {
    const points = [
        {x:50, y:60},
        {x:10, y:10},
        {x:100, y:5},
        {x:150, y:25},
    ]
    const max_p = image_j.points_max(points)
    const min_p = image_j.points_min(points)

    asserts.assertEquals(max_p, {x:150, y:60})
    asserts.assertEquals(min_p, {x:10,  y:5})
})


Deno.test('utf16', () => {
    const encoded:ArrayBuffer = image_j.encode_utf16be('banana香蕉')
    const asnumbers:number[]  = [...new Uint8Array(encoded)]
    asserts.assertEquals(
        asnumbers, 
        [ 0, 98, 0, 97, 0, 110, 0, 97, 0, 110, 0, 97, 153, 153, 133, 73]
    )
})


const ROI_TESTFILE = path.fromFileUrl(
    import.meta.resolve('./assets/roitest.roi')
)

Deno.test('roi.export', () => {
    const p = [
        {x:10, y:20}, {x:10, y:50}, {x:50, y:50}, {x:80, y:60}, {x:80, y:90}
    ]
    const roi = image_j.RoI.freeline_from_points(p, 'banana');
    const bytes = new Uint8Array(roi.tobytes())
    const expected = Deno.readFileSync(ROI_TESTFILE)

    asserts.assertEquals(bytes.byteLength, expected.byteLength)
    asserts.assertEquals([...bytes], [...expected])
})
