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

Deno.test('normalize_vector', () => {
    const v0:util.Vector = {x:50, y:20}
    const n0:util.Vector = util.normalize_vector(v0)
    asserts.assertAlmostEquals(n0.x, 0.9284768, 1e-5)
    asserts.assertAlmostEquals(n0.y, 0.3713907, 1e-5)

    asserts.assertAlmostEquals(util.vector_length(n0), 1.0)
})

Deno.test('orthogonal_vector', () => {
    const v0:util.Vector = {x:50, y:20}
    const o0:util.Vector = util.orthogonal_vector(v0)
    asserts.assertEquals(o0.x, 20)
    asserts.assertEquals(o0.y, -50)
})

Deno.test('direction_vector', () => {
    const n0:util.Vector = {x:50, y:20}
    const n1:util.Vector = {x:40, y:70}
    const d0:util.Vector = util.direction_vector(n0, n1)
    asserts.assertEquals(d0.x, -10)
    asserts.assertEquals(d0.y, 50)
})

