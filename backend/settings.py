import json, os, glob, copy
from . import app

import torch

class Settings:
    FILENAME = 'settings.json'   #FIXME: hardcoded

    def __init__(self):
        self.models        = dict()  #python objects
        self.active_models = dict()  #modelnames
        self.set_settings( self.load_settings_from_file(), save=False )

    @classmethod
    def get_defaults(cls):
        available_models = cls.get_available_models()
        first_or_none    = lambda x: x[0] if len(x) else None
        return dict( active_models = dict([
            (modeltype, first_or_none(models)) for modeltype, models in available_models.items()
        ] ) )

    def load_settings_from_file(self):
        s = self.get_defaults()
        if os.path.exists(self.FILENAME):
            s.update(json.load(open(self.FILENAME)))
            #self.set_settings(s)
        else:
            print(f'[WARNING] Settings file {self.FILENAME} not found.')
            #self.set_settings(s, save=False)
        return s

    def set_settings(self, s, save=True):
        print('Settings: ', s)
        for modeltype, modelname in s.get('active_models', {}).items():
            if self.active_models.get(modeltype, None) != modelname:
                self.models[modeltype] = self.load_model(modeltype, modelname)
        self.__dict__.update( copy.deepcopy(s) )

        if save:
            previous_s = self.load_settings_from_file()
            for modeltype, modelname in s['active_models'].items():
                if modelname == '':  #unsaved
                    s['active_models'][modeltype] = previous_s['active_models'].get(modeltype)
            json.dump( s, open('settings.json','w'), indent=2) 

    def get_settings_as_dict(self):
        #s = self.load_settings_from_file()
        s = self.get_defaults()
        s = dict([ (k,getattr(self,k,v)) for k,v in s.items() ])
        return {
            'settings'         : s,
            'available_models' : self.get_available_models(with_properties=True)
        }

    @classmethod
    def get_available_models(cls, with_properties=False):
        modelsdir  = app.get_models_path()
        contents   = glob.glob(os.path.join(modelsdir, '*'))
        modeltypes = [os.path.basename(x) for x in contents if os.path.isdir(x)]
        models     = dict()
        for modeltype in modeltypes:
            modelfiles, modelnames = [], []
            for ending in ['.pt.zip', '.pt', '.pkl']:       #TODO: remove pkl files
                _modelfiles = glob.glob(os.path.join(modelsdir, modeltype, '*'+ending))
                modelfiles += _modelfiles
                modelnames += [os.path.basename(m)[:-len(ending)] for m in _modelfiles]
            modelnames = sorted(modelnames)

            if with_properties:
                modelprops        = [cls.get_model_properties(m) for m in modelfiles]
                models[modeltype] = [{'name':n, 'properties':p} for n,p in zip(modelnames, modelprops)]
            else:
                models[modeltype] = modelnames
        return models

    @classmethod
    def load_model(cls, modeltype, modelname):
        import pickle
        print(f'Loading model {modeltype}/{modelname}')
        models_dir = app.get_models_path()
        endings    = ['.pt.zip', '.pt', '.pkl']
        for ending in endings:
            path  = os.path.join(models_dir, modeltype, f'{modelname}{ending}')
            if os.path.exists(path):
                return cls.load_modelfile(path)
        #no file with either of the endings exists
        print(f'[ERROR] model "{modeltype}/{modelname}" not found.')
        return
    
    @staticmethod
    def load_modelfile(file_path:str) -> "torch.nn.Module":
        if file_path.endswith('.pt.zip') or file_path.endswith('.pt'):
            return torch.package.PackageImporter(file_path).load_pickle('model', 'model.pkl', map_location='cpu')
        elif file_path.endswith('.pkl'):
            import pickle
            return pickle.load(open(file_path, 'rb'))

    @staticmethod
    def get_model_properties(modelfile:str) -> dict:
        if modelfile.endswith('.pt.zip') or modelfile.endswith('.pt'):
            try:
                import torch
                classes = torch.package.PackageImporter(modelfile).load_text('model', 'class_list.txt').split('\n')
                classes = [c for c in classes if c.lower() not in ['', 'other']]
                return {'known_classes': classes}
            except RuntimeError:
                return None
        else:
            return None



import urllib.request

DEFAULT_PRETRAINED_FILE = os.path.join(app.get_models_path(), 'pretrained_models.txt')

def parse_pretrained_models_file(path=DEFAULT_PRETRAINED_FILE) -> dict:
    lines         = open(path).read().strip().split('\n')
    name2urls     = dict([ map(str.strip, line.split(' : ')) for line in lines])
    return name2urls

def ensure_pretrained_models() -> None:
    models_path = app.get_models_path()
    for destination, url in parse_pretrained_models_file().items():
        destination = os.path.join(models_path, destination)
        if os.path.exists(destination):
            continue

        print(f'Downloading {url} ...')
        with urllib.request.urlopen(url) as f:
            os.makedirs( os.path.dirname(destination), exist_ok=True )
            open(destination, 'wb').write(f.read())



