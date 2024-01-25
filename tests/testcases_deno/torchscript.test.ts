import * as ts from "../../frontend/ts/logic/backends/torchscript.ts";
import * as common from "../../frontend/ts/logic/backends/common.ts";
import * as zip    from "../../frontend/ts/logic/zip.ts";
import { asserts, path } from "./dep.ts"


Deno.test('pack-unpack', async () =>{
    const t0 = common.create_tensor(
        new Float32Array([1.0, 5.0, 10.0, 25.0]),
        'float32',
        [1,1,2,2],
    )
    const t1 = common.create_tensor(
        null,
        'uint8',
        [2,3,4,1],
    )
    asserts.assertNotInstanceOf(t0, Error)
    asserts.assertNotInstanceOf(t1, Error)

    const tdict:common.TensorDict = {
        't0': t0,
        't1': t1,
    }


    const packed = await ts.pack_tensordict(tdict)
    asserts.assertNotInstanceOf(packed, Error)

    const unzipped = await zip.unzip(packed)
    asserts.assertNotInstanceOf(unzipped, Error)

    const unpacked 
        = await common.unpack_tensordict_from_zip_contents(unzipped);
    asserts.assertNotInstanceOf(unpacked, Error)
})



const LIB_PATH:string = path.fromFileUrl(
    import.meta.resolve('../../assets/libTSinterface.so')
)

const TS_TEST_MODULE_PATH:string = path.fromFileUrl(
    import.meta.resolve('./assets/conv2d.torchscript')
)


Deno.test('ffi.error-no-permissions', {permissions:{ffi:false}}, async () => {
    await 0;
    const lib = ts.initialize_ffi(LIB_PATH)
    asserts.assertInstanceOf(
        lib, Error, "FFI initialization should not succeed without --allow-ffi"
    );
    asserts.assertStringIncludes(
        lib.toString(), 
        '--allow-ffi', 
        "Initialization error should give a hint how to enable ffi"
    )
})


Deno.test(
    'ffi', 
    {
        permissions:{ffi:true, read:'inherit'}, 
        //A textdecoder gets closed and I don't know why. Might be a Deno bug.
        sanitizeResources: false
    }, 
    async () => {
    
    const lib = ts.initialize_ffi(LIB_PATH)
    asserts.assertNotInstanceOf(lib, Error, lib.toString());

    const invalid_bytes = new Uint8Array(8)
    const status:number = 
        lib.symbols.initialize_module(invalid_bytes, invalid_bytes.length)
    asserts.assertNotEquals(
        status, 0, "Initialization of an invalid module should fail"
    )
    
    const status2:true|Error = ts.initialize_module(TS_TEST_MODULE_PATH, lib)
    asserts.assertNotInstanceOf(status2, Error, 'Module initialization failed')

    const x_u8 = common.create_tensor(null, 'uint8', [1,3,64,64])
    asserts.assertNotInstanceOf(x_u8, Error)
    const output:common.TensorDict|Error = await ts.run_module({x:x_u8}, lib)
    asserts.assertInstanceOf(
        output, Error, 'Module call with invalid dtype should not succeed'
    )

    const x_f32 = common.create_tensor(null, 'float32', [1,3,64,64])
    asserts.assertNotInstanceOf(x_f32, Error)
    const output2:common.TensorDict|Error = await ts.run_module({x:x_f32}, lib)
    // //console.log(output2)
    asserts.assertNotInstanceOf(output2, Error, 'Module call failed')

    const y:common.AnyTensor|undefined = output2['y'];
    asserts.assertExists(y)
    asserts.assertEquals(y.dtype, 'float32')
    asserts.assertEquals(y.shape, [1,1,64,64])
    asserts.assertEquals(y.data.length, 1*1*64*64)

    lib.close()
})
