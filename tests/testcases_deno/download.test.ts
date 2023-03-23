import * as download            from "../../frontend/ts/logic/download.ts";
import { AppFile, Result }      from "../../frontend/ts/state.ts";
import { asserts }              from "./dep.ts";


// Deno.test('download_single', () => {
//     const f0:AppFile = new AppFile(new File([], 'banana.jpg'))
//     download.download_single_file(f0)
// })


Deno.test('format_results_as_csv', () => {
    const files0:AppFile[] = [0,1,2,3,4].map(
        (i:number) => new AppFile(new File([], `banana${i}.jpg`))
    )
    files0[1]?.result?.set_instances(
        [{label:'banana'}, {label:'banana'}, {label:'banana'}
    ] as any)
    files0[2]?.result?.set_instances(
        [{label:'banana'}
    ] as any)

    const csv0:string       = download.format_results_as_csv(files0)
    const lines0:string[]   = csv0.split('\n')
    //2 processed + 1 header lines
    asserts.assertEquals(lines0.length, 2+1)
    asserts.assert(lines0[0]?.startsWith('#'))
    asserts.assertMatch(lines0[1]!, /x3/)
})
