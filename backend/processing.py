import os
import typing as tp

from . import GLOBALS
from .app import get_cache_path
from .imageutils import is_tiff

import PIL.Image
import tifffile

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
    labels   = [str(l) for l in result['labels']]
    return {
        'segmentation' : output_filename,
        'classmap'     : output_filename,
        'boxes'        : result['boxes'].tolist(),
        'labels'       : labels,
    }



class ImageSize(tp.NamedTuple):
    width:  int
    height: int


def resize_image(
    path:     str, 
    new_size: ImageSize, 
    jpeg_ok:  bool,
) -> tp.Tuple[str, ImageSize]:

    if is_tiff(path):
        # tifffile is faster than PIL.Image.open
        im = PIL.Image.fromarray(tifffile.imread(path))
    else:
        im = PIL.Image.open(path)
    
    og_size = ImageSize(*im.size)
    mode    = PIL.Image.BICUBIC if jpeg_ok else PIL.Image.NEAREST
    im = im.convert('RGB').resize(new_size, resample=mode)

    ending = '.jpg' if jpeg_ok else '.png'
    output_path = path + ending
    im.save(output_path)

    return output_path, og_size



