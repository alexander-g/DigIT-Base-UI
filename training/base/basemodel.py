import zipfile, os, time, pickle, pkgutil, sys
import numpy as np
import PIL.Image
import cloudpickle


#additional optional modules to import
import importlib
modules   = []
#[...]    =  [importlib.reload(importlib.import_module(m)) for m in modules]


class Model:
    def __init__(self):
        self.weights = np.sort(np.random.random(4))

    def load_image(self, path):
        return PIL.Image.open(path) / np.float32(255)
    
    def process_image(self, image):
        '''Dummy processing function'''
        if isinstance(image, str):
            image = self.load_image(image)
        result      = np.zeros( image.shape[:2], 'uint8' )
        y0,x0,y1,x1 = (self.weights * (image.shape[:2]+image.shape[:2])).astype(int)
        print(y0,x0,y1,x1)
        result[y0:y1,x0:x1] = 255

        print(f'Simulating image processing')
        for i in range(3):
            #TODO: progress callback
            time.sleep(0.5)
        return result

    def start_training(self, imagefiles, targetfiles, epochs=100, callback=None):
        print(f'Simulating training')
        self.stop_requested = False
        for i in range(3):
            if self.stop_requested:
                print('Stopping training')
                break
            self.weights = np.sort(np.random.random(4))
            callback( i/3 )
            time.sleep(1)
        callback( 1.0 )

    def stop_training(self):
        self.stop_requested = True

    def save(self, destination):
        for m in [__name__]+modules:
            if m in sys.modules:
                cloudpickle.register_pickle_by_value(sys.modules[m])
        if not destination.endswith('.pkl'):
            destination = destination+'.pkl'
        if isinstance(destination, str):
            destination = os.path.expanduser(destination)
            destination = time.strftime(destination)
        open(destination,'wb').write(cloudpickle.dumps(self))
        return destination
    
