import * as download            from "../../frontend/ts/logic/download.ts";
import { AppFile, Result }      from "../../frontend/ts/state.ts";
import { Box }                  from "../../frontend/ts/logic/boxes.ts";
import { asserts }              from "./dep.ts";



function create_mock_files(): AppFile[] {
    const files0:AppFile[] = [0,1,2,3,4].map(
        (i:number) => new AppFile(new File([], `banana${i}.jpg`))
    )
    files0[1]?.result?.set_instances(
        [
            {label:'banana', box: Box.from_array([  0,  0, 100,100])}, 
            {label:'banana', box: Box.from_array([200,200, 500,300])}, 
            {label:'banana', box: Box.from_array([200,200, 300,250])}
    ])
    files0[2]?.result?.set_instances(
        [{label:'banana', box: Box.from_array([200,200, 500,300])}
    ])
    return files0;
}

Deno.test('format_results_as_csv', () => {
    const files0:AppFile[] = create_mock_files()

    const csv0:string       = download.format_results_as_csv(files0)
    const lines0:string[]   = csv0.split('\n')
    //2 processed + 1 header lines
    asserts.assertEquals(lines0.length, 2+1)
    asserts.assert(lines0[0]?.startsWith('#'))
    asserts.assertMatch(lines0[1]!, /x3/)
})

Deno.test("export_result", async () => {
    const files0:AppFile[]          = create_mock_files()
    const exported_results:File[]   = download.export_results(files0);
    asserts.assertEquals(exported_results.length, 2);

    const reimported_results:(Result|null)[] 
        = await Promise.all( exported_results.map(download.import_result_from_file) )
    
    asserts.assertExists(reimported_results[0])
    asserts.assertExists(reimported_results[1])

    asserts.assertEquals(reimported_results[0], files0[1]?.result)
    asserts.assertEquals(reimported_results[1], files0[2]?.result)
});

