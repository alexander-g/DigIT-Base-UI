import { DownloadButton }   from "../../frontend/ts/components/ContentMenu.tsx";
import { AppFileState }     from "../../frontend/ts/state.ts"
import { preact }           from "../../frontend/ts/dep.ts"
import * as util            from "./util.ts"
import { asserts }          from "./dep.ts";


Deno.test('DownloadButton.enable', async () => {
    const document:Document = await util.setup_jsdom();

    const file:AppFileState = new AppFileState(new File([], 'file000.jpg'))
    const dbutton = <DownloadButton file={file} />
    
    preact.render(dbutton, document.body)
    await util.wait(1)

    //should be disabled as long as no result is set
    asserts.assertEquals(document.querySelectorAll('a.download.disabled').length, 1)

    //set a dummy result
    file.set_result({})
    await util.wait(1)
    //the disabled class should be gone
    asserts.assertEquals(document.querySelectorAll('a.download.disabled').length, 0)

    //remove result again
    file.set_result(null)
    await util.wait(1)
    //the disabled class should be gone
    asserts.assertEquals(document.querySelectorAll('a.download.disabled').length, 1)
})

