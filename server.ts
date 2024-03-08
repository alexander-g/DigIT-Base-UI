#!./deno.sh run --no-prompt --unstable --allow-ffi --allow-net=0.0.0.0:5050,cdn.jsdelivr.net --allow-read --allow-write=./ --allow-env=DENO_DIR

import { file_server } from "./backend/ts/dep.ts"
import * as build     from "./backend/ts/build.ts"
import { TS_Backend } from "./frontend/ts/logic/backends/torchscript.ts";
import * as util      from "./frontend/ts/util.ts";

import * as segm      from "./frontend/ts/logic/segmentation.ts"


const port = 5050;


async function handle_index(request:Request): Promise<Response> {
    //TODO: re-compile index only if this is dev mode
    const buildstatus: true|Error = await build.compile_and_copy_default()
    if(buildstatus instanceof Error){
        console.log('Failed to build:\n', buildstatus)
        return new Response(null, {status:500})
    }
    return file_server.serveFile(request, 'static/index.html')
}

function handle_static(request:Request): Promise<Response> {
    return file_server.serveDir(request, {
        fsRoot:  "static",
        //urlRoot: "",
    })
}

async function handle_process_image(request:Request): Promise<Response> {
    // - get image from request and cache (for debugging or i dont know)
    const files:FormDataEntryValue[] = (await request.formData()).getAll('files')
    if(files.length == 0)
        return new Response('No input files provided', {status:400})
    else if (files.length > 1)
        return new Response('Cannot process more than one file', {status:500})
    const file:FormDataEntryValue = files[0]!
    if(!(file instanceof File))
        return new Response('Expected a file as input', {status:400})
    
    console.log('>> Processing file: ', file.name)
    const data:Uint8Array = new Uint8Array(await file.arrayBuffer())
    Deno.writeFileSync(`request.DELETE.jpg`, data)

    //return new Response(null, {status:501})

    // - TODO: get options/model
    const settings = {
        active_models: {
            detection:"../../traininglib.onnx/agar.inference.ts.pt.zip"
        }
    }

    // - process
    const backend = new TS_Backend(segm.SegmentationResult, settings)
    const result = await backend.process(file)
    if(result.status == 'processed'){
        console.log('Processing succeeded')
        const exported:Record<string,File>|null = await result.export()!

        // - save in cache folder for debugging
        // - zip
        // deno-lint-ignore no-inferrable-types
        const classmap_path:string = `${file.name}.classmap.png`
        Deno.writeFileSync(
            `static/${classmap_path}`,
            new Uint8Array(await (exported!['classmap.png']!).arrayBuffer())
        )
        const responsedata = {
            classmap: classmap_path
        }
        return new Response(JSON.stringify(responsedata), {status:200})
    } else {
        console.log('Processing failed: ', result.raw)
        return new Response(null, {status:500})
    }
}

function handle_404(_request:Request): Response {
    return new Response(null, {status:404})
}


type ServeHandler = (request:Request) => Response|Promise<Response>;

const ROUTING_TABLE: Record<string, ServeHandler > = {
    '^/$':                handle_index,
    '^/process_image/?$': handle_process_image,
    //settings?
    //clear_cache?
    //training (+cancel/save?)
    ///models/ & available_models.txt/json

    // everything else interpreted as a static file
    '^/':                 handle_static,

}



async function route_request(request: Request, info:Deno.ServeHandlerInfo): Promise<Response> {
    const url = new URL(request.url)
    for( const [pattern, handler] of Object.entries(ROUTING_TABLE) ){
        if(new RegExp(pattern).test(url.pathname)){
            return handler(request);
        }
    }
    //should not get here
    return handle_404(request)
};


if(import.meta.main){
    //TODO: check permissions
    //TODO: try/catch?
    const server:Deno.HttpServer = Deno.serve({ port }, route_request);

    Deno.addSignalListener("SIGINT", async () => {
        console.log('Shutdown')
        server.shutdown();
        await util.wait(100)
        Deno.exit()
    });

    await server.finished;
    console.log('Exit')
    Deno.exit()
}

