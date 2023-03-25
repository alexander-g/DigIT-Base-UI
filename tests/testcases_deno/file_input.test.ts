import * as file_input          from "../../frontend/ts/file_input.ts"
import { asserts, path, mock }  from "./dep.ts"

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
Deno.test('load_list_of_files', () => {
    const mock_files: File[] = [
        new File([""], "input.jpg",  { type: "image/jpeg" }),
        new File([""], "result.zip", { type: "application/zip" }),
        new File([""], "input.tiff", { type: "image/tiff" }),
        new File([""], "jpg_without_jpg",  { type: "image/jpeg" }),
    ];

    const set_inputfiles_mock: mock.Spy     = mock.spy()
    const set_resultfiles_mock: mock.Spy    = mock.spy()

    file_input.load_list_of_files(
        mock_files,
        ["image/jpeg", "image/tiff"],
        set_inputfiles_mock,
        set_resultfiles_mock,
    );

    mock.assertSpyCalls(set_inputfiles_mock,  1)
    mock.assertSpyCallArg(set_inputfiles_mock, 0, 0, [mock_files[0], mock_files[2], mock_files[3]])

    mock.assertSpyCalls(set_resultfiles_mock, 1)
    mock.assertSpyCallArg(set_resultfiles_mock, 0, 0, [mock_files[1]])
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
    const collected: Record<string, File[]> 
        = file_input.collect_result_files(result_files, input_files);

    // Check that the function returns the correct output
    asserts.assertEquals(collected['input1.jpg']?.length, 2);
    asserts.assertEquals(collected['input1.jpg']?.[0], result_files[0]);
    asserts.assertEquals(collected['input1.jpg']?.[1], result_files[1]);
    asserts.assertEquals(collected['input2.tiff']?.length, 1);
    asserts.assertEquals(collected['input2.tiff']?.[0]?.name, "input2.json");
    asserts.assertEquals(collected['input3.tiff'], undefined);
});