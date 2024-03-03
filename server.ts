#!./deno.sh run --no-prompt --allow-net=0.0.0.0:5050 --allow-read=static

import { file_server } from "./backend/ts/dep.ts"
import { TS_Backend } from "./frontend/ts/logic/backends/torchscript.ts";

const port = 5050;


function handle_banana(_request:Request): Response {
    return new Response('Banana!', {status:200})
}

function handle_index(request:Request): Promise<Response> {
    //TODO: re-compile index if this is in dev mode
    return file_server.serveFile(request, 'static/index.html')
}

function handle_static(request:Request): Promise<Response> {
    return file_server.serveDir(request, {
        fsRoot:  "static",
        urlRoot: "static",
    })
}

async function handle_process_image(request:Request): Promise<Response> {
    // - get image from request and cache (for debugging or i dont know)
    const data = new Uint8Array(await request.arrayBuffer())
    Deno.writeFileSync(`cache/request.zip?`, data)
    // - get options/model
    const settings = {}
    // - process
    const backend = new TS_Backend()
    const result = await backend.process()
    if(result.status == 'processed'){
        //...
    }
    // - save in cache folder for debugging
    // - zip
}

function handle_404(_request:Request): Response {
    return new Response(null, {status:404})
}


type ServeHandler = (request:Request) => Response|Promise<Response>;

const ROUTING_TABLE: Record<string, ServeHandler > = {
    '^/banana':        handle_banana,
    '^/$':             handle_index,
    '^/static/':       handle_static,
    '^/process_image': handle_process_image,
    //settings?
    //clear_cache?
    //training (+cancel/save?)
    ///models/ & available_models.txt/json

}



async function route_request(request: Request, info:Deno.ServeHandlerInfo): Promise<Response> {
    const url = new URL(request.url)
    for( const [pattern, handler] of Object.entries(ROUTING_TABLE) ){
        if(new RegExp(pattern).test(url.pathname)){
            return handler(request);
        }
    }
    return handle_404(request)
};


if(import.meta.main){
    //TODO: check permissions
    //TODO: try/catch?
    const server:Deno.HttpServer = Deno.serve({ port }, route_request);

    Deno.addSignalListener("SIGINT", () => {
        console.log('Shutdown')
        server.shutdown();
    });

    await server.finished;
    console.log('Exit')
}

