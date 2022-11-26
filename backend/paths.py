import os, sys

def path_to_this_module():
    return os.path.dirname(os.path.realpath(__file__))

def path_to_main_module():
    path = os.environ.get('ROOT_PATH',None)
    path = path or os.path.dirname(os.path.realpath(sys.modules['__main__'].__file__))
    return path

def get_instance_path():
    path = os.environ.get('INSTANCE_PATH',None)
    return path or path_to_main_module()

def get_static_path():
    #stores compiled html/javascript/etc files
    return os.path.join(get_instance_path(), 'static')

def get_cache_path(tail=''):
    #stores images and other data used for processing
    return os.path.join( get_instance_path(), 'cache', tail )

def get_models_path():
    #stores pretrained models
    return os.path.join( get_instance_path(), 'models' )

def get_template_folders():
    return [
        os.path.join(path_to_main_module(), 'templates'),            #subproject
        os.path.join(path_to_this_module(), '..', 'templates'),      #base
    ]

def get_frontend_folders():
    return [
        os.path.join(path_to_this_module(), '..', 'frontend'),       #base
        os.path.join(path_to_main_module(), 'frontend'),             #subproject
    ]
