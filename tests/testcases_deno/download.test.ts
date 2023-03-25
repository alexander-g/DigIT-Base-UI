import * as download            from "../../frontend/ts/logic/download.ts";
import { AppFile, Result }      from "../../frontend/ts/state.ts";
import { asserts }              from "./dep.ts";



function create_mock_files(): AppFile[] {
    const files0:AppFile[] = [0,1,2,3,4].map(
        (i:number) => new AppFile(new File([], `banana${i}.jpg`))
    )
    files0[1]?.result?.set_instances(
        [{label:'banana'}, {label:'banana'}, {label:'banana'}
    ] as any)
    files0[2]?.result?.set_instances(
        [{label:'banana'}
    ] as any)
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

Deno.test("export_result", () => {
    const files0:AppFile[]          = create_mock_files()
    const exported_results:File[]   = download.export_results(files0);
    asserts.assertEquals(exported_results.length, 2);
});

