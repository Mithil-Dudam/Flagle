import pandas as pd
from PIL import Image
import io
import matplotlib.pyplot as plt
import os
import random

# df = pd.read_parquet("hf://datasets/Aniket96/country-flags-dataset/data/train-00000-of-00001.parquet")

# os.makedirs("flags", exist_ok=True)

# for i in range (0,194):

#     image_bytes = df.loc[i,"image"]['bytes']
#     image = Image.open(io.BytesIO(image_bytes))
#     filename = df.loc[i,"label"].replace(" ","_")+".png"
#     image.save(os.path.join("flags",filename))

flags_folder = "flags"
flag_names = [flag.replace("_"," ").removesuffix(".png") for flag in os.listdir(flags_folder) if flag.lower().endswith(('.png'))]

print(random.choice(flag_names))