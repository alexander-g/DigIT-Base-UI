import * as zip         from "../../frontend/ts/logic/zip.ts";
import { asserts }      from "./dep.ts";


Deno.test("zip_files", async () => {
  // Create some sample data to pass to the function
  const file1 = new File(["file1 contents"], "file1.txt");
  const file2 = new File(["file2 contents"], "dir/file2.txt");
  const data = {
    "file1.txt": file1,
    "dir/file2.txt": file2,
  };

  // Call the function
  const ziparchive:File|Error = await zip.zip_files(data, "archive.zip");

  // Assert that the result is a Uint8Array with non-zero length
  asserts.assert(ziparchive instanceof File);
  asserts.assert( new Uint8Array(await ziparchive.arrayBuffer()).length > 0);

  //unzip

  //invalid file should return error and not throw it
  const error: zip.Files|Error = await zip.unzip(new File([], ''))
  asserts.assert(error instanceof Error)

  //the previously zipped files should be there
  const unzipped: zip.Files|Error = await zip.unzip(ziparchive)
  asserts.assertFalse(unzipped instanceof Error)
  //type guard
  if(unzipped instanceof Error)
    throw unzipped;

  asserts.assertEquals(Object.values(unzipped).length, Object.values(data).length)
  asserts.assertArrayIncludes(Object.keys(unzipped), Object.keys(data))
  asserts.assertEquals(await unzipped['file1.txt']!.text(), await file1.text())
});


