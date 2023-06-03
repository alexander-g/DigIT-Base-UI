import { LabelsColumn }         from "../../frontend/ts/components/FileTableRow.tsx";
import { preact, JSX, Signal }  from "../../frontend/ts/dep.ts";
import * as util                from "./util.ts";
import { Box, Instance }        from "../../frontend/ts/logic/boxes.ts";
import { asserts }              from "./dep.ts";


function LabelsColumnTest(props:{$instances:Signal<Instance[]>}): JSX.Element {
    return <LabelsColumn instances={props.$instances.value} />
}

Deno.test('LabelsColumn.basics', async () => {
    const document:Document = await util.setup_jsdom()

    const $instances: Signal<Instance[]> = new Signal([])
    preact.render(<LabelsColumnTest $instances={$instances}/>, document.body)
    await util.wait(1)

    const p:HTMLParagraphElement = document.querySelector('label.detected-labels-summary')!
    asserts.assertStrictEquals(p.innerHTML, '')

    $instances.value = [
        {label:'banana', box:Box.from_array([10,10,50,50])},
    ]
    await util.wait(1)
    asserts.assertStringIncludes(p.innerHTML, 'banana')
})
