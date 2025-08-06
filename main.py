import pandas as pd
from PIL import Image
import io
import matplotlib.pyplot as plt
import os
import random
import uuid
import re

from fastapi import FastAPI, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from langchain_ollama import ChatOllama
import json

from math import radians, sin, cos, sqrt, atan2, degrees


# df = pd.read_parquet("hf://datasets/Aniket96/country-flags-dataset/data/train-00000-of-00001.parquet")

# os.makedirs("flags", exist_ok=True)

# for i in range (0,194):

#     image_bytes = df.loc[i,"image"]['bytes']
#     image = Image.open(io.BytesIO(image_bytes))
#     filename = df.loc[i,"label"].replace(" ","_")+".png"
#     image.save(os.path.join("flags",filename))

df2 = pd.read_csv("coordinates.csv")

flags_folder = "flags"
countries = {
    flag.replace("_", " ").removesuffix(".png"): flag
    for flag in os.listdir(flags_folder)
}
country_names = list(countries.keys())
country = ""
chunks = []
chunks_duplicate = []
temp_chunks = ["", "", "", "", "", ""]
flag = ""
guesses = []
lives = 6

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/flags", StaticFiles(directory="flags"), name="flags")
app.mount("/temp_chunks", StaticFiles(directory="temp_chunks"), name="temp_chunks")


@app.get("/random-country", status_code=status.HTTP_200_OK)
async def random_country():
    global country, chunks, flag, temp_chunks, chunks_duplicate, guesses, lives
    for filename in os.listdir("temp_chunks"):
        filepath = os.path.join("temp_chunks", filename)
        os.remove(filepath)
    chunks = []
    temp_chunks = ["", "", "", "", "", ""]
    chunks_duplicate = []
    guesses = []
    lives = 6
    country = random.choice(country_names)
    flag = "http://localhost:8000/flags/" + countries[country]
    filename = os.path.join("flags", countries[country])
    chunks = split_image_to_chunks(filename)
    chunks_duplicate = chunks.copy()


def split_image_to_chunks(img_path: str):
    os.makedirs("temp_chunks", exist_ok=True)
    img = Image.open(img_path)
    width, height = img.size
    chunk_width = width // 3
    chunk_height = height // 2
    chunks = []

    for row in range(2):
        for col in range(3):
            left = col * chunk_width
            upper = row * chunk_height
            right = left + chunk_width
            lower = upper + chunk_height

            box = (left, upper, right, lower)
            cropped_img = img.crop(box)

            chunk_filename = f"{uuid.uuid4().hex}.png"
            chunk_path = os.path.join("temp_chunks", chunk_filename)
            cropped_img.save(chunk_path)
            chunks.append("http://localhost:8000/temp_chunks/" + chunk_filename)
    return chunks


@app.post("/countries-list", status_code=status.HTTP_200_OK)
async def countries_list(guess: str):
    countries_list = [
        country for country in country_names if guess.lower() in country.lower()
    ]
    if countries_list:
        return {"countries_list": countries_list}
    return {"countries_list": []}


def extract_json(text: str):
    match = re.search(r"{.*}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            raise ValueError("Found JSON block but couldn't parse it.")
    else:
        raise ValueError("No JSON block found in LLM response.")


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth's radius in kilometers

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    distance = R * c
    return distance


def calculate_bearing(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])

    dlon = lon2 - lon1
    x = sin(dlon) * cos(lat2)
    y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlon)

    initial_bearing = atan2(x, y)
    bearing_degrees = (degrees(initial_bearing) + 360) % 360

    return bearing_degrees


def bearing_to_direction(bearing):
    directions = [
        "north",
        "northeast",
        "east",
        "southeast",
        "south",
        "southwest",
        "west",
        "northwest",
    ]
    idx = round(bearing / 45) % 8
    return directions[idx]


@app.post("/guess", status_code=status.HTTP_200_OK)
async def guess(guess: str):
    global chunks, temp_chunks, guesses, lives
    if country.lower() == guess.lower().strip():
        return {
            "result": "correct",
            "chunks": chunks_duplicate,
            "guesses": guesses,
            "country": country,
        }
    if not any(guess.lower().strip() == c.lower() for c in country_names):
        raise HTTPException(status_code=404, detail="Not a country")
    else:
        chunk = random.choice(chunks)
        chunk_index = chunks_duplicate.index(chunk)
        chunks.remove(chunk)
        temp_chunks[chunk_index] = chunk

        lat1, lon1 = (
            df2.loc[df2["country"].str.lower() == guess.lower(), "latitude"].values[0],
            df2.loc[df2["country"].str.lower() == guess.lower(), "longitude"].values[0],
        )
        lat2, lon2 = (
            df2.loc[df2["country"].str.lower() == country.lower(), "latitude"].values[
                0
            ],
            df2.loc[df2["country"].str.lower() == country.lower(), "longitude"].values[
                0
            ],
        )

        distance = haversine_distance(lat1, lon1, lat2, lon2)
        bearing = calculate_bearing(lat1, lon1, lat2, lon2)
        direction = bearing_to_direction(bearing)

        guesses.append({"guess": guess, "distance": distance, "direction": direction})
        lives -= 1
        if lives != 0:
            return {
                "result": "wrong",
                "chunks": temp_chunks,
                "guesses": guesses,
                "lives": lives,
            }
        else:
            return {
                "result": "wrong",
                "chunks": temp_chunks,
                "guesses": guesses,
                "lives": lives,
                "country": country,
            }


llm = ChatOllama(model="llama3.2")


class Query(BaseModel):
    query: str


@app.post("/ai", status_code=status.HTTP_200_OK)
async def ai(query: Query):
    prompt = f"""
    You are an AI assistant helping a user guess a secret country. Your task is to provide subtle hints based on the user's query without ever revealing or confirming the country name. 

    Under no circumstances should you:
    - Say or repeat the name of the secret country
    - Confirm if a guess is correct or not
    - Use words like "yes", "correct", "that’s right", "you guessed it", or similar
    - Imply that the user is right, even indirectly

    Instead, do this:
    - Provide indirect clues related to:
    - Geography (location, neighboring countries)
    - Culture (language, traditions)
    - History (events or figures)
    - Climate or landmarks
    - If the user asks directly “Is it [country]?”, give a vague response that neither confirms nor denies the guess.
    - Always keep your responses short.

    Secret Country: {country}

    User's Query: {query.query}

    Respond with a **1-2 sentence** clue without revealing or confirming the country name. Never say the country’s name.
    """

    result = llm.invoke(prompt)
    return {"result": result.content}
