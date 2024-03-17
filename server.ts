#!./deno.sh run --no-prompt --unstable --allow-ffi --allow-net=0.0.0.0:5050,cdn.jsdelivr.net --allow-read --allow-write=./ --allow-env=DENO_DIR

import { file_server, path, fs } from "./backend/ts/dep.ts"
import * as build     from "./backend/ts/build.ts"

import { TS_Backend } from "./frontend/ts/logic/backends/torchscript.ts";
import * as util      from "./frontend/ts/util.ts";
import * as files     from "./frontend/ts/logic/files.ts";

import * as segm      from "./frontend/ts/logic/segmentation.ts"
import * as instseg   from "./frontend/ts/logic/instancesegmentation.ts"


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

function handle_404(_request:Request): Response {
    return new Response(null, {status:404})
}


type ServeHandler = (request:Request) => Response|Promise<Response>;






export class App<R extends files.Result> {
    ROUTING_TABLE: Record<string, ServeHandler > = {
        '^/$':                handle_index,
        '^/process_image/?$': this.handle_process_image.bind(this),
        '^/settings/?$':      this.handle_settings.bind(this),
        //clear_cache?
        //training (+cancel/save?)
        ///models/ & available_models.txt/json
    
        // everything else interpreted as a static file
        '^/':                 handle_static,
    
    }

    constructor(
        private rootpath:    string,
        private ResultClass: files.ResultClassInterface<R>,
        private ts_lib_path: string,
        private models_dir:  string,
    ){}

    async run(): Promise<void> {
        //TODO: check permissions
        //TODO: try/catch?
        const server:Deno.HttpServer = Deno.serve(
            { port }, 
            this.route_request.bind(this)
        );

        Deno.addSignalListener("SIGINT", async () => {
            console.log('Shutdown')
            //TODO: use AbortController
            server.shutdown();
            await util.wait(100)
            Deno.exit()
        });

        await server.finished;
        console.log('Exit')
        Deno.exit()
    }

    async handle_process_image(request:Request): Promise<Response> {
        //TODO: cache file
        const inputfile:File|Response = await _get_inputfile_from_request(request)
        if(inputfile instanceof Response)
            return inputfile as Response;
        
        console.log('>> Processing file: ', inputfile.name)

        // - TODO: get options/model
        const model_paths:string[] = Array.from(
            fs.expandGlobSync(
                path.join(this.models_dir, 'detection', '*.pt.zip')
            )
        ).map(
            (entry: fs.WalkEntry) => entry.path
        )
        const settings = {
            active_models: {
                //detection:"../../traininglib.onnx/agar.inference.ts.pt.zip"
                detection:model_paths[0]!
            }
        }

        // - process
        //const backend = new TS_Backend(segm.SegmentationResult, settings)
        const backend = new TS_Backend(
            this.ResultClass, 
            settings,
            this.ts_lib_path,
            this.models_dir,
        )
        const result:files.Result = await backend.process(inputfile)
        if(result.status != 'processed'){
            console.log('>> Processing failed: ', result.raw)
            return new Response(null, {status:500})
        }
        //else
    
        console.log('>> Processing succeeded')
        return _result_to_response(result)
    }

    handle_settings(_request:Request): Response {
        //TODO: GET/SET
        const settings = {
            active_models: {
                detection:"../../traininglib.onnx/agar.inference.ts.pt.zip"
            }
        }
        
        const models:string[] = Array.from(
            fs.expandGlobSync(
                path.join(this.models_dir, 'detection', '*.pt.zip')
            )
        ).map(
            (entry: fs.WalkEntry) => path.basename(entry.path)
        )

        const available_models = {
            //detection: [{name:'agar.inference.ts'}]
            detection: models.map( (name:string) => ({name:name}) )
        }
        const payload = {settings, available_models}
        return new Response(JSON.stringify(payload), {status:200})
    }

    async route_request(request: Request): Promise<Response> {
        const url = new URL(request.url)
        for( const [pattern, handler] of Object.entries(this.ROUTING_TABLE) ){
            if(new RegExp(pattern).test(url.pathname)){
                return handler(request);
            }
        }
        //should not get here
        return handle_404(request)
    };
}

/** Make sure the request contained a single input file for processing.
 *  Returns the input file or an error response on failure */
async function _get_inputfile_from_request(request:Request): Promise<File|Response> {
    const files_fs:FormDataEntryValue[] = (await request.formData()).getAll('files')
    if(files_fs.length == 0)
        return new Response('No input files provided', {status:400})
    else if (files_fs.length > 1)
        return new Response('Cannot process more than one file', {status:500})
    const inputfile:FormDataEntryValue = files_fs[0]!
    if(!(inputfile instanceof File))
        return new Response('Expected a file as input', {status:400})
    
    return inputfile;
}

async function _result_to_response(result:files.Result): Promise<Response> {
    const exported:Record<string,File>|null = await result.export();
    if(exported === null || result.inputname === null)
        return new Response("Result export error", {status:500});

    const zipped:File|Error 
        = await files.combine_exports(exported, result.inputname, true);
    if(zipped instanceof Error)
        return new Response((zipped as Error).message, {status:500});
    
    return new Response(zipped, {status:200})

}


if(import.meta.main){
    const app = new App(
        "./", 
        instseg.InstanceSegmentationResult,
        path.fromFileUrl(
            import.meta.resolve('./assets/libTSinterface.so'),
        ),
        path.fromFileUrl(
            import.meta.resolve('./models/')
        )
    );
    await app.run()
}


