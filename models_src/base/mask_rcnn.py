import typing as tp
import time, os
import warnings
#pytorch is too noisy
warnings.simplefilter('ignore')

import numpy as np
import torch, torchvision
import PIL.Image




class MaskRCNN(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.basemodule = torchvision.models.detection.maskrcnn_resnet50_fpn(
            pretrained = True, progress = False, box_score_thresh = 0.5
        )
    
    def forward(self, x):
        return self.basemodule(x)
    
    def load_image(self, path):
        return PIL.Image.open(path) / np.float32(255)

    def process_image(self, x:str) -> tp.Dict:
        if isinstance(x, str):
            x = self.load_image(x)
        if not torch.is_tensor(x):
            x = torchvision.transforms.ToTensor()(x)

        self.eval()
        with torch.no_grad():
            y = self(x[None])
        
        y = y[0]['masks'][:,0].cpu().numpy().max(0)
        y = ( (y>0.5) *255).astype('uint8')
        return y
    
    def save(self, destination:str) -> str:
        if not destination.endswith('.pt.zip'):
            destination += '.pt.zip'
        destination = time.strftime(destination)

        with torch.package.PackageExporter(destination) as pe:
            interns = [__name__.split('.')[-1]]
            pe.intern(interns)
            pe.extern('**')
            pe.save_pickle('model', 'model.pkl', self)

        return destination



if __name__ == '__main__':
    m = MaskRCNN()
    destination = m.save('models/detection/%Y-%m-%d_mask_rcnn')
    print(destination)
