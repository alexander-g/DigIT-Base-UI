import { LabelsColumn }         from "../../frontend/ts/components/FileTableRow.tsx";
import { format_instances_to_counts } from "../../frontend/ts/components/FileTableRow.tsx";
import { preact, JSX, Signal }  from "../../frontend/ts/dep.ts";
import * as util                from "./util.ts";
import { Box, Instance }        from "../../frontend/ts/logic/boxes.ts";
import { asserts, mock }              from "./dep.ts";


function LabelsColumnTest(props:{$instances:Signal<Instance[]>}): JSX.Element {
    return <LabelsColumn instances={props.$instances.value} />
}

Deno.test('LabelsColumn.basics', async () => {
    const document:Document = await util.setup_jsdom()

    const $instances: Signal<Instance[]> = new Signal([])
    preact.render(<LabelsColumnTest $instances={$instances}/>, document.body)
    await util.wait(1)

    const p:HTMLParagraphElement = document.querySelector('label.detected-labels-summary')!
    asserts.assertStrictEquals(p.innerHTML, '-')

    $instances.value = [
        {label:'banana', box:Box.from_array([10,10,50,50])},
    ]
    await util.wait(1)
    asserts.assertStringIncludes(p.innerHTML, 'banana')
})


Deno.test('format_instances_to_counts', () => {
    //null: not yet processed
    asserts.assertEquals(format_instances_to_counts(null), '')

    //empty result
    asserts.assertEquals(format_instances_to_counts([]), '-')

    const mock_instances: Instance[] = [
        {box:{x0:0, y0:0, x1:0, y1:0}, label:'banana'},
        {box:{x0:0, y0:0, x1:0, y1:0}, label:'banana'},
        {box:{x0:0, y0:0, x1:0, y1:0}, label:'potato'},
    ]
    
    asserts.assert(
        format_instances_to_counts(mock_instances), 'banana (x2), potato (x1)'
    )
})
