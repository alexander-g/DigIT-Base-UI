import { asserts, path }   from "./dep.ts";
import * as imagetools     from "../../frontend/ts/logic/imagetools.ts"


const IMAGE_ASSET0_JPG_PATH = path.fromFileUrl(
    import.meta.resolve('./assets/test_image0.jpg')
)

const IMAGE_ASSET1_BIGTIFF_PATH = path.fromFileUrl(
    import.meta.resolve('./assets/bigtiff.tif')
)

const IMAGE_ASSET2_TIFF_PATH = path.fromFileUrl(
    import.meta.resolve('./assets/test_image2.tiff')
)

const IMAGE_ASSET3_PNG_PATH = path.fromFileUrl(
    import.meta.resolve('./assets/test_image1.png')
)



Deno.test("imagetools.blob_to_u8rgb", async() => {
    const jpgdata = Deno.readFileSync(IMAGE_ASSET0_JPG_PATH)
    const jpgblob = new Blob([jpgdata])
    const data    = await imagetools.blob_to_rgb( jpgblob )
    asserts.assertNotInstanceOf(data, Error, data.toString())

    asserts.assertEquals(data.width, 128)
    asserts.assertEquals(data.height, 100)
    asserts.assertEquals(data.length, 100*128*3)
})

Deno.test("imagetools.blob_to_u8rgb+resized", async() => {
    const jpgdata = Deno.readFileSync(IMAGE_ASSET0_JPG_PATH)
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

Deno.test("f32_mono_to_rgba_u8", () => {
    const f32:Float32Array = new Float32Array([1.0, 0.5, 0.1])
    const u8 = imagetools.f32_mono_to_rgba_u8(f32)
    asserts.assertEquals(u8.length, f32.length*4)
    asserts.assertEquals(
        Array.from(u8), 
        [255,255,255,255,  128,128,128,255,  26,26,26,255]
    )
})


Deno.test('is_bigtiff', async () => {
    const blob = new Blob([ Deno.readFileSync(IMAGE_ASSET1_BIGTIFF_PATH) ])
    const result = await imagetools.is_bigtiff(blob)
    asserts.assert(result)

    const blob2 = new Blob([ Deno.readFileSync(IMAGE_ASSET2_TIFF_PATH) ])
    const result2 = await imagetools.is_bigtiff(blob2)
    asserts.assertFalse(result2)
})

Deno.test('is_png', async () => {
    const blob = new Blob([ Deno.readFileSync(IMAGE_ASSET3_PNG_PATH) ])
    const result = await imagetools.is_png(blob)
    asserts.assert(result)

    const blob2 = new Blob([ Deno.readFileSync(IMAGE_ASSET2_TIFF_PATH) ])
    const result2 = await imagetools.is_png(blob2)
    asserts.assertFalse(result2)
})


Deno.test('get_jpg_size', async ()  => {
    const blob = new Blob([ Deno.readFileSync(IMAGE_ASSET0_JPG_PATH) ])
    const result = await imagetools.get_jpg_size(blob)
    asserts.assertEquals(result, {width:128, height:100})

    const blob2 = new Blob([ Deno.readFileSync(IMAGE_ASSET3_PNG_PATH) ])
    const result2 = await imagetools.get_jpg_size(blob2)
    asserts.assertInstanceOf(result2, Error)
})


Deno.test('get_png_size', async ()  => {
    const blob = new Blob([ Deno.readFileSync(IMAGE_ASSET3_PNG_PATH) ])
    const result = await imagetools.get_png_size(blob)
    asserts.assertEquals(result, {width:100, height:100})

    const blob2 = new Blob([ Deno.readFileSync(IMAGE_ASSET0_JPG_PATH) ])
    const result2 = await imagetools.get_png_size(blob2)
    asserts.assertInstanceOf(result2, Error)
})


Deno.test('get_tiff_size', async ()  => {
    const blob = new Blob([ Deno.readFileSync(IMAGE_ASSET2_TIFF_PATH) ])
    const result = await imagetools.get_tiff_size(blob)
    asserts.assertEquals(result, {width:256, height:256})

    const blob2 = new Blob([ Deno.readFileSync(IMAGE_ASSET1_BIGTIFF_PATH) ])
    const result2 = await imagetools.get_tiff_size(blob2)
    asserts.assertEquals(result2, {width:58, height:23})

    const blob3 = new Blob([ Deno.readFileSync(IMAGE_ASSET0_JPG_PATH) ])
    const result3 = await imagetools.get_tiff_size(blob3)
    asserts.assertInstanceOf(result3, Error)
})

