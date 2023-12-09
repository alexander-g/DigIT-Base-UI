import { asserts, path }   from "./dep.ts";
import * as imagetools     from "../../frontend/ts/logic/imagetools.ts"


const IMAGE_ASSET0_PATH = path.fromFileUrl(
    import.meta.resolve('./assets/test_image0.jpg')
)

Deno.test("imagetools.blob_to_u8rgb", async() => {
    const jpgdata = Deno.readFileSync(IMAGE_ASSET0_PATH)
    const jpgblob = new Blob([jpgdata])
    const data    = await imagetools.blob_to_rgb( jpgblob )
    asserts.assertNotInstanceOf(data, Error)

    asserts.assertEquals(data.width, 128)
    asserts.assertEquals(data.height, 100)
    asserts.assertEquals(data.length, 100*128*3)
})

Deno.test("imagetools.blob_to_u8rgb+resized", async() => {
    const jpgdata = Deno.readFileSync(IMAGE_ASSET0_PATH)
    const jpgblob = new Blob([jpgdata])
    const size    = { 
        width: Math.floor(Math.random()*64+128), 
        height:Math.floor(Math.random()*64+128) 
    }
    const data    = await imagetools.blob_to_rgb( jpgblob, size )
    asserts.assertNotInstanceOf(data, Error)

    const n = size.width*size.height*3;
    asserts.assert(data.length == n)
    asserts.assert(data[0] == 0)
    asserts.assert(data[1] == 193)
    asserts.assert(data[2] == 60)
    asserts.assert(data[3] == 0)

    //last pixel
    asserts.assert(data[n-3] == 0)
    asserts.assert(data[n-2] == 193)
    asserts.assert(data[n-1] == 60)
})


Deno.test("imagetools.load-invalid", async() => {
    const blob = new Blob(['banana'])
    const data    = await imagetools.blob_to_rgb( blob )
    asserts.assertInstanceOf(data, Error)
})
