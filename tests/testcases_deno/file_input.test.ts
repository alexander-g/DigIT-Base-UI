import * as file_input          from "../../frontend/ts/components/file_input.ts"
import { Result, InputFile }    from "../../frontend/ts/logic/files.ts"
import { asserts, path, mock }  from "./dep.ts"

const IMAGE_ASSET1_PATH: string 
    = path.fromFileUrl(import.meta.resolve('./assets/test_image2.tiff'))

Deno.test("imagetools.load_tiff", async () => {
    const tiffdata: Uint8Array          = Deno.readFileSync(IMAGE_ASSET1_PATH)
    const tifffile                      = new File([tiffdata], 'image1.tiff')
    const decoded_data:ImageData|null   = await file_input.load_tiff_file(tifffile)
    asserts.assertExists(decoded_data)

    const rgba: Uint8ClampedArray = decoded_data.data

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


//TODO: test that files are reset
Deno.test('categorize_files', async () => {
    const mock_files: File[] = [
        new File([""], "input.jpg",  { type: "image/jpeg" }),
        new File([""], "result.zip", { type: "application/zip" }),
        new File([""], "input.tiff", { type: "image/tiff" }),
        new File([""], "jpg_without_jpg",  { type: "image/jpeg" }),
    ];

    const categorized_files = await file_input.categorize_files(
        mock_files, InputFile,
    );

    asserts.assertEquals(
        categorized_files.inputs.map( i => i.name ), 
        [mock_files[0], mock_files[2], mock_files[3]].map( f => f!.name ),
    )
    asserts.assertEquals(categorized_files.resultfiles, [mock_files[1]])
})



Deno.test('load_list_of_files', async () => {
    const files: File[] = [
        new File([], "input1.jpg"),
        new File([], "input2.tiff"),
        new File([], "input3.tiff"),
        new File([], "input3.zip"),
        new File([], "input4.zip"),
    ];
    const pairs = await file_input.load_list_of_files(files, InputFile, Result)
    // only the jpg & tiff files = 3
    asserts.assertEquals(Object.keys(pairs).length, 3)


    const validate_spy: mock.Spy = mock.spy( () => null )
    class MockResultClass extends Result {
        static validate = validate_spy as <T extends Result>() => Promise<T|null>
    }
    await file_input.load_list_of_files(files, InputFile, MockResultClass)
    // 3 input files x 2 remaining files = 6
    asserts.assertEquals(validate_spy.calls.length, 6)
    //should pass {input:..., file:...} as an input
    asserts.assertArrayIncludes(
        Object.keys(validate_spy.calls[0]?.args[0]), ['input', 'file']
    )

    //only input files, no result files
    const files2 = [files[0]!]
    const pairs2 = await file_input.load_list_of_files(files2, InputFile, Result)
    asserts.assertEquals(Object.keys(pairs2).length, files2.length)

    //only result files, no new input files but previous inputs
    const files3 = [files[3]!, files[4]!]
    const pairs3 = await file_input.load_list_of_files(
        files3, InputFile, Result, pairs2
    )
    //should keep the previous inputs
    asserts.assertEquals(Object.keys(pairs3).length, pairs2.length)
    asserts.assertEquals(pairs3[0]?.input, pairs2[0]?.input)
})
