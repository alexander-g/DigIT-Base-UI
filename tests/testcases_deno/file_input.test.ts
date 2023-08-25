import * as file_input          from "../../frontend/ts/components/file_input.ts"
import { Result, InputFile }    from "../../frontend/ts/logic/files.ts"
import { asserts, path }        from "./dep.ts"

const IMAGE_ASSET1_PATH: string 
    = path.fromFileUrl(import.meta.resolve('../testcases/assets/test_image2.tiff'))

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
Deno.test('categorize_files', () => {
    const mock_files: File[] = [
        new File([""], "input.jpg",  { type: "image/jpeg" }),
        new File([""], "result.zip", { type: "application/zip" }),
        new File([""], "input.tiff", { type: "image/tiff" }),
        new File([""], "jpg_without_jpg",  { type: "image/jpeg" }),
    ];

    const categorized_files = file_input.categorize_files(
        mock_files, InputFile,
    );

    asserts.assertEquals(
        categorized_files.inputfiles.map( i => i.name ), 
        [mock_files[0], mock_files[2], mock_files[3]].map( f => f!.name ),
    )
    asserts.assertEquals(categorized_files.resultfiles, [mock_files[1]])
})


Deno.test("collect_result_files filters result files for input files", () => {
    // Define some input and result files
    const input_files: File[] = [
        new File([], "input1.jpg"),
        new File([], "input2.tiff"),
        new File([], "input3.tiff"),
    ];
    const result_files: File[] = [
        new File([], "input1.json"),
        new File([], "input1.jpg.result.json"),
        new File([], "input2.jpg"),
        new File([], "input2.json"),
        new File([], "input4.jpg"),
    ];

    // Call the function being tested
    const collected 
        = file_input.collect_result_files(input_files, result_files);

    // Check that the function returns the correct output
    asserts.assertEquals(collected['input1.jpg']?.resultfiles.length, 2);
    asserts.assertEquals(collected['input1.jpg']?.resultfiles[0], result_files[0]);
    asserts.assertEquals(collected['input1.jpg']?.resultfiles[1], result_files[1]);
    asserts.assertEquals(collected['input2.tiff']?.resultfiles.length, 1);
    asserts.assertEquals(collected['input2.tiff']?.resultfiles[0]?.name, "input2.json");
    asserts.assertEquals(collected['input3.tiff'], undefined);
});


Deno.test('load_result_files', async () => {
    const files: File[] = [
        new File([], "input1.jpg"),
        new File([], "input2.tiff"),
        new File([], "input3.tiff"),
    ];
    //just dont throw
    await file_input.load_list_of_files(files, InputFile, Result)
})
