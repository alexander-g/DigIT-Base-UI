import { remove_file_extension }    from "../../frontend/ts/util.ts";
import { file_basename }            from "../../frontend/ts/util.ts";
import * as util                    from "../../frontend/ts/util.ts";
import { asserts }                  from "./dep.ts";

Deno.test("remove_file_extension", () => {
    // Test the function with various file names
    asserts.assertEquals(remove_file_extension("example.txt"), "example");
    asserts.assertEquals(remove_file_extension("banana.nana.nananana.txt"), "banana.nana.nananana");
    asserts.assertEquals(remove_file_extension("no_extension"), "no_extension");
    //asserts.assertEquals(remove_file_extension(".hidden_file"), ".hidden_file");
    asserts.assertEquals(
        remove_file_extension("path/to/file.with.dots.txt"), "path/to/file.with.dots"
    );
});

Deno.test("file_basename", () => {
    asserts.assertEquals(file_basename("/path/to/file.txt"), "file.txt");
    asserts.assertEquals(file_basename("/another/path/to/image.jpeg"), "image.jpeg");
    asserts.assertEquals(file_basename("directory/"), "");
    asserts.assertEquals(file_basename(""), "");
});



Deno.test("is_array_of_type ", () => {
    const input3: unknown = "not an array";
    const result3:boolean = util.is_array_of_type(input3, util.validate_string);
    asserts.assertEquals(result3, false);


});


Deno.test('is_object', () => {
    asserts.assertFalse( util.is_object(5), 'a number is not a object' )
    asserts.assertFalse( util.is_object('a string is not an object') )
    asserts.assertFalse( util.is_object(['an array is not an object']) )
    asserts.assert(      util.is_object({'an object':'is an object'}) )
})
