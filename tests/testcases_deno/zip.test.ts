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
  const compressed_data:Uint8Array = await zip_files(data);

  // Assert that the result is a Uint8Array with non-zero length
  asserts.assert(compressed_data instanceof Uint8Array);
  asserts.assert(compressed_data.length > 0);
});


