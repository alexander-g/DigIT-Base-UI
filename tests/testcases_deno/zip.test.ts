import { zip_files }    from "../../frontend/ts/logic/zip.ts";
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
  const ziparchive:File|Error = await zip_files(data, "archive.zip");

  // Assert that the result is a Uint8Array with non-zero length
  asserts.assert(ziparchive instanceof File);
  asserts.assert( new Uint8Array(await ziparchive.arrayBuffer()).length > 0);
});


