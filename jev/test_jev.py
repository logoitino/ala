"""Quick check that Jev is installed and your API key works."""
from dotenv import load_dotenv
from typesafe_sdk import Choice, Noul, Score, TypeSafeClient

load_dotenv()  # reads TYPESAFE_API_KEY from .env
client = TypeSafeClient()  # uses jev-latest by default

play = "Late in the 4th quarter, down by 2, the point guard drives, draws contact and hits a floater as the buzzer sounds."

response = client.system_one(
    state=play,
    questions={
        "sport": Choice(
            instructions="Which sport is being described",
            criteria={
                "basketball": "Hoops, dribbling, shots at a rim",
                "football": "Downs, touchdowns, yards",
                "soccer": "Goals, pitch, keepers",
            },
        ),
        "excitement": Score(
            instructions="How dramatic the moment is",
            criteria=["Routine play", "Notable moment", "Game-deciding highlight"],
        ),
        "game_winner": Noul(instructions="The play wins or ties the game at the end"),
    },
)

print("sport:      ", response.answers["sport"].choice)
print("excitement: ", response.answers["excitement"].score)
print("game_winner:", response.answers["game_winner"].noul)
