import * as file_input from "../../frontend/ts/file_input.ts"
import { asserts, path } from "./dep.ts"

const IMAGE_ASSET1_PATH: string 
    = path.fromFileUrl(import.meta.resolve('../testcases/assets/test_image2.tiff'))

Deno.test("imagetools.load_tiff", async () => {
    const tiffdata: Uint8Array          = Deno.readFileSync(IMAGE_ASSET1_PATH)
    const tifffile                      = new File([tiffdata], 'image1.tiff')
    const decoded_data:ImageData|null   = await file_input.load_tiff_file(tifffile)
    asserts.assertExists(decoded_data)

    const rgba: Uint8ClampedArray = decoded_data.data

    console.log(rgba.slice(0,4*16))

    const n = 256*256*4;
    asserts.assertEquals(rgba.length, n)
    asserts.assertEquals(rgba[0], 0)
    asserts.assertEquals(rgba[1], 201)
    asserts.assertEquals(rgba[2], 11)
    asserts.assertEquals(rgba[3], 255)

    //last pixel
    asserts.assertEquals(rgba[n-4], 148)
    asserts.assertEquals(rgba[n-3], 0)
    asserts.assertEquals(rgba[n-2], 87)
    asserts.assertEquals(rgba[n-1], 255) 
})


