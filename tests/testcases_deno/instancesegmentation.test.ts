import * as instseg from "../../frontend/ts/logic/instancesegmentation.ts"
import * as files   from "../../frontend/ts/logic/files.ts"

import { asserts }  from "./dep.ts"



Deno.test("result.export-import" , async (t:Deno.TestContext) => {
    const inputfilename = 'inputfilename.jpg'
    const result0 = new instseg.InstanceSegmentationResult(
        'processed',
        null,
        inputfilename,
        new File([], 'classmap.png'),
        new File([], 'instancemap.png'),
    )

    const exported = await result0.export()
    asserts.assertExists(exported)

    asserts.assertArrayIncludes(Object.keys(exported), ['instancemap.png'])
    
    const zipfile = await files.combine_exports(exported, result0.inputname!)
    asserts.assertNotInstanceOf(zipfile, Error)

    // await t.step('basic_zip', async() =>{
    //     const result1 = await instseg.InstanceSegmentationResult.validate(zipfile)
    //     asserts.assertExists(result1)
    //     asserts.assertEquals(result1.status, 'processed')
    // })

    await t.step('on_drop', async() =>{
        const input = {name: inputfilename}
        const result2 = await instseg.InstanceSegmentationResult.validate({input, file:zipfile})
        asserts.assertExists(result2)
        asserts.assertEquals(result2.status, 'processed')
    })
    
})

