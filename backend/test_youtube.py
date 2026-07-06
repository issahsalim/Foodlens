import requests
import json

url = "https://youtube-data8.p.rapidapi.com/search/"

querystring = {"q":"pizza recipe tutorial"}

headers = {
	"X-RapidAPI-Key": "7f3cc47f43msh9c618f2c0d96d06p1e4705jsn315ffb734532",
	"X-RapidAPI-Host": "youtube-data8.p.rapidapi.com"
}

response = requests.get(url, headers=headers, params=querystring)

print(json.dumps(response.json(), indent=2))
