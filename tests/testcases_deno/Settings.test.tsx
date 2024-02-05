import { BaseSettingsModal }    from "../../frontend/ts/components/Settings.tsx";
import * as settings        from "../../frontend/ts/logic/settings.ts";

import { preact, signals }  from "../../frontend/ts/dep.ts"
import * as util            from "./util.ts"
import { asserts, mock }    from "./dep.ts";




class MockSettingsHandler extends settings.SettingsHandler {
    async load(): Promise<Error | settings.SettingsResponse> {
        return await new Error()
    }

    async store(settings: settings.Settings): Promise<true | Error> {
        return await true;
    }
}


Deno.test('SettingsModal', async () => {
    const document:Document = await util.setup_jsdom()
    util.mock_jQ({
        dropdown:(x:string)=>{
            if(x == 'get value')
                return 1;
        },
        toast:   ()=>{},
    })

    const handler = {
        load:  mock.spy( () => ({settings:{}}) ),
        store: mock.spy(),
    }
    const ref: preact.RefObject<BaseSettingsModal> = preact.createRef()
    const $settings = new signals.Signal(undefined)
    const $avmodels = new signals.Signal({
        detection: [{name:"potatomodel"}, {name:"bananamodel"}]
    })
    preact.render(
        <BaseSettingsModal 
            $settings         = {$settings} 
            $available_models = {$avmodels} 
            settingshandler   = {handler as any}
            ref               = {ref}
        />,
        document.body
    )
    await util.wait(1)

    const load_calls_before_save = handler.load.calls.length;
    const store_calls_before_save = handler.store.calls.length;
    const status:true|Error = await ref.current!.save_settings()
    asserts.assertNotInstanceOf(status, Error, `${status}`)

    asserts.assertEquals(handler.store.calls.length, store_calls_before_save+1)
    //reload after save, actual bug:
    asserts.assertEquals(handler.load.calls.length,  load_calls_before_save+1)
})




