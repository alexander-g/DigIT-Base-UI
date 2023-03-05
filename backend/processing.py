from . import GLOBALS
from .app import get_cache_path

import os
import PIL.Image

def process_image(imagepath, settings):
    with GLOBALS.processing_lock:
        model    = settings.models['detection']
        result   = model.process_image(imagepath)
    
    output_filename = os.path.basename(imagepath)+'.segmentation.png'
    output_path     = os.path.join(
        get_cache_path(), output_filename
    )
    classmap = result['classmap']
    PIL.Image.fromarray( classmap ).save(output_path)
    return {
        'segmentation' : output_filename,
        'classmap'     : output_filename,
        'boxes'        : result['boxes'].tolist(),
        'labels'       : result['labels'].tolist(),
    }
