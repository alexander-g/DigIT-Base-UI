import { FileTable }        from "../../frontend/ts/components/FileTable.tsx"
import { Result, ProcessingModule }    from "../../frontend/ts/logic/files.ts"
import { 
    InputFileList, 
    input_result_signal_pairs_from_inputs 
}    from "../../frontend/ts/components/state.ts";
import * as util            from "./util.ts"
import { asserts, mock }    from "./dep.ts"
import { preact, signals }  from "../../frontend/ts/dep.ts"


class DummyProcessingModule extends ProcessingModule<File, Result> {
    async process(input: File): Promise<Result> {
        return new Result()
    }
}

Deno.test('FileTable.basic', async (t:Deno.TestContext) => {
    const document:Document = await util.setup_jsdom()
    util.mock_fomantic()

    const $files: InputFileList<File, Result> = new InputFileList([])
    const processing         = new signals.Signal(false)
    const table_ref:preact.RefObject<FileTable<File, Result>> = preact.createRef()

    await util.wait(1)

    await t.step('empty', async () => {
        preact.render(
            <FileTable 
                $files          =   {$files}
                sortable        =   {false} 
                $processing     =   {processing}
                processingmodule =  {new DummyProcessingModule()}
                ref             =   {table_ref}
            />,
            document.body
        )
        
        await util.wait(1)
        asserts.assertEquals(document.querySelectorAll('table tbody tr').length, 0)
    })

    //removing Readonly from the signal for testing
    const $active_file:signals.Signal|null|undefined = table_ref.current?.$active_file;
    asserts.assertExists($active_file)
    $active_file.value = 'somefile.jpg'

    const active_file_spy: mock.Spy = mock.spy()
    $active_file.subscribe(active_file_spy)
    //calls already on subscription
    mock.assertSpyCalls(active_file_spy, 1)
    

    await t.step('non-empty', async () => {
        const files0:File[] = [
            new File([], 'file000.jpg'),
            new File([], 'file001.jpg'),
        ]
        $files.value = input_result_signal_pairs_from_inputs(files0, Result)

        await util.wait(1)
        const P: HTMLTableRowElement[] 
            = Array.from(document.querySelectorAll('table tr.table-row') ?? [])
        asserts.assertEquals( P.length, files0.length )
        //active file should be reset when the input files change
        mock.assertSpyCalls(active_file_spy, 2)
        mock.assertSpyCallArg(active_file_spy, 1, 0, null)
    })

    await t.step('bold-with-result', async () => {
        const P: HTMLTableRowElement[] 
            = Array.from(document.querySelectorAll('table tr.table-row') ?? [])
        const p2: HTMLTableRowElement  = P[1]!
        asserts.assertEquals(p2.style.fontWeight, 'normal')

        $files.peek()[1]!.$result.value = (new Result('processed'))
        await util.wait(1)

        asserts.assertEquals(p2.style.fontWeight, 'bold')
    })
})




// Deno.test('FileTableBody.no-scrolling-on-dead-rows', async () => {
//     const document:Document   = await util.setup_jsdom()
//     util.mock_fomantic()
//     const scrollspy: mock.Spy = mock.spy( )
//     // mocking window.scrollTo, still not sure how it works
//     // deno-lint-ignore no-explicit-any
//     window.scrollTo = mock.stub(document.documentElement, 'scrollTo', scrollspy) as any;

    
//     const files       = new InputFileList([])
//     const files0:File[] = [
//         new File([], 'banana.jpg'),
//         new File([], 'potato.jpg'),
//     ]
//     files.set_from_files(files0);

//     const active_file = new signals.Signal('notbanana.jpg')
//     preact.render(
//         <FileTableBody files={files} active_file={active_file} labels_column={false}/>, 
//         document.body
//     )
//     await util.wait(1)
    
//     //set active file, should isse a scrollTo command
//     active_file.value = 'banana.jpg'
//     await util.wait(20) //long sleep needed
//     mock.assertSpyCalls(scrollspy, 1)
    
//     active_file.value = 'notbanana.jpg'
//     files.set_from_files([]);
//     await util.wait(1)

//     //set new files (partially the same as before)
//     files.set_from_files(files0.slice(0,1));
//     await util.wait(1)

//     //set again the same active file, scrollTo() should be called only once! (actual bug)
//     active_file.value = 'banana.jpg'
//     await util.wait(20) //long sleep needed
//     mock.assertSpyCalls(scrollspy, 2)
// })
