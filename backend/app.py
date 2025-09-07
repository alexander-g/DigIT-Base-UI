import argparse
import atexit
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import typing as tp
import webbrowser
import warnings
warnings.simplefilter('ignore')

import flask

parser = argparse.ArgumentParser()
parser.add_argument('--host',    type=str, default='localhost')
parser.add_argument('--port',    type=int, default=5000)
parser.add_argument('--debug',   default=sys.argv[0].endswith('.py'))

import backend

from .paths import (
    path_to_this_module,
    path_to_main_module,
    get_instance_path,
    get_static_path,
    get_cache_path,
    get_models_path,
    get_frontend_folders,
)

def is_debug() -> bool:
    return sys.argv[0].endswith('.py')


class App(flask.Flask):
    def __init__(self, deno_cfg: 'DenoConfig' = None, **kw):
        self.is_debug    = is_debug()
        is_second_start  = (os.environ.get("WERKZEUG_RUN_MAIN") == 'true')
        do_not_reload    = (os.environ.get('DO_NOT_RELOAD',None) is not None)
        is_reloader      = (self.is_debug and not is_second_start) and not do_not_reload
        self.is_reloader = is_reloader

        super().__init__(
            'reloader' if is_reloader else __name__,
            root_path          = path_to_main_module(),
            static_folder      = get_static_path(), 
            instance_path      = get_instance_path(),
            #template_folder   = <not-used>
            static_url_path    = '/',
            **kw
        )
        if is_reloader:
            return
        

        self.frontend_folders = get_frontend_folders()
        self.cache_path       = get_cache_path()
        print('Root path:       ', self.root_path)
        print('Models path:     ', get_models_path())
        print('Static path:     ', self.static_folder)
        print('Cache path:      ', self.cache_path)
        if self.is_debug:
            print('Frontend paths:  ', self.frontend_folders)
        print()

        if self.is_debug:
            self.deno_cfg = deno_cfg or DenoConfig()

        setup_cache(self.cache_path)
        self.recompile_static()

        @self.route('/')
        def index():
            self.recompile_static()
            setup_cache(self.cache_path)
            return self.send_static_file('index.html')
        
        @self.route('/images/<path:path>')
        def images(path):
            print(f'Download: {get_cache_path(path)}')
            return flask.send_from_directory(self.cache_path, path)

        @self.route('/models/<path:path>')
        def models(path):
            print(f'Model download: {path}')
            return flask.send_from_directory(get_models_path(), path)

        @self.route('/file_upload', methods=['POST'])
        def file_upload():
            files = flask.request.files.getlist("files")
            for f in files:
                print('Upload: %s'%f.filename)
                fullpath = get_cache_path(os.path.basename(f.filename) )
                f.save(fullpath)
            return 'OK'

        @self.route('/delete_image/<path:path>')
        def delete_image(path):
            fullpath = get_cache_path(path)
            print('DELETE: %s'%fullpath)
            if os.path.exists(fullpath):
                os.remove(fullpath)
            return 'OK'
        
        @self.route('/resize_image', methods=['POST'])
        def resize_image():
            '''Convert bigtiff to jpeg'''
            files = flask.request.files.getlist("files")
            if len(files) != 1:
                flask.abort(400, 'No Files')
            
            try:
                W = int(flask.request.form.get('width'))
                H = int(flask.request.form.get('height'))
                new_size = (W,H)
                lossless = flask.request.form.get('lossless', type=json.loads)
            except:
                flask.abort(400, 'No Size')

            f = files[0]            
            fullpath = \
                self.path_in_cache(os.path.basename(f.filename), abort_404=False)
            temppath = fullpath + '.tmp'
            # save continuously as data arrives
            with open(temppath, 'wb') as tempf:
                shutil.copyfileobj(f.stream, tempf, length=64*1024)
            os.replace(temppath, fullpath)

            jpeg_path, [og_height, og_width] = \
                backend.processing.resize_image(fullpath, new_size, jpeg_ok=not lossless)
            
            response = flask.send_file(jpeg_path)
            response.headers['X-Original-Image-Width']  = og_width
            response.headers['X-Original-Image-Height'] = og_height
            return response

        
        self.settings = backend.settings.Settings()
        @self.route('/settings', methods=['GET', 'POST'])
        def get_set_settings():
            if flask.request.method=='POST':
                self.settings.set_settings(flask.request.get_json(force=True))
                return 'OK'
            elif flask.request.method=='GET':
                return flask.jsonify(self.settings.get_settings_as_dict())
        
        @self.route('/stream')
        def stream():
            def generator():
                message_queue = backend.pubsub.PubSub.subscribe()
                while 1:
                    event, message = message_queue.get()
                    #TODO: make sure message does not contain \n
                    yield f'event:{event}\ndata: {json.dumps(message)}\n\n'
            return flask.Response(generator(), mimetype="text/event-stream")
        
        @self.route('/shutdown')
        def shutdown():
            import signal
            os.kill(os.getpid(), signal.SIGINT)
            return 'OK'

        @self.route('/clear_cache')
        def clear_cache():
            setup_cache(self.cache_path)
            return 'OK'
        
        self.route('/process_image/<imagename>')(self.process_image)
        self.route('/training', methods=['POST'])(self.training)
        self.route('/save_model')(self.save_model)
        self.route('/stop_training')(self.stop_training)

        @self.after_request
        def add_header(r):
            """Prevent caching."""
            r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            r.headers["Pragma"]        = "no-cache"
            r.headers["Expires"]       = "0"
            r.headers['Cache-Control'] = 'public, max-age=0'
            return r

        @self.after_request
        def ts_to_js_mimetype_corrections(response:flask.Response):
            #NOTE: this contains the filename, but is this always present?
            dispo = response.headers.get('Content-Disposition', '')

            if dispo.endswith('.ts') or dispo.endswith('.tsx'):
                response.mimetype = 'application/javascript'
            return response

        if not self.is_debug:
            with self.app_context():
                print('Flask started')
                webbrowser.open('http://localhost:5000', new=2)
    
    def process_image(self, imagename):
        full_path = get_cache_path(imagename)
        if not os.path.exists(full_path):
            flask.abort(404)
                
        result = backend.processing.process_image(full_path, self.settings)
        return flask.jsonify(result)
    
    def training(self):
        imagefiles = dict(flask.request.form.lists())['filenames[]']
        imagefiles = [get_cache_path(fname) for fname in imagefiles]
        if not all([os.path.exists(fname) for fname in imagefiles]):
            flask.abort(404)
        
        model = self.settings.models['detection']
        #indicate that the model is not the same as before
        self.settings.active_models['detection'] = ''
        def on_progress(p):
            backend.pubsub.PubSub.publish({'progress':p,  'description':'Training...'}, event='training')
        ok = model.start_training(imagefiles=[], targetfiles=[], callback=on_progress)
        return 'OK' if ok else 'INTERRUPTED'
    
    def save_model(self):
        newname    = flask.request.args['newname']
        print('Saving training model as:', newname)
        modeltype = flask.request.args.get('training_type', 'detection')
        path      = f'{get_models_path()}/{modeltype}/{newname}'
        self.settings.models[modeltype].save(path)
        self.settings.active_models[modeltype] = newname
        return 'OK'

    def stop_training(self):
        #XXX: brute-force approach to avoid boilerplate code
        for m in self.settings.models.values():
            if hasattr(m, 'stop_training'):
                m.stop_training()
        return 'OK'
    
    def recompile_static(self, force=False):
        '''Compile frontend into the static folder from which flask serves files'''
        if not self.is_debug and not force:
            #only in development and during build, not in release
            return

        subprocess.check_call(self.deno_cfg.build_cmd, shell=True)
    
    def run(self, parse_args=True, **args):
        if parse_args:
            args = parser.parse_args()
            args = dict(host=args.host, port=args.port, debug=args.debug)
        super().run(**args)


def setup_cache(cache_path):
    shutil.rmtree(cache_path, ignore_errors=True)
    os.makedirs(cache_path)
    atexit.register(lambda: shutil.rmtree(cache_path, ignore_errors=True))


class DenoConfig:
    def __init__(
        self,
        root:      tp.Optional[str] = None, 
        executable:tp.Optional[str] = None,
        configfile:tp.Optional[str] = None,
        buildfile: tp.Optional[str] = None,
        static:    tp.Optional[str] = None,
        srcdirs :  tp.Optional[str] = None,
        index_tsx: tp.Optional[str] = None,
        dep_ts:    tp.Optional[str] = None,
        copy_globs:tp.Optional[str] = None,
        assets:    tp.Optional[str] = None,
    ):
        #path to the root of the base project
        base_root = os.path.realpath(
            os.path.join(path_to_this_module(), '..')
        )
        #path to the root of the downstream project
        self.root       = root or base_root
        if executable is None:
            scriptname =  ('deno.bat' if sys.platform == 'win32' else 'deno.sh')
            executable = os.path.join(self.root, scriptname)
            if not os.path.exists(executable):
                executable = os.path.join(base_root, scriptname)
                if not os.path.exists(executable):
                    raise RuntimeError('Cannot find deno.')
        self.executable = executable
        self.configfile = configfile or os.path.join(base_root, 'deno.jsonc')
        self.buildfile  = buildfile or os.path.join(base_root, 'backend/ts/build.ts')
        self.static     = static    or os.path.join(self.root, 'static/')
        self.srcdirs    = srcdirs   or os.path.join(self.root, 'frontend/')
        self.index_tsx  = index_tsx or 'ts/index.tsx'
        self.dep_ts     = dep_ts    or 'ts/dep.ts'
        self.assets     = assets    or os.path.join(self.root, 'assets/')


        self.build_cmd = (
            f'{self.executable} run' 
            f' --config {self.configfile}'
            f' --allow-read={self.root}'
            f' --allow-write={self.static}'
            f' --allow-run=deno'
            f' --no-prompt'
            f' --cached-only'
            f' {self.buildfile}'
            f' --static={self.static}'
            f' --srcdirs={self.srcdirs}'
            f' --index_tsx={self.index_tsx}'
            f' --dep_ts={self.dep_ts}'
            + (f' --copy_globs={copy_globs}' if copy_globs else '')
        )


